"""Health, docs, and CORS checks."""

from tests.helpers import data


def test_health_and_docs_still_work(client):
    health = client.get("/api/health")
    assert health.status_code == 200
    body = health.json()
    assert body["success"] is True
    assert body["data"] == {"status": "ok", "database": "ok"}

    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200

    schema = client.get("/openapi.json")
    assert schema.status_code == 200
    paths = schema.json()["paths"]
    for path in [
        "/api/health",
        "/api/reports",
        "/api/reports/{report_id}/verify",
        "/api/matches",
        "/api/matches/{recommendation_id}/approve",
        "/api/assignments/{assignment_id}/status",
        "/api/dashboard/metrics",
    ]:
        assert path in paths


def test_root_and_cors_for_react_frontend(client):
    root = client.get("/")
    assert root.status_code == 200
    assert root.json()["message"] == "Lifeline API is running"

    preflight = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "http://localhost:5173"
