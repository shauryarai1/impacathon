"""Small shared helpers."""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Return the current UTC time."""
    return datetime.now(timezone.utc)
