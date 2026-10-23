"""Shortage, dashboard, and audit schemas."""

from datetime import datetime
from typing import Any

from pydantic import Field

from app.core.enums import ShortageStatus
from app.schemas.common import ORMModel, RequestModel


class ShortageCreate(RequestModel):
    report_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=10_000_000)
    reason: str = Field(min_length=3, max_length=2000)


class ShortageResolveRequest(RequestModel):
    reason: str = Field(default="Shortage reviewed and resolved", min_length=3, max_length=1000)


class DashboardMetrics(ORMModel):
    total_requests: int
    pending_verification: int
    approved_assignments: int
    completed_deliveries: int
    shortages: int
    blocked_routes: int

    # Explicit metric aliases used by the workflow requirements.
    total_reports: int
    verified_needs: int
    delivered_assignments: int
    outstanding_demand: int
    delivery_completion_rate: float

    # Additional context for the coordinator dashboard.
    verified_requests: int
    clarification_requested: int
    proposed_matches: int
    active_assignments: int
    failed_deliveries: int
    cancelled_assignments: int
    open_shortage_units: int
    available_inventory_units: int
    reserved_inventory_units: int


class AuditLogRead(ORMModel):
    id: int
    action: str
    entity_type: str
    entity_id: int | None = None
    actor_type: str
    actor_name: str
    reason: str | None = None
    details: dict[str, Any]
    created_at: datetime
