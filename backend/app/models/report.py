"""Resident-submitted needs and hazards."""

from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import ReportStatus, ReportType
from app.core.utils import utcnow
from app.db.base import Base


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint("quantity >= 1", name="ck_reports_quantity_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    reporter_name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    type: Mapped[str] = mapped_column(
        String(20), default=ReportType.NEED.value, nullable=False
    )
    location: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    urgency: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(40), default=ReportStatus.PENDING.value, nullable=False, index=True
    )

    # Automated triage hints. These NEVER verify a report.
    duplicate_of_report_id: Mapped[int | None] = mapped_column(
        ForeignKey("reports.id"), nullable=True
    )
    duplicate_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    review_flags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Human verification decision.
    verified_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("coordinators.id"), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    verification_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class ReportReview(Base):
    """Immutable record of each human verification decision."""

    __tablename__ = "report_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("reports.id"), nullable=False, index=True
    )
    coordinator_id: Mapped[int] = mapped_column(
        ForeignKey("coordinators.id"), nullable=False
    )
    decision: Mapped[str] = mapped_column(String(40), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
