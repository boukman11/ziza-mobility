#!/usr/bin/env bash
set -euo pipefail
# Wrapper for backward compatibility
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$DIR/create_users_keycloak_v6.sh"
