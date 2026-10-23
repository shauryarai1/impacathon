"""Test configuration and isolated SQLite database."""

import os
import tempfile
from pathlib import Path

TEST_DIR = Path(tempfile.mkdtemp(prefix="lifeline-tests-"))
TEST_DB = TEST_DIR / "lifeline-test.db"

# These must be set before importing application modules because settings and
# the SQLAlchemy engine are constructed at import time.
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["COORDINATOR_API_KEY"] = "test-coordinator-key"
os.environ["VOLUNTEER_API_KEY"] = "test-volunteer-key"
os.environ["DEMO_COORDINATOR_NAME"] = "Test Coordinator"
os.environ["DEMO_VOLUNTEER_NAME"] = "Test Volunteer"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app.models  # noqa: E402,F401
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(clean_db):
    with TestClient(app) as test_client:
        yield test_client
