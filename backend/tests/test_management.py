"""Supplier/resource management and stock invariants."""

from tests.helpers import (
    COORDINATOR_HEADERS,
    create_resource,
    create_supplier,
    data,
)


def test_supplier_update_and_resource_restock(client):
    supplier = create_supplier(client, name="Manageable Supplier", location="Riverside")
    resource = create_resource(client, supplier["id"], quantity=100)

    updated = data(
        client.patch(
            f"/api/suppliers/{supplier['id']}",
            json={
                "active": False,
                "contact_name": "New Contact",
                "reason": "Supplier temporarily paused.",
            },
            headers=COORDINATOR_HEADERS,
        )
    )
    assert updated["active"] is False
    assert updated["contact_name"] == "New Contact"

    no_change = client.patch(
        f"/api/suppliers/{supplier['id']}",
        json={"reason": "Only a reason was supplied."},
        headers=COORDINATOR_HEADERS,
    )
    assert no_change.status_code == 422

    restocked = data(
        client.post(
            f"/api/resources/{resource['id']}/restock",
            json={"quantity": 50, "reason": "Emergency resupply arrived."},
            headers=COORDINATOR_HEADERS,
        )
    )
    assert restocked["quantity_total"] == 150
    assert restocked["quantity_available"] == 150
    assert restocked["quantity_reserved"] == 0

    invalid = client.post(
        f"/api/resources/{resource['id']}/restock",
        json={"quantity": -5, "reason": "Invalid negative restock."},
        headers=COORDINATOR_HEADERS,
    )
    assert invalid.status_code == 422

    stock = data(client.get(f"/api/resources/{resource['id']}"))
    assert (stock["quantity_total"], stock["quantity_available"]) == (150, 150)

    unauthorized = client.patch(
        f"/api/suppliers/{supplier['id']}",
        json={"active": True, "reason": "No coordinator key."},
    )
    assert unauthorized.status_code == 401
