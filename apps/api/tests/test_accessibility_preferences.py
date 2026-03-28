from main import app
from fastapi.testclient import TestClient
from unittest.mock import patch


FAKE_CLAIMS = {"sub": "sprint60-user", "email": "sprint60@example.com"}


def _fake_verify_token(*args, **kwargs):
    return FAKE_CLAIMS


def test_get_accessibility_preferences_defaults():
    client = TestClient(app)
    with patch("main.verify_token", side_effect=_fake_verify_token):
        response = client.get("/v1/user/accessibility", headers={"Authorization": "Bearer demo"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["accessibility"]["highContrast"] is False
    assert payload["accessibility"]["reducedMotion"] is False
    assert payload["accessibility"]["fontScale"] == 1.0


def test_set_accessibility_preferences_clamps_font_scale():
    client = TestClient(app)
    with patch("main.verify_token", side_effect=_fake_verify_token):
        response = client.put(
            "/v1/user/accessibility",
            json={"highContrast": True, "reducedMotion": True, "fontScale": 5},
            headers={"Authorization": "Bearer demo"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["accessibility"]["highContrast"] is True
    assert payload["accessibility"]["reducedMotion"] is True
    assert payload["accessibility"]["fontScale"] == 1.6
