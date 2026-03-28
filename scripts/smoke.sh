#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# You can override defaults:
#   KEYCLOAK_BASE_URL, KEYCLOAK_REALM, API_BASE, PASS
#   CUSTOMER_EMAIL, DRIVER_EMAIL, ADMIN_EMAIL
# ============================================================
# Ziza Sprint 31 - smoke test (local)
# - Validates Keycloak discovery
# - Fetches tokens for customer/driver/admin
# - Checks roles in JWT
# - Calls /me endpoints
# - Creates 1 trip, driver accepts -> arrived -> start -> complete
#
# Requires: curl, python
# ============================================================

KEYCLOAK_BASE_URL="${KEYCLOAK_BASE_URL:-http://localhost:8080}"
REALM="${KEYCLOAK_REALM:-ziza}"
API_BASE="${API_BASE:-http://localhost:8000}"
PASS="${PASS:-Passw0rd!}"

CUSTOMER_EMAIL="${CUSTOMER_EMAIL:-customer1@example.com}"
DRIVER_EMAIL="${DRIVER_EMAIL:-driver1@example.com}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin1@example.com}"

CUSTOMER_CLIENT_ID="${CUSTOMER_CLIENT_ID:-ziza-customer}"
DRIVER_CLIENT_ID="${DRIVER_CLIENT_ID:-ziza-driver}"
ADMIN_CLIENT_ID="${ADMIN_CLIENT_ID:-ziza-admin}"

log(){ echo "[smoke] $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || die "missing command: $1"; }

need curl
need python

wait_200(){
  local url="$1" name="$2"
  log "Waiting for $name ($url) ..."
  local deadline=$((SECONDS+180))
  while (( SECONDS < deadline )); do
    local code
    code="$(curl -sS -o /dev/null -w "%{http_code}" "$url" || true)"
    [[ "$code" == "200" ]] && { log "$name OK"; return 0; }
    sleep 2
  done
  die "$name not ready after 180s"
}

get_token(){
  local client_id="$1" username="$2"
  local tmp code body token
  tmp="$(mktemp)"
  code="$(curl -sS -o "$tmp" -w "%{http_code}" -X POST \
    "${KEYCLOAK_BASE_URL}/realms/${REALM}/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=${client_id}" \
    -d "grant_type=password" \
    -d "username=${username}" \
    -d "password=${PASS}" || echo "000")"
  body="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"
  [[ "$code" == "200" ]] || { echo "$body" >&2; die "token request failed for ${username} (HTTP $code)"; }
  token="$(printf "%s" "$body" | python -c "import sys,json; j=json.load(sys.stdin); print(j.get('access_token',''))")"
  [[ -n "$token" ]] || { echo "$body" >&2; die "access_token missing for ${username}"; }
  echo "$token"
}

jwt_payload(){
  local token="$1"
  python -c "import sys,base64,json; t=sys.argv[1]; p=t.split('.')[1]+'=='; print(base64.urlsafe_b64decode(p.encode()).decode())" "$token"
}

jwt_has_role(){
  local token="$1" role="$2"
  python -c "import sys,json; j=json.loads(sys.stdin.read()); roles=(j.get('realm_access') or {}).get('roles') or []; sys.exit(0 if '$role' in roles else 1)" <<<"$(jwt_payload "$token")"
}

api(){
  local method="$1" path="$2" token="$3" data="${4:-}"
  if [[ -n "$data" ]]; then
    curl -sS -X "$method" "${API_BASE}${path}" \
      -H "Authorization: Bearer ${token}" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json" \
      --data "$data"
  else
    curl -sS -X "$method" "${API_BASE}${path}" \
      -H "Authorization: Bearer ${token}" \
      -H "Accept: application/json"
  fi
}

extract_trip_id(){
  python -c "import sys,json; j=json.load(sys.stdin); print(j.get('tripId') or j.get('trip_id') or j.get('id') or '')"
}

# ---- Checks ----
wait_200 "${KEYCLOAK_BASE_URL}/realms/${REALM}/.well-known/openid-configuration" "Keycloak discovery"
wait_200 "${API_BASE}/health" "API health"

log "Checking /v1/system/version..."
api GET "/v1/system/version" "$AT" >/dev/null || true

log "Fetching tokens..."
CT="$(get_token "$CUSTOMER_CLIENT_ID" "$CUSTOMER_EMAIL")"
DT="$(get_token "$DRIVER_CLIENT_ID" "$DRIVER_EMAIL")"
AT="$(get_token "$ADMIN_CLIENT_ID" "$ADMIN_EMAIL")"
log "Tokens OK."

# issuer check (informational)
log "Token issuers:"
python -c "import json,sys; j=json.loads(sys.stdin.read()); print(' customer iss:', j.get('iss'))" <<<"$(jwt_payload "$CT")"
python -c "import json,sys; j=json.loads(sys.stdin.read()); print(' driver   iss:', j.get('iss'))" <<<"$(jwt_payload "$DT")"
python -c "import json,sys; j=json.loads(sys.stdin.read()); print(' admin    iss:', j.get('iss'))" <<<"$(jwt_payload "$AT")"

log "Checking roles..."
jwt_has_role "$CT" "customer" || die "customer token missing role 'customer'"
jwt_has_role "$DT" "driver" || die "driver token missing role 'driver'"
jwt_has_role "$AT" "admin" || die "admin token missing role 'admin'"
log "Roles OK."

log "Calling /me endpoints..."
api GET "/v1/customer/me" "$CT" >/dev/null || die "customer /me failed"
api GET "/v1/driver/me" "$DT" >/dev/null || die "driver /me failed"
api GET "/v1/admin/me" "$AT" >/dev/null || die "admin /me failed"
log "/me endpoints OK."

log "Creating 1 trip and completing it..."
# Ensure driver online + location
api POST "/v1/driver/status/online" "$DT" >/dev/null || true
api PATCH "/v1/driver/location" "$DT" '{"lat":40.7357,"lng":-74.1724}' >/dev/null || true

resp="$(api POST "/v1/customer/trips" "$CT" '{"pickup":{"lat":40.7357,"lng":-74.1724},"dropoff":{"lat":40.7430,"lng":-74.0324}}')"
trip_id="$(printf "%s" "$resp" | extract_trip_id)"
[[ -n "$trip_id" ]] || { echo "$resp" >&2; die "could not extract tripId"; }
log "Trip created: $trip_id"

api POST "/v1/driver/trips/${trip_id}/accept" "$DT" >/dev/null
api POST "/v1/driver/trips/${trip_id}/arrived" "$DT" >/dev/null
api POST "/v1/driver/trips/${trip_id}/start" "$DT" >/dev/null
api POST "/v1/driver/trips/${trip_id}/complete" "$DT" '{}' >/dev/null
log "Trip completed ✅"

log "SMOKE TEST PASS ✅"
