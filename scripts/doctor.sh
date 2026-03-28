#!/usr/bin/env bash
set -euo pipefail
need(){ command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing '$1'"; exit 1; }; }
need curl

echo "[doctor] Checking services..."
echo "- API health:"
code="$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:8000/health || true)"; echo "  /health -> ${code}"
code2="$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:8000/v1/system/version || true)"; echo "  /v1/system/version -> ${code2}"

echo "- API health:"
curl -fsS http://localhost:8000/health >/dev/null && echo "  OK" || echo "  FAIL"

echo "- Keycloak discovery:"
curl -fsS http://localhost:8080/realms/ziza/.well-known/openid-configuration >/dev/null && echo "  OK" || echo "  FAIL"

echo "- Web:"
for p in 3000 3001 3002; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:${p}/ || true)"
  echo "  :${p} -> ${code}"
done

echo
echo "[doctor] If roles/users are missing, run:"
echo "  bash scripts/create_users_keycloak_v6.sh"
