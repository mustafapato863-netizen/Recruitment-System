#!/bin/sh
set -eu
node /app/deploy/validate-runtime.cjs
cd /app/database
# PostgreSQL may still be accepting connections when the container starts
# (especially when the database is managed as a separate service). Retry the
# non-destructive migration command for transient startup races, but still fail
# closed after a bounded number of attempts. Never push or reset production
# schema.
migration_max_attempts="${MIGRATION_MAX_ATTEMPTS:-6}"
migration_retry_delay="${MIGRATION_RETRY_DELAY_SECONDS:-5}"

case "$migration_max_attempts" in
  ''|*[!0-9]*)
    echo "MIGRATION_MAX_ATTEMPTS must be a positive integer" >&2
    exit 1
    ;;
esac
case "$migration_retry_delay" in
  ''|*[!0-9]*)
    echo "MIGRATION_RETRY_DELAY_SECONDS must be a non-negative integer" >&2
    exit 1
    ;;
esac
if [ "$migration_max_attempts" -lt 1 ]; then
  echo "MIGRATION_MAX_ATTEMPTS must be a positive integer" >&2
  exit 1
fi

migration_attempt=1
while :; do
  if node scripts/prisma.cjs migrate deploy --schema prisma/schema.prisma; then
    break
  fi

  if [ "$migration_attempt" -ge "$migration_max_attempts" ]; then
    echo "Database migrations failed after ${migration_max_attempts} attempt(s)." >&2
    exit 1
  fi

  echo "Database migration attempt ${migration_attempt}/${migration_max_attempts} failed; retrying in ${migration_retry_delay}s." >&2
  migration_attempt=$((migration_attempt + 1))
  sleep "$migration_retry_delay"
done
cd /app/apps/api
exec node dist/apps/api/src/main.js
