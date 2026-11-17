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

---

## 6. V2 Release Rollout Governance & 14-Day Production Bake Guard (Choice A)

RecruitFlow V2 enforces the corporate **Choice A (14-Day Safety Guard)** release policy:

### 6.1 Rollout Architecture (100% Organization Cutover)
- **Default State**: 100% full organization cutover is enabled via `apps/api/src/auth/seat-rollout.ts` (`DEFAULT_V2_SEATS = ['employee', 'manager', 'admin']`) and `apps/web/src/theme/uiVersion.ts` (`applyUiVersion('v2')`).
- **Multi-tier Rollout Precedence**:
  1. **Org Config**: `integrations` table row `ROLLOUT_SEATS` with JSON config `{"v2Seats": [...]}`. An empty array `[]` disables V2 for that tenant.
  2. **Environment Variable**: `RF_V2_SEATS` (e.g., `employee,manager`; `none` disables V2 globally).
  3. **Default**: `['employee', 'manager', 'admin']` (100% cutover).

### 6.2 Instant Zero-Downtime Rollback Mechanism
If a critical regression is identified post-deployment:
- **Global Rollback**: Set `RF_V2_SEATS=none` in the production environment.
- **Tenant Rollback**: Update tenant's `ROLLOUT_SEATS` integration config to `{"v2Seats": []}`.
- **Seat-Level Rollback**: Set `RF_V2_SEATS="employee"` to restrict V2 exposure while debugging manager/admin flows.

### 6.3 14-Day Zero-Rollback Production Bake Guard (Choice A)
Per architectural directive Choice A:
1. **Preservation of Legacy Wrappers**:
   - Legacy V1 page components under `apps/web/src/pages/`, classic routing paths in `apps/web/src/App.tsx` (`/hires`, `/hires/:id`, `/offers`, `/classic/candidates`, `/classic/vacancies`, etc.), and `apps/web/src/styles/classic-in-shell.css` MUST remain intact in the codebase throughout the 14-day bake period.
   - Immediate legacy deletion (Choice B) and premature archival to temporary directories (Choice C) are strictly prohibited.
2. **Operational Telemetry & Health Monitoring**:
   - Error rates and request tracing via `x-correlation-id`.
   - Email/message outbox queue processing.
   - Background worker and reminder worker health (`GET /api/v1/health` and `reminderWorkerHealthy`).
   - Core recruiter/manager workflows (interviews, offer approvals, license checks, onboarding).
3. **Decommissioning Gate (Post-Bake)**:
   - Full retirement and deletion of legacy V1 pages, classic routes, and `classic-in-shell.css` is permitted ONLY after **14 consecutive calendar days of live production operation with zero rollbacks**.

