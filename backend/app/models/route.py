"""Routes connect supplier areas to affected areas."""

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utcnow
from app.db.base import Base


class Route(Base):
    __tablename__ = "routes"
    __table_args__ = (
        CheckConstraint("travel_cost >= 0", name="ck_routes_cost_nonnegative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    origin: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    destination: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    travel_cost: Mapped[float] = mapped_column(Float, nullable=False)
    blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    blocked_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    blocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
