"""Deterministic, rule-based matching.

There is no trained model here. Reports are processed in urgency/age order,
then resources are considered in a stable order: accessible route cost,
available stock, supplier id, resource id. Every proposal includes a written
rationale. Proposals never reserve stock or create assignments.
"""

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import (
    RecommendationStatus,
    ReportStatus,
    ReportType,
    URGENCY_RANK,
)
from app.core.utils import utcnow
from app.models.coordinator import Coordinator
from app.models.recommendation import Recommendation
from app.models.report import Report
from app.models.resource import Resource
from app.models.shortage import Shortage
from app.models.supplier import Supplier
from app.schemas.match import MatchGenerationResult
from app.services.audit import add_audit
from app.services.presenters import committed_quantity, recommendation_view
from app.services.routing import find_accessible_route
from app.services.shortages import refresh_report_shortage, shortage_quantity, shortage_views


def _eligible_reports(db: Session) -> list[Report]:
    reports = list(
        db.scalars(
            select(Report).where(
                Report.status == ReportStatus.VERIFIED.value,
                Report.type == ReportType.NEED.value,
            )
        ).all()
    )
    reports.sort(
        key=lambda report: (
            URGENCY_RANK.get(report.urgency, 99),
            report.created_at,
            report.id,
        )
    )
    return reports


def generate_matches(
    db: Session,
    coordinator: Coordinator,
    *,
    report_id: int | None = None,
    replace_proposed: bool = True,
) -> MatchGenerationResult:
    """Generate proposals for verified need reports. Never reserve inventory."""
    if report_id is not None:
        report = db.get(Report, report_id)
        if report is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report #{report_id} not found",
            )
        if report.status != ReportStatus.VERIFIED.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only verified reports can be matched",
            )
        if report.type != ReportType.NEED.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only need reports can be matched to resources",
            )
        reports = [report]
    else:
        reports = _eligible_reports(db)

    generated_ids: list[int] = []
    superseded_count = 0
    touched_report_ids: set[int] = set()

    # Proposals do not reserve stock, so this run must track the unallocated
    # stock it has already promised. Without this, two reports could both be
    # offered the same units during one matching run.
    planned_stock: dict[int, int] = {}
    if report_id is not None or not replace_proposed:
        # Existing proposals remain in place when regenerating one report or
        # when the caller asks not to replace proposals. Conservatively account
        # for their suggested units so this run cannot double-promise stock.
        for resource in db.scalars(select(Resource)).all():
            planned_stock[resource.id] = resource.quantity_available
        proposal_stmt = select(
            Recommendation.resource_id,
            func.sum(Recommendation.quantity),
        ).where(Recommendation.status == RecommendationStatus.PROPOSED.value)
        if report_id is not None:
            proposal_stmt = proposal_stmt.where(
                Recommendation.report_id != report_id
            )
        other_proposals = db.execute(
            proposal_stmt.group_by(Recommendation.resource_id)
        ).all()
        for other_resource_id, other_quantity in other_proposals:
            planned_stock[other_resource_id] = max(
                0,
                planned_stock.get(other_resource_id, 0) - int(other_quantity or 0),
            )

    for report in reports:
        touched_report_ids.add(report.id)
        existing = list(
            db.scalars(
                select(Recommendation).where(
                    Recommendation.report_id == report.id,
                    Recommendation.status == RecommendationStatus.PROPOSED.value,
                )
            ).all()
        )
        if existing and not replace_proposed:
            continue
        for old in existing:
            old.status = RecommendationStatus.SUPERSEDED.value
            old.reviewed_at = utcnow()
            old.review_reason = "Superseded by a new matching run; no stock was reserved."
            superseded_count += 1
            add_audit(
                db,
                action="recommendation_superseded",
                entity_type="recommendation",
                entity_id=old.id,
                actor_type="coordinator",
                actor_name=coordinator.name,
                reason="Regenerated match proposals",
                details={"report_id": report.id},
            )
        if existing:
            db.flush()

        outstanding = report.quantity - committed_quantity(db, report.id)
        if outstanding <= 0:
            refresh_report_shortage(db, report)
            continue

        candidate_rows = db.execute(
            select(Resource, Supplier)
            .join(Supplier, Resource.supplier_id == Supplier.id)
            .where(
                Resource.category == report.category,
                Resource.quantity_available > 0,
                Supplier.verification_status == "verified",
                Supplier.active.is_(True),
            )
        ).all()

        accessible = []
        for resource, supplier in candidate_rows:
            planned_available = planned_stock.setdefault(
                resource.id, resource.quantity_available
            )
            if planned_available <= 0:
                continue
            route_match = find_accessible_route(db, supplier.location, report.location)
            if route_match is None:
                continue
            accessible.append(
                (
                    route_match.cost,
                    -planned_available,
                    supplier.id,
                    resource.id,
                    resource,
                    supplier,
                    route_match,
                    planned_available,
                )
            )
        accessible.sort(key=lambda row: row[:4])

        remaining = outstanding
        for (
            _,
            _,
            _,
            _,
            resource,
            supplier,
            route_match,
            planned_available,
        ) in accessible:
            if remaining <= 0:
                break
            proposed_quantity = min(remaining, planned_available)
            if proposed_quantity <= 0:
                continue

            if route_match.same_area:
                route_text = "same area, no road travel required"
            else:
                route_text = (
                    f"accessible via route #{route_match.route.id} at travel cost "
                    f"{route_match.cost:g}"
                )

            rationale = (
                f"Verified {report.category} need at {report.location} "
                f"(urgency: {report.urgency}; {outstanding} unresolved units). "
                f"Supplier '{supplier.name}' at {supplier.location} has "
                f"{planned_available} unallocated units for this planning run; "
                f"{route_text}. Proposed {proposed_quantity} unit(s) from "
                f"resource '{resource.name}' (#{resource.id})."
            )

            recommendation = Recommendation(
                report_id=report.id,
                resource_id=resource.id,
                supplier_id=supplier.id,
                route_id=route_match.route.id if route_match.route else None,
                quantity=proposed_quantity,
                status=RecommendationStatus.PROPOSED.value,
                rationale=rationale,
                route_cost=route_match.cost,
                needs_review=False,
            )
            db.add(recommendation)
            db.flush()
            generated_ids.append(recommendation.id)
            add_audit(
                db,
                action="match_proposed",
                entity_type="recommendation",
                entity_id=recommendation.id,
                actor_type="coordinator",
                actor_name=coordinator.name,
                details={
                    "report_id": report.id,
                    "resource_id": resource.id,
                    "supplier_id": supplier.id,
                    "quantity": proposed_quantity,
                    "route_id": recommendation.route_id,
                    "route_cost": route_match.cost,
                },
            )
            planned_stock[resource.id] = planned_available - proposed_quantity
            remaining -= proposed_quantity

        db.flush()
        refresh_report_shortage(db, report)
        add_audit(
            db,
            action="matching_run_completed",
            entity_type="report",
            entity_id=report.id,
            actor_type="coordinator",
            actor_name=coordinator.name,
            details={
                "unresolved_before_match": outstanding,
                "proposed_units": outstanding - remaining,
                "remaining_shortage": remaining,
            },
        )

    db.commit()

    recommendations = [
        db.get(Recommendation, recommendation_id) for recommendation_id in generated_ids
    ]
    recommendations = [recommendation for recommendation in recommendations if recommendation]
    shortages = list(
        db.scalars(
            select(Shortage)
            .where(
                Shortage.report_id.in_(touched_report_ids),
                Shortage.status == "open",
            )
            .order_by(Shortage.created_at.desc(), Shortage.id.desc())
        ).all()
    ) if touched_report_ids else []

    return MatchGenerationResult(
        generated_count=len(recommendations),
        superseded_count=superseded_count,
        recommendations=[
            recommendation_view(
                db,
                recommendation,
                remaining_shortage=shortage_quantity(
                    db, db.get(Report, recommendation.report_id)
                ),
            )
            for recommendation in recommendations
        ],
        shortages=shortage_views(db, shortages),
    )


def list_recommendations(
    db: Session,
    *,
    recommendation_status: str | None = None,
    report_id: int | None = None,
) -> list[Recommendation]:
    statement = select(Recommendation)
    if recommendation_status:
        statement = statement.where(Recommendation.status == recommendation_status)
    if report_id:
        statement = statement.where(Recommendation.report_id == report_id)
    statement = statement.order_by(Recommendation.created_at.desc(), Recommendation.id.desc())
    return list(db.scalars(statement).all())


def present_recommendations(db: Session, recommendations: list[Recommendation]):
    shortage_cache: dict[int, int] = {}
    views = []
    for recommendation in recommendations:
        if recommendation.report_id not in shortage_cache:
            report = db.get(Report, recommendation.report_id)
            shortage_cache[recommendation.report_id] = (
                shortage_quantity(db, report) if report else 0
            )
        views.append(
            recommendation_view(
                db,
                recommendation,
                remaining_shortage=shortage_cache[recommendation.report_id],
            )
        )
    return views
