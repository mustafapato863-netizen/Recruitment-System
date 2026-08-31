# Competitive Enhancement Plan — 2026-08-26

Status: **ACTIVE — canonical enhancement roadmap.** This document is the working reference for
execution. It complements (does not replace) `RECRUITFLOW_PRODUCTION_MASTER_PLAN_2026-08-23.md`.

## Basis

Full product review vs market ATS (Greenhouse, Lever, Workable, Zoho Recruit, Ashby) rated
RecruitFlow **6.2/10** overall: strong requisition-to-hire workflow engine and security discipline,
but missing the market-defining surfaces (public apply, job boards, email, calendar sync, parsing,
matching, background jobs).

**Strategy:** compete in the SMB/mid-market gap. Wedge = deep requisition approvals + post-offer
compliance (Workable/Zoho lack these) with modern UX (Zoho's weakness). Regional focus EGY + UAE
sourcing channels (Wuzzuf, Bayt, GulfTalent, LinkedIn). English-only UI; no RTL scope.

## Phase plan

| Phase | Theme | Window | Target rating |
|---|---|---|---|
| 0 | Trust & security closure | ~2 weeks | 6.2 → 6.5 |
| 1 | Async engine (BullMQ/outbox) + email delivery | ~3 weeks | → 6.8 |
| 2 | Candidate acquisition (public apply, career site, job boards) | ~5–6 weeks | → 7.2 |
| 3 | Structured hiring core (pipeline templates live, interview kits) | ~4–5 weeks | → 7.6 |
| 4 | CV intelligence & explainable matching (M5/M6 execution order) | ~6–8 weeks | → 8.0 |
| 5 | Offer-to-onboard completion (PDF, e-sign, HRIS handoff) | ~3–4 weeks | → 8.2 |
| 6 | Analytics maturity (SQL aggregates, source-of-hire, time-in-stage) | ~3 weeks | → 8.3 |
| 7 | Platform & enterprise (API keys, webhooks, SSO, PDPL tooling) | ~5 weeks | → 8.5 |
| 8 | Scale & hardening (pagination, FTS, tenancy enforcement, OTel, CI) | ~3 weeks | → 8.7 |
| 9 | Release certification (= master-plan M10) | ~2 weeks | → 8.8 |

## Phase 0 work items (current execution)

- [x] P0-A Enforce dormant permissions: `VIEW_CANDIDATE_PII`, `VIEW_CURRENT_SALARY`,
      `DOWNLOAD_DOCUMENTS` on candidate detail/documents surfaces.
- [x] P0-B Close roles cross-tenant hole: role catalog scoped/gated; `ROLES_MANAGE` cannot
      enumerate or edit other tenants' usable roles.
- [x] P0-C Rate-limit all public auth endpoints (password-reset, email-verification,
      invitation accept) with the existing DB-backed limiter pattern.
- [x] P0-D Remove demo personas/hardcoded password from LoginPage; replace hardcoded
      VacantListPage KPI zeros with real metrics.
- [x] P0-E Remove git-tracked `apps/web_backup_20260818_122853`; upgrade `xlsx`.
- [x] P0-F Accept `Authorization: Bearer` alongside cookie extraction for non-browser clients.
- [x] P0-G Wire notification producers into workflow events (approvals, offers, interviews).
- [x] P0-H React error boundary at app root; mount the existing CommandPalette into AppShell.

## Deliberate non-goals

Native CRM nurture campaigns; integration marketplace; built-in video interviewing (integrate
Zoom/Teams instead); mobile app; payroll/HRIS expansion. Revisit only after overall rating ≥ 8.0.

## Execution rules

1. Each phase item lands with lint/typecheck/build/test/security-suite evidence.
2. No contract break without a reviewed versioned change.
3. Tenant isolation must hold after every phase (isolation + RBAC suites green).
4. Update this file's checkboxes as items complete; record evidence under this date section.

## Evidence log

### 2026-08-26 — Phase 0 executed

- P0-A..P0-H implemented on `main`. See commit history for exact diffs.
- Gates run: `pnpm lint`, `pnpm typecheck`, `pnpm build`, web unit tests, DB-backed
  integration/security suites (`test-p36-auth-matrix`, `test-isolation`, `test-rbac`).
- `test-p4-workflow-transitions`: **115/115 PASS** against a fresh API build (port-parametrized
  via `P4_API_PORT`; default 3000 unchanged).
- Fix during verification: talent-pool controller routes now validate UUID path params with
  `ParseUUIDPipe` (previously returned 500 on malformed ids; p4 section 8 now green).
- Fix during verification: migration `20260826_role_tenant_scoping` column corrected to
  camelCase `"organizationId"` (schema uses no field-level `@map`; snake_case broke the
  Prisma client's role include queries).
- Fix during verification: DI service imports (`PrismaService`, `NotificationsService`,
  `UserPermissionsService`) restored to value imports wrapped in
  `eslint-disable @typescript-eslint/consistent-type-imports` — auto-fix had converted them to
  `import type`, which erased Nest reflection metadata and crashed boot.
- **P0-A dedicated suite added**: `database/test-p0a-permission-enforcement.cjs`
  (`P0A_API_PORT` env, read-only, no teardown) — **24/24 PASS**:
  - `VIEW_CANDIDATE_PII`: HIRING_MANAGER sees masked email/phone on list + detail;
    ADMINISTRATOR/HR_MANAGER sees full values for the same records.
  - `VIEW_CURRENT_SALARY`: HIRING_MANAGER gets `monthlyPackage: null` on offer detail;
    HR_MANAGER sees the numeric amount.
  - `DOWNLOAD_DOCUMENTS`: document download + CV-bank manifest return 403 without the pair
    (`CANDIDATE_VIEW` + `DOWNLOAD_DOCUMENTS`); permission-holder passes the gate.

### 2026-08-26 — Phase 1 executed

Phase 1 is **complete and verified**. The async engine now provides a PostgreSQL
transactional email outbox, retry/backoff and stale-lease recovery, dead-letter
handling, optional BullMQ/Redis scheduling with database polling fallback, and
configurable console/SMTP delivery. Auth recovery and invitation tokens are
stored as hashes in `auth_tokens` and encrypted with AES-256-GCM in the outbox;
production requires `EMAIL_OUTBOX_ENCRYPTION_KEY` and never exposes development
tokens or account-dependent response fields.

Approval, offer, vacancy, interview, and task notification producers now await
preference-aware, tenant-scoped in-app/email persistence with unread-event
idempotency protection. Evidence:

- `database/test-p1-email-outbox.cjs`: **22/22 PASS**
- `database/test-p1-production-queue.cjs`: **4/4 PASS** under production API settings
- `database/test-p1-workflow-notifications.cjs`: **5/5 PASS**
- Workspace typecheck, lint, build, web tests, database validation/status,
  design-token, bundle-budget, dependency-audit, code-quality, security,
  tenant-isolation, RBAC, and workflow regression gates: **PASS**

Operational runbook: `docs/operations/phase1-async-email.md`.

Exact next phase: **Phase 2 — Candidate acquisition** (public apply, career
site, and job-board channels).
