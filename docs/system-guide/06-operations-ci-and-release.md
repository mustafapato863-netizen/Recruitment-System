# 06 — Operations, CI/CD & Verification Gates

RecruitFlow validates every change across workspace packages (`pnpm`), PostgreSQL migrations, API unit & DB specs, background workers, Playwright + `axe-core` browser checks, and bundle budgets.

---

## 1. Environment Configuration (`@recruitflow/config` & `.env.example`)

Validated in [packages/config/src/index.ts](../../packages/config/src/index.ts) and [apps/api/src/main.ts](../../apps/api/src/main.ts):

| Group | Variables | Notes |
|---|---|---|
| **Runtime & CORS** | `NODE_ENV`, `API_PORT` (`3000`), `WEB_ORIGIN`, `APP_WEB_URL`, `TRUST_PROXY` | Production enforces HTTPS security headers, strict CSP, and explicit `WEB_ORIGIN` |
| **PostgreSQL & Adapter** | `DATABASE_URL`, `VACANCY_CORE_ADAPTER` (`prisma` / `in-memory`) | Always set `VACANCY_CORE_ADAPTER=prisma` for persistent/production deployments |
| **Auth & Signing Secrets** | `SESSION_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (min 32 chars), `JWT_ACCESS_EXPIRES_IN` (`15m`), `JWT_REFRESH_EXPIRES_IN` (`7d`), `SELF_SCHEDULE_SECRET`, `EMAIL_OUTBOX_ENCRYPTION_KEY` (64 hex chars) | Mandatory fail-fast in production API & worker startup |
| **Auth Rate Limiting** | `AUTH_MAX_ATTEMPTS` (`5`), `AUTH_IP_MAX_ATTEMPTS` (`25`), `AUTH_LOCKOUT_DURATION` (`900`), `AUTH_WINDOW_DURATION` (`300`) | Backed by `AuthRateLimit` |
| **Storage & Backups** | `OBJECT_STORAGE_*`, `RECRUITFLOW_DOCUMENT_STORAGE_PATH` (`./storage/documents`), `RECRUITFLOW_DOCUMENT_STORAGE_PROVIDER` | Private path only; backup manifest exports metadata, not binary snapshots |
| **Worker & Email** | `REDIS_URL`, `MAIL_DELIVERY_ENABLED`, `MAIL_TRANSPORT` (`console` / `smtp`), `SMTP_*`, `MAIL_FROM`, `WORKER_BATCH_SIZE`, `WORKER_POLL_INTERVAL_MS`, `WORKER_READINESS_REQUIRED`, `DUE_REMINDER_ENABLED`, `DUE_REMINDER_HOUR_CAIRO`, `DUE_REMINDER_LEAD_DAYS` (`3,1`) | Production should enable `WORKER_READINESS_REQUIRED=true` |
| **Domain Tuning & Rollout** | `INTERVIEW_ROOM_HOSTS`, `DEFAULT_PHONE_COUNTRY_CODE` (`966`), `CONTACT_KEYS_REPAIR_ON_BOOT` (`true`), `RF_V2_SEATS` (`employee`) | Controls room URL allowlist, phone normalization, and seat rollout flags |

---

## 2. Deployment Topologies & Supply-Chain Policy

- **Frontend (`vercel.json`):** Builds `apps/web` (`pnpm --dir apps/web build` → `apps/web/dist`), serves SPA fallback rewrites, `no-cache` on HTML routes, and immutable `1y` caching on `/assets/*`. Remember Vite strips `import.meta.env.DEV` quick-login helpers from production builds automatically (`apps/web/src/auth/LoginPage.tsx`).
- **API & Worker (`Dockerfile`, `compose.production.yml`, `compose.hostinger.yml`, `deploy/`):** Containerized Node 24 + pnpm 11 builds running API + Worker + PostgreSQL + Redis, plus pre-flight validation helpers in `deploy/check-api-runtime.cjs` and `deploy/validate-runtime.cjs`.
- **pnpm Workspace Overrides (`pnpm-workspace.yaml`):** Keeps pinned transitive security patches across all 9 workspace projects (including `nodemailer >=10.1.4`, `multer >=2.5.0`, `body-parser >=2.4.0`, `qs >=6.16.1`, `cross-spawn >=7.0.5`, `effect ^3.22.1` keeping `3.22.5` compatible with `@prisma/config@6.19.3`).

---

## 3. Verification Gates & GitHub CI Workflows

Defined in root [package.json](../../package.json), [.github/workflows/ci.yml](../../.github/workflows/ci.yml), and [.github/workflows/rules-pack.yml](../../.github/workflows/rules-pack.yml):

| Gate | Command | What It Verifies |
|---|---|---|
| **Frozen Install & Audit** | `pnpm install --frozen-lockfile && pnpm audit --prod` | Lockfile integrity & 0 unignored production dependency vulnerabilities |
| **Prisma Schema & Migrations** | `pnpm db:validate && pnpm db:migrate:status && pnpm db:generate` | Valid schema, applied migrations, fresh generated client |
| **TypeScript & ESLint** | `pnpm typecheck && pnpm lint` | Zero TS errors (`api`, `web`, `worker`) & zero ESLint errors/warnings |
| **Design Tokens & Bundle Budgets** | `pnpm check:design-tokens && pnpm -r build && pnpm check:bundle` | Strict `--rf2-*` token boundaries (`84` strict files), JS `<= 150 KB` gzip, CSS `<= 60 KB` gzip, lazy PDF parser split |
| **Frontend Suite** | `pnpm test:web` | All `146` Vitest files (`1,427` tests) including V2 routing matrix, `Scope.test.ts`, and `axe-core` component checks |
| **Backend & Worker Suites** | `pnpm test:api && pnpm test:worker` | Unit specs + compression middleware specs + worker sweeper/processor specs (`*.db.spec.ts` enabled when `B1_TEST_DATABASE_URL`–`B8_TEST_DATABASE_URL` are set) |
| **B11 Rules Pack (CI)** | `vitest run apps/api/src/rules-pack` + `B1..B8` DB specs | Enforces all B1–B11 governance rules against live PostgreSQL |
| **Live DB Security & Contracts** | `pnpm test:db`, `RECRUITFLOW_API_PORT=3000 pnpm test:cv-storage`, `node database/test-m1-auth-contracts.cjs` | P3.6 auth matrix (`117/117`), cross-tenant isolation (`10/10`), RBAC matrix, CV storage antivirus/hash/consent/isolation (`25/25`), auth & outbox encryption contracts (`63/63`) |
| **Dual-Mode Browser Matrix** | `pnpm test:browser` (`tests/browser/recruitflow_dual_mode_matrix.py`) | Light + Dark themes × 6 viewports (`375`–`1440`) × routes (`396` Playwright + `axe-core` WCAG AA checks) |
| **System Guide Integrity** | `node scripts/verify-system-guide.mjs` | Verifies every registered route, controller, Prisma model, sweeper, internal Markdown link, and `KNOWLEDGE_CHUNKS.jsonl` record |
