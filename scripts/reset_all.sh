#!/usr/bin/env bash
set -euo pipefail
# Full reset (removes volumes).
docker compose down -v
echo "[ziza] Reset done. Rebuild with:"
echo "docker compose up --build"
