"""Shared API helpers for the workflow tests."""

from typing import Any

from fastapi.testclient import TestClient

COORDINATOR_KEY = "test-coordinator-key"
VOLUNTEER_KEY = "test-volunteer-key"
COORDINATOR_HEADERS = {
    "X-Coordinator-Key": COORDINATOR_KEY,
    "X-Coordinator-Name": "Test Coordinator",
}
VOLUNTEER_HEADERS = {
    "X-Volunteer-Key": VOLUNTEER_KEY,
    "X-Volunteer-Name": "Test Volunteer",
}


def data(response):
    assert response.status_code < 400, response.text
    body = response.json()
    assert body["success"] is True, body
    return body["data"]


def create_report(
    client: TestClient,
    *,
    category: str = "water",
    report_type: str = "need",
    location: str = "Riverside",
    description: str = "Families need clean drinking water after the flood.",
    quantity: int = 500,
    urgency: str = "critical",
    reporter_name: str = "Test Reporter",
    **overrides: Any,
):
    payload = {
        "reporter_name": reporter_name,
        "category": category,
        "type": report_type,
        "location": location,
        "description": description,
        "quantity": quantity,
        "urgency": urgency,
    }
    payload.update(overrides)
    return data(client.post("/api/reports", json=payload))


def verify_report(client: TestClient, report_id: int, reason: str = "Verified by phone."):
    return data(
        client.post(
            f"/api/reports/{report_id}/verify",
            json={"reason": reason},
            headers=COORDINATOR_HEADERS,
        )
    )


def create_supplier(
    client: TestClient,
    *,
    name: str = "Test Supplier",
    location: str = "Riverside",
    verified: bool = True,
    active: bool = True,
):
    return data(
        client.post(
            "/api/suppliers",
            json={
                "name": name,
                "location": location,
                "verification_status": "verified" if verified else "pending",
                "active": active,
            },
            headers=COORDINATOR_HEADERS,
        )
    )


def create_resource(
    client: TestClient,
    supplier_id: int,
    *,
    category: str = "water",
    quantity: int = 300,
    name: str = "Test resource",
):
    return data(
        client.post(
            "/api/resources",
            json={
                "supplier_id": supplier_id,
                "name": name,
                "category": category,
                "quantity_available": quantity,
            },
            headers=COORDINATOR_HEADERS,
        )
    )


def create_route(
    client: TestClient,
    *,
    origin: str = "Northside",
    destination: str = "Riverside",
    travel_cost: float = 2.0,
    blocked: bool = False,
):
    return data(
        client.post(
            "/api/routes",
            json={
                "origin": origin,
                "destination": destination,
                "travel_cost": travel_cost,
                "blocked": blocked,
            },
            headers=COORDINATOR_HEADERS,
        )
    )


def generate_matches(client: TestClient, report_id: int | None = None):
    payload = {"report_id": report_id} if report_id else {}
    return data(
        client.post("/api/matches", json=payload, headers=COORDINATOR_HEADERS)
    )


def approve_match(client: TestClient, recommendation_id: int, reason: str = "Approved for dispatch."):
    return data(
        client.post(
            f"/api/matches/{recommendation_id}/approve",
            json={"reason": reason},
            headers=COORDINATOR_HEADERS,
        )
    )


def setup_approved_assignment(
    client: TestClient,
    *,
    quantity: int = 200,
    resource_quantity: int = 300,
    location: str = "Riverside",
):
    supplier = create_supplier(client, location=location)
    resource = create_resource(client, supplier["id"], quantity=resource_quantity)
    report = create_report(client, quantity=quantity, location=location)
    verify_report(client, report["id"])
    result = generate_matches(client, report["id"])
    recommendation = result["recommendations"][0]
    approved = approve_match(client, recommendation["id"])
    return {
        "supplier": supplier,
        "resource": resource,
        "report": report,
        "recommendation": recommendation,
        "assignment": approved["assignment"],
        "approval": approved,
    }
