#!/usr/bin/env bash
set -euo pipefail

KEYCLOAK_BASE_URL="${KEYCLOAK_BASE_URL:-http://localhost:8080}"
REALM="${KEYCLOAK_REALM:-ziza}"
API_BASE="${API_BASE:-http://localhost:8000}"

CUSTOMER_USER="${CUSTOMER_USER:-customer1@example.com}"
DRIVER_USER="${DRIVER_USER:-driver1@example.com}"
PASSWORD="${PASSWORD:-Passw0rd!}"

CUSTOMER_CLIENT_ID="${CUSTOMER_CLIENT_ID:-ziza-customer}"
DRIVER_CLIENT_ID="${DRIVER_CLIENT_ID:-ziza-driver}"

log(){ echo "[seed] $*"; }
need(){ command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing '$1'"; exit 1; }; }
need curl
need python

wait_200(){
  local url="$1" name="$2"
  local deadline=$((SECONDS+180))
  while (( SECONDS < deadline )); do
    local code
    code="$(curl -sS -o /dev/null -w "%{http_code}" "$url" || true)"
    [[ "$code" == "200" ]] && { log "$name ready"; return 0; }
    sleep 2
  done
  echo "ERROR: $name not ready at $url" >&2
  exit 1
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
    -d "password=${PASSWORD}" || echo "000")"
  body="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"
  [[ "$code" == "200" ]] || { echo "$body" >&2; echo "ERROR: token request failed (HTTP $code)" >&2; exit 1; }
  token="$(printf "%s" "$body" | python -c "import sys,json; j=json.load(sys.stdin); print(j.get('access_token',''))")"
  [[ -n "$token" ]] || { echo "$body" >&2; echo "ERROR: access_token missing" >&2; exit 1; }
  echo "$token"
}

api_json(){
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

wait_200 "${KEYCLOAK_BASE_URL}/realms/${REALM}/.well-known/openid-configuration" "Keycloak"
wait_200 "${API_BASE}/health" "API"

log "Getting tokens..."
CUSTOMER_TOKEN="$(get_token "$CUSTOMER_CLIENT_ID" "$CUSTOMER_USER")"
DRIVER_TOKEN="$(get_token "$DRIVER_CLIENT_ID" "$DRIVER_USER")"
log "Tokens OK."

log "Setting driver ONLINE + location..."
api_json POST "/v1/driver/status/online" "$DRIVER_TOKEN" >/dev/null
api_json PATCH "/v1/driver/location" "$DRIVER_TOKEN" '{"lat":40.7357,"lng":-74.1724}' >/dev/null

RIDES=(
  '{"pickup":{"lat":40.7357,"lng":-74.1724},"dropoff":{"lat":40.7430,"lng":-74.0324}}'
  '{"pickup":{"lat":40.7282,"lng":-74.0776},"dropoff":{"lat":40.7178,"lng":-74.0431}}'
  '{"pickup":{"lat":40.7411,"lng":-74.1786},"dropoff":{"lat":40.7210,"lng":-74.0550}}'
)

for i in 0 1 2; do
  log "Creating trip #$((i+1))..."
  resp="$(api_json POST "/v1/customer/trips" "$CUSTOMER_TOKEN" "${RIDES[$i]}")"
  trip_id="$(printf "%s" "$resp" | extract_trip_id)"
  [[ -n "$trip_id" ]] || { echo "$resp" >&2; echo "ERROR: could not extract tripId" >&2; exit 1; }
  log "Trip created: $trip_id"

  api_json POST "/v1/driver/trips/${trip_id}/accept" "$DRIVER_TOKEN" >/dev/null
  sleep 1
  api_json POST "/v1/driver/trips/${trip_id}/arrived" "$DRIVER_TOKEN" >/dev/null
  sleep 1
  api_json POST "/v1/driver/trips/${trip_id}/start" "$DRIVER_TOKEN" >/dev/null
  sleep 1
  api_json POST "/v1/driver/trips/${trip_id}/complete" "$DRIVER_TOKEN" '{}' >/dev/null
  sleep 1

  log "Trip #$((i+1)) done ✅"
done

log "All 3 rides created and completed ✅"
