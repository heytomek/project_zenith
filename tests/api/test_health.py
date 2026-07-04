from app.main import app
from fastapi.testclient import TestClient


def test_health_reports_database_backend_and_tables() -> None:
    client = TestClient(app)

    response = client.get("/api/v1/health")
    payload = response.json()

    assert response.status_code == 200
    assert payload["service"] == "zenith-api"
    assert "organizations" in payload["configured_tables"]
    assert "roles" in payload["configured_tables"]
