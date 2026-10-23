"""Stage 4: human approval, authorization, atomic reservation, and review."""

from tests.helpers import (
    COORDINATOR_HEADERS,
    approve_match,
    create_report,
    create_resource,
    create_route,
    create_supplier,
    data,
    generate_matches,
    verify_report,
)


def _single_match(client, *, report_quantity=500, resource_quantity=300):
    supplier = create_supplier(client, name="Approval Supplier", location="Riverside")
    resource = create_resource(
        client, supplier["id"], quantity=resource_quantity, category="water"
    )
    report = create_report(client, category="water", quantity=report_quantity)
    verify_report(client, report["id"])
    result = generate_matches(client, report["id"])
    return supplier, resource, report, result["recommendations"][0]


def test_approval_requires_authorization_and_is_atomic(client):
    _, resource, _, recommendation = _single_match(client)

    assert (
        client.post(
            f"/api/matches/{recommendation['id']}/approve",
            json={"reason": "Approved."},
        ).status_code
        == 401
    )
    assert (
        client.post(
            f"/api/matches/{recommendation['id']}/approve",
            json={"reason": "Approved."},
            headers={"X-Coordinator-Key": "bad"},
        ).status_code
        == 403
    )

    approved = approve_match(client, recommendation["id"], "Approved for delivery.")
    assignment = approved["assignment"]
    assert assignment["status"] == "approved"
    assert assignment["quantity"] == recommendation["quantity"]
    assert assignment["created_by_id"] is not None
    assert approved["recommendation"]["status"] == "approved"
    assert approved["recommendation"]["assignment_id"] == assignment["id"]

    stock = data(client.get(f"/api/resources/{resource['id']}"))
    assert stock["quantity_total"] == 300
    assert stock["quantity_available"] == 0
    assert stock["quantity_reserved"] == 300

    assignments = data(client.get("/api/assignments"))
    assert len(assignments) == 1
    assert assignments[0]["status"] == "approved"

    duplicate = client.post(
        f"/api/matches/{recommendation['id']}/approve",
        json={"reason": "Approve again."},
        headers=COORDINATOR_HEADERS,
    )
    assert duplicate.status_code == 409

    stock = data(client.get(f"/api/resources/{resource['id']}"))
    assert (stock["quantity_available"], stock["quantity_reserved"]) == (0, 300)

    # There is deliberately no direct assignment-creation endpoint.
    assert client.post("/api/assignments", json={}).status_code == 405

    audit = data(client.get("/api/audit-logs", headers=COORDINATOR_HEADERS))
    actions = {entry["action"] for entry in audit}
    assert "recommendation_approved" in actions
    assert "assignment_created" in actions


def test_modify_then_reject_never_creates_assignment(client):
    _, resource, _, recommendation = _single_match(client)

    too_much = client.post(
        f"/api/matches/{recommendation['id']}/modify",
        json={"reason": "Try to over-allocate.", "quantity": 301},
        headers=COORDINATOR_HEADERS,
    )
    assert too_much.status_code == 409

    invalid_quantity = client.post(
        f"/api/matches/{recommendation['id']}/modify",
        json={"reason": "Negative stock attempt.", "quantity": -5},
        headers=COORDINATOR_HEADERS,
    )
    assert invalid_quantity.status_code == 422

    modified = data(
        client.post(
            f"/api/matches/{recommendation['id']}/modify",
            json={"reason": "Reduce the first delivery.", "quantity": 200},
            headers=COORDINATOR_HEADERS,
        )
    )
    assert modified["status"] == "proposed"
    assert modified["quantity"] == 200
    assert modified["assignment_id"] is None

    stock = data(client.get(f"/api/resources/{resource['id']}"))
    assert (stock["quantity_available"], stock["quantity_reserved"]) == (300, 0)

    rejected = data(
        client.post(
            f"/api/matches/{recommendation['id']}/reject",
            json={"reason": "Supplier cannot deliver today."},
            headers=COORDINATOR_HEADERS,
        )
    )
    assert rejected["status"] == "rejected"
    assert data(client.get("/api/assignments")) == []

    # A rejected proposal cannot later be approved.
    assert (
        client.post(
            f"/api/matches/{recommendation['id']}/approve",
            json={"reason": "Too late."},
            headers=COORDINATOR_HEADERS,
        ).status_code
        == 409
    )


def test_two_recommendations_cannot_over_allocate(client):
    first_supplier = create_supplier(client, name="Near Supplier", location="Riverside")
    second_supplier = create_supplier(client, name="Route Supplier", location="Northside")
    first_resource = create_resource(client, first_supplier["id"], quantity=300)
    second_resource = create_resource(client, second_supplier["id"], quantity=200)
    create_route(client, origin="Northside", destination="Riverside", travel_cost=2.0)

    report = create_report(client, quantity=500)
    verify_report(client, report["id"])
    recommendations = generate_matches(client, report["id"])["recommendations"]
    assert len(recommendations) == 2

    first_approval = approve_match(client, recommendations[0]["id"])
    assert first_approval["assignment"]["quantity"] == 300

    # Only 200 units of outstanding demand remain; asking for 201 must fail.
    over_demand = client.post(
        f"/api/matches/{recommendations[1]['id']}/modify",
        json={"reason": "Over demand.", "quantity": 201},
        headers=COORDINATOR_HEADERS,
    )
    assert over_demand.status_code == 409

    second_approval = approve_match(client, recommendations[1]["id"])
    assert second_approval["assignment"]["quantity"] == 200

    stock_one = data(client.get(f"/api/resources/{first_resource['id']}"))
    stock_two = data(client.get(f"/api/resources/{second_resource['id']}"))
    assert (stock_one["quantity_available"], stock_one["quantity_reserved"]) == (0, 300)
    assert (stock_two["quantity_available"], stock_two["quantity_reserved"]) == (0, 200)

    # The report is fully committed; a fresh matching run creates no proposals.
    rerun = generate_matches(client, report["id"])
    assert rerun["generated_count"] == 0
    assert rerun["superseded_count"] == 0
