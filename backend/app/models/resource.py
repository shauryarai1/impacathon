"""Inventory held by suppliers.

`quantity_total` is the stock still owned by the supplier. It is split into
available stock and stock reserved by approved assignments:
    quantity_total == quantity_available + quantity_reserved
When a delivery completes, both total and reserved decrease. When an assignment
is cancelled or fails, reserved stock returns to available stock.
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utcnow
from app.db.base import Base


class Resource(Base):
    __tablename__ = "resources"
    __table_args__ = (
        CheckConstraint("quantity_total >= 0", name="ck_resources_total_nonnegative"),
        CheckConstraint("quantity_available >= 0", name="ck_resources_available_nonnegative"),
        CheckConstraint("quantity_reserved >= 0", name="ck_resources_reserved_nonnegative"),
        CheckConstraint(
            "quantity_available + quantity_reserved <= quantity_total",
            name="ck_resources_stock_split",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    quantity_total: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_available: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_reserved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
