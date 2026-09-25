#!/usr/bin/env bash
set -euo pipefail
unset npm_config_prefix 2>/dev/null || true
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${TEST_DATABASE_URL:?TEST_DATABASE_URL is required}"
: "${PORT:=3100}"
npm run migrate
npm run build
exec npx next start -p "$PORT"
