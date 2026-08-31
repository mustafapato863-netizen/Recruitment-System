# RecruitFlow — Production Release & Operations Playbook

## 1. Environment Configuration

The production environment requires the following environment variables:

| Variable | Description | Example / Requirement |
|---|---|---|
| `NODE_ENV` | Runtime environment | `production` |
| `API_PORT` | API Server listening port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/Recruitment_DB?schema=public` |
| `JWT_ACCESS_SECRET` | Secret key for signing access tokens | Min 32 random characters |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh tokens | Min 32 random characters |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifespan | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan | `7d` |
| `RECRUITFLOW_DOCUMENT_STORAGE_PROVIDER` | Private CV storage adapter | `local-private` for development; approved object storage in production |
| `RECRUITFLOW_DOCUMENT_STORAGE_PATH` | Private local CV storage root | Persistent private volume only; never a public web root |
| `RECRUITFLOW_DOCUMENT_BACKUP_PROVIDER` | External binary backup provider marker | Must be a verified provider before production go-live |
| `RECRUITFLOW_DOCUMENT_BACKUP_LAST_SUCCESS_AT` | Last verified binary backup timestamp | Set only by the successful backup job |

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

The CV Bank Excel workbook is a metadata manifest, not a binary backup. A production release must separately snapshot the private CV object-storage provider, rehearse restore, and verify that the CV Bank backup-status endpoint reports the provider and last successful backup. Do not expose `storageKey` values or place the local fallback under a public/static directory.

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
