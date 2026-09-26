#!/usr/bin/env bash
set -euo pipefail
unset npm_config_prefix 2>/dev/null || true
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${TEST_DATABASE_URL:?TEST_DATABASE_URL is required}"
: "${PORT:=3100}"
: "${CREATOR_AUTH_MODE:=dev}"
: "${DEV_CREATOR_ID:=creator_e2e_a}"
: "${DEV_CREATOR_ID_B:=creator_e2e_b}"
: "${CREATOR_SESSION_SECRET:=e2e-test-session-secret-minimum-32-chars}"
export CREATOR_AUTH_MODE DEV_CREATOR_ID DEV_CREATOR_ID_B CREATOR_SESSION_SECRET
npm run migrate
# Use dev server so NODE_ENV=development and M9 dev Creator auth can run end-to-end.
exec npx next dev -p "$PORT"
