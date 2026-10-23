"""Route lookup, blocking, and coordinator review flags."""

from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.enums import ACTIVE_ASSIGNMENT_STATUSES, RecommendationStatus
from app.core.utils import utcnow
from app.models.assignment import Assignment
from app.models.coordinator import Coordinator
from app.models.recommendation import Recommendation
from app.models.route import Route
from app.services.audit import add_audit
from app.services.shortages import refresh_report_shortage


@dataclass(frozen=True)
class RouteMatch:
    route: Route | None
    cost: float
    same_area: bool


def normalize_area_sql(column):
    return func.lower(func.trim(column))


def find_accessible_route(db: Session, from_location: str, to_location: str) -> RouteMatch | None:
    """Return the cheapest unblocked route between two areas, in either direction."""
    origin = from_location.strip().casefold()
    destination = to_location.strip().casefold()
    if origin == destination:
        return RouteMatch(route=None, cost=0.0, same_area=True)

    route = db.scalar(
        select(Route)
        .where(
            Route.blocked.is_(False),
            or_(
                (normalize_area_sql(Route.origin) == origin)
                & (normalize_area_sql(Route.destination) == destination),
                (normalize_area_sql(Route.origin) == destination)
                & (normalize_area_sql(Route.destination) == origin),
            ),
        )
        .order_by(Route.travel_cost.asc(), Route.id.asc())
    )
    if route is None:
        return None
    return RouteMatch(route=route, cost=route.travel_cost, same_area=False)


def route_is_accessible(db: Session, route_id: int | None) -> bool:
    if route_id is None:
        return True
    route = db.get(Route, route_id)
    return bool(route and not route.blocked)


def get_route_or_404(db: Session, route_id: int) -> Route:
    route = db.get(Route, route_id)
    if route is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route #{route_id} not found",
        )
    return route


def block_route(
    db: Session,
    route_id: int,
    coordinator: Coordinator,
    reason: str,
) -> Route:
    route = get_route_or_404(db, route_id)
    if route.blocked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Route #{route_id} is already blocked",
        )

    route.blocked = True
    route.blocked_reason = reason
    route.blocked_at = utcnow()

    affected_reports: set[int] = set()
    proposed = db.scalars(
        select(Recommendation).where(
            Recommendation.route_id == route_id,
            Recommendation.status == RecommendationStatus.PROPOSED.value,
        )
    ).all()
    for recommendation in proposed:
        recommendation.needs_review = True
        recommendation.review_reason = f"Route #{route_id} blocked: {reason}"
        affected_reports.add(recommendation.report_id)

    active_assignments = db.scalars(
        select(Assignment).where(
            Assignment.route_id == route_id,
            Assignment.status.in_(ACTIVE_ASSIGNMENT_STATUSES),
        )
    ).all()
    for assignment in active_assignments:
        assignment.needs_review = True
        assignment.review_reason = f"Route #{route_id} blocked: {reason}"
        affected_reports.add(assignment.report_id)

    db.flush()
    for report_id in sorted(affected_reports):
        from app.models.report import Report

        report = db.get(Report, report_id)
        if report is not None:
            refresh_report_shortage(db, report)

    add_audit(
        db,
        action="route_blocked",
        entity_type="route",
        entity_id=route_id,
        actor_type="coordinator",
        actor_name=coordinator.name,
        reason=reason,
        details={
            "affected_recommendations": len(proposed),
            "affected_assignments": len(active_assignments),
            "affected_report_ids": sorted(affected_reports),
        },
    )
    db.commit()
    db.refresh(route)
    return route


def unblock_route(
    db: Session,
    route_id: int,
    coordinator: Coordinator,
    reason: str,
) -> Route:
    route = get_route_or_404(db, route_id)
    if not route.blocked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Route #{route_id} is not blocked",
        )

    route.blocked = False
    route.blocked_reason = None
    route.blocked_at = None

    affected_report_ids = set(
        db.scalars(
            select(Recommendation.report_id).where(Recommendation.route_id == route_id)
        ).all()
    ) | set(
        db.scalars(
            select(Assignment.report_id).where(Assignment.route_id == route_id)
        ).all()
    )

    db.flush()
    for report_id in sorted(affected_report_ids):
        from app.models.report import Report

        report = db.get(Report, report_id)
        if report is not None:
            refresh_report_shortage(db, report)

    add_audit(
        db,
        action="route_unblocked",
        entity_type="route",
        entity_id=route_id,
        actor_type="coordinator",
        actor_name=coordinator.name,
        reason=reason,
        details={"affected_report_ids": sorted(affected_report_ids)},
    )
    db.commit()
    db.refresh(route)
    return route
