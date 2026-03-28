#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Ziza / Keycloak bootstrap (realm roles + demo users)
# Git Bash compatible.
#
# - Ensures realm roles: customer, driver, admin
# - Ensures users:
#     customer1@example.com  -> role customer
#     driver1@example.com    -> role driver
#     admin1@example.com     -> role admin
# - Sets password to DEFAULT_PASS
#
# Requires: curl, python
# ============================================================

KEYCLOAK_BASE_URL="${KEYCLOAK_BASE_URL:-http://localhost:8080}"
ADMIN_REALM="${ADMIN_REALM:-master}"
REALM="${REALM:-ziza}"

ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin}"
ADMIN_CLIENT_ID="${ADMIN_CLIENT_ID:-admin-cli}"

DEFAULT_PASS="${DEFAULT_PASS:-Passw0rd!}"

CUSTOMER_EMAIL="${CUSTOMER_EMAIL:-customer1@example.com}"
DRIVER_EMAIL="${DRIVER_EMAIL:-driver1@example.com}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin1@example.com}"

DEBUG="${DEBUG:-0}"

# IMPORTANT: logs must go to STDERR so command substitutions capture ONLY IDs/tokens.
log(){ echo "[kc] $*" >&2; }
die(){ echo "ERROR: $*" >&2; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || die "missing command: $1"; }

need curl
need python

urlenc() {
  python -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$1"
}

json_get() {
  # Usage: json_get <field>
  python -c "import sys,json; j=json.load(sys.stdin); print(j.get(sys.argv[1],''))" "$1"
}

json_first_id() {
  python -c "import sys,json; a=json.load(sys.stdin); print((a[0].get('id','') if isinstance(a,list) and a else ''))"
}

wait_ready(){
  local url="$1" name="$2"
  log "Waiting for $name at $url ..."
  local deadline=$((SECONDS+180))
  while (( SECONDS < deadline )); do
    local code
    code="$(curl -sS -o /dev/null -w "%{http_code}" "$url" || true)"
    [[ "$code" == "200" ]] && { log "$name ready."; return 0; }
    sleep 2
  done
  die "$name not ready after 180s"
}

kc_token(){
  local tmp code body
  tmp="$(mktemp)"
  code="$(curl -sS -o "$tmp" -w "%{http_code}" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=${ADMIN_CLIENT_ID}" \
    -d "grant_type=password" \
    -d "username=${ADMIN_USER}" \
    -d "password=${ADMIN_PASS}" \
    "${KEYCLOAK_BASE_URL}/realms/${ADMIN_REALM}/protocol/openid-connect/token" || echo "000")"
  body="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"

  [[ "$code" == "200" ]] || { echo "$body" >&2; die "admin token request failed (HTTP $code)"; }

  local token
  token="$(printf "%s" "$body" | json_get access_token | tr -d '\r')"
  [[ -n "$token" ]] || { echo "$body" >&2; die "token response missing access_token"; }
  echo "$token"
}

kc_call(){
  local method="$1" url="$2" token="$3" data="${4:-}"
  if [[ -n "$data" ]]; then
    curl -sS -X "$method" "$url" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json" \
      --data "$data"
  else
    curl -sS -X "$method" "$url" \
      -H "Authorization: Bearer $token" \
      -H "Accept: application/json"
  fi
}

kc_call_code(){
  # prints http_code then newline then body to STDOUT (caller may parse)
  local method="$1" url="$2" token="$3" data="${4:-}"
  local tmp code body
  tmp="$(mktemp)"
  if [[ -n "$data" ]]; then
    code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json" \
      --data "$data" || echo "000")"
  else
    code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $token" \
      -H "Accept: application/json" || echo "000")"
  fi
  body="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"
  printf "%s\n%s" "$code" "$body"
}

ensure_realm_accessible(){
  local token="$1"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $token" \
    "${KEYCLOAK_BASE_URL}/admin/realms/${REALM}" || echo "000")"
  [[ "$code" == "200" ]] || die "Realm '${REALM}' not accessible (HTTP $code). Check realm import."
  log "Realm '${REALM}' accessible."
}

ensure_role(){
  local token="$1" role="$2"
  local url="${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/roles"
  local payload
  payload="$(python -c "import json; print(json.dumps({'name':'$role'}))")"

  local resp code body
  resp="$(kc_call_code POST "$url" "$token" "$payload")"
  code="${resp%%$'\n'*}"
  body="${resp#*$'\n'}"

  if [[ "$code" == "201" || "$code" == "204" ]]; then
    log "Role '$role' created."
    return 0
  fi
  if [[ "$code" == "409" ]]; then
    log "Role '$role' already exists."
    return 0
  fi
  [[ "$DEBUG" == "1" ]] && echo "$body" >&2
  die "Could not ensure role '$role' (HTTP $code)"
}

get_role_id(){
  local token="$1" role="$2"
  local url="${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/roles/${role}"
  local body
  body="$(kc_call GET "$url" "$token")"
  printf "%s" "$body" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))"
}

find_user_id(){
  local token="$1" email="$2"
  local base="${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users"
  local q
  q="$(urlenc "$email")"
  local body id

  body="$(kc_call GET "${base}?username=${q}&exact=true" "$token")"
  id="$(printf "%s" "$body" | json_first_id | tr -d '\r')"
  [[ -n "$id" ]] && { echo "$id"; return 0; }

  body="$(kc_call GET "${base}?email=${q}&exact=true" "$token" || true)"
  id="$(printf "%s" "$body" | json_first_id | tr -d '\r')"
  [[ -n "$id" ]] && { echo "$id"; return 0; }

  body="$(kc_call GET "${base}?search=${q}" "$token")"
  id="$(printf "%s" "$body" | json_first_id | tr -d '\r')"
  [[ -n "$id" ]] && { echo "$id"; return 0; }

  echo ""
}

create_or_get_user(){
  local token="$1" email="$2"
  local base="${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users"
  local payload
  payload="$(python -c "import json; print(json.dumps({'username':'$email','email':'$email','enabled':True,'emailVerified':True}))")"

  local tmp_headers tmp_body code body location
  tmp_headers="$(mktemp)"
  tmp_body="$(mktemp)"
  code="$(curl -sS -D "$tmp_headers" -o "$tmp_body" -w "%{http_code}" \
    -X POST "$base" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    --data "$payload" || echo "000")"
  body="$(cat "$tmp_body" 2>/dev/null || true)"
  location="$(grep -i '^Location:' "$tmp_headers" | head -n1 | tr -d '\r' | sed 's/^[Ll]ocation: //')"
  rm -f "$tmp_headers" "$tmp_body"

  if [[ "$DEBUG" == "1" ]]; then
    log "create_user $email -> HTTP $code location='${location}'"
    [[ -n "$body" ]] && echo "$body" >&2
  fi

  if [[ "$code" == "201" ]]; then
    local id="${location##*/}"
    [[ -n "$id" ]] && { echo "$id"; return 0; }
    # fallback: find
  elif [[ "$code" == "409" ]]; then
    local id
    id="$(find_user_id "$token" "$email")"
    [[ -n "$id" ]] && { echo "$id"; return 0; }
    die "User $email exists (409) but cannot be found via search."
  else
    echo "$body" >&2
    die "Failed creating user $email (HTTP $code)"
  fi

  local tries=20
  while (( tries > 0 )); do
    local id
    id="$(find_user_id "$token" "$email")"
    [[ -n "$id" ]] && { echo "$id"; return 0; }
    sleep 1
    tries=$((tries-1))
  done

  die "user $email not found after creation (even after retries)"
}

set_password(){
  local token="$1" user_id="$2" pass="$3"
  local url="${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users/${user_id}/reset-password"
  local payload
  payload="$(python -c "import json; print(json.dumps({'type':'password','value':'$pass','temporary':False}))")"
  local resp code body
  resp="$(kc_call_code PUT "$url" "$token" "$payload")"
  code="${resp%%$'\n'*}"
  body="${resp#*$'\n'}"
  [[ "$code" == "204" ]] || { [[ "$DEBUG" == "1" ]] && echo "$body" >&2; die "Failed setting password for ${user_id} (HTTP $code)"; }
}


fix_required_actions(){
  local token="$1" user_id="$2"
  local url="${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users/${user_id}"

  # Fetch current user JSON
  local tmp code body
  tmp="$(mktemp)"
  code="$(curl -sS -o "$tmp" -w "%{http_code}" -X GET "$url" \
    -H "Authorization: Bearer $token" \
    -H "Accept: application/json" || echo "000")"
  body="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"
  [[ "$code" == "200" ]] || { [[ "$DEBUG" == "1" ]] && echo "$body" >&2; die "Failed reading user ${user_id} (HTTP $code)"; }

  # Set enabled=true, emailVerified=true, requiredActions=[]
  local payload
  payload="$(printf "%s" "$body" | python -c "import sys,json; u=json.load(sys.stdin); u['enabled']=True; u['emailVerified']=True; u['requiredActions']=[]; print(json.dumps(u))")"

  local resp
  resp="$(kc_call_code PUT "$url" "$token" "$payload")"
  local rc="${resp%%$'\n'*}"
  [[ "$rc" == "204" ]] || { [[ "$DEBUG" == "1" ]] && echo "${resp#*$'\n'}" >&2; die "Failed clearing requiredActions for ${user_id} (HTTP $rc)"; }
}
assign_role(){
  local token="$1" user_id="$2" role="$3"
  local rid
  rid="$(get_role_id "$token" "$role" | tr -d '\r')"
  [[ -n "$rid" ]] || die "Could not read role id for '$role'"

  local url="${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users/${user_id}/role-mappings/realm"
  local payload
  payload="$(python -c "import json; print(json.dumps([{'id':'$rid','name':'$role'}]))")"

  local resp code body
  resp="$(kc_call_code POST "$url" "$token" "$payload")"
  code="${resp%%$'\n'*}"
  body="${resp#*$'\n'}"
  [[ "$code" == "204" ]] || { [[ "$DEBUG" == "1" ]] && echo "$body" >&2; die "Failed assigning role '$role' (HTTP $code)"; }
}

# ---- Run ----
wait_ready "${KEYCLOAK_BASE_URL}/realms/${ADMIN_REALM}/.well-known/openid-configuration" "Keycloak"
TOKEN="$(kc_token)"
ensure_realm_accessible "$TOKEN"

ensure_role "$TOKEN" "customer"
ensure_role "$TOKEN" "driver"
ensure_role "$TOKEN" "admin"
ensure_role "$TOKEN" "driver_pending"

log "Ensuring users + passwords + roles ..."
cid="$(create_or_get_user "$TOKEN" "$CUSTOMER_EMAIL")"
set_password "$TOKEN" "$cid" "$DEFAULT_PASS"
fix_required_actions "$TOKEN" "$cid"
assign_role "$TOKEN" "$cid" "customer"
log "OK customer: $CUSTOMER_EMAIL (id=$cid)"

did="$(create_or_get_user "$TOKEN" "$DRIVER_EMAIL")"
set_password "$TOKEN" "$did" "$DEFAULT_PASS"
fix_required_actions "$TOKEN" "$did"
assign_role "$TOKEN" "$did" "driver"
log "OK driver:   $DRIVER_EMAIL (id=$did)"

aid="$(create_or_get_user "$TOKEN" "$ADMIN_EMAIL")"
set_password "$TOKEN" "$aid" "$DEFAULT_PASS"
fix_required_actions "$TOKEN" "$aid"
assign_role "$TOKEN" "$aid" "admin"
log "OK admin:    $ADMIN_EMAIL (id=$aid)"

log "Done."
