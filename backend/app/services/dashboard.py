"""Aggregate dashboard metrics."""

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.enums import (
    ACTIVE_ASSIGNMENT_STATUSES,
    COMMITTED_ASSIGNMENT_STATUSES,
    AssignmentStatus,
    RecommendationStatus,
    ReportStatus,
    ReportType,
    ShortageStatus,
)
from app.models.assignment import Assignment
from app.models.recommendation import Recommendation
from app.models.report import Report
from app.models.resource import Resource
from app.models.route import Route
from app.models.shortage import Shortage
from app.schemas.operations import DashboardMetrics


def get_metrics(db: Session) -> DashboardMetrics:
    def count(model, *conditions) -> int:
        statement = select(func.count()).select_from(model)
        if conditions:
            statement = statement.where(*conditions)
        return int(db.scalar(statement) or 0)

    total_requests = count(Report)
    pending_verification = count(
        Report, Report.status == ReportStatus.PENDING.value
    )
    clarification_requested = count(
        Report, Report.status == ReportStatus.CLARIFICATION_REQUESTED.value
    )
    verified_requests = count(Report, Report.status == ReportStatus.VERIFIED.value)
    verified_needs = count(
        Report,
        Report.status == ReportStatus.VERIFIED.value,
        Report.type == ReportType.NEED.value,
    )

    approved_assignments = count(Assignment)
    active_assignments = count(
        Assignment, Assignment.status.in_(ACTIVE_ASSIGNMENT_STATUSES)
    )
    completed_deliveries = count(
        Assignment, Assignment.status == AssignmentStatus.DELIVERED.value
    )
    failed_deliveries = count(
        Assignment, Assignment.status == AssignmentStatus.FAILED.value
    )
    cancelled_assignments = count(
        Assignment, Assignment.status == AssignmentStatus.CANCELLED.value
    )

    shortages = count(Shortage, Shortage.status == ShortageStatus.OPEN.value)
    open_shortage_units = int(
        db.scalar(
            select(func.coalesce(func.sum(Shortage.quantity), 0)).where(
                Shortage.status == ShortageStatus.OPEN.value
            )
        )
        or 0
    )
    blocked_routes = count(Route, Route.blocked.is_(True))
    proposed_matches = count(
        Recommendation, Recommendation.status == RecommendationStatus.PROPOSED.value
    )

    # Outstanding demand is the quantity on verified need reports that has not
    # yet been committed by an approved/delivered assignment. Proposals are
    # deliberately excluded: they are not promises and do not reserve stock.
    demand_rows = db.execute(
        select(
            Report.quantity,
            func.coalesce(func.sum(Assignment.quantity), 0),
        )
        .outerjoin(
            Assignment,
            and_(
                Assignment.report_id == Report.id,
                Assignment.status.in_(COMMITTED_ASSIGNMENT_STATUSES),
            ),
        )
        .where(
            Report.status == ReportStatus.VERIFIED.value,
            Report.type == ReportType.NEED.value,
        )
        .group_by(Report.id, Report.quantity)
    ).all()
    outstanding_demand = sum(
        max(0, int(quantity) - int(committed or 0))
        for quantity, committed in demand_rows
    )

    delivery_completion_rate = (
        round((completed_deliveries / approved_assignments) * 100, 1)
        if approved_assignments
        else 0.0
    )

    available_inventory_units = int(
        db.scalar(select(func.coalesce(func.sum(Resource.quantity_available), 0))) or 0
    )
    reserved_inventory_units = int(
        db.scalar(select(func.coalesce(func.sum(Resource.quantity_reserved), 0))) or 0
    )

    return DashboardMetrics(
        total_requests=total_requests,
        pending_verification=pending_verification,
        approved_assignments=approved_assignments,
        completed_deliveries=completed_deliveries,
        shortages=shortages,
        blocked_routes=blocked_routes,
        total_reports=total_requests,
        verified_needs=verified_needs,
        delivered_assignments=completed_deliveries,
        outstanding_demand=outstanding_demand,
        delivery_completion_rate=delivery_completion_rate,
        verified_requests=verified_requests,
        clarification_requested=clarification_requested,
        proposed_matches=proposed_matches,
        active_assignments=active_assignments,
        failed_deliveries=failed_deliveries,
        cancelled_assignments=cancelled_assignments,
        open_shortage_units=open_shortage_units,
        available_inventory_units=available_inventory_units,
        reserved_inventory_units=reserved_inventory_units,
    )
