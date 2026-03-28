#!/usr/bin/env bash
set -euo pipefail

OUT="${1:-ziza-sprint59.zip}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR"
zip -r "$OUT" . \
  -x '.git/*' \
     'ziza-local-sprint57-bugsfix2.zip' \
     'ziza-sprint58.zip' \
     '*.pyc' \
     '__pycache__/*'

echo "Sprint 59 package created: $ROOT_DIR/$OUT"
