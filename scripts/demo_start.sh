#!/usr/bin/env bash
set -euo pipefail

# One command to bring up the full local demo.
# 1) start core services
# 2) create/assign Keycloak users + roles
# 3) start web apps
# 4) seed 3 rides

bash scripts/up_core.sh
bash scripts/create_users_keycloak_v6.sh
# Build web applications before starting them to ensure the latest assets are available.
bash scripts/build_web_sequential.sh
bash scripts/up_web.sh
bash scripts/seed_3_rides.sh

echo "[demo] Done."
echo "Customer: http://localhost:3000"
echo "Driver:   http://localhost:3001"
echo "Admin:    http://localhost:3002"
