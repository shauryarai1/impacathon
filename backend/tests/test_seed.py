"""The demo seed must be additive, idempotent, and safe to re-run."""

from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models.assignment import Assignment
from app.models.audit import AuditLog
from app.models.coordinator import Coordinator
from app.models.recommendation import Recommendation
from app.models.report import Report
from app.models.resource import Resource
from app.models.route import Route
from app.models.shortage import Shortage
from app.models.supplier import Supplier
from app.models.volunteer import Volunteer
from app.seed import _seed


def _counts():
    with SessionLocal() as db:
        models = {
            "coordinators": Coordinator,
            "volunteers": Volunteer,
            "suppliers": Supplier,
            "resources": Resource,
            "routes": Route,
            "reports": Report,
            "recommendations": Recommendation,
            "shortages": Shortage,
            "assignments": Assignment,
            "audit_logs": AuditLog,
        }
        return {
            name: int(db.scalar(select(func.count()).select_from(model)) or 0)
            for name, model in models.items()
        }


def test_demo_seed_is_idempotent_and_additive(client, capsys):
    with SessionLocal() as db:
        first_created = _seed(db)

    first_counts = _counts()
    assert first_counts["reports"] == 7
    assert first_counts["suppliers"] == 6
    assert first_counts["resources"] == 7
    assert first_counts["routes"] == 8
    assert first_counts["recommendations"] == 1
    assert first_counts["shortages"] == 1
    assert first_counts["assignments"] == 0
    assert sum(first_created.values()) > 0

    with SessionLocal() as db:
        second_created = _seed(db)

    second_counts = _counts()
    assert sum(second_created.values()) == 0
    assert second_counts == first_counts

    output = capsys.readouterr().out
    assert "SIMULATION DATA ONLY" in output
    assert "existing rows were left untouched" in output
