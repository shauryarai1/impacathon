"""Demo coordinator and volunteer authorization.

The prototype uses two shared demo API keys configured through the environment.
The key proves the caller has the demo role; the name header identifies the
human so decisions can be attributed. A name header is NOT cryptographically
bound to the key. This is a hackathon demo limitation, not production auth.
"""

import hmac

from fastapi import Depends, Header, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.coordinator import Coordinator
from app.models.volunteer import Volunteer

coordinator_key_header = APIKeyHeader(
    name="X-Coordinator-Key",
    auto_error=False,
    description="Demo coordinator key configured via COORDINATOR_API_KEY.",
)
volunteer_key_header = APIKeyHeader(
    name="X-Volunteer-Key",
    auto_error=False,
    description="Demo volunteer/provider key configured via VOLUNTEER_API_KEY.",
)


def _check_key(provided: str | None, expected: str, role: str) -> None:
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{role} authentication is not configured on the server",
        )
    if not provided:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"{role} API key required",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Invalid {role} API key",
        )


def _get_or_create_actor(db: Session, model, name: str, **extra):
    actor = db.scalar(select(model).where(model.name == name))
    if actor is not None:
        return actor

    actor = model(name=name, active=True, **extra)
    db.add(actor)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        actor = db.scalar(select(model).where(model.name == name))
        if actor is None:
            raise
        return actor
    db.refresh(actor)
    return actor


def get_current_coordinator(
    db: Session = Depends(get_db),
    key: str | None = Security(coordinator_key_header),
    name: str | None = Header(default=None, alias="X-Coordinator-Name"),
) -> Coordinator:
    """Authorize a coordinator and resolve the named demo coordinator."""
    _check_key(key, settings.COORDINATOR_API_KEY, "Coordinator")

    actor_name = (name or settings.DEMO_COORDINATOR_NAME).strip()
    if not actor_name:
        actor_name = settings.DEMO_COORDINATOR_NAME

    coordinator = _get_or_create_actor(db, Coordinator, actor_name)
    if not coordinator.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Coordinator account is inactive",
        )
    return coordinator


def get_current_volunteer(
    db: Session = Depends(get_db),
    key: str | None = Security(volunteer_key_header),
    name: str | None = Header(default=None, alias="X-Volunteer-Name"),
) -> Volunteer:
    """Authorize a volunteer/provider and resolve the named demo volunteer."""
    _check_key(key, settings.VOLUNTEER_API_KEY, "Volunteer")

    actor_name = (name or settings.DEMO_VOLUNTEER_NAME).strip()
    if not actor_name:
        actor_name = settings.DEMO_VOLUNTEER_NAME

    volunteer = _get_or_create_actor(
        db,
        Volunteer,
        actor_name,
        organization="Demo volunteer (auto-created)",
    )
    if not volunteer.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Volunteer account is inactive",
        )
    return volunteer
