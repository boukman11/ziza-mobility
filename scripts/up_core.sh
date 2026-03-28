#!/usr/bin/env bash
set -euo pipefail
# Start core services (db, keycloak, api, worker) without rebuilding.
docker compose up -d db keycloak api worker
echo "[ziza] Core up."
echo "API:       http://localhost:8000/health"
echo "Swagger:   http://localhost:8000/docs"
echo "Keycloak:  http://localhost:8080"
