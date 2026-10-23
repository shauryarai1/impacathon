"""Full REPORT -> VERIFY -> MATCH -> REVIEW -> DELIVER -> CONFIRM/REPLAN flow."""

from tests.helpers import (
    COORDINATOR_HEADERS,
    VOLUNTEER_HEADERS,
    approve_match,
    create_report,
    create_resource,
    create_route,
    create_supplier,
    data,
    generate_matches,
    verify_report,
)


def _update_status(client, assignment_id, status, **extra):
    return data(
        client.post(
            f"/api/assignments/{assignment_id}/status",
            json={"status": status, **extra},
            headers=VOLUNTEER_HEADERS,
        )
    )


def test_complete_workflow_with_route_block_and_human_replan(client):
    # 1-3. Resident report starts pending; a human coordinator verifies it.
    report = create_report(
        client,
        category="water",
        location="Riverside",
        quantity=100,
        urgency="critical",
        description="Shelter needs drinking water for displaced families.",
    )
    assert report["status"] == "pending_verification"
    assert verify_report(client, report["id"])["status"] == "verified"

    # 4. Verified supplier lists partial stock (80 of the 100 needed).
    supplier = create_supplier(
        client, name="E2E Riverside Water", location="Riverside"
    )
    resource = create_resource(client, supplier["id"], quantity=80)

    # 5-6. Matching proposes a partial allocation; stock is untouched.
    match = generate_matches(client, report["id"])
    recommendation = match["recommendations"][0]
    assert recommendation["quantity"] == 80
    assert match["shortages"][0]["quantity"] == 20

    stock = data(client.get(f"/api/resources/{resource['id']}"))
    assert (stock["quantity_available"], stock["quantity_reserved"]) == (80, 0)
    assert data(client.get("/api/assignments")) == []

    # 7-8. Explicit human approval reserves stock and creates the assignment.
    approval = approve_match(
        client, recommendation["id"], "Verified water delivery route."
    )
    assignment = approval["assignment"]
    assert assignment["status"] == "approved"

    stock = data(client.get(f"/api/resources/{resource['id']}"))
    assert (stock["quantity_available"], stock["quantity_reserved"]) == (0, 80)

    audit = data(
        client.get(
            "/api/audit-logs?action=recommendation_approved",
            headers=COORDINATOR_HEADERS,
        )
    )
    assert audit
    assert audit[0]["details"]["before"]["recommendation_status"] == "proposed"
    assert audit[0]["details"]["after"]["assignment_id"] == assignment["id"]

    # 9-10. Volunteer progresses and confirms the delivery.
    assert _update_status(client, assignment["id"], "dispatched")["status"] == "dispatched"
    assert (
        _update_status(client, assignment["id"], "in_transit")["status"]
        == "in_transit"
    )
    delivered = _update_status(
        client,
        assignment["id"],
        "delivered",
        note="Delivered to Riverside shelter lead; receipt signed.",
    )
    assert delivered["status"] == "delivered"
    assert delivered["inventory_consumed"] is True
    stock = data(client.get(f"/api/resources/{resource['id']}"))
    assert (stock["quantity_total"], stock["quantity_reserved"]) == (0, 0)

    # 11. A separate route is blocked after the first delivery.
    route_supplier = create_supplier(
        client, name="E2E Northside Water", location="Northside"
    )
    route_resource = create_resource(client, route_supplier["id"], quantity=50)
    route = create_route(
        client, origin="Northside", destination="Eastbridge", travel_cost=3.0
    )
    second_report = create_report(
        client,
        category="water",
        location="Eastbridge",
        quantity=50,
        description="Eastbridge clinic needs bottled water after the flood.",
    )
    verify_report(client, second_report["id"])
    second_match = generate_matches(client, second_report["id"])
    second_recommendation = second_match["recommendations"][0]
    assert second_recommendation["route_id"] == route["id"]

    data(
        client.post(
            f"/api/routes/{route['id']}/block",
            json={"reason": "Floodwater covered the Northside road."},
            headers=COORDINATOR_HEADERS,
        )
    )
    flagged = data(client.get(f"/api/matches/{second_recommendation['id']}"))
    assert flagged["needs_review"] is True

    blocked_approval = client.post(
        f"/api/matches/{second_recommendation['id']}/approve",
        json={"reason": "Attempt to use blocked route."},
        headers=COORDINATOR_HEADERS,
    )
    assert blocked_approval.status_code == 409

    # 12. Add an alternative supplier and replan. This only creates a new
    # proposal; it does not approve or dispatch anything.
    alternative_supplier = create_supplier(
        client, name="E2E Eastbridge Water", location="Eastbridge"
    )
    alternative_resource = create_resource(
        client, alternative_supplier["id"], quantity=50
    )
    replan = generate_matches(client, second_report["id"])
    assert replan["generated_count"] == 1
    alternative = replan["recommendations"][0]
    assert alternative["supplier_id"] == alternative_supplier["id"]
    assert alternative["route_id"] is None
    assert alternative["status"] == "proposed"
    assert alternative["assignment_id"] is None
    assert len(data(client.get("/api/assignments"))) == 1

    # Another coordinator decision is required before the alternative moves.
    alternative_approval = approve_match(
        client, alternative["id"], "Alternative same-area supplier approved."
    )
    assert alternative_approval["assignment"]["status"] == "approved"

    # 13. Dashboard reflects actual database state.
    metrics = data(client.get("/api/dashboard/metrics"))
    assert metrics["total_reports"] == 2
    assert metrics["pending_verification"] == 0
    assert metrics["verified_needs"] == 2
    assert metrics["approved_assignments"] == 2
    assert metrics["delivered_assignments"] == 1
    assert metrics["completed_deliveries"] == 1
    assert metrics["delivery_completion_rate"] == 50.0
    assert metrics["blocked_routes"] == 1
    assert metrics["outstanding_demand"] == 20
    assert metrics["open_shortage_units"] == 20
    assert metrics["reserved_inventory_units"] == 50
    assert data(client.get(f"/api/resources/{alternative_resource['id']}"))[
        "quantity_reserved"
    ] == 50
