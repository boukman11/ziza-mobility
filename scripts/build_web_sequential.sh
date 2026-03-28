#!/usr/bin/env bash
set -euo pipefail

# Build the 3 web images sequentially (recommended on slow networks / 4G).
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "[ziza] Building web-customer..."
docker compose build web-customer
echo "[ziza] Building web-driver..."
docker compose build web-driver
echo "[ziza] Building web-admin..."
docker compose build web-admin

echo "[ziza] Done. Start them with:"
echo "docker compose up -d web-customer web-driver web-admin"
