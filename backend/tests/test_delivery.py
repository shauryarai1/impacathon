"""Stage 5: delivery transitions, confirmation, and inventory consistency."""

from tests.helpers import (
    VOLUNTEER_HEADERS,
    data,
    setup_approved_assignment,
)


def _status(client, assignment_id, status, **extra):
    payload = {"status": status, **extra}
    return client.post(
        f"/api/assignments/{assignment_id}/status",
        json=payload,
        headers=VOLUNTEER_HEADERS,
    )


def test_delivery_happy_path_and_terminal_state(client):
    setup = setup_approved_assignment(client, quantity=200, resource_quantity=300)
    assignment = setup["assignment"]
    resource_id = setup["resource"]["id"]

    invalid_jump = _status(client, assignment["id"], "delivered")
    assert invalid_jump.status_code == 409

    no_key = client.post(
        f"/api/assignments/{assignment['id']}/status",
        json={"status": "dispatched"},
    )
    assert no_key.status_code == 401
    wrong_key = client.post(
        f"/api/assignments/{assignment['id']}/status",
        json={"status": "dispatched"},
        headers={"X-Volunteer-Key": "wrong"},
    )
    assert wrong_key.status_code == 403

    dispatched = data(_status(client, assignment["id"], "dispatched"))
    assert dispatched["status"] == "dispatched"
    assert dispatched["volunteer_name"] == "Test Volunteer"
    assert dispatched["dispatched_at"] is not None

    assert _status(client, assignment["id"], "dispatched").status_code == 409

    in_transit = data(_status(client, assignment["id"], "in_transit"))
    assert in_transit["status"] == "in_transit"

    delivered = data(
        _status(
            client,
            assignment["id"],
            "delivered",
            note="Water handed to shelter lead; signed receipt collected.",
        )
    )
    assert delivered["status"] == "delivered"
    assert delivered["inventory_consumed"] is True
    assert delivered["delivered_at"] is not None
    assert "signed receipt" in delivered["confirmation_note"]

    stock = data(client.get(f"/api/resources/{resource_id}"))
    assert stock["quantity_total"] == 100
    assert stock["quantity_available"] == 100
    assert stock["quantity_reserved"] == 0

    # Terminal states cannot be changed or double-consumed.
    assert _status(client, assignment["id"], "delivered").status_code == 409
    assert _status(client, assignment["id"], "cancelled", note="Too late").status_code == 409
    stock = data(client.get(f"/api/resources/{resource_id}"))
    assert (stock["quantity_total"], stock["quantity_reserved"]) == (100, 0)

    dashboard = data(client.get("/api/dashboard/metrics"))
    assert dashboard["completed_deliveries"] == 1
    assert dashboard["delivered_assignments"] == 1
    assert dashboard["active_assignments"] == 0
    assert dashboard["delivery_completion_rate"] == 100.0


def test_cancellation_releases_inventory_exactly_once(client):
    setup = setup_approved_assignment(client, quantity=200, resource_quantity=300)
    assignment = setup["assignment"]
    resource_id = setup["resource"]["id"]
    recommendation_id = setup["recommendation"]["id"]

    cancelled = data(
        _status(
            client,
            assignment["id"],
            "cancelled",
            note="Supplier truck broke down before dispatch.",
        )
    )
    assert cancelled["status"] == "cancelled"
    assert cancelled["inventory_released"] is True
    assert "truck broke down" in cancelled["failure_reason"]

    stock = data(client.get(f"/api/resources/{resource_id}"))
    assert stock["quantity_total"] == 300
    assert stock["quantity_available"] == 300
    assert stock["quantity_reserved"] == 0

    assert _status(client, assignment["id"], "cancelled", note="Again").status_code == 409
    stock = data(client.get(f"/api/resources/{resource_id}"))
    assert (stock["quantity_available"], stock["quantity_reserved"]) == (300, 0)

    recommendation = data(client.get(f"/api/matches/{recommendation_id}"))
    assert recommendation["needs_review"] is True

    shortages = data(
        client.get("/api/shortages", params={"report_id": setup["report"]["id"]})
    )
    assert any(item["status"] == "open" for item in shortages)


def test_failed_delivery_requires_reason_and_releases_inventory(client):
    setup = setup_approved_assignment(client, quantity=150, resource_quantity=300)
    assignment = setup["assignment"]
    resource_id = setup["resource"]["id"]

    data(_status(client, assignment["id"], "dispatched"))
    data(_status(client, assignment["id"], "in_transit"))

    missing_reason = _status(client, assignment["id"], "failed")
    assert missing_reason.status_code == 422

    failed = data(
        _status(
            client,
            assignment["id"],
            "failed",
            failure_reason="Road became impassable; delivery could not reach the shelter.",
        )
    )
    assert failed["status"] == "failed"
    assert failed["inventory_released"] is True
    assert "impassable" in failed["failure_reason"]

    stock = data(client.get(f"/api/resources/{resource_id}"))
    assert (stock["quantity_total"], stock["quantity_available"], stock["quantity_reserved"]) == (
        300,
        300,
        0,
    )

    assert (
        _status(
            client,
            assignment["id"],
            "failed",
            failure_reason="Duplicate failure.",
        ).status_code
        == 409
    )
    stock = data(client.get(f"/api/resources/{resource_id}"))
    assert (stock["quantity_available"], stock["quantity_reserved"]) == (300, 0)
