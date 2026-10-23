"""Delivery assignments created only by coordinator approval."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import AssignmentStatus
from app.core.utils import utcnow
from app.db.base import Base


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_assignments_quantity_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # One recommendation can produce at most one assignment. This is the final
    # guard against a duplicate approval creating a second allocation.
    recommendation_id: Mapped[int] = mapped_column(
        ForeignKey("recommendations.id"), unique=True, nullable=False, index=True
    )
    report_id: Mapped[int] = mapped_column(
        ForeignKey("reports.id"), nullable=False, index=True
    )
    resource_id: Mapped[int] = mapped_column(
        ForeignKey("resources.id"), nullable=False, index=True
    )
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.id"), nullable=False, index=True
    )
    route_id: Mapped[int | None] = mapped_column(
        ForeignKey("routes.id"), nullable=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default=AssignmentStatus.APPROVED.value, nullable=False, index=True
    )

    volunteer_id: Mapped[int | None] = mapped_column(
        ForeignKey("volunteers.id"), nullable=True
    )
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("coordinators.id"), nullable=False
    )
    approval_reason: Mapped[str] = mapped_column(Text, nullable=False)

    # Delivery confirmation / exception details.
    confirmation_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    needs_review: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    review_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Inventory guards. A terminal transition flips one of these exactly once.
    inventory_released: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    inventory_consumed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
    dispatched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
