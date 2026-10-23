"""Report submission and human verification endpoints."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.enums import ReportCategory, ReportStatus, ReportType, ReviewDecision
from app.core.security import get_current_coordinator
from app.db.session import get_db
from app.models.coordinator import Coordinator
from app.schemas.common import ApiResponse
from app.schemas.report import (
    ReportCreate,
    ReportRead,
    ReportReviewRead,
    ReportReviewRequest,
)
from app.services import reports as report_service
from app.services.presenters import report_view

router = APIRouter(prefix="/reports", tags=["1. Report & Verify"])


@router.post(
    "",
    response_model=ApiResponse[ReportRead],
    status_code=status.HTTP_201_CREATED,
    summary="Submit a resident need or hazard report",
)
def submit_report(
    payload: ReportCreate,
    db: Session = Depends(get_db),
) -> ApiResponse[ReportRead]:
    report = report_service.create_report(db, payload)
    return ApiResponse(
        message="Report submitted for coordinator verification. Automated flags do not verify a report.",
        data=report_view(report),
    )


@router.get(
    "",
    response_model=ApiResponse[list[ReportRead]],
    summary="List reports with optional filters",
)
def list_reports(
    report_status: ReportStatus | None = Query(default=None, alias="status"),
    category: ReportCategory | None = None,
    report_type: ReportType | None = Query(default=None, alias="type"),
    location: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> ApiResponse[list[ReportRead]]:
    reports = report_service.list_reports(
        db,
        report_status=report_status.value if report_status else None,
        category=category.value if category else None,
        report_type=report_type.value if report_type else None,
        location=location,
        limit=limit,
    )
    return ApiResponse(
        message=f"Found {len(reports)} report(s)",
        data=[report_view(report) for report in reports],
    )


@router.get(
    "/pending",
    response_model=ApiResponse[list[ReportRead]],
    summary="List reports awaiting coordinator verification or clarification",
)
def list_pending_reports(
    db: Session = Depends(get_db),
) -> ApiResponse[list[ReportRead]]:
    reports = report_service.list_pending_reports(db)
    return ApiResponse(
        message=f"{len(reports)} report(s) awaiting human review",
        data=[report_view(report) for report in reports],
    )


@router.get(
    "/{report_id}",
    response_model=ApiResponse[ReportRead],
    summary="Get one report",
)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
) -> ApiResponse[ReportRead]:
    report = report_service.get_report(db, report_id)
    return ApiResponse(data=report_view(report))


@router.get(
    "/{report_id}/reviews",
    response_model=ApiResponse[list[ReportReviewRead]],
    summary="List human verification decisions for a report",
)
def list_reviews(
    report_id: int,
    db: Session = Depends(get_db),
) -> ApiResponse[list[ReportReviewRead]]:
    reviews = report_service.list_report_reviews(db, report_id)
    return ApiResponse(
        message=f"{len(reviews)} review decision(s)",
        data=[ReportReviewRead.model_validate(review) for review in reviews],
    )


@router.post(
    "/{report_id}/verify",
    response_model=ApiResponse[ReportRead],
    summary="Coordinator verifies a report",
)
def verify_report(
    report_id: int,
    payload: ReportReviewRequest,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[ReportRead]:
    report = report_service.review_report(
        db, report_id, ReviewDecision.VERIFIED, coordinator, payload.reason
    )
    return ApiResponse(message="Report verified by coordinator", data=report_view(report))


@router.post(
    "/{report_id}/reject",
    response_model=ApiResponse[ReportRead],
    summary="Coordinator rejects a report",
)
def reject_report(
    report_id: int,
    payload: ReportReviewRequest,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[ReportRead]:
    report = report_service.review_report(
        db, report_id, ReviewDecision.REJECTED, coordinator, payload.reason
    )
    return ApiResponse(message="Report rejected by coordinator", data=report_view(report))


@router.post(
    "/{report_id}/request-clarification",
    response_model=ApiResponse[ReportRead],
    summary="Coordinator requests clarification instead of verifying",
)
def request_clarification(
    report_id: int,
    payload: ReportReviewRequest,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[ReportRead]:
    report = report_service.review_report(
        db,
        report_id,
        ReviewDecision.CLARIFICATION_REQUESTED,
        coordinator,
        payload.reason,
    )
    return ApiResponse(
        message="Clarification requested; report is not verified",
        data=report_view(report),
    )
