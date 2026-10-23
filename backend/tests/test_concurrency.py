"""Concurrent human approvals must not create duplicate assignments."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from fastapi import HTTPException
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.coordinator import Coordinator
from app.services.approvals import approve_recommendation
from tests.helpers import (
    COORDINATOR_HEADERS,
    create_report,
    create_resource,
    create_supplier,
    data,
    generate_matches,
    verify_report,
)


def test_concurrent_approval_creates_exactly_one_assignment(client):
    supplier = create_supplier(client, name="Concurrent Supplier", location="Riverside")
    resource = create_resource(client, supplier["id"], quantity=200)
    report = create_report(client, quantity=200)
    verify_report(client, report["id"])
    recommendation = generate_matches(client, report["id"])["recommendations"][0]

    # Ensure the demo coordinator row exists before separate worker sessions.
    data(client.get("/api/audit-logs?limit=1", headers=COORDINATOR_HEADERS))

    barrier = Barrier(2)

    def attempt_approval():
        with SessionLocal() as db:
            coordinator = db.scalar(
                select(Coordinator).where(Coordinator.name == "Test Coordinator")
            )
            assert coordinator is not None
            barrier.wait(timeout=10)
            try:
                result = approve_recommendation(
                    db,
                    recommendation["id"],
                    coordinator,
                    "Concurrent approval attempt.",
                )
                return ("approved", result.assignment.id)
            except HTTPException as exc:
                return ("error", exc.status_code)
            except Exception as exc:  # pragma: no cover - surfaces unexpected races
                return ("unexpected", type(exc).__name__, str(exc))

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: attempt_approval(), range(2)))

    approved = [result for result in results if result[0] == "approved"]
    conflicts = [
        result
        for result in results
        if result[0] == "error" and result[1] == 409
    ]
    unexpected = [result for result in results if result[0] == "unexpected"]

    assert not unexpected, unexpected
    assert len(approved) == 1, results
    assert len(conflicts) == 1, results

    assignments = data(client.get("/api/assignments"))
    assert len(assignments) == 1
    assert assignments[0]["id"] == approved[0][1]
    assert assignments[0]["quantity"] == 200

    stock = data(client.get(f"/api/resources/{resource['id']}"))
    assert (stock["quantity_available"], stock["quantity_reserved"]) == (0, 200)

    match = data(client.get(f"/api/matches/{recommendation['id']}"))
    assert match["status"] == "approved"
    assert match["assignment_id"] == assignments[0]["id"]
