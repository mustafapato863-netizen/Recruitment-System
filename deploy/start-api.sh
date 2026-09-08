#!/bin/sh
set -eu
cd /app/database
# Fail closed if a migration fails; never push or reset production schema.
node scripts/prisma.cjs migrate deploy --schema prisma/schema.prisma
cd /app/apps/api
exec node dist/apps/api/src/main.js

