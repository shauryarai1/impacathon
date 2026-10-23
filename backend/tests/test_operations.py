"""Stage 6: route blocking, replanning, shortages, and dashboard metrics."""

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


def _route_scenario(client):
    supplier = create_supplier(client, name="Northside Route Supplier", location="Northside")
    resource = create_resource(client, supplier["id"], quantity=300)
    route = create_route(
        client, origin="Northside", destination="Riverside", travel_cost=2.5
    )
    report = create_report(client, quantity=500)
    verify_report(client, report["id"])
    recommendation = generate_matches(client, report["id"])["recommendations"][0]
    return supplier, resource, route, report, recommendation


def test_blocking_route_flags_plans_and_prevents_approval(client):
    _, _, route, _, recommendation = _route_scenario(client)
    assert recommendation["route_id"] == route["id"]

    no_key = client.post(
        f"/api/routes/{route['id']}/block", json={"reason": "Flooding."}
    )
    assert no_key.status_code == 401

    blocked = data(
        client.post(
            f"/api/routes/{route['id']}/block",
            json={"reason": "Bridge flooded after heavy rain."},
            headers=COORDINATOR_HEADERS,
        )
    )
    assert blocked["blocked"] is True
    assert "Bridge flooded" in blocked["blocked_reason"]

    flagged = data(client.get(f"/api/matches/{recommendation['id']}"))
    assert flagged["needs_review"] is True
    assert "blocked" in flagged["review_reason"].lower()

    approval = client.post(
        f"/api/matches/{recommendation['id']}/approve",
        json={"reason": "Try blocked route."},
        headers=COORDINATOR_HEADERS,
    )
    assert approval.status_code == 409

    reopened = data(
        client.post(
            f"/api/routes/{route['id']}/unblock",
            json={"reason": "Water receded and bridge inspected."},
            headers=COORDINATOR_HEADERS,
        )
    )
    assert reopened["blocked"] is False

    approved = approve_match(client, recommendation["id"])
    assignment = approved["assignment"]
    assert assignment["status"] == "approved"

    # Blocking again flags the unfinished assignment for coordinator review.
    data(
        client.post(
            f"/api/routes/{route['id']}/block",
            json={"reason": "Bridge closed again."},
            headers=COORDINATOR_HEADERS,
        )
    )
    flagged_assignment = data(client.get(f"/api/assignments/{assignment['id']}"))
    assert flagged_assignment["needs_review"] is True
    assert "blocked" in flagged_assignment["review_reason"].lower()


def test_blocked_route_is_excluded_when_replanning(client):
    _, _, route, report, recommendation = _route_scenario(client)

    data(
        client.post(
            f"/api/routes/{route['id']}/block",
            json={"reason": "Landslide covers the road."},
            headers=COORDINATOR_HEADERS,
        )
    )

    replan = generate_matches(client, report["id"])
    assert replan["generated_count"] == 0
    assert replan["superseded_count"] == 1
    assert any(item["quantity"] == 500 for item in replan["shortages"])

    data(
        client.post(
            f"/api/routes/{route['id']}/unblock",
            json={"reason": "Road cleared."},
            headers=COORDINATOR_HEADERS,
        )
    )
    replan_after_unblock = generate_matches(client, report["id"])
    assert replan_after_unblock["generated_count"] == 1
    assert replan_after_unblock["recommendations"][0]["route_id"] == route["id"]


def test_shortages_and_dashboard_metrics(client):
    supplier = create_supplier(client, name="Dashboard Supplier", location="Riverside")
    resource = create_resource(client, supplier["id"], quantity=300)
    create_route(
        client,
        origin="Eastbridge",
        destination="Riverside",
        travel_cost=5.0,
        blocked=True,
    )

    report = create_report(client, quantity=500)
    verify_report(client, report["id"])
    recommendation = generate_matches(client, report["id"])["recommendations"][0]

    metrics = data(client.get("/api/dashboard/metrics"))
    assert metrics["total_requests"] == 1
    assert metrics["total_reports"] == 1
    assert metrics["pending_verification"] == 0
    assert metrics["verified_requests"] == 1
    assert metrics["verified_needs"] == 1
    assert metrics["approved_assignments"] == 0
    assert metrics["completed_deliveries"] == 0
    assert metrics["delivered_assignments"] == 0
    assert metrics["shortages"] == 1
    assert metrics["blocked_routes"] == 1
    assert metrics["open_shortage_units"] == 200
    assert metrics["outstanding_demand"] == 500
    assert metrics["delivery_completion_rate"] == 0.0
    assert metrics["proposed_matches"] == 1
    assert metrics["available_inventory_units"] == 300
    assert metrics["reserved_inventory_units"] == 0

    approve_match(client, recommendation["id"])
    metrics = data(client.get("/api/dashboard/metrics"))
    assert metrics["approved_assignments"] == 1
    assert metrics["active_assignments"] == 1
    assert metrics["available_inventory_units"] == 0
    assert metrics["reserved_inventory_units"] == 300
    assert metrics["open_shortage_units"] == 200
    assert metrics["outstanding_demand"] == 200
    assert metrics["delivery_completion_rate"] == 0.0

    too_large = client.post(
        "/api/shortages",
        json={
            "report_id": report["id"],
            "quantity": 501,
            "reason": "Impossible shortage.",
        },
        headers=COORDINATOR_HEADERS,
    )
    assert too_large.status_code == 409

    manual = data(
        client.post(
            "/api/shortages",
            json={
                "report_id": report["id"],
                "quantity": 25,
                "reason": "Additional baby formula shortage reported by the shelter.",
            },
            headers=COORDINATOR_HEADERS,
        )
    )
    assert manual["source"] == "manual"
    assert manual["status"] == "open"

    metrics = data(client.get("/api/dashboard/metrics"))
    assert metrics["shortages"] == 2
    assert metrics["open_shortage_units"] == 225

    resolved = data(
        client.post(
            f"/api/shortages/{manual['id']}/resolve",
            json={"reason": "Emergency formula delivery confirmed."},
            headers=COORDINATOR_HEADERS,
        )
    )
    assert resolved["status"] == "resolved"
    assert resolved["resolved_at"] is not None

    metrics = data(client.get("/api/dashboard/metrics"))
    assert metrics["shortages"] == 1
    assert metrics["open_shortage_units"] == 200
