"""Stage 1/2: report submission, triage flags, and human verification."""

from app.db.session import SessionLocal
from app.models.report import Report
from tests.helpers import (
    COORDINATOR_HEADERS,
    create_report,
    data,
    verify_report,
)


def test_report_persists_in_sqlite_across_sessions(client):
    report = create_report(client)
    with SessionLocal() as db:
        persisted = db.get(Report, report["id"])
        assert persisted is not None
        assert persisted.reporter_name == report["reporter_name"]
        assert persisted.status == "pending_verification"


def test_report_validation_and_error_envelope(client):
    response = client.post(
        "/api/reports",
        json={
            "reporter_name": "A",
            "category": "not-a-category",
            "type": "need",
            "location": "Riverside",
            "description": "short",
            "quantity": 0,
            "urgency": "urgent",
        },
    )
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["message"] == "Request validation failed"
    assert body["data"]["errors"]


def test_duplicate_and_uncertainty_flags_do_not_verify(client):
    first = create_report(
        client,
        description="Families need clean drinking water after the flood.",
    )
    second = create_report(
        client,
        description="Families need clean drinking water after flood.",
        reporter_name="Another Reporter",
    )

    assert first["status"] == "pending_verification"
    assert second["status"] == "pending_verification"
    assert second["duplicate_of_report_id"] == first["id"]
    assert second["duplicate_score"] is not None
    assert any("Potential duplicate" in flag for flag in second["review_flags"])
    assert second["needs_review"] is True

    uncertain = create_report(
        client,
        category="other",
        description="Maybe we need supplies, not sure.",
        quantity=10,
        urgency="low",
    )
    assert uncertain["status"] == "pending_verification"
    assert uncertain["needs_review"] is True
    assert any("uncertain" in flag.lower() for flag in uncertain["review_flags"])


def test_pending_list_and_verification_authorization(client):
    report = create_report(client)

    pending = data(client.get("/api/reports/pending"))
    assert [item["id"] for item in pending] == [report["id"]]

    missing_key = client.post(
        f"/api/reports/{report['id']}/verify", json={"reason": "Looks valid."}
    )
    assert missing_key.status_code == 401
    assert missing_key.json()["success"] is False

    wrong_key = client.post(
        f"/api/reports/{report['id']}/verify",
        json={"reason": "Looks valid."},
        headers={"X-Coordinator-Key": "wrong"},
    )
    assert wrong_key.status_code == 403

    verified = verify_report(client, report["id"], "Shelter coordinator confirmed the need.")
    assert verified["status"] == "verified"
    assert verified["verified_by_id"] is not None
    assert verified["verification_reason"] == "Shelter coordinator confirmed the need."
    assert verified["needs_review"] is False

    reviews = data(client.get(f"/api/reports/{report['id']}/reviews"))
    assert len(reviews) == 1
    assert reviews[0]["decision"] == "verified"

    duplicate_verification = client.post(
        f"/api/reports/{report['id']}/verify",
        json={"reason": "Again."},
        headers=COORDINATOR_HEADERS,
    )
    assert duplicate_verification.status_code == 409

    reject_verified = client.post(
        f"/api/reports/{report['id']}/reject",
        json={"reason": "No longer needed."},
        headers=COORDINATOR_HEADERS,
    )
    assert reject_verified.status_code == 409


def test_reject_and_request_clarification(client):
    rejected_report = create_report(client, category="food", description="Food boxes needed at Hilltop.")
    rejected = data(
        client.post(
            f"/api/reports/{rejected_report['id']}/reject",
            json={"reason": "Duplicate of an already fulfilled request."},
            headers=COORDINATOR_HEADERS,
        )
    )
    assert rejected["status"] == "rejected"

    unclear_report = create_report(
        client,
        category="shelter",
        description="Maybe blankets needed at Eastbridge.",
        urgency="medium",
    )
    clarified = data(
        client.post(
            f"/api/reports/{unclear_report['id']}/request-clarification",
            json={"reason": "Quantity and exact location are unclear."},
            headers=COORDINATOR_HEADERS,
        )
    )
    assert clarified["status"] == "clarification_requested"
    assert clarified["needs_review"] is True

    # Clarification-requested reports remain in the human review queue.
    pending_ids = [item["id"] for item in data(client.get("/api/reports/pending"))]
    assert unclear_report["id"] in pending_ids

    verified_after_clarification = verify_report(client, unclear_report["id"])
    assert verified_after_clarification["status"] == "verified"
