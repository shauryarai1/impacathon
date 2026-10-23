"""Delivery status transitions and inventory finalization."""

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.enums import AssignmentStatus, RecommendationStatus
from app.core.utils import utcnow
from app.models.assignment import Assignment
from app.models.recommendation import Recommendation
from app.models.report import Report
from app.models.resource import Resource
from app.models.volunteer import Volunteer
from app.schemas.assignment import AssignmentRead, AssignmentStatusUpdate
from app.services.audit import add_audit
from app.services.presenters import assignment_view
from app.services.shortages import refresh_report_shortage

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    AssignmentStatus.APPROVED.value: {
        AssignmentStatus.DISPATCHED.value,
        AssignmentStatus.CANCELLED.value,
        AssignmentStatus.FAILED.value,
    },
    AssignmentStatus.DISPATCHED.value: {
        AssignmentStatus.IN_TRANSIT.value,
        AssignmentStatus.CANCELLED.value,
        AssignmentStatus.FAILED.value,
    },
    AssignmentStatus.IN_TRANSIT.value: {
        AssignmentStatus.DELIVERED.value,
        AssignmentStatus.CANCELLED.value,
        AssignmentStatus.FAILED.value,
    },
    AssignmentStatus.DELIVERED.value: set(),
    AssignmentStatus.FAILED.value: set(),
    AssignmentStatus.CANCELLED.value: set(),
}


def get_assignment(db: Session, assignment_id: int) -> Assignment:
    assignment = db.get(Assignment, assignment_id)
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment #{assignment_id} not found",
        )
    return assignment


def list_assignments(
    db: Session,
    *,
    assignment_status: str | None = None,
    report_id: int | None = None,
) -> list[Assignment]:
    statement = select(Assignment)
    if assignment_status:
        statement = statement.where(Assignment.status == assignment_status)
    if report_id:
        statement = statement.where(Assignment.report_id == report_id)
    statement = statement.order_by(Assignment.created_at.desc(), Assignment.id.desc())
    return list(db.scalars(statement).all())


def update_assignment_status(
    db: Session,
    assignment_id: int,
    payload: AssignmentStatusUpdate,
    volunteer: Volunteer,
) -> AssignmentRead:
    assignment = get_assignment(db, assignment_id)
    old_status = assignment.status
    new_status = payload.status.value

    allowed = ALLOWED_TRANSITIONS.get(old_status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Invalid delivery transition: {old_status} -> {new_status}. "
                f"Allowed: {sorted(allowed) if allowed else 'none (terminal status)'}"
            ),
        )

    now = utcnow()
    values: dict = {"status": new_status, "volunteer_id": volunteer.id, "updated_at": now}

    if new_status == AssignmentStatus.DISPATCHED.value:
        values["dispatched_at"] = now
    elif new_status == AssignmentStatus.DELIVERED.value:
        values.update(
            delivered_at=now,
            confirmation_note=payload.note,
            failure_reason=None,
            needs_review=False,
            review_reason=None,
            inventory_consumed=True,
        )
    elif new_status == AssignmentStatus.FAILED.value:
        reason = payload.failure_reason or payload.note or "Delivery failed"
        values.update(
            failure_reason=reason,
            needs_review=True,
            review_reason=f"Delivery failed: {reason}",
            inventory_released=True,
        )
    elif new_status == AssignmentStatus.CANCELLED.value:
        reason = payload.failure_reason or payload.note or "Assignment cancelled"
        values.update(
            failure_reason=reason,
            needs_review=True,
            review_reason=f"Assignment cancelled: {reason}",
            inventory_released=True,
        )

    # Conditional update prevents two volunteers applying conflicting terminal
    # transitions and guarantees release/consumption happens at most once.
    result = db.execute(
        update(Assignment)
        .where(Assignment.id == assignment_id, Assignment.status == old_status)
        .values(**values)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Assignment status changed by another request; refresh and retry",
        )

    inventory_action = "none"
    if new_status == AssignmentStatus.DELIVERED.value:
        stock_update = db.execute(
            update(Resource)
            .where(
                Resource.id == assignment.resource_id,
                Resource.quantity_reserved >= assignment.quantity,
                Resource.quantity_total >= assignment.quantity,
            )
            .values(
                quantity_total=Resource.quantity_total - assignment.quantity,
                quantity_reserved=Resource.quantity_reserved - assignment.quantity,
            )
            .execution_options(synchronize_session=False)
        )
        if stock_update.rowcount != 1:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inventory reservation is inconsistent; delivery was not recorded",
            )
        inventory_action = "consumed"
    elif new_status in {AssignmentStatus.FAILED.value, AssignmentStatus.CANCELLED.value}:
        stock_update = db.execute(
            update(Resource)
            .where(
                Resource.id == assignment.resource_id,
                Resource.quantity_reserved >= assignment.quantity,
            )
            .values(
                quantity_reserved=Resource.quantity_reserved - assignment.quantity,
                quantity_available=Resource.quantity_available + assignment.quantity,
            )
            .execution_options(synchronize_session=False)
        )
        if stock_update.rowcount != 1:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inventory reservation is inconsistent; status was not changed",
            )
        inventory_action = "released"

    if new_status in {AssignmentStatus.FAILED.value, AssignmentStatus.CANCELLED.value}:
        recommendation = db.get(Recommendation, assignment.recommendation_id)
        if recommendation is not None:
            recommendation.needs_review = True
            recommendation.review_reason = values.get("review_reason")

    db.flush()
    report = db.get(Report, assignment.report_id)
    if report is not None:
        refresh_report_shortage(db, report)

    add_audit(
        db,
        action="assignment_status_changed",
        entity_type="assignment",
        entity_id=assignment_id,
        actor_type="volunteer",
        actor_name=volunteer.name,
        reason=payload.failure_reason or payload.note,
        details={
            "from_status": old_status,
            "to_status": new_status,
            "inventory": inventory_action,
            "report_id": assignment.report_id,
            "quantity": assignment.quantity,
        },
    )
    db.commit()
    db.expire_all()
    assignment = get_assignment(db, assignment_id)
    return assignment_view(db, assignment)
