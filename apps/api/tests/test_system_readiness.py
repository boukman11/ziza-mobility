from main import app
from fastapi.testclient import TestClient


def test_readiness_endpoint_returns_expected_shape(monkeypatch):
    monkeypatch.setenv("KEYCLOAK_URL", "http://keycloak:8080")
    monkeypatch.setenv("KEYCLOAK_REALM", "ziza")
    monkeypatch.setenv("CUSTOMER_AUD", "customer-app")
    monkeypatch.setenv("DRIVER_AUD", "driver-app")
    monkeypatch.setenv("ADMIN_AUD", "admin-app")
    monkeypatch.setenv("GCP_PROJECT_ID", "ziza-mobility")
    monkeypatch.setenv("GCP_REGION", "us-east1")

    client = TestClient(app)
    response = client.get("/v1/system/readiness")

    assert response.status_code == 200
    payload = response.json()
    assert set(["ok", "db", "env", "project", "region", "time_utc"]).issubset(payload.keys())
    assert payload["project"] == "ziza-mobility"
    assert payload["region"] == "us-east1"
