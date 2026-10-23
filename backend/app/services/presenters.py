"""Response presenters that combine an entity with display-only fields."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import COMMITTED_ASSIGNMENT_STATUSES
from app.models.assignment import Assignment
from app.models.coordinator import Coordinator
from app.models.recommendation import Recommendation
from app.models.report import Report
from app.models.resource import Resource
from app.models.shortage import Shortage
from app.models.supplier import Supplier
from app.models.volunteer import Volunteer
from app.schemas.assignment import AssignmentRead
from app.schemas.match import RecommendationRead, ShortageRead
from app.schemas.report import ReportRead


def report_view(report: Report) -> ReportRead:
    return ReportRead.model_validate(report)


def committed_quantity(db: Session, report_id: int) -> int:
    """Units already committed to a report by approved or delivered assignments."""
    total = db.scalar(
        select(func.coalesce(func.sum(Assignment.quantity), 0)).where(
            Assignment.report_id == report_id,
            Assignment.status.in_(COMMITTED_ASSIGNMENT_STATUSES),
        )
    )
    return int(total or 0)


def recommendation_view(
    db: Session,
    recommendation: Recommendation,
    remaining_shortage: int | None = None,
) -> RecommendationRead:
    report = db.get(Report, recommendation.report_id)
    resource = db.get(Resource, recommendation.resource_id)
    supplier = db.get(Supplier, recommendation.supplier_id)
    assignment = db.scalar(
        select(Assignment).where(Assignment.recommendation_id == recommendation.id)
    )

    return RecommendationRead(
        id=recommendation.id,
        report_id=recommendation.report_id,
        resource_id=recommendation.resource_id,
        supplier_id=recommendation.supplier_id,
        route_id=recommendation.route_id,
        quantity=recommendation.quantity,
        status=recommendation.status,
        rationale=recommendation.rationale,
        route_cost=recommendation.route_cost,
        needs_review=recommendation.needs_review,
        review_reason=recommendation.review_reason,
        reviewed_by_id=recommendation.reviewed_by_id,
        reviewed_at=recommendation.reviewed_at,
        created_at=recommendation.created_at,
        updated_at=recommendation.updated_at,
        report_location=report.location if report else None,
        report_category=report.category if report else None,
        report_status=report.status if report else None,
        report_urgency=report.urgency if report else None,
        report_quantity=report.quantity if report else None,
        resource_name=resource.name if resource else None,
        supplier_name=supplier.name if supplier else None,
        supplier_location=supplier.location if supplier else None,
        assignment_id=assignment.id if assignment else None,
        assignment_status=assignment.status if assignment else None,
        remaining_shortage=remaining_shortage,
    )


def assignment_view(db: Session, assignment: Assignment) -> AssignmentRead:
    report = db.get(Report, assignment.report_id)
    resource = db.get(Resource, assignment.resource_id)
    supplier = db.get(Supplier, assignment.supplier_id)
    volunteer = db.get(Volunteer, assignment.volunteer_id) if assignment.volunteer_id else None
    coordinator = db.get(Coordinator, assignment.created_by_id)
    recommendation = db.get(Recommendation, assignment.recommendation_id)

    return AssignmentRead(
        id=assignment.id,
        recommendation_id=assignment.recommendation_id,
        report_id=assignment.report_id,
        resource_id=assignment.resource_id,
        supplier_id=assignment.supplier_id,
        route_id=assignment.route_id,
        quantity=assignment.quantity,
        status=assignment.status,
        volunteer_id=assignment.volunteer_id,
        created_by_id=assignment.created_by_id,
        approval_reason=assignment.approval_reason,
        confirmation_note=assignment.confirmation_note,
        failure_reason=assignment.failure_reason,
        needs_review=assignment.needs_review,
        review_reason=assignment.review_reason,
        inventory_released=assignment.inventory_released,
        inventory_consumed=assignment.inventory_consumed,
        created_at=assignment.created_at,
        updated_at=assignment.updated_at,
        dispatched_at=assignment.dispatched_at,
        delivered_at=assignment.delivered_at,
        recommendation_quantity=recommendation.quantity if recommendation else None,
        report_location=report.location if report else None,
        report_category=report.category if report else None,
        report_urgency=report.urgency if report else None,
        resource_name=resource.name if resource else None,
        supplier_name=supplier.name if supplier else None,
        volunteer_name=volunteer.name if volunteer else None,
        volunteer_organization=volunteer.organization if volunteer else None,
        coordinator_name=coordinator.name if coordinator else None,
    )


def shortage_view(db: Session, shortage: Shortage) -> ShortageRead:
    report = db.get(Report, shortage.report_id)

    return ShortageRead(
        id=shortage.id,
        report_id=shortage.report_id,
        quantity=shortage.quantity,
        reason=shortage.reason,
        status=shortage.status,
        source=shortage.source,
        reported_by_id=shortage.reported_by_id,
        created_at=shortage.created_at,
        updated_at=shortage.updated_at,
        resolved_at=shortage.resolved_at,
        report_location=report.location if report else None,
        report_category=report.category if report else None,
        report_urgency=report.urgency if report else None,
    )
