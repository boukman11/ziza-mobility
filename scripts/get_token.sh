#!/usr/bin/env bash
set -euo pipefail
ROLE="${1:-customer}"
EMAIL="${2:-customer1@example.com}"
PASSWORD="${3:-Passw0rd!}"
BASE_URL="${KEYCLOAK_BASE_URL:-http://localhost:8080}"
REALM="${KEYCLOAK_REALM:-ziza}"

case "$ROLE" in
  customer) CLIENT_ID="ziza-customer" ;;
  driver)   CLIENT_ID="ziza-driver" ;;
  admin)    CLIENT_ID="ziza-admin" ;;
  *) echo "Usage: $0 {customer|driver|admin} email password"; exit 1 ;;
esac

curl -s -X POST "$BASE_URL/realms/$REALM/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=$CLIENT_ID" -d "grant_type=password" -d "username=$EMAIL" -d "password=$PASSWORD" \
  | python -c 'import sys,json; print(json.load(sys.stdin)["access_token"])'
