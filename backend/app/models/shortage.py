"""Unmet demand / shortage records."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import ShortageStatus
from app.core.utils import utcnow
from app.db.base import Base


class Shortage(Base):
    __tablename__ = "shortages"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_shortages_quantity_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("reports.id"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=ShortageStatus.OPEN.value, nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(String(20), default="auto", nullable=False)
    reported_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("coordinators.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
