"""Matching/recommendation schemas."""

from datetime import datetime

from pydantic import Field, model_validator

from app.core.enums import (
    RecommendationStatus,
    ReportCategory,
    ReportStatus,
    ShortageStatus,
    Urgency,
)
from app.schemas.assignment import AssignmentRead
from app.schemas.common import ORMModel, RequestModel
from app.schemas.logistics import SupplierRead


class MatchGenerateRequest(RequestModel):
    report_id: int | None = Field(default=None, gt=0)
    replace_proposed: bool = True


class RecommendationRead(ORMModel):
    id: int
    report_id: int
    resource_id: int
    supplier_id: int
    route_id: int | None = None
    quantity: int
    status: RecommendationStatus
    rationale: str
    route_cost: float
    needs_review: bool
    review_reason: str | None = None
    reviewed_by_id: int | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    # Convenience fields for frontend rendering.
    report_location: str | None = None
    report_category: ReportCategory | None = None
    report_status: ReportStatus | None = None
    report_urgency: Urgency | None = None
    report_quantity: int | None = None
    resource_name: str | None = None
    supplier_name: str | None = None
    supplier_location: str | None = None
    assignment_id: int | None = None
    assignment_status: str | None = None
    remaining_shortage: int | None = None


class ShortageRead(ORMModel):
    id: int
    report_id: int
    quantity: int
    reason: str
    status: ShortageStatus
    source: str
    reported_by_id: int | None = None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None
    report_location: str | None = None
    report_category: ReportCategory | None = None
    report_urgency: Urgency | None = None


class MatchGenerationResult(ORMModel):
    generated_count: int
    superseded_count: int
    recommendations: list[RecommendationRead]
    shortages: list[ShortageRead]


class ApprovalRequest(RequestModel):
    reason: str = Field(min_length=3, max_length=2000)


class ModifyRecommendationRequest(RequestModel):
    reason: str = Field(min_length=3, max_length=2000)
    quantity: int | None = Field(default=None, gt=0, le=10_000_000)
    resource_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def at_least_one_change(self):
        if self.quantity is None and self.resource_id is None:
            raise ValueError("provide quantity and/or resource_id to modify the recommendation")
        return self


class RejectRecommendationRequest(RequestModel):
    reason: str = Field(min_length=3, max_length=2000)


class ApprovalResult(ORMModel):
    recommendation: RecommendationRead
    assignment: AssignmentRead
    supplier: SupplierRead | None = None

