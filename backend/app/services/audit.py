"""Audit logging helper."""

from typing import Any

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def add_audit(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: int | None,
    actor_type: str,
    actor_name: str,
    reason: str | None = None,
    details: dict[str, Any] | None = None,
) -> AuditLog:
    """Add an audit entry to the current transaction. Caller commits."""
    entry = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_type=actor_type,
        actor_name=actor_name,
        reason=reason,
        details=details or {},
    )
    db.add(entry)
    return entry
