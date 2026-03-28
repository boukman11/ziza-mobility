from main import app
from fastapi.testclient import TestClient


def test_onboarding_checklist_customer():
    client = TestClient(app)
    response = client.get("/v1/system/onboarding/checklist?role=customer")
    assert response.status_code == 200
    payload = response.json()
    assert payload["role"] == "customer"
    assert payload["sprint"] == 59
    assert any("ride estimate" in item.lower() for item in payload["items"])


def test_onboarding_checklist_invalid_role():
    client = TestClient(app)
    response = client.get("/v1/system/onboarding/checklist?role=ops")
    assert response.status_code == 422
