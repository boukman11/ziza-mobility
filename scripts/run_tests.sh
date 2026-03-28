#!/usr/bin/env bash
set -euo pipefail
docker compose build api
docker compose run --rm api pytest -q
