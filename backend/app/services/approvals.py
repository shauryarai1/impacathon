"""Coordinator review: approve, modify, or reject match proposals."""

from fastapi import HTTPException, status
from sqlalchemy import select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import (
    AssignmentStatus,
    RecommendationStatus,
    ReportStatus,
    ReportType,
    SupplierVerification,
)
from app.core.utils import utcnow
from app.models.assignment import Assignment
from app.models.coordinator import Coordinator
from app.models.recommendation import Recommendation
from app.models.report import Report
from app.models.resource import Resource
from app.models.supplier import Supplier
from app.schemas.logistics import SupplierRead
from app.schemas.match import (
    ApprovalResult,
    ModifyRecommendationRequest,
    RecommendationRead,
)
from app.services.audit import add_audit
from app.services.presenters import (
    assignment_view,
    committed_quantity,
    recommendation_view,
)
from app.services.routing import find_accessible_route, route_is_accessible
from app.services.shortages import refresh_report_shortage, shortage_quantity


def get_recommendation(db: Session, recommendation_id: int) -> Recommendation:
    recommendation = db.get(Recommendation, recommendation_id)
    if recommendation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recommendation #{recommendation_id} not found",
        )
    return recommendation


def _serialize_approval_write(db: Session) -> None:
    """Serialize review decisions on SQLite.

    Stock and status updates are conditional, which handles duplicate approvals
    and stock races. This additional writer lock also protects the cross-resource
    outstanding-demand check: a second concurrent approval waits, then sees the
    first assignment's committed quantity. The service functions own the
    transaction and have no uncommitted caller changes at this point.
    """
    if settings.DATABASE_URL.startswith("sqlite"):
        if db.in_transaction():
            db.rollback()
        db.execute(text("BEGIN IMMEDIATE"))


def _validate_supply(
    db: Session,
    report: Report,
    resource: Resource,
    supplier: Supplier,
    quantity: int,
) -> None:
    if report.status != ReportStatus.VERIFIED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only verified reports can be approved for delivery",
        )
    if report.type != ReportType.NEED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only need reports can become delivery assignments",
        )
    if resource.category != report.category:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Resource category no longer matches the report category",
        )
    if supplier.verification_status != SupplierVerification.VERIFIED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Supplier is not verified",
        )
    if not supplier.active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Supplier is inactive",
        )
    if resource.quantity_available < quantity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Insufficient available stock: requested {quantity}, "
                f"available {resource.quantity_available}"
            ),
        )

    outstanding = report.quantity - committed_quantity(db, report.id)
    if quantity > outstanding:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Quantity exceeds the report's outstanding demand "
                f"({quantity} requested, {max(0, outstanding)} outstanding)"
            ),
        )


def approve_recommendation(
    db: Session,
    recommendation_id: int,
    coordinator: Coordinator,
    reason: str,
) -> ApprovalResult:
    """Atomically approve a proposal, reserve stock, and create an assignment."""
    _serialize_approval_write(db)
    recommendation = get_recommendation(db, recommendation_id)
    if recommendation.status != RecommendationStatus.PROPOSED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Recommendation #{recommendation_id} cannot be approved "
                f"(status={recommendation.status})"
            ),
        )

    report = db.get(Report, recommendation.report_id)
    resource = db.get(Resource, recommendation.resource_id)
    supplier = db.get(Supplier, recommendation.supplier_id)
    if report is None or resource is None or supplier is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recommendation references missing report, resource, or supplier data",
        )

    _validate_supply(db, report, resource, supplier, recommendation.quantity)

    if not route_is_accessible(db, recommendation.route_id):
        recommendation.needs_review = True
        recommendation.review_reason = "Route is blocked; rematch or choose another route"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The selected route is blocked; run matching again or modify the recommendation",
        )

    now = utcnow()
    before_state = {
        "recommendation_status": recommendation.status,
        "quantity": recommendation.quantity,
        "resource_available": resource.quantity_available,
        "resource_reserved": resource.quantity_reserved,
    }
    try:
        # Conditional status change prevents two coordinators approving the same
        # recommendation concurrently.
        result = db.execute(
            update(Recommendation)
            .where(
                Recommendation.id == recommendation_id,
                Recommendation.status == RecommendationStatus.PROPOSED.value,
            )
            .values(
                status=RecommendationStatus.APPROVED.value,
                reviewed_by_id=coordinator.id,
                reviewed_at=now,
                review_reason=reason,
                needs_review=False,
            )
            .execution_options(synchronize_session=False)
        )
        if result.rowcount != 1:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Recommendation was already reviewed",
            )

        # Conditional stock decrement prevents over-allocation and negative stock.
        stock_update = db.execute(
            update(Resource)
            .where(
                Resource.id == recommendation.resource_id,
                Resource.quantity_available >= recommendation.quantity,
            )
            .values(
                quantity_available=Resource.quantity_available - recommendation.quantity,
                quantity_reserved=Resource.quantity_reserved + recommendation.quantity,
            )
            .execution_options(synchronize_session=False)
        )
        if stock_update.rowcount != 1:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Insufficient stock available; another assignment may have reserved it",
            )

        assignment = Assignment(
            recommendation_id=recommendation.id,
            report_id=recommendation.report_id,
            resource_id=recommendation.resource_id,
            supplier_id=recommendation.supplier_id,
            route_id=recommendation.route_id,
            quantity=recommendation.quantity,
            status=AssignmentStatus.APPROVED.value,
            created_by_id=coordinator.id,
            approval_reason=reason,
            needs_review=False,
        )
        db.add(assignment)
        db.flush()
        db.refresh(resource)

        # If this approval consumed the stock that other pending proposals were
        # counting on, surface the conflict for human review instead of silently
        # leaving over-committed suggestions in the queue.
        competing = db.scalars(
            select(Recommendation).where(
                Recommendation.resource_id == resource.id,
                Recommendation.status == RecommendationStatus.PROPOSED.value,
                Recommendation.id != recommendation.id,
            )
        ).all()
        competing_total = sum(other.quantity for other in competing)
        flagged_competing: list[int] = []
        affected_report_ids = {report.id}
        for other in competing:
            affected_report_ids.add(other.report_id)
            if competing_total > resource.quantity_available:
                other.needs_review = True
                other.review_reason = (
                    f"Stock reduced by approved assignment #{assignment.id}; "
                    f"only {resource.quantity_available} unit(s) remain available "
                    f"for competing proposals totaling {competing_total} units."
                )
                flagged_competing.append(other.id)

        db.flush()
        for affected_report_id in sorted(affected_report_ids):
            affected_report = db.get(Report, affected_report_id)
            if affected_report is not None:
                refresh_report_shortage(db, affected_report)

        if flagged_competing:
            add_audit(
                db,
                action="competing_recommendations_flagged",
                entity_type="recommendation",
                entity_id=recommendation.id,
                actor_type="system",
                actor_name="matching",
                reason="Stock was committed by an approved assignment",
                details={
                    "approved_recommendation_id": recommendation.id,
                    "assignment_id": assignment.id,
                    "flagged_recommendation_ids": flagged_competing,
                },
            )

        add_audit(
            db,
            action="recommendation_approved",
            entity_type="recommendation",
            entity_id=recommendation.id,
            actor_type="coordinator",
            actor_name=coordinator.name,
            reason=reason,
            details={
                "before": before_state,
                "after": {
                    "recommendation_status": RecommendationStatus.APPROVED.value,
                    "assignment_id": assignment.id,
                    "assignment_status": AssignmentStatus.APPROVED.value,
                    "quantity": assignment.quantity,
                    "resource_available": resource.quantity_available,
                    "resource_reserved": resource.quantity_reserved,
                },
                "report_id": report.id,
                "resource_id": resource.id,
                "flagged_competing_recommendations": flagged_competing,
            },
        )
        add_audit(
            db,
            action="assignment_created",
            entity_type="assignment",
            entity_id=assignment.id,
            actor_type="coordinator",
            actor_name=coordinator.name,
            reason=reason,
            details={
                "recommendation_id": recommendation.id,
                "quantity": assignment.quantity,
                "inventory_reserved": True,
            },
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This recommendation already has an assignment",
        ) from exc

    db.expire_all()
    recommendation = get_recommendation(db, recommendation_id)
    assignment = db.scalar(
        select(Assignment).where(Assignment.recommendation_id == recommendation_id)
    )
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Assignment creation failed",
        )
    supplier = db.get(Supplier, recommendation.supplier_id)
    return ApprovalResult(
        recommendation=recommendation_view(
            db, recommendation, remaining_shortage=shortage_quantity(db, report)
        ),
        assignment=assignment_view(db, assignment),
        supplier=SupplierRead.model_validate(supplier) if supplier else None,
    )


def modify_recommendation(
    db: Session,
    recommendation_id: int,
    coordinator: Coordinator,
    payload: ModifyRecommendationRequest,
) -> RecommendationRead:
    """Change a pending proposal. It remains pending until a human approves it."""
    _serialize_approval_write(db)
    recommendation = get_recommendation(db, recommendation_id)
    if recommendation.status != RecommendationStatus.PROPOSED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Only proposed recommendations can be modified (status={recommendation.status})",
        )

    report = db.get(Report, recommendation.report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Report not found")

    new_quantity = payload.quantity or recommendation.quantity
    new_resource_id = payload.resource_id or recommendation.resource_id
    resource = db.get(Resource, new_resource_id)
    if resource is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource #{new_resource_id} not found",
        )
    supplier = db.get(Supplier, resource.supplier_id)
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Supplier not found")

    _validate_supply(db, report, resource, supplier, new_quantity)

    route_match = find_accessible_route(db, supplier.location, report.location)
    if route_match is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No accessible unblocked route connects this supplier to the report location",
        )

    if (
        new_quantity == recommendation.quantity
        and new_resource_id == recommendation.resource_id
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No change supplied for this recommendation",
        )

    before = {
        "resource_id": recommendation.resource_id,
        "supplier_id": recommendation.supplier_id,
        "quantity": recommendation.quantity,
        "route_id": recommendation.route_id,
    }
    recommendation.resource_id = resource.id
    recommendation.supplier_id = supplier.id
    recommendation.quantity = new_quantity
    recommendation.route_id = route_match.route.id if route_match.route else None
    recommendation.route_cost = route_match.cost
    recommendation.reviewed_by_id = coordinator.id
    recommendation.reviewed_at = utcnow()
    recommendation.needs_review = False
    recommendation.review_reason = f"Modified by coordinator: {payload.reason}"
    recommendation.rationale += (
        f"\nCoordinator modification: {new_quantity} unit(s) from "
        f"'{resource.name}' (#{resource.id}) via supplier '{supplier.name}', "
        f"route cost {route_match.cost:g}. Reason: {payload.reason}"
    )

    db.flush()
    refresh_report_shortage(db, report)
    add_audit(
        db,
        action="recommendation_modified",
        entity_type="recommendation",
        entity_id=recommendation.id,
        actor_type="coordinator",
        actor_name=coordinator.name,
        reason=payload.reason,
        details={
            "before": before,
            "after": {
                "resource_id": resource.id,
                "supplier_id": supplier.id,
                "quantity": new_quantity,
                "route_id": recommendation.route_id,
            },
            "assignment_created": False,
        },
    )
    db.commit()
    db.expire_all()
    recommendation = get_recommendation(db, recommendation_id)
    return recommendation_view(
        db, recommendation, remaining_shortage=shortage_quantity(db, report)
    )


def reject_recommendation(
    db: Session,
    recommendation_id: int,
    coordinator: Coordinator,
    reason: str,
) -> RecommendationRead:
    _serialize_approval_write(db)
    recommendation = get_recommendation(db, recommendation_id)
    if recommendation.status != RecommendationStatus.PROPOSED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Only proposed recommendations can be rejected (status={recommendation.status})",
        )

    report = db.get(Report, recommendation.report_id)
    result = db.execute(
        update(Recommendation)
        .where(
            Recommendation.id == recommendation_id,
            Recommendation.status == RecommendationStatus.PROPOSED.value,
        )
        .values(
            status=RecommendationStatus.REJECTED.value,
            reviewed_by_id=coordinator.id,
            reviewed_at=utcnow(),
            review_reason=reason,
            needs_review=False,
        )
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recommendation was already reviewed",
        )

    if report is not None:
        refresh_report_shortage(db, report)
    add_audit(
        db,
        action="recommendation_rejected",
        entity_type="recommendation",
        entity_id=recommendation_id,
        actor_type="coordinator",
        actor_name=coordinator.name,
        reason=reason,
        details={
            "before": {"status": RecommendationStatus.PROPOSED.value},
            "after": {
                "status": RecommendationStatus.REJECTED.value,
                "assignment_created": False,
                "inventory_reserved": False,
            },
            "report_id": recommendation.report_id,
        },
    )
    db.commit()
    db.expire_all()
    recommendation = get_recommendation(db, recommendation_id)
    remaining = shortage_quantity(db, report) if report is not None else 0
    return recommendation_view(db, recommendation, remaining_shortage=remaining)
