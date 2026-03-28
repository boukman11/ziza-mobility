#!/usr/bin/env bash
set -euo pipefail

# Fix Keycloak users stuck with: {"error":"invalid_grant","error_description":"Account is not fully set up"}
# Typical cause: requiredActions set on the user (VERIFY_EMAIL / UPDATE_PASSWORD / CONFIGURE_TOTP etc.)
# This script clears requiredActions, forces emailVerified=true, enabled=true, and resets password (non-temporary).

KEYCLOAK_BASE_URL="${KEYCLOAK_BASE_URL:-http://localhost:8080}"
ADMIN_REALM="${ADMIN_REALM:-master}"
REALM="${REALM:-ziza}"

ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin}"
ADMIN_CLIENT_ID="${ADMIN_CLIENT_ID:-admin-cli}"

DEFAULT_PASS="${DEFAULT_PASS:-Passw0rd!}"

USERS=(
  "${CUSTOMER_EMAIL:-customer1@example.com}"
  "${DRIVER_EMAIL:-driver1@example.com}"
  "${ADMIN_EMAIL:-admin1@example.com}"
)

log(){ echo "[kc-fix] $*" >&2; }
die(){ echo "ERROR: $*" >&2; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || die "missing command: $1"; }

need curl
need python

urlenc() {
  python -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$1"
}

wait_200(){
  local url="$1" name="$2"
  log "Waiting for $name at $url ..."
  local deadline=$((SECONDS+180))
  while (( SECONDS < deadline )); do
    local code
    code="$(curl -sS -o /dev/null -w "%{http_code}" "$url" || true)"
    [[ "$code" == "200" ]] && { log "$name ready"; return 0; }
    sleep 2
  done
  die "$name not ready after 180s"
}

admin_token(){
  local tmp code body token
  tmp="$(mktemp)"
  code="$(curl -sS -o "$tmp" -w "%{http_code}" -X POST \
    "${KEYCLOAK_BASE_URL}/realms/${ADMIN_REALM}/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=${ADMIN_CLIENT_ID}" \
    -d "grant_type=password" \
    -d "username=${ADMIN_USER}" \
    -d "password=${ADMIN_PASS}" || echo "000")"
  body="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"
  [[ "$code" == "200" ]] || { echo "$body" >&2; die "admin token request failed (HTTP $code)"; }
  token="$(printf "%s" "$body" | python -c "import sys,json; j=json.load(sys.stdin); print(j.get('access_token',''))")"
  [[ -n "$token" ]] || { echo "$body" >&2; die "token response missing access_token"; }
  echo "$token"
}

first_id(){
  python -c "import sys,json; a=json.load(sys.stdin); print(a[0].get('id','') if isinstance(a,list) and a else '')"
}

get_user_id(){
  local token="$1" email="$2"
  local q; q="$(urlenc "$email")"
  local res
  res="$(curl -sS -H "Authorization: Bearer $token" \
    "${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users?username=${q}&exact=true")"
  local id; id="$(printf "%s" "$res" | first_id)"
  [[ -n "$id" ]] && { echo "$id"; return 0; }

  res="$(curl -sS -H "Authorization: Bearer $token" \
    "${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users?search=${q}")"
  id="$(printf "%s" "$res" | first_id)"
  echo "$id"
}

get_user_json(){
  local token="$1" id="$2"
  curl -sS -H "Authorization: Bearer $token" \
    "${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users/${id}"
}

put_user_json(){
  local token="$1" id="$2" payload="$3"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" -X PUT \
    "${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users/${id}" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    --data "$payload" || echo "000")"
  [[ "$code" == "204" ]] || die "failed updating user ${id} (HTTP $code)"
}

reset_password(){
  local token="$1" id="$2" pass="$3"
  local payload
  payload="$(python -c "import json; print(json.dumps({'type':'password','value':'$pass','temporary':False}))")"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" -X PUT \
    "${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users/${id}/reset-password" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    --data "$payload" || echo "000")"
  [[ "$code" == "204" ]] || die "failed resetting password for ${id} (HTTP $code)"
}

fix_user(){
  local token="$1" email="$2"
  local id; id="$(get_user_id "$token" "$email")"
  [[ -n "$id" ]] || die "user not found in realm '${REALM}': ${email}"

  local uj; uj="$(get_user_json "$token" "$id")"
  local fixed
  fixed="$(printf "%s" "$uj" | python -c "import sys,json; u=json.load(sys.stdin); u['enabled']=True; u['emailVerified']=True; u['requiredActions']=[]; print(json.dumps(u))")"

  put_user_json "$token" "$id" "$fixed"
  reset_password "$token" "$id" "$DEFAULT_PASS"

  log "Fixed user: $email (id=$id) requiredActions cleared + password reset"
}

# ---- Run ----
wait_200 "${KEYCLOAK_BASE_URL}/realms/${ADMIN_REALM}/.well-known/openid-configuration" "Keycloak"
TOKEN="$(admin_token)"

# Sanity: realm exists
code="$(curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "${KEYCLOAK_BASE_URL}/admin/realms/${REALM}" || echo "000")"
[[ "$code" == "200" ]] || die "realm '${REALM}' not accessible (HTTP $code)."

for u in "${USERS[@]}"; do
  fix_user "$TOKEN" "$u"
done

log "Done. Retry: bash scripts/seed_3_rides.sh"
