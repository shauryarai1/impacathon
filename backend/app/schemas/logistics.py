"""Supplier, resource, and route schemas."""

from datetime import datetime

from pydantic import Field, model_validator

from app.core.enums import ReportCategory, SupplierVerification
from app.schemas.common import ORMModel, RequestModel


class SupplierCreate(RequestModel):
    name: str = Field(min_length=2, max_length=160)
    location: str = Field(min_length=2, max_length=160)
    contact_name: str | None = Field(default=None, max_length=120)
    verification_status: SupplierVerification = SupplierVerification.PENDING
    active: bool = True


class SupplierRead(ORMModel):
    id: int
    name: str
    location: str
    contact_name: str | None = None
    verification_status: SupplierVerification
    active: bool
    created_at: datetime
    updated_at: datetime


class SupplierVerifyRequest(RequestModel):
    reason: str = Field(default="Supplier verification reviewed", min_length=3, max_length=1000)


class SupplierUpdate(RequestModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    location: str | None = Field(default=None, min_length=2, max_length=160)
    contact_name: str | None = Field(default=None, max_length=120)
    verification_status: SupplierVerification | None = None
    active: bool | None = None
    reason: str = Field(default="Supplier details updated", min_length=3, max_length=1000)

    @model_validator(mode="after")
    def at_least_one_change(self):
        mutable = {"name", "location", "contact_name", "verification_status", "active"}
        if not mutable.intersection(self.model_fields_set):
            raise ValueError(
                "provide at least one of name, location, contact_name, "
                "verification_status, or active"
            )
        return self


class ResourceCreate(RequestModel):
    supplier_id: int = Field(gt=0)
    name: str = Field(min_length=2, max_length=160)
    category: ReportCategory
    quantity_available: int = Field(gt=0, le=10_000_000)


class ResourceRead(ORMModel):
    id: int
    supplier_id: int
    name: str
    category: ReportCategory
    quantity_total: int
    quantity_available: int
    quantity_reserved: int
    created_at: datetime
    updated_at: datetime


class ResourceRestock(RequestModel):
    quantity: int = Field(gt=0, le=10_000_000)
    reason: str = Field(default="Inventory restocked", min_length=3, max_length=1000)


class RouteCreate(RequestModel):
    origin: str = Field(min_length=2, max_length=160)
    destination: str = Field(min_length=2, max_length=160)
    travel_cost: float = Field(ge=0, le=100_000)
    blocked: bool = False

    @model_validator(mode="after")
    def areas_must_differ(self):
        if self.origin.casefold() == self.destination.casefold():
            raise ValueError("origin and destination must be different areas")
        return self


class RouteRead(ORMModel):
    id: int
    origin: str
    destination: str
    travel_cost: float
    blocked: bool
    blocked_reason: str | None = None
    blocked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class RouteBlockRequest(RequestModel):
    reason: str = Field(min_length=3, max_length=1000)


class RouteUnblockRequest(RequestModel):
    reason: str = Field(default="Route reopened", min_length=3, max_length=1000)
