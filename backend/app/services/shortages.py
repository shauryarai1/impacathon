"""Shortage calculation, manual reporting, and resolution."""

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.enums import (
    COMMITTED_ASSIGNMENT_STATUSES,
    RecommendationStatus,
    ReportStatus,
    ReportType,
    ShortageStatus,
)
from app.core.utils import utcnow
from app.models.assignment import Assignment
from app.models.coordinator import Coordinator
from app.models.recommendation import Recommendation
from app.models.report import Report
from app.models.resource import Resource
from app.models.route import Route
from app.models.shortage import Shortage
from app.schemas.operations import ShortageCreate
from app.services.audit import add_audit
from app.services.presenters import shortage_view


def shortage_quantity(db: Session, report: Report) -> int:
    """Unmet demand after committed assignments and accessible proposed matches.

    Proposals are planner suggestions, not reservations. Counting them here lets
    the API report the shortage that remains *after* the current suggestions.
    Blocked-route proposals do not count as accessible supply.
    """
    if report.status != ReportStatus.VERIFIED.value or report.type != ReportType.NEED.value:
        return 0

    committed = db.scalar(
        select(func.coalesce(func.sum(Assignment.quantity), 0)).where(
            Assignment.report_id == report.id,
            Assignment.status.in_(COMMITTED_ASSIGNMENT_STATUSES),
        )
    )
    proposed = db.scalar(
        select(func.coalesce(func.sum(Recommendation.quantity), 0))
        .select_from(Recommendation)
        .outerjoin(Route, Recommendation.route_id == Route.id)
        .where(
            Recommendation.report_id == report.id,
            Recommendation.status == RecommendationStatus.PROPOSED.value,
            Recommendation.needs_review.is_(False),
            or_(Recommendation.route_id.is_(None), Route.blocked.is_(False)),
        )
    )
    return max(0, int(report.quantity) - int(committed or 0) - int(proposed or 0))


def refresh_report_shortage(db: Session, report: Report) -> int:
    """Create, update, or resolve the automatic shortage record for a report.

    Does not commit; callers own the transaction.
    """
    remaining = shortage_quantity(db, report)
    open_auto = db.scalar(
        select(Shortage)
        .where(
            Shortage.report_id == report.id,
            Shortage.status == ShortageStatus.OPEN.value,
            Shortage.source == "auto",
        )
        .order_by(Shortage.created_at.desc(), Shortage.id.desc())
    )

    if remaining > 0:
        reason = (
            f"Unmet demand of {remaining} unit(s) for verified need report #{report.id} "
            f"at {report.location}; no accessible unallocated supply currently covers it."
        )
        if open_auto is not None:
            open_auto.quantity = remaining
            open_auto.reason = reason
        else:
            db.add(
                Shortage(
                    report_id=report.id,
                    quantity=remaining,
                    reason=reason,
                    status=ShortageStatus.OPEN.value,
                    source="auto",
                )
            )
    elif open_auto is not None:
        open_auto.status = ShortageStatus.RESOLVED.value
        open_auto.resolved_at = utcnow()

    return remaining


def list_shortages(
    db: Session,
    *,
    shortage_status: str | None = None,
    report_id: int | None = None,
) -> list[Shortage]:
    statement = select(Shortage)
    if shortage_status:
        statement = statement.where(Shortage.status == shortage_status)
    if report_id:
        statement = statement.where(Shortage.report_id == report_id)
    statement = statement.order_by(Shortage.created_at.desc(), Shortage.id.desc())
    return list(db.scalars(statement).all())


def create_manual_shortage(
    db: Session,
    payload: ShortageCreate,
    coordinator: Coordinator,
) -> Shortage:
    report = db.get(Report, payload.report_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report #{payload.report_id} not found",
        )
    if report.status != ReportStatus.VERIFIED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Shortages can only be reported against verified reports",
        )
    if report.type != ReportType.NEED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Shortages can only be reported against need reports",
        )
    if payload.quantity > report.quantity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Shortage quantity cannot exceed the report quantity",
        )

    shortage = Shortage(
        report_id=report.id,
        quantity=payload.quantity,
        reason=payload.reason,
        status=ShortageStatus.OPEN.value,
        source="manual",
        reported_by_id=coordinator.id,
    )
    db.add(shortage)
    db.flush()
    add_audit(
        db,
        action="shortage_reported",
        entity_type="shortage",
        entity_id=shortage.id,
        actor_type="coordinator",
        actor_name=coordinator.name,
        reason=payload.reason,
        details={"report_id": report.id, "quantity": payload.quantity},
    )
    db.commit()
    db.refresh(shortage)
    return shortage


def resolve_shortage(
    db: Session,
    shortage_id: int,
    coordinator: Coordinator,
    reason: str,
) -> Shortage:
    shortage = db.get(Shortage, shortage_id)
    if shortage is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shortage #{shortage_id} not found",
        )
    if shortage.status == ShortageStatus.RESOLVED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Shortage #{shortage_id} is already resolved",
        )

    shortage.status = ShortageStatus.RESOLVED.value
    shortage.resolved_at = utcnow()
    add_audit(
        db,
        action="shortage_resolved",
        entity_type="shortage",
        entity_id=shortage.id,
        actor_type="coordinator",
        actor_name=coordinator.name,
        reason=reason,
        details={"report_id": shortage.report_id},
    )
    db.commit()
    db.refresh(shortage)
    return shortage


def shortage_views(db: Session, shortages: list[Shortage]):
    return [shortage_view(db, shortage) for shortage in shortages]
