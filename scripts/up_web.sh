#!/usr/bin/env bash
set -euo pipefail
# Start the 3 web apps without rebuilding.
docker compose up -d web-customer web-driver web-admin
echo "[ziza] Web apps up."
echo "Customer: http://localhost:3000"
echo "Driver:   http://localhost:3001"
echo "Admin:    http://localhost:3002"
