import os, time
from typing import Any, Dict, List, Optional
import requests

KEYCLOAK_ADMIN_BASE_URL = os.getenv("KEYCLOAK_ADMIN_BASE_URL", "http://keycloak:8080").rstrip("/")
KEYCLOAK_ADMIN_REALM = os.getenv("KEYCLOAK_ADMIN_REALM", "master")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "ziza")

KEYCLOAK_ADMIN_CLIENT_ID = os.getenv("KEYCLOAK_ADMIN_CLIENT_ID", "admin-cli")
KEYCLOAK_ADMIN_USER = os.getenv("KEYCLOAK_ADMIN_USER", os.getenv("KEYCLOAK_ADMIN", "admin"))
KEYCLOAK_ADMIN_PASS = os.getenv("KEYCLOAK_ADMIN_PASS", os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin"))

_cache: Dict[str, Any] = {"token": None, "exp": 0.0}

def _token_url() -> str:
    return f"{KEYCLOAK_ADMIN_BASE_URL}/realms/{KEYCLOAK_ADMIN_REALM}/protocol/openid-connect/token"

def _admin_headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}

def get_admin_token() -> str:
    now = time.time()
    if _cache.get("token") and now < float(_cache.get("exp", 0)):
        return str(_cache["token"])

    data = {
        "client_id": KEYCLOAK_ADMIN_CLIENT_ID,
        "grant_type": "password",
        "username": KEYCLOAK_ADMIN_USER,
        "password": KEYCLOAK_ADMIN_PASS,
    }
    r = requests.post(_token_url(), data=data, timeout=10)
    r.raise_for_status()
    j = r.json()
    token = j.get("access_token")
    if not token:
        raise RuntimeError("Keycloak admin token response missing access_token")
    _cache["token"] = token
    _cache["exp"] = now + float(j.get("expires_in", 60)) - 10
    return token

def _kc(url: str, method: str = "GET", token: Optional[str] = None, json_body: Any = None) -> requests.Response:
    tok = token or get_admin_token()
    headers = _admin_headers(tok)
    if json_body is not None:
        headers = {**headers, "Content-Type": "application/json"}
        return requests.request(method, url, headers=headers, json=json_body, timeout=15)
    return requests.request(method, url, headers=headers, timeout=15)

def find_user_id_by_email(email: str) -> Optional[str]:
    tok = get_admin_token()
    base = f"{KEYCLOAK_ADMIN_BASE_URL}/admin/realms/{KEYCLOAK_REALM}/users"
    for url in [
        f"{base}?username={requests.utils.quote(email)}&exact=true",
        f"{base}?email={requests.utils.quote(email)}&exact=true",
        f"{base}?search={requests.utils.quote(email)}",
    ]:
        r = _kc(url, token=tok)
        r.raise_for_status()
        arr = r.json()
        if isinstance(arr, list) and arr:
            return arr[0].get("id")
    return None

def get_user(oidc_sub: str) -> Dict[str, Any]:
    url = f"{KEYCLOAK_ADMIN_BASE_URL}/admin/realms/{KEYCLOAK_REALM}/users/{oidc_sub}"
    r = _kc(url)
    r.raise_for_status()
    return r.json()

def update_user(oidc_sub: str, payload: Dict[str, Any]) -> None:
    url = f"{KEYCLOAK_ADMIN_BASE_URL}/admin/realms/{KEYCLOAK_REALM}/users/{oidc_sub}"
    r = _kc(url, method="PUT", json_body=payload)
    if r.status_code != 204:
        raise RuntimeError(f"Keycloak update user failed (HTTP {r.status_code}): {r.text}")

def normalize_user_setup(oidc_sub: str) -> None:
    u = get_user(oidc_sub)
    u["enabled"] = True
    u["emailVerified"] = True
    u["requiredActions"] = []
    update_user(oidc_sub, u)

def get_realm_role(role_name: str) -> Dict[str, Any]:
    url = f"{KEYCLOAK_ADMIN_BASE_URL}/admin/realms/{KEYCLOAK_REALM}/roles/{role_name}"
    r = _kc(url)
    r.raise_for_status()
    return r.json()

def user_realm_roles(oidc_sub: str) -> List[str]:
    url = f"{KEYCLOAK_ADMIN_BASE_URL}/admin/realms/{KEYCLOAK_REALM}/users/{oidc_sub}/role-mappings/realm"
    r = _kc(url)
    r.raise_for_status()
    arr = r.json()
    if not isinstance(arr, list):
        return []
    return [x.get("name") for x in arr if x.get("name")]

def add_realm_role(oidc_sub: str, role_name: str) -> None:
    role = get_realm_role(role_name)
    payload = [{"id": role.get("id"), "name": role.get("name")}]
    url = f"{KEYCLOAK_ADMIN_BASE_URL}/admin/realms/{KEYCLOAK_REALM}/users/{oidc_sub}/role-mappings/realm"
    r = _kc(url, method="POST", json_body=payload)
    if r.status_code != 204:
        raise RuntimeError(f"Keycloak add role failed (HTTP {r.status_code}): {r.text}")

def remove_realm_role(oidc_sub: str, role_name: str) -> None:
    role = get_realm_role(role_name)
    payload = [{"id": role.get("id"), "name": role.get("name")}]
    url = f"{KEYCLOAK_ADMIN_BASE_URL}/admin/realms/{KEYCLOAK_REALM}/users/{oidc_sub}/role-mappings/realm"
    r = _kc(url, method="DELETE", json_body=payload)
    if r.status_code != 204:
        raise RuntimeError(f"Keycloak remove role failed (HTTP {r.status_code}): {r.text}")
