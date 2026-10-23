"""Database initialization."""

import app.models  # noqa: F401  # registers models with Base.metadata
from app.db.base import Base
from app.db.session import engine


def init_db() -> None:
    """Create database tables that do not exist yet."""
    Base.metadata.create_all(bind=engine)
