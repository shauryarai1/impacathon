"""Stage 3: deterministic matching, route accessibility, and shortages."""

from tests.helpers import (
    COORDINATOR_HEADERS,
    create_report,
    create_resource,
    create_route,
    create_supplier,
    data,
    generate_matches,
    verify_report,
)


def _match_scenario(client):
    riverside = create_supplier(client, name="Riverside Depot", location="Riverside")
    northside = create_supplier(client, name="Northside Depot", location="Northside")
    eastbridge = create_supplier(client, name="Eastbridge Depot", location="Eastbridge")

    r_riverside = create_resource(client, riverside["id"], quantity=300)
    r_northside = create_resource(client, northside["id"], quantity=100)
    r_eastbridge = create_resource(client, eastbridge["id"], quantity=500)

    create_route(client, origin="Northside", destination="Riverside", travel_cost=2.0)
    create_route(
        client,
        origin="Eastbridge",
        destination="Riverside",
        travel_cost=6.0,
        blocked=True,
    )

    report = create_report(client, category="water", location="Riverside", quantity=500)
    verify_report(client, report["id"])

    unmatched_report = create_report(
        client,
        category="food",
        location="Hilltop",
        quantity=100,
        description="Food boxes needed for the Hilltop shelter tonight.",
    )
    return {
        "report": report,
        "unmatched_report": unmatched_report,
        "resources": {
            "riverside": r_riverside,
            "northside": r_northside,
            "eastbridge": r_eastbridge,
        },
    }


def test_matching_requires_coordinator_and_verified_need(client):
    scenario = _match_scenario(client)

    no_key = client.post("/api/matches", json={"report_id": scenario["report"]["id"]})
    assert no_key.status_code == 401

    wrong_key = client.post(
        "/api/matches",
        json={"report_id": scenario["report"]["id"]},
        headers={"X-Coordinator-Key": "nope"},
    )
    assert wrong_key.status_code == 403

    unverified = client.post(
        "/api/matches",
        json={"report_id": scenario["unmatched_report"]["id"]},
        headers=COORDINATOR_HEADERS,
    )
    assert unverified.status_code == 409


def test_only_verified_active_suppliers_are_eligible(client):
    pending_supplier = create_supplier(
        client, name="Pending Supplier", location="Riverside", verified=False
    )
    inactive_supplier = create_supplier(
        client, name="Inactive Supplier", location="Riverside", active=False
    )
    eligible_supplier = create_supplier(
        client, name="Eligible Supplier", location="Riverside"
    )
    create_resource(client, pending_supplier["id"], quantity=100)
    create_resource(client, inactive_supplier["id"], quantity=100)
    create_resource(client, eligible_supplier["id"], quantity=50)

    report = create_report(client, category="water", location="Riverside", quantity=300)
    verify_report(client, report["id"])

    result = generate_matches(client, report["id"])
    assert result["generated_count"] == 1
    assert result["recommendations"][0]["quantity"] == 50
    assert result["recommendations"][0]["supplier_name"] == "Eligible Supplier"
    assert any(item["quantity"] == 250 for item in result["shortages"])


def test_matching_does_not_double_promise_stock_across_reports(client):
    supplier = create_supplier(client, name="Shared Stock", location="Riverside")
    resource = create_resource(client, supplier["id"], quantity=300)

    first = create_report(
        client,
        category="water",
        location="Riverside",
        quantity=200,
        description="First water request at the Riverside shelter.",
    )
    second = create_report(
        client,
        category="water",
        location="Riverside",
        quantity=200,
        description="Second water request at the Riverside clinic.",
    )
    verify_report(client, first["id"])
    verify_report(client, second["id"])

    result = generate_matches(client)
    assert result["generated_count"] == 2
    assert sum(item["quantity"] for item in result["recommendations"]) == 300
    assert max(item["quantity"] for item in result["recommendations"]) <= 300

    stock = data(client.get(f"/api/resources/{resource['id']}"))
    assert (stock["quantity_available"], stock["quantity_reserved"]) == (300, 0)


def test_no_replace_mode_keeps_existing_proposals_and_respects_stock(client):
    supplier = create_supplier(client, name="No Replace Supplier", location="Riverside")
    create_resource(client, supplier["id"], quantity=100)

    first = create_report(
        client,
        quantity=100,
        description="First shelter water request at Riverside.",
    )
    second = create_report(
        client,
        quantity=100,
        description="Second clinic water request at Riverside.",
    )
    verify_report(client, first["id"])
    verify_report(client, second["id"])

    first_run = generate_matches(client, first["id"])
    assert first_run["generated_count"] == 1
    assert first_run["recommendations"][0]["quantity"] == 100

    preserve = data(
        client.post(
            "/api/matches",
            json={"replace_proposed": False},
            headers=COORDINATOR_HEADERS,
        )
    )
    assert preserve["generated_count"] == 0
    assert preserve["superseded_count"] == 0

    proposed = data(client.get("/api/matches", params={"status": "proposed"}))
    assert len(proposed) == 1
    assert sum(item["quantity"] for item in proposed) == 100


def test_matching_is_partial_deterministic_and_never_allocates(client):
    scenario = _match_scenario(client)

    result = generate_matches(client, scenario["report"]["id"])
    assert result["generated_count"] == 2
    recommendations = result["recommendations"]

    # Same-area supply is cheapest; the Northside route is next. Blocked
    # Eastbridge supply is excluded even though it has the most stock.
    assert [item["quantity"] for item in recommendations] == [300, 100]
    assert recommendations[0]["supplier_name"] == "Riverside Depot"
    assert recommendations[0]["route_id"] is None
    assert recommendations[0]["route_cost"] == 0
    assert recommendations[1]["supplier_name"] == "Northside Depot"
    assert recommendations[1]["route_id"] is not None

    assert result["shortages"]
    assert result["shortages"][0]["quantity"] == 100
    assert recommendations[0]["remaining_shortage"] == 100

    # Proposals are not reservations.
    for resource in data(client.get("/api/resources")):
        assert resource["quantity_reserved"] == 0
    assert data(client.get("/api/assignments")) == []

    # Re-running supersedes old proposals and produces the same deterministic set.
    rerun = generate_matches(client, scenario["report"]["id"])
    assert rerun["generated_count"] == 2
    assert rerun["superseded_count"] == 2
    assert [item["quantity"] for item in rerun["recommendations"]] == [300, 100]

    superseded = data(client.get("/api/matches", params={"status": "superseded"}))
    assert len(superseded) == 2
    proposed = data(client.get("/api/matches", params={"status": "proposed"}))
    assert len(proposed) == 2

    # The pending food report was never matched.
    assert all(item["report_id"] == scenario["report"]["id"] for item in proposed)
