#!/usr/bin/env bash
set -euo pipefail

OUT="${1:-ziza-sprint60.zip}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR"
zip -r "$OUT" . \
  -x '.git/*' \
     'ziza-local-sprint57-bugsfix2.zip' \
     'ziza-sprint58.zip' \
     'ziza-sprint59.zip' \
     '*.pyc' \
     '__pycache__/*'

echo "Sprint 60 package created: $ROOT_DIR/$OUT"
