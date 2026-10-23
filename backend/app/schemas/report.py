"""Report request/response schemas."""

from datetime import datetime

from pydantic import Field

from app.core.enums import (
    ReportCategory,
    ReportStatus,
    ReportType,
    ReviewDecision,
    Urgency,
)
from app.schemas.common import ORMModel, RequestModel


class ReportCreate(RequestModel):
    reporter_name: str = Field(min_length=2, max_length=120)
    category: ReportCategory
    type: ReportType = ReportType.NEED
    location: str = Field(min_length=2, max_length=160)
    description: str = Field(min_length=5, max_length=4000)
    quantity: int = Field(ge=1, le=1_000_000)
    urgency: Urgency


class ReportRead(ORMModel):
    id: int
    reporter_name: str
    category: ReportCategory
    type: ReportType
    location: str
    description: str
    quantity: int
    urgency: Urgency
    status: ReportStatus
    duplicate_of_report_id: int | None = None
    duplicate_score: float | None = None
    review_flags: list[str] = Field(default_factory=list)
    needs_review: bool
    verified_by_id: int | None = None
    verified_at: datetime | None = None
    verification_reason: str | None = None
    created_at: datetime
    updated_at: datetime


class ReportReviewRequest(RequestModel):
    reason: str = Field(min_length=3, max_length=2000)


class ReportReviewRead(ORMModel):
    id: int
    report_id: int
    coordinator_id: int
    decision: ReviewDecision
    reason: str
    created_at: datetime
