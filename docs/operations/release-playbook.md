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

## 5. Rollback Procedure — release BLOCKER until rehearsed

Current signed-in web routing always loads `V2Shell`, regardless of the API's
`v2Seats` and `v2Enabled` values. **Do not rely on `RF_V2_SEATS=none` or
`ROLLOUT_SEATS: []` to restore V1**. They do not switch the frontend back to V1.
Changing a configuration row is not a demonstrated safe rollback.

The release owner must select and rehearse one real rollback route **before** deploying
V2 to production:

1. Reinstate and test real per-seat V1/V2 frontend route trees and a switch, **or**
2. Preserve a compatible, immutable V1 web/API/worker deployment artifact and rehearse
   atomic traffic rollback (blue/green). Confirm that the deployed DB schema and
   document storage can safely serve the previous binary before switching traffic.

A Git checkout or UI setting alone is not a tested rollback. Record the tested deployment
IDs, migration baseline, document-backup snapshot, rehearsal logs and authorized decision
owner. Restore only from validated backups following the recovery playbook; never perform
an ad hoc destructive production DB reset.

---

## 6. V2 Release Rollout Governance & 14-Day Production Bake Guard (Choice A)

### 6.1 Actual V2 Runtime Behavior (as of 19 November 2026)

- All authenticated users enter the V2 shell through `App.tsx` and `V2Shell.tsx`.
- `/auth/me` exposes `seat`, `v2Seats`, `v2Enabled` and `flags.v2Seats`,
  using organization config, `RF_V2_SEATS`, then full-seat default precedence.
- **These API values are currently informational only for UI selection.** The frontend
  deliberately ignores them; the app does **not** implement functional per-seat V1 fallback.
- V1 components still render on some old URLs under V2's shell. This is partial
  UI reuse, not proof of a reversible V1 rollout.
- Until real rollback is implemented and tested, release status is **NO-GO**.

### 6.2 Rollback Acceptance and Monitoring

- Choose one option from §5, implement it and verify it with Employee, Manager,
  Admin, restricted interviewer and final-hiring approver accounts.
- Verify persisted candidate/job/application history, document downloads and versioned
  offers after rollback and re-entry.
- Monitor auth refresh, cross-tenant access, recruiter workload, interviews, offers,
  clinical licensing, final approval, joining capacity, queue failures and API health.
- Retain an approved previous deployment during the 14-day production bake. Do not
  announce instant/zero-downtime rollback until evidence confirms it.

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

