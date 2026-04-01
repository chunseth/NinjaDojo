#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${NINJADOJO_BASE_URL:-}" || -z "${KIOSK_SHARED_KEY:-}" ]]; then
  echo "Set NINJADOJO_BASE_URL and KIOSK_SHARED_KEY"
  exit 1
fi

curl -sS -X POST "${NINJADOJO_BASE_URL}/api/reports/monthly/generate" \
  -H "Content-Type: application/json" \
  -H "x-kiosk-key: ${KIOSK_SHARED_KEY}"
