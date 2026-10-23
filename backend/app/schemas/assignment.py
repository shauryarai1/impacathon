"""Assignment and delivery schemas."""

from datetime import datetime

from pydantic import Field, model_validator

from app.core.enums import AssignmentStatus
from app.schemas.common import ORMModel, RequestModel


class AssignmentRead(ORMModel):
    id: int
    recommendation_id: int
    report_id: int
    resource_id: int
    supplier_id: int
    route_id: int | None = None
    quantity: int
    status: AssignmentStatus
    volunteer_id: int | None = None
    created_by_id: int
    approval_reason: str
    confirmation_note: str | None = None
    failure_reason: str | None = None
    needs_review: bool
    review_reason: str | None = None
    inventory_released: bool
    inventory_consumed: bool
    created_at: datetime
    updated_at: datetime
    dispatched_at: datetime | None = None
    delivered_at: datetime | None = None

    # Convenience fields for frontend rendering.
    recommendation_quantity: int | None = None
    report_location: str | None = None
    report_category: str | None = None
    report_urgency: str | None = None
    resource_name: str | None = None
    supplier_name: str | None = None
    volunteer_name: str | None = None
    volunteer_organization: str | None = None
    coordinator_name: str | None = None


class AssignmentStatusUpdate(RequestModel):
    status: AssignmentStatus
    note: str | None = Field(default=None, max_length=2000)
    failure_reason: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_reason(self):
        if self.status == AssignmentStatus.DELIVERED:
            return self
        if self.status == AssignmentStatus.FAILED:
            if not self.failure_reason or len(self.failure_reason) < 3:
                raise ValueError("failure_reason is required when marking a delivery failed")
            return self
        if self.status == AssignmentStatus.CANCELLED:
            if not (self.note or self.failure_reason):
                raise ValueError("a reason is required when cancelling an assignment")
            return self
        return self
