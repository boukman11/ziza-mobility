#!/usr/bin/env bash
set -euo pipefail

echo "=============================="
echo " Ziza Local Release Checklist "
echo " Sprint 46"
echo "=============================="

echo
echo "[1/7] Starting core services..."
bash scripts/up_core.sh

echo
echo "[2/7] Ensuring Keycloak users/roles..."
bash scripts/create_users_keycloak_v6.sh

echo
echo "[3/7] Starting web apps..."
bash scripts/up_web.sh

echo
echo "[4/7] Running doctor..."
bash scripts/doctor.sh || true

echo
echo "[5/7] Running smoke test..."
bash scripts/smoke.sh

echo
echo "[6/7] Seeding 3 rides..."
bash scripts/seed_3_rides.sh || true

echo
echo "[7/7] Done ✅"
echo
echo "Open:"
echo "- Customer: http://localhost:3000"
echo "- Driver:   http://localhost:3001"
echo "- Admin:    http://localhost:3002"
echo "- API docs: http://localhost:8000/docs"
echo "- System:   http://localhost:3002/system"
