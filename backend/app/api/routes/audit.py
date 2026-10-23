"""Read-only audit trail endpoint."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_coordinator
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.coordinator import Coordinator
from app.schemas.common import ApiResponse
from app.schemas.operations import AuditLogRead

router = APIRouter(prefix="/audit-logs", tags=["Audit"])


@router.get(
    "",
    response_model=ApiResponse[list[AuditLogRead]],
    summary="List audit trail entries (coordinator only)",
)
def list_audit_logs(
    entity_type: str | None = None,
    entity_id: int | None = None,
    action: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[list[AuditLogRead]]:
    statement = select(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    if entity_type:
        statement = statement.where(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        statement = statement.where(AuditLog.entity_id == entity_id)
    if action:
        statement = statement.where(AuditLog.action == action)
    statement = statement.limit(limit)
    entries = list(db.scalars(statement).all())
    return ApiResponse(
        message=f"Found {len(entries)} audit entr{'y' if len(entries) == 1 else 'ies'}",
        data=[AuditLogRead.model_validate(entry) for entry in entries],
    )
