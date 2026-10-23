"""Shortage and dashboard endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.enums import ShortageStatus
from app.core.security import get_current_coordinator
from app.db.session import get_db
from app.models.coordinator import Coordinator
from app.schemas.common import ApiResponse
from app.schemas.match import ShortageRead
from app.schemas.operations import (
    DashboardMetrics,
    ShortageCreate,
    ShortageResolveRequest,
)
from app.services.dashboard import get_metrics
from app.services.shortages import (
    create_manual_shortage,
    list_shortages,
    resolve_shortage,
    shortage_view,
    shortage_views,
)

router = APIRouter(tags=["6. Confirm, Replan & Dashboard"])


@router.get(
    "/shortages",
    response_model=ApiResponse[list[ShortageRead]],
    summary="List shortage records (automatic and manually reported)",
)
def get_shortages(
    shortage_status: ShortageStatus | None = Query(default=None, alias="status"),
    report_id: int | None = None,
    db: Session = Depends(get_db),
) -> ApiResponse[list[ShortageRead]]:
    shortages = list_shortages(
        db,
        shortage_status=shortage_status.value if shortage_status else None,
        report_id=report_id,
    )
    return ApiResponse(
        message=f"Found {len(shortages)} shortage(s)",
        data=shortage_views(db, shortages),
    )


@router.post(
    "/shortages",
    response_model=ApiResponse[ShortageRead],
    status_code=201,
    summary="Report a shortage against a verified need (coordinator only)",
)
def report_shortage(
    payload: ShortageCreate,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[ShortageRead]:
    shortage = create_manual_shortage(db, payload, coordinator)
    return ApiResponse(message="Shortage reported for coordinator follow-up", data=shortage_view(db, shortage))


@router.post(
    "/shortages/{shortage_id}/resolve",
    response_model=ApiResponse[ShortageRead],
    summary="Resolve a shortage (coordinator only)",
)
def resolve_shortage_endpoint(
    shortage_id: int,
    payload: ShortageResolveRequest,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[ShortageRead]:
    shortage = resolve_shortage(db, shortage_id, coordinator, payload.reason)
    return ApiResponse(message="Shortage resolved", data=shortage_view(db, shortage))


@router.get(
    "/dashboard/metrics",
    response_model=ApiResponse[DashboardMetrics],
    summary="Coordinator dashboard metrics",
)
def dashboard_metrics(db: Session = Depends(get_db)) -> ApiResponse[DashboardMetrics]:
    return ApiResponse(message="Dashboard metrics", data=get_metrics(db))
