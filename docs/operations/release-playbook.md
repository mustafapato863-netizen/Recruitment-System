# RecruitFlow — Production Release & Operations Playbook

## 1. Environment Configuration

The production environment requires the following environment variables:

| Variable | Description | Example / Requirement |
|---|---|---|
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | API Server listening port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/Recruitment_DB?schema=public` |
| `JWT_ACCESS_SECRET` | Secret key for signing access tokens | Min 32 random characters |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh tokens | Min 32 random characters |
| `JWT_ACCESS_EXPIRY` | Access token lifespan | `15m` |
| `JWT_REFRESH_EXPIRY` | Refresh token lifespan | `7d` |

---

## 2. Deployment Procedure

### Step 1: Clone & Install
```bash
git clone <repository_url>
cd recruitment-workflow-system
pnpm install --frozen-lockfile
```

### Step 2: Database Migration & Schema Sync
```bash
# Run schema migrations in production
pnpm --dir database prisma:migrate:deploy

# Generate Prisma Client
pnpm --dir database prisma:generate
```

### Step 3: Production Build
```bash
npx pnpm build
```

### Step 4: Start Services
```bash
# Start API server in production mode
pnpm --dir apps/api start

# Start Background Worker
pnpm --dir apps/worker dev
```

---

## 3. Health Probes & Monitoring

- **Liveness Probe**: `GET /api/v1/health`
  - Returns `200 OK` with `{ status: "ok" }` when the server process is responsive.
- **Readiness Probe**: `GET /api/v1/readiness`
  - Returns `200 OK` when the database connection is healthy (`{ status: "up", services: { database: "connected" } }`).
  - Returns `533 Service Unavailable` if database connectivity is lost.
- **Request Tracing**: All API responses contain an `x-correlation-id` header for distributed log correlation.

---

## 4. Backup & Disaster Recovery

### Database Backup
```bash
pg_dump -U postgres -h localhost -d Recruitment_DB -F c -b -v -f recruitflow_backup_$(date +%Y%m%d_%H%M%S).dump
```

### Database Restore
```bash
pg_restore -U postgres -h localhost -d Recruitment_DB -v recruitflow_backup_YYYYMMDD_HHMMSS.dump
```

---

## 5. Rollback Procedure

In case of a critical post-release issue:
1. Revert to the last known stable Git release tag: `git checkout tags/vX.Y.Z`
2. Re-run `npx pnpm build`
3. Restart API & Worker processes.
