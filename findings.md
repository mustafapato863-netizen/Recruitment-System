# RecruitFlow Consolidated Findings & Authoritative Full-Stack Audit

## 2026-08-31 — Product UX Blueprint Documentation Findings

- The current documentation already accepts `docs/App Deisgn` as a visual and
  workflow reference, not release evidence. The new blueprint must keep that
  distinction and must not promote static example counts or unsupported channel
  badges into production states.
- The production master plan remains the phase authority. The blueprint may
  provide goal-level delivery guidance, but it must map to M2–M8 instead of
  renumbering or bypassing M0–M10.
- Current planning records contain conflicting historical claims about M1-G4/
  M1-G5 completion. The blueprint will use conditional phase gates and require
  independent verification rather than asserting those milestones as facts.
- Product direction is now explicitly constrained to three internal operating
  roles: Employee/Requester, Manager/Hiring Manager, and
  Administrator/Recruitment Operations. UI visibility is a convenience layer;
  API authorization, tenant scope, and audit remain mandatory enforcement.
- The navigation target is twelve simple internal destinations, with secondary
  administration features inside Settings and notifications in the top bar.
- Manager ownership, recruiter reassignment, and per-vacancy targets are a
  core workflow concern. They require scoped assignment/target records, reason
  and audit history, and must never automatically move or reject candidates.
- The authoritative execution companion is now
  `docs/development/RECRUITFLOW_PRODUCT_UX_WORKFLOW_BLUEPRINT_2026-08-31.md`.
  Its 18 prompt files are sequenced from the M1 entry gate through M10 release
  certification and use an independent review prompt after every goal. They
  are implementation instructions, not completion evidence.

## 2026-08-31 — F2 Application Shell & Navigation

**Status: COMPLETE — READY FOR INDEPENDENT REVIEW**

### Summary of Findings & Implementation:
1. **Permission-Driven Navigation:** All 16 sidebar nav items use `permission` or `anyPermissions` props backed by `user.permissions` from `/auth/me`. No hard-coded role-name authorization checks found anywhere in the frontend. The 3 instances of `user?.roles?.[0]?.name` are display-only (sidebar role label, dropdown role label).
2. **Hierarchical Breadcrumbs:** Route labels converted from flat `[path, label]` tuples to `{path, label, parent}` objects. Breadcrumbs now show parent navigation family → current page (e.g., "Jobs & Pipeline / Openings & Vacancies"). Truncation at 140px (parent) and 200px (current) with `title` tooltip overflow.
3. **Mobile Drawer Accessibility:** Added `aria-modal="true"`, `role="dialog"` on sidebar when open. Added `aria-hidden="true"` on `<main>` when drawer is open. Added body scroll lock (`overflow: hidden`) to prevent background scrolling. Existing focus trap and Escape handling preserved.
4. **Route Label Coverage:** Added missing routes `/offers`, `/joinings`, `/settings/targets` to breadcrumb route labels. These were linked in sidebar navigation but missing from the label array.
5. **Pre-Existing Build Fix:** `Avatar` and `DashboardSection` components existed but were not exported from `components/ui/index.ts`, causing `ReportsPage.tsx` build failure. Fixed by adding barrel exports.
6. **Notification Data Integrity:** Verified `NotificationAlertDialog` uses real API (`GET /notifications/unread-count` and `GET /notifications`). No fabricated unread counts. Badge shows real `unreadCount` from API response.

### Quality Gates:
- `pnpm typecheck`: **0 errors** (all 3 workspace projects)
- `pnpm lint`: **0 errors, 0 warnings**
- `pnpm test`: **35/35 web tests** (16 files) + **11/11 API tests** (1 file)
- `pnpm build`: **Clean production build** (web, api, worker)

### Report: `docs/development/F2_SHELL_NAVIGATION_REPORT.md`

## 2026-08-31 — M1-G5 Master Data Integrity Foundation

**Status: COMPLETE & VERIFIED**

### Summary of Findings & Implementation:
1. **Concurrency-Safe Generated Codes:** Implemented `resolveCode()` using PostgreSQL advisory locks (`pg_advisory_xact_lock`) dynamically hashed per tenant ID and master data type. This safely guarantees unique generation even under high concurrent `POST` volume.
2. **Strict Tenant Isolation:** `TENANT_RESOURCE_POLICIES` were confirmed to correctly include `legalEntity`, `branch`, and `position`. Fixed tests confirmed that `TenantScopedGuard` properly enforces isolation and returns safe 404s for cross-tenant ID scanning.
3. **Reference-Aware Soft Deletion:** Hard deletions are correctly rejected if the records are referenced (e.g. Branch references LegalEntity, Vacancies reference Position). The API returns `409 Conflict`. Safe `archive` (soft-delete) and `restore` mutations were implemented and wired to the UI.
4. **UI RBAC Protection:** The `actions` column and `Add` buttons in `MasterDataPage.tsx` were updated to render strictly only when `MASTER_DATA_MANAGE` permission is present. Axe audits for these UI states passed with 0 critical/serious violations.
5. **No DB Migration:** Found that the existing schema components (`onDelete: Restrict`, `code` strings, `status` field, and `@@unique` configurations) fully satisfied P0 master data requirements without altering the database schema.

## 2026-08-31 — M1-G4 Evidence Closure & Deterministic Multi-Tenant Validation

### Summary of Evidence Rework:
1. **Deterministic Per-Run Multi-Tenant Fixtures:** Replaced arbitrary production-like records with `database/m1-g4-fixture-manager.cjs`. Every test run generates an isolated namespace `M1G4_<runId>_...` containing deterministic Org A and Org B entities across all 26 resource families and child relations, with clean teardown in `finally`.
2. **Actual Fixture IDs in API & Browser Suites:** Both `database/test-m1-g4-rls.cjs` and `tests/browser/test_m1_g4_rls_browser_matrix.py` dynamically consume the generated run fixtures.
3. **87 Backend Assertions (100% Passed):** Verified same-tenant authorized reads, same-tenant RBAC denials, roles and system role immutability, foreign-key reference rejection (404/400), cross-tenant safe 404s across all 26 resource families, list/search/pagination isolation, SheetJS XLSX workbook parsing (0 Org B data), exact failed audit creation with verified `organizationId`, CV download isolation, client override immunity (`X-Tenant-Id`, `x-organization-id`, `?organizationId=`, body), and existence-neutral error parity.
4. **96 Browser Matrix Assertions (100% Passed):** Evaluated all 16 representative routes for Admin, Recruiter, Hiring Manager, and Interviewer, deep links to foreign resources (candidates, vacancies, requests, applications, interviews, offers, talent pools), keyboard navigation and filter input, 6 responsive viewports (375-1440px), and automated Axe audits across all 16 routes in both light and dark themes (32 total audits, 0 critical/serious violations).
5. **Quality Gates & Builds:** Clean `pnpm typecheck` (0 errors), `pnpm lint` (0 errors/warnings), `pnpm test` (43/43 unit tests passed), `pnpm build` (production build clean), `pnpm db:validate` (passed), and `pnpm db:migrate:status` (17 migrations up to date).
6. **Authoritative Next Phase:** **M1-G5 — Master Data integrity foundation**.

### Scope
Enforce strict multi-tenant isolation, row-level visibility, and relationship-aware scoping across all RecruitFlow controllers, services, database queries, audit logs, and web UI.

### Key Architectural Findings & Remediations
- **Post-Auth Tenant Context:** `TenantContextMiddleware` executed before guards and saw `undefined` for `req.user`. Furthermore, `JwtAuthGuard` failed to await Passport auth before setting `request.tenantId`. This was repaired in `jwt-auth.guard.ts` by explicitly awaiting Passport authentication (`await super.canActivate(context)`) and attaching `request.tenantId = request.user.organizationId`. `TenantContextMiddleware` was neutered to avoid race conditions. Injected headers (`X-Tenant-Id`, `x-organization-id`), queries (`?organizationId=`), and body overrides were proven ineffective.
- **Typed Tenant-Resource Policy Registry:** Eliminated dynamic Prisma model indexing (`(this.prisma as any)[model]`) and unsafe `any`. Created `tenant-resource-policies.ts` with direct organization scoping for direct models and relation-chain parent scoping (`parentRelationScope`) for child/junction entities (e.g. `offerVersion`, `offerApproval`, `complianceRequirement`, `hiringCaseApproval`, `pipelineStage`, `candidateImportRow`, `applicationStatusHistory`, `interviewAttendee`, `interviewScorecard`, `talentPoolCandidate`, `vacancyRequestApproval`, `vacancyAssignment`, `offerComponent`, and `role`).
- **Roles & Role Permissions:** Added typed `role` policy and decorated `roles.controller.ts` with `@UseGuards(TenantScopedGuard)` and `@TenantResource({ resource: 'role', param: 'id' })`. System roles are shared and immutable to tenant updates (403), while foreign custom roles return safe 404. Cross-tenant custom role assignment to users is rejected (404).
- **Safe 404 Behavior:** `TenantScopedGuard` fails closed for unmapped resources and returns existence-neutral safe 404s (`NotFoundException`) for non-existent or foreign tenant entities, preventing resource enumeration across tenants.
- **Audit Scoping & Exact Failed Verification:** `AuditInterceptor` was updated to preserve `organizationId` from verified request user context for both `SUCCESS` and `FAILURE` authenticated actions. Verified exact newly-created failure records in database with matching `organizationId`, actor, and safely redacted reason, with 0 audit entries created in foreign tenants.
- **XLSX Report Parsing:** Downloaded actual `/reports/export.xlsx` via API, parsed with SheetJS (`xlsx`), and verified 0 instances of foreign tenant names, IDs, or records.
- **Controller Protections:** Applied `@UseGuards(TenantScopedGuard)` and `@TenantResource(...)` decorators across all ID-parameter routes across all 29 domain controllers.

### Test & Quality Gate Evidence
- **Backend Integration (`node database/test-m1-g4-rls.cjs`)**: **72/72 assertions PASSED** covering all 16 test categories.
- **Browser UI & Accessibility (`python tests/browser/test_m1_g4_rls_browser_matrix.py`)**: **64/64 assertions PASSED** across 4 personas (Admin, Recruiter, Hiring Manager, Interviewer), 16 representative routes, 6 viewports, 2 themes, and Axe accessibility (0 critical/serious findings).
- **Quality Gates**: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors/warnings), `pnpm test` (43/43 unit tests passed), `pnpm build` (clean production build for web, worker, and api), `pnpm db:validate` (passed), `pnpm db:migrate:status` (17 migrations up to date).
- **All Regressions Green:** M1-G1 72/72, M1-G2 121/121, M1-G3 87/87, auth recovery 39/39, auth matrix 93/93, isolation 10/10, RBAC 12/12, safe-disclosure 7/7, CV storage 24/24, bulk import 16/16, master data import 32/32, hardening slice 20/20.
- **Authoritative Next Milestone:** **M1-G5 — Master Data integrity foundation**.

The delegated report also points to the wrong next phase. The authoritative
plan defines **M1-G5 as Master Data integrity foundation**, not rate limiting.
M1-G4 remains open until these evidence and coverage gaps are remediated.

## 2026-08-30 — M1-G3 Stable API Error Contracts (Complete & Verified)

### Scope
Implement stable, safe, consistent API error contracts across RecruitFlow without weakening auth, authorization, tenant isolation, validation, audit logging, or business rules.

### Findings & Implementation Details
- **Fail-Safe Normalizer:** A bounded fail-safe sanitizer was instituted in `error-normalizer.ts` because the previous global HTTP filter carelessly emitted raw strings. The new normalizer detects Prisma `P*` codes, raw SQL fragments, `node_modules` paths, tokens, absolute paths, and raw object dumps, replacing unsafe client messages with stable fallbacks.
- **Envelope Standardization:** API errors now emit the stable envelope with required `{ statusCode, code, message, requestId, retryable, retryAfterSeconds }` and optional `fields`. Core DTO fields are guaranteed by `@recruitflow/contracts`.
- **Frontend Client:** `fetchApi` and `downloadApi` uniformly parse the envelope, preserve fields/retry metadata, and dispatch `auth:unauthorized` gracefully on 401s (including file downloads without infinite refresh loops).
- **Unit Tests Provided:** Direct tests `apps/web/src/api/client.test.ts` (5 tests) and `apps/api/src/common/errors/error-normalizer.spec.ts` (11 tests) were written and pass 100%.

### Test Evidence
- **Backend integration (`node database/test-m1-g3-error-contracts.cjs`)**: 87/87 checks PASSED on the current build and repeated successfully in isolated runs.
- **Browser UI checks (`python tests/browser/test_m1_g3_browser_matrix.py`)**: 33/33 UI checks PASSED twice, covering login/error/session behavior at six viewport widths in light and dark themes plus Axe accessibility in both themes.
- **Current-build regressions:** M1-G1 72/72, auth recovery 39/39, M1-G2 121/121, safe-disclosure 7/7, isolation 10/10, RBAC 12/12, and P0-A 24/24 passed in the validated runs.
- All regression, safe-disclosure, isolation, and RBAC tests remain fully green.
## 2026-08-24 - M1 Authentication & Public Journeys Closure

- **RF-AUTH-003 (M1 Closed)**: Missing public authentication endpoints for password recovery, email verification, and invitation acceptance. Resolved by wiring 5 public routes in `auth.controller.ts` (`/auth/password-reset/request`, `/auth/password-reset/complete`, `/auth/email-verification/request`, `/auth/email-verification/complete`, `/auth/invitations/accept`) and 1 authenticated invitation route in `users.controller.ts` (`POST /users/invitations` behind `USERS_MANAGE` permission and `USER_INVITE` audit action).
- **RF-AUTH-004 (M1 Closed)**: Single-use token security and anti-enumeration. Verified that raw tokens are never persisted (SHA-256 hashes only), row locks (`SELECT ... FOR UPDATE`) prevent concurrency race conditions, consumed tokens cannot be replayed (`consumedAt` stamped), and session invalidation (`tokenVersion` increment) invalidates active refresh tokens on password reset.
- **RF-AUTH-005 (M1 Closed)**: Development token isolation. Verified that `AUTH_EXPOSE_DEV_TOKENS=true` is required in conjunction with `NODE_ENV !== 'production'` to expose development tokens. In production or when unconfigured, `delivery: 'not_configured'` is returned without leaking token values.
- **RF-FE-004 (M1 Closed)**: Missing public authentication frontend journeys. Implemented 4 dedicated public pages: `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `AcceptInvitationPage.tsx`, and `VerifyEmailPage.tsx` with full state handling (idle, submitting, success, error, invalid/expired token), SGH design system aesthetics, and responsive layout across 6 viewport widths. Added "Forgot password?" navigation link to `LoginPage.tsx`.
- **RF-DATA-003 (M1 Closed)**: Prisma migration `20260827_auth_recovery_invitations` successfully applied to database; `User.emailVerifiedAt`, `User.invitationAcceptedAt`, and `auth_tokens` table are now active. `prisma migrate status` reports 12 applied migrations and 0 pending.
- **RF-TEST-001 (M1 Closed)**: Created comprehensive integration test suite `database/test-m1-auth-recovery.cjs` (38/38 checks passing) and Playwright browser matrix `tests/browser/test_m1_auth_browser_matrix.py` (60/60 checks passing across 6 widths × 2 themes). All quality gates (typecheck, lint, test, build, design-tokens, bundle-budgets, security matrix, isolation, RBAC) are verified green.

## 2026-08-23 - M0 exact-source baseline checkpoint

- The required repository-root `AGENTS.md` file is absent. The task-provided AGENTS instructions remain the active policy and are recorded as a baseline discrepancy.
- The exact source is on `main` at `915b3a68158d53d485d3b3f7f76792634619a5e6` with an intentionally dirty worktree: 190 changed tracked paths (one deletion) and 951 untracked paths. The status manifest fingerprint is `dcdf63293e92b617056a5f7f09dce62c4975a3cdce2d704a23640ad19dfd2aef`.
- The current repository contains 39 web pages, 70 shared UI TSX files, 27 API controllers, 23 API services, 20 DTO files, 8 migration directories, 9 database/security scripts, and 11 Python browser test files. This confirms broad implementation surface but not release completeness.
- `apps/web/src/App.tsx` currently lazy-routes the major ATS families and protects operational/admin routes with `PermissionGate`; `apps/web/src/layout/AppShell.tsx` exposes six groups, a direct Interviews route, but Calendar remains a contextual route rather than a separate navigation item.
- Auth currently has HttpOnly access/refresh cookies, JWT/session version invalidation, database-backed auth rate-limit state, global validation, correlation IDs, and security headers. The worker remains a logging-only skeleton and readiness checks database only.
- Current source contract risks to carry into M1 include a broad `/users/interviewers` response behind `VACANCY_VIEW`, a permissive API `PermissionsGuard` requiring all decorated permissions, page/API approval contract reconciliation, workflow transition integrity, audit atomicity/entity identity, and truthful empty/error state verification.
- The current migration tree includes `20260820_profile_preferences` and `20260823_auth_rate_limits` in addition to the six earlier migration directories. Fresh Prisma status/deploy evidence is required before treating those migrations as applied.
- No Docker/Compose/Kubernetes/Terraform/Vercel/Netlify or other deployment manifest was found in the exact source inventory. This is an M8-M10 operational gap, not an authorization to invent deployment infrastructure during M0.
- Evidence record: `docs/development/M0_BASELINE_2026-08-23.md`.

### M0 fresh validation findings - 2026-08-23

- The current source does not reproduce the historical Vitest memory failure: serial, 8-worker, and correctly rooted 256 MB heap runs all completed 13 files / 25 tests. A failed first constrained invocation was a command-root error (`/@id/.../src/test/setup.ts`), not an application failure.
- The current source does not pass the production build. Web compilation identifies invalid shared icon names (`loader`, `table`, `trash-2`), a missing `showToast` context member, PageFrame `showBack` prop drift, Button `tone` drift, and required FormField `id` omissions in Talent Pool pages, along with unused Dashboard state. API and worker compilation passed.
- Bundle budgets are exceeded by the generated current web artifacts: 246.49 KB CSS versus 225 KB and 378.17 KB JS versus 300 KB. The PDF parser remains lazy-loaded, so this is an entry-bundle budget issue rather than a parser code-splitting failure.
- Lint reports 13 errors across `talent-pool.service.ts`, `DashboardPage.tsx`, `TalentPoolDetailPage.tsx`, `TalentPoolPage.tsx`, the design-system Tailwind preset, and `resumeParser.ts`. These are implementation debt to address in M1/M2 without masking rules.
- The read-only relational audit returned zero reported violations against the local database. Its output labels every metric `[PASS]` and always exits successfully even if a metric is nonzero; M1 must turn this into a fail-closed release check.
- The full browser matrix timed out at 240 seconds before writing `matrix-summary.json`. A dated root route probe reached the current Vite source on port 5185 and the API on port 3000, and found serious `color-contrast` violations in light mode at all six widths and in dark mode at four widths. This is current evidence, not historical screenshot interpretation.
- The extended full browser matrix completed all 396 checks: 354 passed and 42 failed. The failures are limited to axe serious `color-contrast` findings on Dashboard, Candidates, Applications/Pipeline, and Reports; the affected controls repeatedly use white foreground text on `#00a3e0` at 2.87:1. All other traversed routes completed without recorded overflow, console, failed-response, or route-load issues.
- The original Vite process associated with port 5173 was still present but had no listening socket during the check. A separate Vite process owned by this M0 run served port 5185; the existing API process on port 3000 is `dist/apps/api/src/main.js`. No user-owned process was stopped.
- Generated Prisma artifacts required an environment workaround: `db:generate` could not replace a locked Windows engine. The verified same-schema local-engine output restored the default ignored client runtime without changing the tracked schema; the lock remains an environmental baseline issue until the owning process is released.
- Exact Prisma schema read confirms tenant IDs are present on domain tables, but most child foreign keys independently reference parent IDs without composite same-organization constraints. Tenant isolation therefore remains primarily application-enforced and requires continued cross-tenant negative testing in M1.
- Exact current data model read confirms Candidate profile data is still flat (`skills`, `experienceYears`, `location`, certifications, languages, availability), TalentPoolCandidate has membership/consent/eligibility/cooling-off fields, and there are no structured CV provenance, sourcing requirement, scoring version, match evidence, fairness, or outcome-monitoring entities. This keeps M4-M6 correctly blocked behind deterministic foundations.
- Exact contract read confirms core lifecycle types and pagination exist, but Vacancy contracts omit current schema fields such as required skills, minimum experience, and location. Candidate inputs still expose optional `organizationId`, while the server must remain authoritative for tenant context. These are M1 contract-reconciliation items, not schema-change authorization.
- The eight forward-only migrations cover the initial ATS, auth, candidate/application, documents/interviews, offers, notifications/tasks, preferences, and database-backed auth rate limits. There is no repository rollback script or deployment rehearsal evidence; migration upgrade/recovery remains M9-M10 work.
- Exact shared primitive read confirms Modal is portalled with Escape, focus restoration, focus cycling, viewport-bounded internal scrolling, and backdrop dismissal; ThemeContext persists light/dark and reduced-motion settings. Current build drift is in consumers and shared prop/icon contracts, while the shared action token `#00a3e0` with white text is the WCAG blocker found by the full matrix.
- Environment review found 19 keys in `.env.example` versus 16 in the local `.env` (names only; values were not printed), with the three auth-limit keys absent locally and therefore defaulted by the service. The example documents `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY`, while `auth.service.ts` reads `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN`; this naming drift must be resolved without exposing secrets. The example also contains session/object-storage placeholders that are not yet consumed by the current runtime.

### M0 closure decision - 2026-08-23

M0 is complete as an exact-source baseline and release-discipline checkpoint. There are no unknown baseline commands or unclassified failures. Product implementation must begin at M1; the current source is not release-ready because the production web build/lint gates fail, entry bundle budgets fail, and the full browser matrix has 42 WCAG contrast failures. The next implementation slice must remain P0-focused and must use isolated data for any valid-write integration/RBAC test.

## 2026-08-23 — Perfect Production Version planning findings

Status: Master-plan reconciliation complete and ready for execution review; no new product implementation has started under this program.

- The user requested one complete plan to fix and enhance the full application into the best production version, not another isolated visual patch.
- Existing planning records are extensive and sometimes contradictory: several historical sections claim full completion, while later evidence identifies additional blockers or changed source. The new master plan must distinguish historical evidence from exact-source release certification.
- The repository already contains substantial P0, design-system, responsive, security, CI, and browser-matrix work. The plan must preserve and revalidate this work rather than restart or replace it.
- The current product boundary is a Recruitment Operations / ATS platform. Core HR, payroll, attendance, leave, benefits, and employee self-service remain a separate ZenHR-style HRMS roadmap.
- Talent Pool is the largest product-value gap: current APIs cover pool CRUD/membership basics, but the UI/detail routing and frontend contracts require reconciliation, and structured candidate/requirement data is insufficient for trustworthy recommendation scoring.
- A sellable recommendation engine requires structured, editable CV data; explicit sourcing requirements; hard eligibility gates; explainable, versioned scores; human review; protected-attribute exclusion; auditability; and outcome monitoring.
- The master plan will use phase entry criteria, deliverables, acceptance criteria, required tests, rollback expectations, and release evidence so “complete” has a consistent definition.
- Exact-source reconciliation confirms an extensively dirty worktree across frontend, API, database, documentation, tests, and CI. These changes are user-owned and the execution plan must begin with a protected baseline/branch strategy; no reset or wholesale replacement is acceptable.
- The root workspace now exposes explicit lint, typecheck, build, web test, database/security test, browser matrix, design-token, bundle-budget, migration, and seed commands. The release plan should reuse these gates and close their coverage gaps instead of inventing a parallel test system.
- Current manifests identify React 19/Vite 8, NestJS 11, Prisma 6/PostgreSQL, pnpm workspaces, a worker package, shared contracts/validation/design-system packages, Lucide, Radix, GSAP, dnd-kit, PDF.js, and Mammoth. No broad UI or animation dependency is justified by the master plan.
- The source contains an untracked `TalentPoolDetailPage.tsx`; its existence does not prove the detail route, contracts, or workflow are integrated. M4 must inspect and either safely integrate or revise it without discarding user work.
- Historical test artifacts are very large and duplicated. Release certification must generate a fresh, dated evidence set from the exact candidate source rather than treating old screenshots as current proof.
- Exact-source Talent Pool reconciliation supersedes the earlier missing-route finding: `/talent-pool/:id` is now lazy-routed and `TalentPoolDetailPage.tsx` implements load, add, remove, and candidate navigation. Remaining foundation gaps include an inert Edit Pool action, browser-native removal confirmation, incomplete detail pagination/filtering, and no recommendation workflow.
- Candidate persistence now includes `skills`, `experienceYears`, and `location`, and Vacancy includes `location`. This is a useful matching baseline, but it does not yet provide normalized skills, proficiency/evidence, employment history, certifications, languages, availability, requirement weights, or score/version provenance.
- The CI workflow is substantially stronger than the older readiness report: PostgreSQL service, migrations, seed, design tokens, lint, typecheck, build, bundle budget, dependency audit, API startup, database/security tests, and browser/accessibility matrix are wired. The master plan must retain these gates and add mutation/E2E, deployment, recovery, and operational evidence.
- The worker package currently initializes a Redis target but does not implement production queues, processors, retry/dead-letter policy, schedules, or job observability. Asynchronous integrations and CV processing therefore remain M7 work.
- Environment contracts mention Redis and private object storage, but repository evidence still needs proof of provisioned production infrastructure, encrypted binary storage, backup/restore rehearsal, monitoring, and secrets management.
- Existing readiness documents disagree because source evolved after earlier audits. The master plan will treat the exact source plus fresh command output as authoritative and keep older reports as historical context only.
- The 2026-08-23 readiness audit accurately defines the commercial boundary and historical trust gaps, but several P0 items in that report were subsequently implemented. Its stage model remains useful; its command results must not be reused as current baseline evidence.
- `RELEASE_READINESS.md` still identifies durable open gates that remain appropriate for the perfect-version plan: isolated browser mutation journeys, full accessibility evidence, authorized pre-production security review, performance baseline, dedicated-tenant UAT, and migration provenance/rollback evidence.
- The canonical domain dependency order remains sound: contracts → migration/schema → API → shared UI → page integration → browser/security evidence. The new master plan will add Talent Matching, asynchronous integrations, commercial operations, and production certification without changing that order.
- Master-plan diff integrity produced no whitespace errors; Git reported only the repository's existing LF/CRLF normalization warnings for the planning files.
- Final coverage review confirmed that the plan explicitly includes the sidebar/top bar, persistent light/dark theme and backgrounds, login, shared UI foundations, all recruitment workflows, Talent Pool and explainable matching, integrations, administration/commercial controls, accessibility, performance, security, responsive QA, release evidence, and required phase/final handoffs.

## 2026-08-23 Product & Release Readiness Audit

Status: Evidence collection in progress.

Audit questions:

1. Which capabilities are fully implemented and testable today?
2. Which capabilities are incomplete, placeholder-driven, UI-only, or operationally unsafe?
3. Which issues block selling RecruitFlow as a recruitment operations product?
4. Which additional modules are required only if RecruitFlow expands into a ZenHR-style HRMS?

Initial evidence:

- The repository is a multi-package TypeScript application with React/Vite frontend, NestJS API, shared contracts/design-system packages, and Prisma-backed persistence.
- The current frontend scope is recruitment-heavy: vacancy requests, approvals, vacancies, candidates, applications/pipeline, interviews/calendar, offers, hiring/joining, talent pools, tasks, notifications, reports, integrations, users/roles, master data, workflow settings, audit, profile, and design-system showcase.
- Calendar exists at `/interviews/calendar`, but the primary sidebar exposes only `Interviews`; this is a discoverability and information-architecture defect, not a missing route.
- The worktree is extensively dirty with user-owned modifications and untracked files. The audit will remain read-only except for planning records.
- Workspace manifests confirm a React 19 + Vite 8 frontend, NestJS 11 API, Prisma database package, shared contracts/validation/design-system packages, and pnpm workspaces. The root also declares a worker package, which requires separate verification because its commercial/runtime role is not documented by the main scripts.
- Frontend dependencies already include Lucide, Radix, GSAP, dnd-kit, Tailwind/shadcn utilities, and React Router. The unattractive result is therefore not caused by a missing UI library; it is primarily an information-architecture, composition, token-adoption, and consistency problem.
- Test artifacts are extensive but heavily duplicated across historical visual passes. The existence of screenshots does not prove current release readiness; current-state commands and critical-journey checks must be rerun.
- No deployment platform, CI pipeline, container, infrastructure-as-code, or production observability configuration was identified in the initial architecture file inventory. This is a likely commercial-readiness gap pending a focused operations check.
- The frontend declares 42 authenticated route surfaces plus Login/404 and uses route-level lazy loading. Core workflow coverage is real at the route level: vacancy request lifecycle, vacancies, candidates/documents, applications, interviews/calendar/scorecards, offers/approvals, hiring/final approval/joining, talent pools/import, tasks/notifications, reports, admin, profile, and design-system showcase.
- The current shell renders sidebar icons at 14px and uses six legacy menu groups (`Overview`, `Vacancy Management`, `Talent`, `Recruitment`, `Analytics`, `Administration`). Calendar has its own route and breadcrumb but no direct sidebar item. This confirms the user's visual and discoverability complaint.
- The backend exposes corresponding NestJS controllers and permission decorators for the major recruitment workflows. This is more than a static prototype, but endpoint depth, tenant isolation, validation, error behavior, and critical journey completion still require verification.
- Frontend and backend route permissions are not modeled from one shared registry. The same capability can therefore drift between `PermissionGate`, sidebar visibility, and NestJS decorators; historical findings already show examples of this class of defect.
- The data schema contains recruitment, workflow, hiring, audit, notification, task, role/permission, organization, and integration entities. It does not represent a full ZenHR-class HRMS domain such as payroll, attendance, leave, employee self-service, performance, benefits, or localized statutory processing.
- Current source still violates its own truthfulness rules: Dashboard uses fake numeric fallbacks (`openVacancies || 2`, `vacancies.length || 3`), Vacancy Overview substitutes joined/remaining values (`|| 1`, `|| 2`), and one vacancy tab explicitly renders “coming soon.” These are P0 trust blockers for a sellable data product.
- `ApplicationDetailPage` and `HiringCasePage` use `Math.random()` as row-key fallback, creating unstable rendering identity. `Sparkline` generates an ID during render using `Math.random()`, which can also destabilize repeated rendering and accessibility references.
- Calendar is not feature-complete: source contains an explicit TODO for day/week/month switching. Notifications also contains a TODO for globally accurate unread count. Both support the user's impression that navigation and product depth are unfinished.
- Historical release documentation explicitly states `PARTIAL — NOT READY TO DECLARE Enterprise Beta`. Its remaining gates include mutation-based browser journeys, full accessibility, authorized security review, performance baseline, UAT, and migration/rollback evidence. These remain authoritative until current evidence supersedes them.
- The repository README still describes RecruitFlow as an internal recruitment and hiring system and documents in-memory adapter defaults plus future S3/Redis plans. Commercial packaging, production persistence defaults, file-storage architecture, and worker operations must be proven before sale.
- The strict enhancement prompt intentionally prevented an application-wide redesign and required one sidebar Interviews item. That constraint explains why Calendar remained an internal tab. The new audit should retain deep links while making Calendar unmistakably discoverable inside the unified workspace and through contextual navigation.
- Authentication has useful foundations: HttpOnly access/refresh cookies, secure cookies in production, token-version invalidation, refresh rotation, active-account checks, global DTO validation, origin allowlisting, and organization-aware permission lookup.
- Authentication is not yet production-hardened for scale: failed-login state lives only in an in-process `Map`, so it resets on restart and is not shared across API instances. JWT expiries are hard-coded in service methods despite environment variables documenting configurable values.
- Platform hardening evidence is incomplete: no explicit security-header middleware, rate-limit middleware for general API traffic, centralized request correlation/audit logging, health dependency checks, metrics/tracing, or production exception-sanitization layer was found in `main.ts`.
- Integrations are catalog records, not functioning connectors. A read auto-creates eight default rows, configuration is stored as generic JSON, and every connection test deliberately returns `success: false`. The product must not market Microsoft 365, Google, S3, HRIS, LinkedIn, email, job boards, or webhooks as working integrations yet.
- Candidate documents are intentionally metadata-only; no binary upload, object storage, malware scanning, signed download, retention, or deletion workflow exists. This is an honest V1 boundary but a commercial ATS limitation.
- Candidate import has meaningful duplicate detection, transactional confirmation, tenant filters, and pagination. However it processes all rows synchronously in the API transaction, so large-file throughput and background processing remain unproven.
- Historical desktop visual evidence confirms the user's design concern: the shell is visually clean but underscaled and generic. Navigation icons, labels, secondary text, metric metadata, and chart annotations are too small; hierarchy is created mainly through boxes instead of stronger composition and typography.
- Dashboard density is high but decision hierarchy is weak: five equal KPI cards, several equal white panels, tiny action links, and a large number of borders compete for attention. It reads as a polished internal dashboard rather than a distinctive premium product.
- The calendar uses an oversized weekly grid with substantial empty space, no visible day/month mode control in the reviewed evidence, limited conflict/availability context, and weak schedule density. It is functionally recognizable but not yet a strong recruiter scheduling workspace.
- Historical screenshots are not reliable proof of current navigation because one artifact shows a direct `Interview Calendar` sidebar entry while current source does not. Current-state browser evidence must be generated before final release sign-off.
- Mobile Dashboard evidence shows excessive vertical length and two-column KPI cards that truncate labels and metadata. Dense charts are readable only with very small text, and important actions compete with date/refresh controls at the top.
- Historical 375px Calendar evidence shows severe navigation/content overlap and horizontal schedule clipping. Although later source claims responsive shell fixes, Calendar still requires a current-state mobile regression test and likely a purpose-built mobile agenda view rather than a squeezed desktop week grid.
- Mobile product navigation has no clear persistent module affordance in the reviewed Dashboard capture; icon-only header controls lack the strong wayfinding expected for a sellable operational product.
- The worker is a stub: it imports no BullMQ/ioredis runtime, registers no queues or processors, and only logs a redacted Redis target. Background CV parsing, notifications, exports, retries, and scheduled jobs therefore do not exist operationally despite dependencies and README language.
- Runtime configuration is inconsistent: the shared environment schema defaults `VACANCY_CORE_ADAPTER` to `in-memory`, the module factory defaults it to `prisma`, and `.env.example` sets `prisma`. Production must fail closed to Prisma with one validated configuration source.
- Readiness checks only validate the database. They do not validate Redis, storage, email, queue workers, migrations, or external dependencies. This is acceptable for the current narrow runtime but insufficient once those capabilities are marketed.
- A `.github` directory exists, so CI must be inspected before concluding deployment automation is absent. No Docker/container, Kubernetes, Terraform, Vercel, or Netlify project configuration exists at repository root.
- GitHub Actions exists but is below release-grade: it uses Node 20 and pnpm 9 while the repository declares Node 24/pnpm 11 guidance and `packageManager: pnpm@11.9.0`; it runs install, Prisma validation, recursive typecheck, and build only.
- CI does not run root lint, frontend Vitest, database integration/RBAC/tenant suites, browser journeys, design-token checks, dependency/security audit, migration deployment/status, or artifact/deployment checks. A green CI run therefore cannot currently certify release quality.
- Frontend has 11 focused component/theme unit test files but no page-level or route-level Vitest coverage. API source has no colocated unit/spec files. Most business confidence comes from standalone database scripts and Python Playwright scripts outside CI.
- Browser tests have valuable coverage for login, permissions, recruitment surfaces, responsive overflow, reduced motion, and some truthful-boundary checks. They remain largely read-only; the release document correctly flags missing isolated mutation journeys.
- Browser scripts depend on seeded local credentials and locally running API/web processes. Test-environment provisioning, data isolation, cleanup, parallel safety, and CI integration are not yet productized.
- Frontend pages are generally connected to real APIs and important mutations exist for applications, interviews, approvals, offers, hiring, profile, tasks, notifications, imports, workflow settings, and candidate creation. RecruitFlow is not a screenshot-only product.
- Several pages fetch broad datasets for selector/context use (`/vacancies`, `/applications`, `/hiring`, `/interviews`) without proven server pagination or query narrowing. This will degrade as tenant data grows and should be replaced by paginated/search endpoints where necessary.
- Commercial SaaS capabilities are absent from application/database source: no subscription plans, billing, trials, tenant self-provisioning, invitation flow, email verification, password reset, SSO/SAML/OIDC, MFA, domain verification, support/ticketing, or customer-facing data export/deletion workflow was found.
- Candidate consent fields exist, but broader privacy operations such as retention policies, subject access/export, deletion/anonymization, legal holds, and auditable consent capture are not yet complete product capabilities.
- Backup/restore appears only as a manual operations document using `pg_dump`/`pg_restore`; no automated backup policy, restore drill evidence, RPO/RTO, encryption/key management, or environment-specific runbook is wired into deployment.
- Dashboard truthfulness is substantially worse than the first scan showed: active candidates, interview count, offers, hires, period deltas, aging counts, and action counts all substitute designed demo values when real values are zero. This is a release-blocking data-integrity defect, not cosmetic polish.
- Vacancy Overview exposes six tabs while five route sections render a generic “coming soon” state. It also hard-codes accepted offers and substitutes joined/remaining headcount, uses multiple `any` casts, and displays assignment user IDs instead of names. This page is not commercially complete.
- The API client sanitizes 401/403/404 responses, but passes other backend validation/error messages directly to users. A stable problem-details/error-code mapping is needed to avoid leaking implementation detail and to keep user messages consistent.
- Vacancy request context now receives tenant context in normal controller/service flow and returns tenant-filtered branch/position lists, addressing the historical first-organization defect. The repository still permits optional organization/requester arguments and has a global fallback; this should be removed so tenant scope is mandatory by type and runtime.
- Global search has good tenant scoping, rehydrates active permissions server-side, and restricts tasks to the current assignee. It is a strong example for other modules.
- The “old icons” problem is implementation-specific, not library-specific: current Lucide icons use a restrained 1.8 stroke, but the sidebar forces them to 14px. At that size the icons lose distinction and visual presence.
- Icon semantics are duplicated: `users` is used for both Candidates and Users & Roles; `database` for Talent Pool and Master Data; `settings` for Profile and Pipeline Settings; `FileText` for offers, audit, and generic documents. Distinct module icons and 18–20px navigation sizing are needed.
- Profile & Settings is incorrectly distributed under Administration even though every authenticated user owns it. It should live in the account menu; Administration should contain only organizational controls.
- The internal Interviews/Calendar switcher exists and keeps both deep links, but it uses `role=tab` on router links without full tab keyboard/selection semantics. It should be implemented either as standard navigation links or as a complete accessible tabs pattern.
- Shared component adoption is broad but uneven: 36 pages use `PageFrame`, 20 use `ResponsiveDataView`, 18 use `MetricCard`, and 14 use `FormField`, while only 5 use `DataTable` and 7 use `Tabs`. This explains why the system has a recognizable visual language but inconsistent interaction behavior.
- Six pages still contain `any` casts and six contain inline styles; three pages render raw buttons. These are manageable debts but should be eliminated during the workflow-by-workflow redesign.
- The frontend loads eight style files totaling roughly 145 KB of source CSS, in addition to `App.css` and Tailwind utilities. The layered history (`polish`, `v2-parity`, `source-integration`, `design-system`, `ui-primitives`, `shell`) creates a high risk of override drift and makes visual refinement slower than necessary.
- The CSS conflict risk is confirmed: `.sidebar`, `.nav`, `.header`, `.page`, metrics, panels, tables, controls, and responsive breakpoints are redefined across `shell.css`, `polish.css`, and `v2-parity.css`. `v2-parity.css` relies heavily on `!important`, effectively patching earlier layers rather than using one authoritative component style.
- Responsive breakpoints are fragmented across 480, 520, 600, 720, 767, 768, 860, 900, 960, 1023, 1080, 1180, and others. This makes the shell and page composition unpredictable between tested widths and is a root cause of layout regressions.
- Login is visually stronger and more distinctive than the authenticated product: it has a clear two-column hierarchy, focused typography, and restrained atmosphere. The app shell should reach this quality bar without copying the login's large marketing composition.
- Login currently displays “Secure Sign In” and “Protected by your organization's access policy.” Because authentication has real HttpOnly-cookie/RBAC foundations these are not entirely false, but the claims should be reviewed alongside missing MFA/SSO, distributed rate limiting, and production security headers before marketing them externally.
- Current quality evidence: recursive workspace typecheck passed, 11 frontend test files/18 tests passed, Prisma schema validation passed, and the local database reports all 7 migrations applied.
- Root typecheck does not include the web package because `apps/web/package.json` has no `typecheck` script. Web TypeScript is only exercised as part of `build`, so the current typecheck PASS is incomplete by itself.
- Root lint fails with 55 errors across seven product pages plus two stray patch scripts in the page directory. Most failures are `no-explicit-any`, concentrated in application detail, hiring case, interview detail, users/roles, vacancy overview, vacancy requests, and vacancy list.
- The design-token gate fails in shared high-visibility components (`FunnelChart`, `MetricCard`, notification popover, `TrendBarChart`). These components hard-code Tailwind palette colors, hex values, and light-only surfaces; this directly explains theme and contrast inconsistency.
- The notification popover source contains hard-coded named people, avatar colors, time labels, and notification content instead of using the real notifications API. The header bell therefore presents demo information while the full Notifications page is API-backed—a P0 trust defect.
- `TrendBarChart` contains static narrative text (“below target” and a named strongest month) that is not proven to be derived from the current dataset. Dashboard insight copy must be calculated from actual values or omitted.
- Full workspace production build passes, including web TypeScript compilation. However the recursive workspace unexpectedly builds the untracked `apps/web_backup_20260818_122853` copy because `apps/*` includes it; this duplicates build work and risks shipping/stale package confusion.
- Current web output has a 933.32 kB minified CV Intake chunk (255.57 kB gzip) plus a 1.26 MB PDF worker. This is the primary measured frontend performance concern and should be addressed through parser isolation/lazy worker loading and upload-flow performance budgets.
- Main CSS output is 200.83 kB (33.12 kB gzip), consistent with the layered override debt. Some route chunks are unexpectedly large (`Button` ~95.86 kB, Applications ~104.27 kB, Design System ~165.51 kB), requiring bundle-graph inspection before optimization.
- Production dependency audit fails with two high-severity advisories: vulnerable `nanoid` through PostCSS-related paths and vulnerable `deepmerge-ts` through Prisma configuration. Dependency resolution/upgrades and verification are P0 release gates.
- Build-time packages (`@tailwindcss/vite`, `shadcn`) are declared as production dependencies, contributing to the production audit/runtime dependency surface. Dependency classification should be corrected after verifying Vite build requirements.
- Header notifications are definitively disconnected from backend truth: the component initializes five named demo notifications, computes unread count locally, and “mark read/all” only changes React state. This can mislead every user immediately after login and must be replaced before any customer demo.
- The notification popover declares `aria-modal="true"` but behaves as a non-modal anchored popover without focus trapping or background inertness. Its interaction semantics and mobile presentation need correction together with the API integration.
- Dashboard hardcoding is explicit and broad: aging counts, candidate totals/deltas, interview totals/upcoming counts, offer action counts, hiring counts, goal values, and narrative insight text are constants. The chart goal line is fixed at 6 and the copy always names July as strongest month regardless of data.
- Existing database acceptance scripts are mixed read/write tests against the local API/database. The larger lifecycle suites create and clean fixtures, while isolation suites attempt forbidden mutations to prove safe 404 behavior. They should run only in a dedicated disposable test database, not against shared development/UAT data.
- The test harness currently relies on known seeded user passwords and localhost ports. A sell-ready pipeline needs ephemeral database provisioning, unique per-run fixtures, teardown guarantees, and environment guards that refuse Production.
- Current-state browser matrix executed 88 checks across 11 key routes, four widths, and both themes: 66 passed and 22 failed. Interviews, Calendar, Offers, Hires, Users, and Component Showcase passed all tested width/theme combinations for overflow/runtime/selected Axe checks.
- Accessibility is a release blocker: Dashboard, Candidates, Pipeline, and Reports have serious color-contrast failures. Candidates also has a critical invalid `aria-controls` reference. Dark desktop exposes a severe brand contrast defect; dark Dashboard includes near-unreadable hard-coded rose/slate surfaces.
- Eight Profile failures were caused by an old API process started on 2026-08-20 that does not expose the new `/me/profile` and `/me/preferences` routes, while current source/build contains them. This demonstrates an operational deployment/version-skew problem; a focused current-build recheck is required before classifying Profile code.
- Current desktop screenshot confirms visible shell defects: sidebar account/footer content loses its container/layout at the bottom, Administration content is not readily visible, branding and group labels are undersized/low contrast, and the fake header notification count is prominent.
- The frontend development proxy target is hard-coded to port 3000. Environment-specific proxy/API configuration should be centralized to make isolated testing and deployment less fragile.
- Focused Profile verification against fresh-build API/frontend processes passed 8/8 across all required widths and both themes. Temporary processes were stopped; the user's pre-existing API and unrelated PMS frontend processes were not changed.
- `git diff --check` fails on trailing whitespace in existing modified UI files and emits extensive LF/CRLF warnings. Repository hygiene is not release-clean.
- Final product assessment: RecruitFlow is an advanced internal recruitment beta with a credible ATS core, but it is not ready for sale. The authoritative staged remediation and target-state report is `docs/development/PRODUCT_READINESS_AUDIT_2026-08-23.md`.

---

**Audit Date**: 2026-08-17
**Scope**: Full Application Audit across Frontend, Shared UI, API Client, Auth, NestJS API, Prisma, Contracts, State Machine, and Operations
**Auditor**: Senior Full-Stack Architecture Specialist
**Constraint Verification**: V1 Light Mode Only, Existing Design Tokens Preserved, Metadata-Only Documents, Working Tree Protected, Applied Migrations Unchanged, 0 Code Changes during Audit.

> **2026-08-18 product decision**: The user explicitly approved Light + Dark modes. This supersedes the former light-only presentation constraint for the enhancement implementation; all other safety and data-truth constraints remain active.

### 2026-08-18 enhancement implementation baseline

- `ThemeContext` is intentionally light-only and currently removes both `data-theme` and `.dark`; a no-flash bootstrap does not exist in `index.html`.
- The current atmosphere is one static gradient layer; unused drift keyframes already exist, so the enhancement can remain CSS-only without another animation dependency.
- Many shared primitives still hard-code `bg-white`, `text-white`, slate/violet colors, and white focus-ring offsets. These must migrate before dark mode can be considered complete.
- The shell changes at `960px` while header compaction starts at `720px`, leaving the confirmed 768px failure range. The enhancement will standardize the drawer boundary at `1024px`.
- The existing header search is only a focusable input and the “New” control is only a link to `/candidates`; both require truthful interactive behavior.
- `PipelineBoard` advertises drop targets without drag/drop handlers. The API already exposes `PATCH /applications/:id/stage`, so the frontend needs allowed-transition metadata and an accessible move implementation rather than a new mutation model.
- Reports expose four unfiltered endpoints and label position-title grouping as department data. The additive overview contract will preserve old endpoints while correcting the UI label and adding real range/filter data.
- `AuthUser` carries role codes but not hydrated permission codes. Global search therefore must load the current active user's permission set server-side and omit unauthorized entity groups; a broad static permission decorator cannot model this safely.
- Existing high-frequency entity indexes already cover organization/status and organization/stage for vacancies, candidates, applications, and tasks. The additive search/report slices can proceed without a schema migration; performance evidence will determine any later index work.
- Task search must remain assignee-scoped as well as organization-scoped because the current task permission is defined as access to the current user's tasks.
- Quick-create actions can be truthful without inventing routes: vacancy creation uses `/vacancy-requests/create`; candidate creation can use the existing Candidates modal via a `?create=1` handoff; CV intake uses `/cv-intake`; offer/interview creation is governed by the existing `APPLICATION_MOVE_STAGE` permission.
- The existing shared `Modal` already traps focus and restores it, but hard-codes light surfaces and a slate overlay. It must be made semantic before it is reused for the command palette in Dark mode.

---

## 1. Finding Catalog

### [RF-FE-001] Fake/Hardcoded Metric Number Fallbacks on Falsy Zero
- **ID**: `RF-FE-001`
- **Severity**: `P1`
- **Affected User Workflow**: Dashboard, Executive KPI reporting, Approval Inbox, Interviews overview, License compliance, Master data counts, Audit log volume.
- **Exact File & Line**:
  - `apps/web/src/pages/DashboardPage.tsx`: lines 301, 308, 323, 341, 377, 380 (`openVacancies || 2`, `vacancies.length || 3`, `totalHeadcount || 5`, `funnel.reduce(...) || 10`, `pendingRequests || 3`, `criticalRequests || 1`)
  - `apps/web/src/pages/ApprovalInboxPage.tsx`: lines 238, 245, 252, 272, 279 (`totalPending || 3`, `requests.length || 2`, `offerApprovals.length || 1`)
  - `apps/web/src/pages/AuditLogPage.tsx`: lines 99, 100 (`totalEvents || 18`, `sensitiveCount || 3`)
  - `apps/web/src/pages/InterviewsPage.tsx`: lines 137–140 (`scheduledCount || 2`, `completedCount || 4`, `pendingFeedback || 1`, `interviews.length || 7`)
  - `apps/web/src/pages/JoiningManagementPage.tsx`: lines 92–94 (`awaitingCount || 2`, `items.length || 3`, `joinedCount || 1`)
  - `apps/web/src/pages/LicenseManagementPage.tsx`: lines 99–101 (`licenses.length || 6`, `verified || 4`, `pending || 2`)
  - `apps/web/src/pages/MasterDataPage.tsx`: lines 134–136 (`legalEntities || 2`, `branches || 3`, `positions || 8`)
  - `apps/web/src/pages/OffersPage.tsx`: lines 85–87 (`draftCount || 1`, `pendingCount || 1`, `sentCount || 1`)
  - `apps/web/src/pages/ReportsPage.tsx`: line 84 (`kpis.timeToFill.value || 24`)
  - `apps/web/src/pages/UsersRolesPage.tsx`: line 130 (`users.length || 5`)
  - `apps/web/src/pages/TalentPoolPage.tsx`: line 99 (`pools.length || 3`)
- **Reproduction Steps**:
  1. Log into a newly created organization with zero vacancies, zero interviews, or zero pending approvals.
  2. Navigate to `/`, `/approval-inbox`, `/interviews`, or `/master-data`.
  3. Observe KPI cards.
- **Expected Behavior**: When real data count is `0`, KPI cards display `0`.
- **Actual Behavior**: Because `0` is falsy in JavaScript, the logical OR `||` evaluates to fake fallback integers (`2`, `3`, `5`, `10`, `18`, `7`, `6`, `4`, `8`, `24`), presenting fictitious numbers to the user.
- **Technical Root Cause**: Use of `count || <mock_number>` instead of nullish coalescing `count ?? 0` or directly passing `count`.
- **Problem Layer**: Frontend UI Presentation.
- **Recommended Fix**: Replace all `value={count || N}` with `value={count ?? 0}` or `value={count}`.
- **Required Regression Tests**: Test empty organization fixture; verify that all metric cards on all 11 pages display `0`.
- **Dependencies**: None.

---

### [RF-BE-001] Cross-Tenant Leakage in Vacancy Request Context Endpoint
- **ID**: `RF-BE-001`
- **Severity**: `P0`
- **Affected User Workflow**: Creating a Vacancy Request (`/vacancy-requests/create`).
- **Exact File & Line**:
  - `apps/api/src/vacancy-core/prisma-vacancy-core.repository.ts`: lines 33–57
  - `apps/api/src/vacancy-core/vacancy-requests.controller.ts`: lines 33–37
- **Reproduction Steps**:
  1. Create Organization A and Organization B in the database.
  2. Log in as a Hiring Manager in Organization B.
  3. Navigate to `/vacancy-requests/create`.
  4. Submit a new vacancy request.
- **Expected Behavior**: The vacancy request context returns the branch and position belonging to Organization B.
- **Actual Behavior**: `getContext()` executes `this.prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } })` and returns the branch and position of Organization A (the first seeded organization), causing cross-tenant data assignment.
- **Technical Root Cause**: `VacancyRequestsController.getContext()` does not pass `@CurrentUser() user: AuthUser` to `VacancyCoreService.getContext(organizationId)`. The repository queries the first global organization instead of filtering by the authenticated user's `organizationId`.
- **Problem Layer**: Backend (Controller + Service + Repository).
- **Recommended Fix**:
  1. Update `VacancyRequestsController.getContext(@CurrentUser() user: AuthUser)`.
  2. Pass `user.organizationId` through `VacancyCoreService.getContext(organizationId)` to `prisma-vacancy-core.repository.ts`.
  3. Query `prisma.branch.findMany({ where: { organizationId, status: 'Active' } })` and `prisma.position.findMany({ where: { organizationId, status: 'Active' } })` to let the user select real tenant branches and positions.
- **Required Regression Tests**: Multi-tenant isolation test verifying that User B only receives Organization B master data.
- **Dependencies**: `RF-FE-002`.

---

### [RF-FE-002] Hardcoded Single Branch/Position Selection in Vacancy Request Form
- **ID**: `RF-FE-002`
- **Severity**: `P1`
- **Affected User Workflow**: Creating a Vacancy Request (`/vacancy-requests/create`).
- **Exact File & Line**:
  - `apps/web/src/pages/CreateVacancyRequestPage.tsx`: lines 61–62
- **Reproduction Steps**:
  1. Log into an organization with multiple branches (e.g. Dubai, Abu Dhabi, Riyadh) and multiple positions.
  2. Go to `/vacancy-requests/create`.
- **Expected Behavior**: The user can choose their intended Branch and Position from dropdown selectors.
- **Actual Behavior**: The form hardcodes payload values to `context.branch.id` and `context.position.id`, completely preventing the user from creating vacancies for any other branch or position.
- **Technical Root Cause**: Frontend relies on a legacy 1:1 `VacancyCoreContext` object containing single objects (`branch: Branch, position: Position`) instead of branch and position lists.
- **Problem Layer**: Frontend & Contract.
- **Recommended Fix**: Update `VacancyCoreContext` contract to return `branches: Branch[]` and `positions: Position[]`, and render `<Select>` components for Branch and Position in `CreateVacancyRequestPage.tsx`.
- **Required Regression Tests**: Form validation test with multiple branches/positions.
- **Dependencies**: `RF-BE-001`.

---

### [RF-AUTH-001] Permission Denial for Recruiters Querying `/users` on Interview Scheduling
- **ID**: `RF-AUTH-001`
- **Severity**: `P1`
- **Affected User Workflow**: Scheduling an Interview from the Interviews Page (`/interviews`).
- **Exact File & Line**:
  - `apps/api/src/users/users.controller.ts`: line 18
  - `apps/web/src/pages/InterviewsPage.tsx`: line 48 (`getApi<UserRecord[]>('/users').catch(() => [])`)
- **Reproduction Steps**:
  1. Log in as a user with the `RECRUITER` role.
  2. Navigate to `/interviews` and click **Schedule interview**.
  3. Open the **Designated Interviewer** dropdown.
- **Expected Behavior**: The recruiter can select from active organization interviewers.
- **Actual Behavior**: `GET /users` requires `USERS_VIEW` permission (reserved for HR Admins). The request returns `403 Forbidden`. The silent `.catch(() => [])` in `InterviewsPage.tsx` catches the error and leaves the attendee list empty.
- **Technical Root Cause**: `UsersController` restricts all user listing to `USERS_VIEW` permission without providing a scoped endpoint (or allowing `INTERVIEW_SCHEDULE` / `APPLICATION_VIEW` callers) to retrieve basic interviewer summaries (`id`, `displayName`, `email`).
- **Problem Layer**: Backend Authorization & API Contract.
- **Recommended Fix**: Add `@RequirePermissions('USERS_VIEW', 'INTERVIEW_SCHEDULE', 'INTERVIEW_VIEW')` to `UsersController.list` or expose a dedicated `@Get('interviewers')` endpoint with `id` and `displayName`.
- **Required Regression Tests**: Test recruiter persona scheduling interview without `USERS_VIEW` administrative permission.
- **Dependencies**: None.

---

### [RF-FE-003] Hardcoded Dummy Currency and Compensation Components in Offer Creation
- **ID**: `RF-FE-003`
- **Severity**: `P2`
- **Affected User Workflow**: Creating an Offer (`/offers/create`).
- **Exact File & Line**:
  - `apps/web/src/pages/CreateOfferPage.tsx`: lines 51, 56–59, 76–78
- **Reproduction Steps**:
  1. Go to `/offers/create`.
  2. View initial salary breakdown and location.
- **Expected Behavior**: The offer components start clean or pre-populate from the specific vacancy budget / approved request.
- **Actual Behavior**: Form pre-populates with hardcoded dummy items: `Basic Salary: 14000 AED`, `Housing Allowance: 5000 AED`, `Transportation Allowance: 2000 AED`, and `workLocation: 'Dubai Marina'`.
- **Technical Root Cause**: Prototype placeholder state left in `useState` initialization.
- **Problem Layer**: Frontend Form.
- **Recommended Fix**: Initialize components dynamically with standard empty breakdown or load currency/breakdown from the parent vacancy request.
- **Required Regression Tests**: Test offer creation with custom currency and amounts.
- **Dependencies**: None.

---

### [RF-BE-002] Missing Branch/Position Listing Permissions for Line & Hiring Managers
- **ID**: `RF-BE-002`
- **Severity**: `P1`
- **Affected User Workflow**: Line managers and department heads creating vacancy requests.
- **Exact File & Line**:
  - `apps/api/src/master-data/branches.controller.ts`: line 18
  - `apps/api/src/master-data/positions.controller.ts`: line 18
- **Reproduction Steps**:
  1. Log in as a `HIRING_MANAGER` or `LINE_MANAGER`.
  2. Attempt to list branches or positions.
- **Expected Behavior**: User can view available organization branches and positions to select for their hiring requisitions.
- **Actual Behavior**: Returns `403 Forbidden` because `list` is guarded strictly with `@RequirePermissions('MASTER_DATA_VIEW')`.
- **Technical Root Cause**: Permission requirements are coarse-grained. `MASTER_DATA_VIEW` is treated as an admin capability rather than allowing operational requisition creators read-only access to catalog lists.
- **Problem Layer**: Backend Authorization.
- **Recommended Fix**: Allow `@RequirePermissions('MASTER_DATA_VIEW', 'VACANCY_REQUEST_CREATE', 'VACANCY_VIEW')` on read-only list endpoints.
- **Required Regression Tests**: Requisition creation flow as Hiring Manager.
- **Dependencies**: `RF-BE-001`.

---

### [RF-DATA-001] Missing Composite Indexes on High-Frequency Filter Fields
- **ID**: `RF-DATA-001`
- **Severity**: `P2`
- **Affected User Workflow**: High-volume candidate search, interview schedule lookups, application stage filtering.
- **Exact File & Line**:
  - `database/prisma/schema.prisma`: `Application`, `Interview`, `CandidateDocument` models
- **Reproduction Steps**:
  1. Seed database with 50,000 candidates and 100,000 applications.
  2. Query `GET /applications?stage=Interview&primaryRecruiterId=...`.
- **Expected Behavior**: Query executes using index scan on `(organizationId, stage)` and `(organizationId, primaryRecruiterId)`.
- **Actual Behavior**: Performs sequential scan across large tables because composite indexes for multi-tenant query combinations are missing.
- **Technical Root Cause**: Schema defines single-column indexes on some models but lacks composite multi-tenant indexes `@@index([organizationId, stage])`, `@@index([organizationId, status])`.
- **Problem Layer**: Database (Prisma Schema).
- **Recommended Fix**: Add composite index definitions in future planned migration.
- **Required Regression Tests**: Query execution plan validation (`EXPLAIN ANALYZE`).
- **Dependencies**: None.

---

### [RF-FE-004] Inconsistent Pagination Wire Response Handling across Lists
- **ID**: `RF-FE-004`
- **Severity**: `P2`
- **Affected User Workflow**: Browsing interviews, offers, talent pools vs applications, notifications, tasks.
- **Exact File & Line**:
  - `apps/web/src/pages/InterviewsPage.tsx`: line 46 (`getApi<Interview[]>('/interviews')`)
  - `apps/web/src/pages/OffersPage.tsx`: line 40 (`getApi<Offer[]>('/offers')`)
  - `apps/web/src/pages/ApplicationsPage.tsx`: line 45 (`getApi<PaginatedResult<Application>>('/applications')`)
- **Reproduction Steps**:
  1. Check network responses across different list pages.
- **Expected Behavior**: Consistent envelope structure across all operational list endpoints.
- **Actual Behavior**: Half the API endpoints return plain arrays `T[]` while others return `PaginatedResult<T>` (`{ data: T[], total, page, pageSize, totalPages }`).
- **Technical Root Cause**: Divergent endpoint evolution across development phases.
- **Problem Layer**: Contract / API Consistency.
- **Recommended Fix**: Standardize contracts in `packages/contracts` so list queries consistently consume typed paginated responses.
- **Required Regression Tests**: Contract serialization and pagination tests.
- **Dependencies**: None.

---

### [RF-UX-001] Missing Frontend Route Guard Synchronization for Integrations & Reports
- **ID**: `RF-UX-001`
- **Severity**: `P2`
- **Affected User Workflow**: Direct URL navigation to `/integrations` and `/reports`.
- **Exact File & Line**:
  - `apps/web/src/App.tsx`: lines 127, 139
- **Reproduction Steps**:
  1. Log in as a `CANDIDATE_COORDINATOR` or `INTERVIEWER`.
  2. Type `/integrations` or `/reports` in the URL bar.
- **Expected Behavior**: Frontend `<PermissionGate>` immediately blocks unauthorized access and displays the friendly forbidden surface.
- **Actual Behavior**: For `/reports`, `App.tsx` lacks a `<PermissionGate>` wrapper (backend blocks data with 403). For `/integrations`, `App.tsx` checks `requiredRole="ADMINISTRATOR"` instead of checking `requiredPermission="MASTER_DATA_VIEW"`.
- **Technical Root Cause**: Frontend router permission gate attributes are out of sync with backend NestJS `@RequirePermissions` annotations.
- **Problem Layer**: Frontend Routing.
- **Recommended Fix**: Synchronize `App.tsx` `<PermissionGate>` props to use canonical permission codes (`APPLICATION_VIEW` for reports, `MASTER_DATA_MANAGE` for integrations).
- **Required Regression Tests**: Router permission matrix test for all 7 standard user roles.
- **Dependencies**: None.

---

## 2. API Contract Mismatch Matrix

| Endpoint | Backend Return Type | Frontend Expectation | Status / Impact |
|---|---|---|---|
| `GET /vacancy-requests/context` | Single default org branch/position | Array of branches/positions | **MISMATCH** — prevents selecting real branch/position |
| `GET /users` | `UserRecord[]` (requires `USERS_VIEW`) | `UserRecord[]` (called by `RECRUITER`) | **PERMISSION GAP** — returns 403 on interview scheduler |
| `GET /branches` | `Branch[]` (requires `MASTER_DATA_VIEW`) | `Branch[]` (needed by requisition creator) | **PERMISSION GAP** — returns 403 for Line Managers |
| `GET /positions` | `Position[]` (requires `MASTER_DATA_VIEW`) | `Position[]` (needed by requisition creator) | **PERMISSION GAP** — returns 403 for Line Managers |
| `GET /applications` | `PaginatedResult<Application>` | `PaginatedResult<Application>` | **ALIGNED** |
| `GET /interviews` | `Interview[]` | `Interview[]` | **ALIGNED** (Unpaginated) |
| `GET /offers` | `Offer[]` | `Offer[]` | **ALIGNED** (Unpaginated) |
| `POST /candidates/import/:id/confirm` | `{ status: 'Confirmed', ... }` | `Confirmed` / `Completed` | **ALIGNED** (Fixed in Checkpoint) |

---

## 3. Entity Relationship & Multi-Tenancy Problems

1. **`VacancyCoreRepository.getContext()`**: Leaks Organization #1 to all tenants due to missing `organizationId` parameter.
2. **`OfferVersion` Immutability**: Properly enforced in backend transaction (`isLocked: true` on approval), but UI allows creating revisions without displaying previous version comparison diffs.
3. **`HiringCase` & `JoiningRecord`**: Headcount validation is properly enforced in backend `hiring.service.ts` transaction; prevents exceeding approved vacancy headcount upon joining.

---

## 4. Current Verification Pass - Baseline Evidence (2026-08-17)

This section belongs to the current forensic pass and does not replace the historical findings above. Historical findings are treated as hypotheses until their current implementation and line numbers are re-verified.

| Area | Current evidence | Audit implication |
|---|---|---|
| Worktree | `git status --short` reports extensive pre-existing modifications and untracked files across API, web, database checks, tests, and documentation. | No application files may be reverted or normalized during this audit. |
| Workspace | Root scripts expose web/API build, recursive typecheck, lint, Prisma validation/status, and seed commands. | These commands are available for read-only verification; results must be run in this session before being claimed. |
| Database history | `database/prisma/migrations` contains six migration directories plus `migration_lock.toml`; no migration file will be edited. | Schema and migration provenance must be inspected before any schema recommendation. |
| Prior release position | `docs/development/RELEASE_READINESS.md` records `PARTIAL - NOT READY`, with mutation journeys, full accessibility, security review, performance baseline, UAT, and migration provenance still open. | Prior `STABLE` wording in `progress.md` is not sufficient to declare release readiness. |
| Current task boundary | Prompt 1 requires a no-code-change forensic audit. | Only planning/evidence files may be updated; no implementation fixes are authorized in this pass. |

### Current frontend hypotheses awaiting backend/runtime correlation

#### [RF-FE-005] Non-zero metric fallbacks remain in live routes

- **Severity**: `P1`
- **Affected workflows**: Vacancy request and opening dashboards, task queue, talent pool health, vacancy detail funnel, and interview scorecard progress.
- **Current evidence**: `rg` against `apps/web/src/pages` found current non-zero fallbacks at `VacancyRequestsPage.tsx:80-82`, `VacantListPage.tsx:81-82`, `TasksPage.tsx:89-90`, `TalentPoolPage.tsx:188-190`, `VacancyOverviewPage.tsx:120-125,204,206`, and `InterviewDetailPage.tsx:208`.
- **Expected**: Persisted zero values render as zero and unavailable values render an explicit unavailable state.
- **Actual risk**: Falsy values resolve to prototype numbers, so a healthy empty response can display fictitious operational metrics.
- **Root-cause layer**: Frontend presentation; exact severity will be confirmed against the API nullability and empty-organization behavior.
- **Dependencies**: None identified.

#### [RF-FE-006] Route-level permission coverage is incomplete

- **Severity**: `P1`
- **Affected workflows**: Direct URL access to vacancy, candidate, application, interview, offer, hiring, joining, and administration surfaces.
- **Current evidence**: `apps/web/src/App.tsx:90-124,152-153` declares these routes without a `PermissionGate`, while only `/users`, `/master-data`, `/audit-log`, `/reports`, `/pipeline-settings`, and `/integrations` are wrapped. `App.tsx:143-148` uses a role-only gate for integrations.
- **Expected**: Direct navigation and sidebar navigation use the same canonical permission boundary, with backend authorization remaining authoritative.
- **Actual risk**: A user can render a protected page shell and trigger requests before receiving backend denial; several routes have no friendly forbidden surface and route/action permissions cannot be reviewed from one consistent matrix.
- **Root-cause layer**: Frontend routing/authorization contract; backend permission requirements still require correlation.
- **Dependencies**: API permission map and role matrix.

#### [RF-FE-007] Related-data errors are converted into successful empty UI state

- **Severity**: `P1`
- **Affected workflow**: Scheduling an interview and selecting an application/interviewer.
- **Current evidence**: `apps/web/src/pages/InterviewsPage.tsx:47-48` converts application and interviewer request failures into `{ data: [] }` or `[]`, including a fallback from `/users/interviewers` to `/users`.
- **Expected**: The page identifies which dependency failed and offers a retry or a truthful unavailable state.
- **Actual risk**: A 403/404/500 can look like “no applications” or “no interviewers,” hiding an integration or permission failure and allowing an incomplete scheduling form.
- **Root-cause layer**: Frontend data-loading/error handling; permission and endpoint correctness require backend correlation.
- **Dependencies**: API contract and interviewer permission findings.

#### [RF-FE-008] Notification shell starts with a fictitious unread count and suppresses count failures

- **Severity**: `P2`
- **Affected workflow**: Header notification access on every authenticated route.
- **Current evidence**: `apps/web/src/layout/AppShell.tsx:51` initializes `unreadCount` to `8`, and `:64` catches `/notifications/unread-count` failures without changing the displayed count or exposing retry/error state. The same component uses hard-coded identity fallbacks at `:202,241-242`.
- **Expected**: Before the count is known, the badge is absent/loading; failure is distinguishable from a real zero count; identity comes from the authenticated profile.
- **Actual risk**: Users may see a false unread badge or demo organization/persona when the API is unavailable or the auth contract is incomplete.
- **Root-cause layer**: Frontend shell state/data truthfulness.
- **Dependencies**: Notification API response and auth bootstrap behavior.

#### [RF-UX-002] Notification popover and Drawer do not share complete dialog focus behavior

- **Severity**: `P2`
- **Affected workflows**: Header notification review and evidence drawers.
- **Current evidence**: `AppShell.tsx:311` renders the popover as a dialog without focus capture/return or a retry action; `apps/web/src/components/ui/Drawer.tsx:20-31` handles Escape only and has no focus trap/return, labelled-by relationship, or initial focus. `Modal.tsx` has a separate focus implementation.
- **Expected**: Dialog-like surfaces have a labelled dialog, initial focus, focus containment, Escape close, return focus, and recoverable load/error behavior.
- **Actual risk**: Keyboard users can tab behind open overlays, lose context, or be unable to recover notification loading failures.
- **Root-cause layer**: Shared UI/accessibility.
- **Dependencies**: Shared dialog contract and route-level accessibility gate.

#### [RF-API-001] Universal and dedicated offer approval inboxes do not consume the same wire contract

- **Severity**: `P1`
- **Affected workflow**: Approving or rejecting an offer from `/approval-inbox` or `/offers/approvals/inbox`.
- **Current evidence**:
  - `apps/api/src/offers/offers.service.ts:319-332` returns a flat object with `offerVersionId`, `offerCode`, `candidateName`, `positionTitle`, `branchName`, `versionNumber`, `monthlyPackage`, `roleCode`, and `status`.
  - `apps/web/src/pages/ApprovalInboxPage.tsx:12-25,126-130` types and reads `offerVersion.offer.offerCode` and `offerVersion.versionNumber`, which are not present in the response.
  - `apps/web/src/pages/ApprovalInboxPage.tsx:126-127` sends `decision: 'Approved'` or `'Rejected'`, while `apps/api/src/offers/offers.dto.ts:102-104` accepts only `'Approve'` or `'Reject'`.
  - `apps/web/src/pages/OfferApprovalInboxPage.tsx:119-122` links to `/offers/${app.id}` where `app.id` is the approval ID; the response does not provide the offer ID needed for that detail route.
- **Reproduction**: Seed one pending offer approval, open `/approval-inbox`, select the Offers tab, then approve or reject; separately open `/offers/approvals/inbox` and select Review.
- **Expected**: Both screens render the same typed response, navigate with the offer ID, and submit the DTO enum accepted by the controller.
- **Actual risk**: The universal inbox displays blank/default offer metadata and its decision request receives a 400; the dedicated inbox’s Review link targets an approval UUID as if it were an offer UUID.
- **Root-cause layer**: Combined API/UI contract drift.
- **Minimum-risk fix**: Define one shared approval-inbox contract, return the required `offerId` (or a stable detail URL), and use the canonical `Approve | Reject` values in both consumers. Add a wire-shape and mutation regression test.
- **Dependencies**: `RF-FE-006` route permissions and the offer approval workflow trace.

#### [RF-API-002] License management depends on fields omitted by the hiring-case list endpoint

- **Severity**: `P1`
- **Affected workflow**: Reviewing compliance/license requirements at `/licenses`.
- **Current evidence**: `apps/web/src/pages/LicenseManagementPage.tsx:37-53` calls `GET /hiring` and flattens `c.complianceRequirements`; `apps/api/src/hiring/hiring.service.ts:112-137` maps the list response without `complianceRequirements` or `approvals`.
- **Reproduction**: Create a hiring case with its default compliance requirements, open `/licenses`, and inspect the response and rendered rows.
- **Expected**: The license page receives the requirements it is explicitly designed to display, or it calls a dedicated compliance endpoint.
- **Actual risk**: The page silently turns every case’s missing optional property into an empty list, so real compliance requirements disappear without an error.
- **Root-cause layer**: API response shape / frontend consumer mismatch.
- **Minimum-risk fix**: Add a dedicated organization-scoped compliance list contract or include the required relation in the list response, then remove the truth-hiding optional fallback from this consumer and add a populated-case test.
- **Dependencies**: Hiring/compliance endpoint contract and release workflow coverage.

#### [RF-FE-009] Offer creation still contains prototype values and a revision-only DTO violation

- **Severity**: `P1`
- **Affected workflow**: Creating and revising offers at `/offers/create` and `/offers/:id`.
- **Current evidence**:
  - `apps/web/src/pages/CreateOfferPage.tsx` initializes offer components and form fields with fixed salary/currency, schedule, probation, and work-location values, and inserts a fixed AED allowance when adding a component.
  - The same page includes `applicationId` in the revision payload, while `apps/api/src/offers/offers.dto.ts:71-99` defines `CreateOfferRevisionDto` without that property and `main.ts` enables `forbidNonWhitelisted: true` globally.
  - The page catches application-loading failures without setting an error state, so a failed application request can present an empty selector as if there were no candidates.
- **Reproduction**: Open the create-offer page with no vacancy-specific compensation data; then revise an existing offer and inspect the request body and response.
- **Expected**: Defaults are either empty/truthful or loaded from the selected application; revision requests contain only revision DTO fields; dependency failures are visible and retryable.
- **Actual risk**: Users can submit fabricated compensation context, and revision requests are rejected with a validation error before the service executes.
- **Root-cause layer**: Frontend form state and request-contract handling.
- **Minimum-risk fix**: Remove non-authoritative values, model currency/compensation as required backend data, branch create/revision payloads by DTO, and expose application-load errors.
- **Dependencies**: Offer contract matrix and workflow test data.

#### [RF-AUTH-002] Interviewer lookup requires a permission that is absent from the seeded authorization model

- **Severity**: `P1`
- **Affected workflow**: Scheduling an interview and assigning interviewers as the seeded recruiter or hiring manager.
- **Current evidence**:
  - `apps/api/src/users/users.controller.ts:17-21` guards `GET /users/interviewers` with `INTERVIEW_VIEW` but returns the unrestricted organization user list.
  - `database/prisma/seed.cjs:212-247` never seeds `INTERVIEW_VIEW`; the role map at `:271-290` assigns no interview-view permission to `RECRUITER`, `HIRING_MANAGER`, or `INTERVIEWER`.
  - `apps/web/src/pages/InterviewsPage.tsx:45-49` requests `/users/interviewers`, then falls back to `/users`; the fallback requires `USERS_VIEW`, which the seeded recruiter also lacks.
- **Reproduction**: Sign in as `sarah.ahmed@recruitflow.local`, open `/interviews`, and inspect the interviewer request(s) and schedule dialog.
- **Expected**: The scheduling user can retrieve only active, organization-scoped eligible interviewers under a defined permission.
- **Actual risk**: Both requests return 403 for the seeded recruiter; the UI converts the failure to an empty interviewer list, so scheduling cannot be completed and the permission failure is hidden.
- **Root-cause layer**: Authorization model plus endpoint implementation.
- **Minimum-risk fix**: Define the canonical permission and role assignments, filter the endpoint to active eligible users, remove the broad `/users` fallback, and surface a retry/unavailable state. Add role-by-endpoint tests.
- **Dependencies**: `RF-FE-007`, interview workflow trace, and shared permission catalog.

#### [RF-BE-004] Interview service accepts invalid time ranges and arbitrary active attendees

- **Severity**: `P2`
- **Affected workflow**: Scheduling and editing interviews.
- **Current evidence**: `apps/api/src/interviews/interviews.dto.ts:26-30,53-59` validates ISO date syntax only; `apps/api/src/interviews/interviews.service.ts:99-107,112-125,164-169` verifies only active organization membership, then persists the dates without checking `scheduledEnd > scheduledStart`, calendar overlap, or interviewer eligibility/role.
- **Reproduction**: POST `/api/v1/interviews` with an end time before the start time or with any active organization user ID.
- **Expected**: Invalid intervals and unavailable/non-interviewer attendees are rejected with actionable validation errors; conflicting assignments follow a documented policy.
- **Actual risk**: Impossible calendar events and users without interviewer responsibility can be persisted, undermining interview and scorecard workflow integrity.
- **Root-cause layer**: Backend validation/business rules.
- **Minimum-risk fix**: Add cross-field time validation, explicit eligible-attendee selection, and conflict policy before the transaction; add DTO/service tests.
- **Dependencies**: `RF-AUTH-002` and interview status/permission contract.

#### [RF-WF-001] Offer acceptance bypasses the canonical application-stage transition table

- **Severity**: `P1`
- **Affected workflow**: Moving an application from interview/offer review into pre-hire after a candidate accepts an offer.
- **Current evidence**: `apps/api/src/applications/applications.service.ts:23-32` permits `Interview -> Offer -> Pre-Hire`; `apps/api/src/offers/offers.service.ts:442-454` directly writes `Pre-Hire` when an offer changes to `Accepted`, without checking the application’s current stage or calling the transition validator.
- **Reproduction**: Create an application still in `Applied` or `Screening`, create/send an offer through an authorized test path, mark the offer `Accepted`, then inspect `Application.stage` and `ApplicationStatusHistory`.
- **Expected**: Offer acceptance is accepted only for an application in the required `Offer` stage, or a documented transition rule is applied consistently.
- **Actual risk**: A valid offer can move an application across skipped stages, and the history entry does not preserve `fromStage`; reports and downstream hiring eligibility can become inconsistent with the pipeline.
- **Root-cause layer**: Backend workflow transition enforcement.
- **Minimum-risk fix**: Reuse one transition service/table inside the offer transaction, persist the actual prior stage, and add invalid-stage, replay, and partial-failure tests.
- **Dependencies**: Offer approval state machine, hiring-case creation, and workflow trace.

#### [RF-WF-002] Offer revisions are not restricted by offer/version state

- **Severity**: `P1`
- **Affected workflow**: Revising offers after approval, sending, acceptance, or rejection.
- **Current evidence**: `apps/api/src/offers/offers.service.ts:225-275` loads the organization-scoped offer and latest version but does not check offer status, version `isLocked`, or whether a revision is allowed before creating a new pending version and replacing `currentVersionId`.
- **Reproduction**: Call `POST /api/v1/offers/:id/revisions` for an offer whose current version is locked or whose offer status is `Accepted`/`Sent`.
- **Expected**: Only a documented editable/rejected state can create a revision; immutable versions and terminal offers remain unchanged.
- **Actual risk**: A previously distributed or accepted compensation package can be replaced by a new pending version, weakening approval and historical integrity.
- **Root-cause layer**: Backend workflow/state validation.
- **Minimum-risk fix**: Enforce revision preconditions in the service transaction and add concurrency/state regression tests.
- **Dependencies**: `RF-API-001` and the offer workflow policy.

#### [RF-FE-010] Dashboard substitutes demo records whenever a live collection is empty

- **Severity**: `P1`
- **Affected workflow**: Organization dashboard at `/` for a new or empty tenant, and after list-request failures.
- **Current evidence**: `apps/web/src/pages/DashboardPage.tsx:189-207,210-233` defines non-empty `defaultFunnelStages`, `defaultVacancies`, and `defaultRequests`, then renders them whenever the corresponding API arrays are empty. `:66-90` uses `Promise.allSettled` and reports an error only when three core calls all fail.
- **Reproduction**: Use an organization with zero requests/vacancies/applications, or make only one core dashboard request fail, then open `/`.
- **Expected**: Empty persisted collections render an explicit empty state; partial failures identify unavailable widgets and never replace them with demo records.
- **Actual risk**: A real empty tenant can display fabricated vacancies, requests, and funnel counts; a partial outage can be rendered as a plausible but false dashboard.
- **Root-cause layer**: Frontend data-state handling.
- **Minimum-risk fix**: Remove demo fallbacks, track each resource state, and render `PageState`/retry per failed or empty resource.
- **Dependencies**: Report/funnel API truth and dashboard route permission coverage.

#### [RF-DATA-002] Vacancy detail funnel response is hardcoded to zero and the UI replaces zero with demo counts

- **Severity**: `P1`
- **Affected workflow**: Vacancy funnel, joined headcount, accepted offers, and remaining seats at `/vacancies/:id`.
- **Current evidence**:
  - `apps/api/src/vacancy-core/prisma-vacancy-core.repository.ts:291-323` returns `applied`, `screening`, `interviews`, `offer`, and `preHire` as literal zeroes rather than querying organization-scoped applications.
  - `apps/web/src/pages/VacancyOverviewPage.tsx:119-125,202-206` converts those zeroes to `28/12/6/2/1`, converts joined zero to `1`, and converts remaining zero to `2`; it also hardcodes accepted offers to `1`.
- **Reproduction**: Open any vacancy with zero applications and zero joined headcount; inspect the API response and the overview metrics.
- **Expected**: Counts are derived from persisted application/offer/hiring records and zero remains zero.
- **Actual risk**: Vacancy owners see false funnel performance and headcount, compromising staffing decisions and reports.
- **Root-cause layer**: Combined backend metric implementation and frontend presentation fallback.
- **Minimum-risk fix**: Calculate the funnel in one organization-scoped query/service and remove all non-zero fallbacks; add empty, populated, and cross-organization tests.
- **Dependencies**: `RF-FE-005`, reporting contract, and workflow integrity checks.

#### [RF-DATA-003] Recruiter workload and interview no-show reporting contain unsupported values

- **Severity**: `P1`
- **Affected workflow**: Reports at `/reports`, especially SLA posture and interview no-show KPI.
- **Current evidence**:
  - `apps/api/src/reports/reports.service.ts:41-44` counts interview status `No-show`, but `database/prisma/schema.prisma:420-441` stores an unconstrained string and `apps/api/src/interviews/interviews.dto.ts:66-68` permits only `Scheduled`, `Completed`, `Cancelled`, or `Rescheduled`; no current mutation path records `No-show` for an interview.
  - `apps/api/src/reports/reports.service.ts:135-148` returns `overdueTasks: 0` for every active user while the UI labels the column “Overdue Tasks” and “task SLA posture.”
  - `:115-132` labels position titles as “department” although the persisted model has no department field.
- **Reproduction**: Open Reports with active recruiters/tasks or attempt to record an interview no-show through the current API.
- **Expected**: Every displayed KPI has a persisted source and documented status/semantic definition, or is explicitly unavailable.
- **Actual risk**: Overdue work is always reported as zero and no-show rate cannot be populated through the supported interview workflow; “department” aggregates are actually position aggregates.
- **Root-cause layer**: Backend reporting/status contract.
- **Minimum-risk fix**: Query tasks for overdue counts, either add a supported no-show workflow or remove/redefine the KPI, and rename or source the department dimension from authoritative master data.
- **Dependencies**: Report contracts and workflow status catalogue.

#### [RF-DATA-004] Tenant-owned relationship foreign keys do not enforce same-organization ownership at the database layer

- **Severity**: `P2`
- **Affected workflow**: Cross-organization integrity for applications, offers, hiring cases, interviews, documents, and master-data links.
- **Current evidence**: `database/prisma/schema.prisma:184-195,236-247,333-361,420-451,479-495,559-580` stores `organizationId` alongside independent single-column foreign keys. For example, `Application.organizationId`, `vacancyId`, and `candidateId` are separate constraints; `HiringCase` independently references `applicationId` and `offerId`; `Offer.currentVersionId` at `:486` has no Prisma relation or foreign key.
- **Reproduction**: In an authorized integrity fixture, insert a child row with organization A and a related parent ID from organization B using a direct database write or an unreviewed service path, then run the current integrity script.
- **Expected**: Database constraints or a complete, tested repository boundary prevent cross-tenant relationships and invalid current-version pointers.
- **Actual risk**: Application services currently perform several ownership checks, but the schema cannot prevent future code, scripts, or direct writes from creating cross-organization links; current-version referential integrity is not enforced at all.
- **Root-cause layer**: Database integrity design and application boundary.
- **Minimum-risk fix**: First close and test all service/repository ownership checks; only then evaluate forward-only composite-FK or trigger changes with a data backfill. Add a real FK/relation for `currentVersionId` if Prisma migration semantics and existing data permit it.
- **Dependencies**: Integrity audit completeness and migration provenance; do not edit applied migrations.

#### [RF-AUDIT-001] Integrity audit tooling reports PASS and success even when violations exist

- **Severity**: `P1`
- **Affected workflow**: Database integrity/release gate evidence.
- **Current evidence**: `database/scripts/audit-db-integrity.cjs:114-124` labels every measured result `[PASS]` regardless of the count and prints “completed successfully with 0 violations”; `:125-129` catches errors without setting a failing exit code. The script also does not inspect joining/orphan documents/interviews, offer current-version pointers, hiring-case offer/application identity, or audit coverage.
- **Reproduction**: Run the script against a fixture containing one cross-organization application or headcount violation and inspect stdout/exit status.
- **Expected**: Non-zero findings produce explicit failure evidence and a non-zero exit code; the checked relation set matches the release gate.
- **Actual risk**: CI or release documentation can record a green integrity check while reporting violations or while leaving important relationship classes unchecked.
- **Root-cause layer**: Verification tooling / release evidence.
- **Minimum-risk fix**: Make findings fail the command, distinguish PASS/FAIL, cover the complete relation matrix, and add a fixture test with an intentional violation. Keep the audit read-only.
- **Dependencies**: `RF-DATA-004`, migration provenance, and final release gate.

#### [RF-AUDIT-002] Sensitive mutation auditing is asynchronous and generic rather than tied to the committed entity mutation

- **Severity**: `P1`
- **Affected workflow**: Audit history for hiring, compliance, vacancy, offer, and joining mutations.
- **Current evidence**:
  - `apps/api/src/common/interceptors/audit.interceptor.ts:20-48` starts `auditLog.create()` inside `tap` and fire-and-forgets failures with `catch(console.error)`, while recording `entityType: 'system'` and `entityId: 'none'`.
  - `apps/api/src/hiring/hiring.service.ts:87-94,200-207` calls `this.auditService.log(...)` without awaiting it on two mutation paths.
- **Reproduction**: Exercise a decorated mutation while making the audit insert fail or complete after the HTTP response; compare the mutation response and audit row/entity identity.
- **Expected**: Sensitive mutation and audit evidence have a documented atomicity policy, stable entity identity, and observable failure handling.
- **Actual risk**: Successful business changes can lack audit rows, and existing rows cannot identify the affected record; release audit-history checks can pass only by luck.
- **Root-cause layer**: Backend audit transaction/observability.
- **Minimum-risk fix**: Define which audit events are transactional, await required writes or use an outbox, and pass actual entity IDs/before-after data where required. Add failure-injection tests.
- **Dependencies**: Database transaction boundaries and release audit evidence.

#### [RF-API-003] Talent-pool response fields are shadowed by page-local interfaces

- **Severity**: `P1`
- **Affected workflow**: Talent pool health and recently added candidate review at `/talent-pool`.
- **Current evidence**:
  - `apps/api/src/talent-pool/talent-pool.service.ts:68-79,82-128` returns `candidateName`, `poolName`, `addedAt`, and `activeConsentPercent`/`profileFreshPercent`/`recentContactPercent`.
  - `apps/web/src/pages/TalentPoolPage.tsx:12-14,156-166,188-190` defines and reads `name`, `pool`, `lastUpdated`, `activeConsent`, `profileFresh`, and `recentContact` instead of the shared contract fields.
- **Reproduction**: Seed one talent-pool candidate and open `/talent-pool`; inspect the network JSON and the candidate/health widgets.
- **Expected**: The page consumes `@recruitflow/contracts` and renders the returned names, pool, timestamps, and percentages; an empty tenant displays zero health metrics.
- **Actual risk**: Candidate cells render undefined fields and health values fall back to fictitious 92/84/76 percentages even when the API correctly returns zero.
- **Root-cause layer**: Frontend/backend contract duplication.
- **Minimum-risk fix**: Replace page-local interfaces with shared types, map fields explicitly where presentation naming differs, and remove non-zero fallbacks. Add a populated and empty response fixture test.
- **Dependencies**: `RF-FE-005` and shared contract ownership.

#### [RF-FE-011] Additional live pages retain unsupported business metrics and fallback facts

- **Severity**: `P1`
- **Affected workflows**: Vacancy list, application detail, offer detail, offer approvals, and final approval reporting.
- **Current evidence**: Current source contains hardcoded or fallback facts at `apps/web/src/pages/VacantListPage.tsx:81-85`, `ApplicationDetailPage.tsx:227`, `OfferDetailPage.tsx:240-242`, `OfferApprovalInboxPage.tsx:80-82`, and `FinalApprovalInboxPage.tsx:84-85`.
- **Expected**: Metrics and compensation facts come from persisted API fields, or are labelled unavailable when the endpoint does not provide them.
- **Actual risk**: Empty/partial records display non-zero vacancy, package, score, approval, and SLA facts that are not supported by current contracts.
- **Root-cause layer**: Frontend presentation/data-state handling.
- **Minimum-risk fix**: Delete demo values, add explicit nullable fields to the contract only when backed by a source of truth, and show `Not reported`/empty states otherwise.
- **Dependencies**: Report and offer contract matrix; overlaps with `RF-FE-005`, `RF-FE-009`, and `RF-DATA-002`.

#### [RF-UX-003] Production UI still uses Unicode/mis-encoded symbols instead of the existing icon component

- **Severity**: `P2`
- **Affected workflow**: Navigation, drawers, approval inboxes, and metric cards across the authenticated shell.
- **Current evidence**: `apps/web/src/layout/AppShell.tsx:195,203,205,242,244,280` contains mis-encoded/Unicode symbols; `FinalApprovalInboxPage.tsx:82-85` and `OfferApprovalInboxPage.tsx:79-82` pass Unicode characters as metric icons; `apps/web/src/components/ui/Drawer.tsx:54-56` renders a mis-encoded close glyph.
- **Expected**: Production icons use Lucide or the existing SVG `Icon` component with stable accessible labels, and source files are UTF-8 clean.
- **Actual risk**: Symbols render inconsistently, violate the stated production icon constraint, and can become unreadable in assistive or fallback fonts.
- **Root-cause layer**: Shared UI implementation/encoding.
- **Minimum-risk fix**: Replace symbols with named icons and correct source encoding; add a static check for unsupported icon literals.
- **Dependencies**: Shared component standardization and UI regression screenshots.

#### [RF-AUTH-003] Organization creation is exposed as ordinary tenant master-data management

- **Severity**: `P1`
- **Affected workflow**: Organization provisioning and tenant boundary administration.
- **Current evidence**: `apps/api/src/master-data/organizations.controller.ts:17-27` protects `POST /organizations` only with `MASTER_DATA_MANAGE` and does not pass the authenticated user or organization context; `apps/api/src/master-data/master-data.service.ts:66-73` creates a new organization directly from the request body. `database/prisma/seed.cjs:260-285` assigns `MASTER_DATA_MANAGE` to `HR_MANAGER` and `HIRING_MANAGER`.
- **Reproduction**: Authenticate as a seeded HR manager or hiring manager and submit a valid organization payload to `POST /api/v1/organizations`.
- **Expected**: Tenant provisioning is restricted to an explicit platform authority or the endpoint is removed from organization-scoped users; all created records have an auditable actor and provisioning policy.
- **Actual risk**: A normal tenant master-data role can create a separate organization outside its current tenant context, with no actor/tenant ownership recorded by the service.
- **Root-cause layer**: Authorization and tenant administration boundary.
- **Minimum-risk fix**: Separate platform provisioning from tenant master data, require an explicit administrator/platform permission, and audit the actor and resulting organization. Add role-matrix and cross-tenant tests.
- **Dependencies**: Permission catalogue, organization lifecycle policy, and audit integrity.

#### [RF-BE-005] GET integrations performs a database write and can race while seeding defaults

- **Severity**: `P2`
- **Affected workflow**: Opening `/integrations` for an organization with no integration rows.
- **Current evidence**: `apps/api/src/integrations/integrations.service.ts:24-46` creates eight default rows from `listIntegrations()` when the read query is empty; this write is not wrapped in an idempotent uniqueness transaction.
- **Reproduction**: Open the integrations page concurrently in two sessions for a fresh organization and inspect database rows and the GET request behavior.
- **Expected**: GET is read-only, or default catalog provisioning is an explicit idempotent setup operation with uniqueness guarantees.
- **Actual risk**: A read can mutate tenant state and concurrent requests can duplicate defaults or make first-load latency/error handling nondeterministic.
- **Root-cause layer**: Backend endpoint semantics/data initialization.
- **Minimum-risk fix**: Move provisioning to seed/setup or an explicit command and add uniqueness/transaction coverage if defaults remain runtime-created.
- **Dependencies**: Integration contract and release data-integrity checks.

## 5. Current endpoint contract matrix (2026-08-17)

The following is the current controller-to-consumer correlation. `Org scoped` means the controller/service derives organization ownership from the authenticated context; it does not mean the database has composite same-organization foreign keys.

| Domain | Endpoint family | Permission / scope evidence | Frontend consumer | Contract status |
|---|---|---|---|---|
| Authentication | `/auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/me` | Session cookie; `JwtStrategy` resolves the active user and organization | `AuthContext`, `api/client.ts` | **Aligned in direct login probe**; host/origin must remain consistent |
| Users and roles | `/users`, `/users/:id`, `/users/interviewers` | `USERS_VIEW` for general users; `INTERVIEW_VIEW` for interviewer lookup; org-scoped service | `InterviewsPage`, `UsersRolesPage` | **Mismatch**: interviewer permission is absent from seeded roles; related failures are swallowed (`RF-AUTH-002`, `RF-FE-007`) |
| Organizations and master data | `/organizations`, `/branches`, `/positions`, `/legal-entities` | Master-data permissions; organization POST has no platform-provisioning boundary | `MasterDataPage`, vacancy request context | **Risk**: organization creation is exposed to tenant master-data roles (`RF-AUTH-003`) |
| Vacancy requests | `/vacancy-requests`, `/vacancy-requests/context`, `/vacancy-requests/inbox`, `/:id/approve`, `/:id/convert` | Create/view/approve/convert permission families; current controller passes authenticated organization context | Dashboard, request pages, `ApprovalInboxPage` | Context is currently tenant-scoped; approval inbox has no route gate and partial-error coverage |
| Vacancies | `/vacancies`, `/vacancies/:id`, status/assignment mutations | `VACANCY_VIEW` and `VACANCY_MANAGE`; service queries are org-scoped | `VacantListPage`, `VacancyOverviewPage` | **Mismatch**: detail funnel returns literal zeroes and UI replaces zeroes with demo counts (`RF-DATA-002`) |
| Candidates and documents | `/candidates`, `/candidates/:id`, `/documents/candidate/:id`, `/documents` | Candidate view/create/edit permissions; metadata-only document service; org checks present | Candidates, detail, documents, application form | Core metadata boundary is aligned; operational routes are not consistently wrapped by `PermissionGate` |
| Applications and screening | `/applications`, `/applications/:id`, `/applications/:id/history`, `/screening/*` | Application view/create/move-stage permissions; paginated list is `{ data, total, page, pageSize }` | Applications, application detail, interviews, offer creation | **Partial**: local page interfaces and unsupported score/fallback values remain; stage transition is bypassed by offer acceptance (`RF-WF-001`) |
| Interviews and scorecards | `/interviews`, `/interviews/:id`, `/interviews/:id/scorecard` | Read uses vacancy view; mutations use application move-stage; organization checks present | Interviews, calendar, interview detail | **Mismatch**: interviewer lookup 403s for seeded roles; time/attendee validation is incomplete (`RF-AUTH-002`, `RF-BE-004`) |
| Offers and approvals | `/offers`, `/offers/:id`, `/offers/:id/revisions`, `/offers/approvals/inbox`, `/offers/approvals/:id/decide` | Application view/move-stage and `APPROVE_OFFERS`; org-scoped service | Offers, create/detail, universal and dedicated approval inboxes | **Mismatch**: flat vs nested approval response, `Approve | Reject` vs `Approved | Rejected`, and missing offer ID (`RF-API-001`); revision preconditions missing (`RF-WF-002`) |
| Hiring, compliance, joining | `/hiring`, `/hiring/:id`, compliance, final approvals, joining | Candidate edit/application view/final approval; transactions enforce several parent and headcount checks | Hire, case, licenses, joining pages | **Mismatch**: list omits `complianceRequirements` used by licenses (`RF-API-002`); audit calls are not awaited (`RF-AUDIT-002`) |
| Talent pools and CV imports | `/talent-pools*`, `/candidates/import/*` | Candidate view/create/edit; org-scoped service methods | Talent pool, CV intake, import preview | **Mismatch**: talent-pool field names differ between API and page-local interface (`RF-API-003`); import state coverage is incomplete |
| Tasks and notifications | `/tasks*`, `/notifications*`, unread count | Task view/update and notification view; recipient/org scoped | Tasks, Notifications, `AppShell` | **Partial**: list contracts are compatible, but shell unread badge starts at `8` and failures are suppressed (`RF-FE-008`); task cards retain fallback values |
| Reports | `/reports/kpis`, `/reports/funnel`, `/reports/hiring-by-department`, `/reports/recruiter-workload` | `APPLICATION_VIEW`; org-scoped reads | Dashboard, Reports | **Mismatch**: overdue tasks are literal zero and `No-show` has no supported mutation path (`RF-DATA-003`) |
| Pipeline settings | `/pipeline-templates*` | Master-data view/manage and workflow override | `PipelineSettingsPage` | Route is gated; no current wire mismatch found in static pass |
| Integrations | `/integrations`, `/:id/test` | Master-data view/manage; page route uses role-only `ADMINISTRATOR` gate | `IntegrationsPage` | **Risk**: GET creates defaults instead of being read-only (`RF-BE-005`); UI gate is less precise than API permission |
| Audit logs | `/audit-logs` | `AUDIT_VIEW`; query is org-scoped | `AuditLogPage`, interceptor/service | **Mismatch**: generic asynchronous audit writes and false-green integrity tooling (`RF-AUDIT-001`, `RF-AUDIT-002`) |

## 6. Current route-by-route status matrix (2026-08-17)

State legend: `L` loading, `E` empty, `X` error/retry, `F` forbidden, `N` not-found, `S` successful data. `Desktop render` refers to the corrected local browser probe at 1440px using the local API; mobile and full keyboard coverage remain release-gate work unless explicitly noted.

| Route | Data source | UI state coverage found | Responsive / accessibility evidence | Runtime result | Severity / minimum-risk fix |
|---|---|---|---|---|---|
| `/login` | Auth endpoints | Validation, loading, auth error, S | Login keyboard order and reduced-motion checks pass | PASS | No current blocker |
| `/` | Context, requests, vacancies, reports, tasks | No standard PageState; S is substituted by demo arrays | Desktop overflow check passed; mobile full route check pending | PASS | P1 `RF-FE-010`: remove demo records and model partial failures |
| `/tasks` | `/tasks` | L, E, X; metric fallbacks remain | Static responsive controls; full mobile/keyboard route check pending | Renders as `Task Inbox & Actions`; test expected stale title | P1 `RF-FE-005`: remove `|| 4` values |
| `/notifications` | `/notifications` | L, E; shell count has no truthful failure state | Header access pattern renders; overlay focus audit pending | PASS | P2 `RF-FE-008`, `RF-UX-002`: remove hardcoded count and complete dialog focus |
| `/vacancy-requests` | `/vacancy-requests` | L, E; no route-level forbidden surface | Static table/filter layout; full responsive check pending | Not in corrected sweep | P1 route-gate/state follow-up |
| `/vacancy-requests/create` | `/vacancy-requests/context`, POST request | L only at page level; no complete X/F/N state | Form semantics require dedicated keyboard/validation run | Not in corrected sweep | P1 route-gate/state follow-up |
| `/vacancy-requests/:id` | Request detail/decision | L plus inline error; no explicit N/F state | Dedicated form/dialog check pending | Not in corrected sweep | P1 route-gate/state follow-up |
| `/approval-inbox` | Three approval inbox endpoints | L, E; no distinct dependency error/F state | Desktop render; mutation journey not run | PASS | P1 `RF-API-001`: share approval contract and expose retry |
| `/vacancies` | `/vacancies` | L, E; non-zero metric fallbacks | Static table overflow class; mobile route check pending | Not in corrected sweep | P1 `RF-FE-005`, `RF-FE-011`: remove unsupported metrics |
| `/vacancies/:id` | Vacancy detail/reports | L plus inline error; no explicit E/N state | Dedicated funnel responsive check pending | Not in corrected sweep | P1 `RF-DATA-002`: implement persisted funnel and preserve zero |
| `/candidates` | `/candidates` | L, E | Desktop render; table keyboard/mobile check pending | PASS | P1 route gate and error-state follow-up |
| `/candidates/:id` | Candidate, applications, documents, vacancies | L, E, F, N | Detail/table audit pending | Not in corrected sweep | P1 route gate/state follow-up |
| `/candidates/:id/documents` | Candidate and metadata documents | L, E, X | Metadata-only boundary is respected; responsive table check pending | Not in corrected sweep | P1 route gate and upload-error follow-up |
| `/talent-pool` | Pools, recently added, health | L, E, X; health has non-zero fallbacks | Static table layout; mobile/accessibility check pending | Not in corrected sweep | P1 `RF-API-003`, `RF-FE-005`: consume shared fields and truthful zeros |
| `/cv-intake` | Import jobs and upload | L; incomplete standard E/X coverage | File/form keyboard and validation check pending | Not in corrected sweep | P1 route/state follow-up |
| `/cv-intake/:jobId` | Import summary, rows, error report | L, E; mutation errors are page-specific | Table internal scrolling should be verified | Not in corrected sweep | P1 route/state follow-up |
| `/applications` | Paginated applications | L, E; no distinct X/F state | Desktop render; board/table responsive check pending | PASS | P1 contract/error-state follow-up |
| `/applications/:id` | Application, history, screening | L, E, F, N; unsupported score remains | Detail keyboard/responsive check pending | Not in corrected sweep | P1 `RF-FE-011`: remove hardcoded score |
| `/interviews` | Interviews, applications, interviewer users | L, E; related failures become empty arrays | Form/modal focus check pending | PASS with repeated 403s | P1 `RF-AUTH-002`, `RF-FE-007`: fix permission and surface dependency errors |
| `/interviews/calendar` | `/interviews` | L, E | Calendar internal scrolling is implemented; corrected mobile probe still pending | PASS desktop | P2 responsive/accessibility verification |
| `/interviews/:id` | Interview and scorecard | L, F, N; no complete E state | Scorecard keyboard check pending | Not in corrected sweep | P1/P2 state and attendee metric follow-up |
| `/offers` | `/offers` | L, E | Desktop render; table/mobile check pending | PASS | P1 route gate/state follow-up |
| `/offers/create` | Applications, POST offer/revision | No standard PageState; application failure is swallowed | Form/validation/focus run pending | Not in corrected sweep | P1 `RF-FE-009`: remove prototype values and DTO mismatch |
| `/offers/approvals/inbox` | Offer approval inbox | L, E | Desktop render; decision mutation not run | PASS | P1 `RF-API-001`, `RF-FE-011`: correct wire shape and unsupported SLA facts |
| `/offers/:id` | Offer and hiring cases | L, E, F, N; compensation fallbacks | Detail responsive check pending | Not in corrected sweep | P1 `RF-FE-011`: remove fabricated package/approval values |
| `/hires` | `/hiring` | L, E | Desktop render; table/mobile check pending | PASS | P1 `RF-API-002`: define list compliance contract |
| `/hires/:id` | Hiring case/compliance/joining | L, E, F, N | Dialog/form/keyboard check pending | Not in corrected sweep | P1 workflow/audit follow-up |
| `/hires/approvals/inbox` | Final hiring approvals | L, E | Desktop render; decision mutation not run | PASS | P1 workflow/audit follow-up |
| `/licenses` | `/hiring` list (missing requirements) | L, E, X; empty PageState is invalid table child | Static table overflow; console hydration errors observed | P1 `RF-API-002`; P2 `RF-UX-004`: use a valid table empty row and correct endpoint |
| `/joinings` | `/hiring` list | L, E | Desktop render; table/mobile check pending | PASS | P1 headcount/workflow regression coverage pending |
| `/reports` | Four report endpoints | L, E; unsupported KPI values from API | Desktop render; chart/table accessibility pending | PASS | P1 `RF-DATA-003`: source overdue/no-show/department values |
| `/users` | `/users` | L, E; route-level F via `PermissionGate` | Admin desktop and recruiter forbidden probe pass | PASS | No current route-gate blocker; expand role matrix |
| `/master-data` | Branches, positions, legal entities | L, E | Admin desktop render; test title was stale | PASS as `Master Data & Catalogs` | Review role/provisioning boundary (`RF-AUTH-003`) |
| `/audit-log` | `/audit-logs` | L, E | Desktop render; filter/pagination controls present | PASS | P1 `RF-AUDIT-001/002`: make evidence fail closed and entity-specific |
| `/pipeline-settings` | Pipeline templates | L, E | Desktop render; form/table audit pending | PASS | Route is gated; no current static wire blocker |
| `/integrations` | `/integrations` | L, E; test errors page-specific | Desktop render; role-gate precision pending | PASS | P2 `RF-BE-005`: make GET read-only/idempotent |
| unknown / 404 | No data source | Dedicated 404 component; no shared PageState | Responsive/keyboard check pending | Not in corrected sweep | P2/P3: include in route regression matrix |

### [RF-UX-004] License empty state is invalid table markup and emits React hydration warnings

- **Severity**: `P2`
- **Affected workflow**: Empty or filtered compliance list at `/licenses`.
- **Current evidence**: `apps/web/src/pages/LicenseManagementPage.tsx:135-195` renders `PageState` directly inside `DataTable`; `DataTable` renders a `<div>` containing a `<table>`, so the `PageState` `<div>` becomes a child of `<table>` after `<tbody>`. The corrected browser route probe recorded repeated `In HTML, <div> cannot be a child of <table>` and nested-table warnings on `/licenses`.
- **Reproduction**: Sign in locally, open `/licenses` with no returned compliance rows, and inspect the browser console.
- **Expected**: Empty content is represented by a `<tr><td colSpan=...>` row or rendered outside the table wrapper; the console remains clean.
- **Actual risk**: Invalid DOM correction can move or discard content differently across browsers and produces hydration/runtime warnings.
- **Root-cause layer**: Frontend shared table/state composition.
- **Minimum-risk fix**: Add a table-safe empty-row variant to `DataTable` or render `PageState` outside the table; add a console-clean empty-state browser assertion.
- **Dependencies**: `RF-API-002` because the current missing relation makes the empty state common.

## 7. Runtime and verification evidence

- Corrected local browser probe: authenticated admin login succeeded when the browser used `localhost` with a resolver rule mapping it to the RecruitFlow IPv4 listener. All 18 checked route navigations rendered; 16 matched the existing test headings, while `/tasks` and `/master-data` rendered under their current headings (`Task Inbox & Actions` and `Master Data & Catalogs`). Those two are stale test-heading expectations, not blank-page failures.
- Runtime defect evidence: `/interviews` generated repeated `403 GET /api/v1/users/interviewers` responses; `/licenses` generated React invalid-table warnings. No non-auth 4xx/5xx responses were recorded in the successful route sweep besides the known interviewer 403s.
- Full existing browser suite: inconclusive in this environment. The first run used `127.0.0.1` for the web app while the built client used `localhost` for the API, so authentication cookies were not retained. The corrected `localhost` run hit the suite timeout because `localhost:5174` resolved to an unrelated IPv6 PMS listener. This is recorded as test-environment evidence, not a product pass/fail.
- Direct verification passed using local binaries: web TypeScript build, Vite production build, API local TypeScript check, Nest build, ESLint, Prisma validation, and migration status.
- Read-only database checks against the configured local database found zero current orphan/cross-organization/duplicate/headcount violations across the expanded relation set. This does not prove future writes are protected and does not make the false-green audit script acceptable.
- `git diff --check` is not clean because the pre-existing dirty worktree contains whitespace and line-ending issues, including planning files and existing frontend files. No normalization was performed.

## Enhancement implementation evidence — 2026-08-18

- `@dnd-kit/react` 0.5 exposes the required React 19-compatible `DragDropProvider`, `useDraggable`, and `useDroppable` APIs. Its operation event supplies source and target identifiers/data, allowing the pipeline to enforce API-provided target stages without exposing database implementation fields.
- The application wire contract now carries additive `allowedTransitions`; backend transition validation remains authoritative while the UI can suppress invalid targets and retain an explicit move selector for touch and keyboard use.
- The first pipeline implementation removes the misleading unconditional drop target and adds a dedicated drag handle, explicit stage selector, duplicate-submission locking, optimistic rollback, and live-region feedback. This remains provisional until focused build and browser checks pass.
- The focused web production build passes with the new DnD slice. The applications route is independently lazy-loaded; the DnD code therefore stays route-scoped. The pre-existing CV intake chunk remains the only build-size warning.
- The legacy pipeline stylesheet still used literal white/slate colors, an auto-fit board, and a 520px minimum column height. It must be converted to semantic surfaces and deliberate horizontal desktop navigation before dark-mode/browser validation.
- The pipeline shared styles now use semantic theme tokens, deliberate horizontal columns, compact vertical sizing, visible keyboard focus, 44px touch controls, and drag/mutation state styling. An inactive unsupported column-action button was removed.
- The route graph has no existing `/__design-system` preview and no shared `Tabs.tsx` primitive at the expected design-system location. The preview should document only implemented shared primitives and remain guarded by `import.meta.env.DEV`, rather than creating unsupported production UI.
- `PageState` and the alert icon container were shared dark-mode blockers because they retained page-local white, slate, blue, amber, and rose utilities. They now consume the RecruitFlow semantic surface, ink, border, and state roles; every route using these primitives inherits the correction.
- The enforced design-system source roots (`components/ui`, `layout`, `auth`, and `theme`) now contain no literal hex colors or palette-specific Tailwind utilities. This creates a practical zero-debt boundary for an automated token guard while legacy route CSS is migrated in controlled waves.
- `DataTable` still imposed a universal 860px minimum width and a literal white wrapper. This causes avoidable tablet scrolling and breaks dark surfaces; the wrapper and default table width should become semantic and responsive while existing consumers remain compatible.
- The production build confirms `/__design-system` is absent from the production chunk graph, while the design-token check passes across 32 enforced shared-system files. The shared table wrapper now uses semantic surfaces and a 680px tablet baseline; a typed `ResponsiveDataView<T>` supplies mobile cards, priority columns, row identity, navigation, and action slots for route-by-route migration.
- The reports UI still consumes four legacy endpoints, labels position data as departments, and uses light-only local colors. The additive `/reports/overview` API already returns persisted range, comparison, trend, funnel, hiring-by-position, and workload data, but needs tenant-scoped filter-option labels/identifiers so the UI can expose all approved filters without borrowing create-only master-data endpoints.
- Branch, position, and user records all have direct organization ownership and active status fields, so filter options can be returned safely from the report service with organization-scoped Prisma queries and no schema change. The generic API client supports `RequestInit` only through `fetchApi`, enabling report request cancellation and stale-response protection.
- Reports now consume one typed overview response with UTC date range, automatic previous-period comparison, branch/position/recruiter filters, trends, funnel, correctly named hiring-by-position, workload, accessible chart tables, and explicit unavailable aging states. Web and API production builds pass after the coordinated additive contract update.
- Legacy route pages still contain approximately 730 palette-specific Tailwind tokens. Rewriting all of them in one pass would create high dirty-worktree risk, so a one-release Dark compatibility bridge is required at the page boundary while route families migrate to semantic utilities. Shared primitives remain zero-debt and new shared literals remain blocked automatically.
- The candidate directory rendered a non-table `PageState` inside `<table>`, reported active counts as if they were global although they were page-local, displayed a static “CV Intake Ready” metric, and retained a search/page race. It now uses `ResponsiveDataView` mobile cards/priority columns, table-safe empty placement, truthful page-scoped metrics, and an explicit page-1 search request.
- The former regex-only status mapper classified `Inactive` as success because it matched “active,” treated task priority as neutral, and embedded palette-specific dot colors. The canonical mapper now handles known workflow/status/priority values explicitly, falls back conservatively, and uses semantic state tokens across every current StatusBadge consumer.
- The web workspace had no component-test runner or DOM testing dependencies despite the release plan requiring theme, dialog, responsive-data, status, and motion-state regression coverage. A focused Vitest/jsdom/Testing Library harness is warranted and remains isolated to development dependencies.
- Focused component verification now passes: 5 files and 8 tests cover theme persistence/cross-tab sync, modal focus restoration/Escape, status mapping/text labels, responsive data markup/actions, and atmosphere visibility pausing. The web production build and 36-file token guard also pass.
- Navigation hides many domains by permission, but most matching route elements in `App.tsx` remain ungated, so direct URLs disclose route shells and trigger avoidable forbidden requests. `PermissionGate` currently supports only one permission or role; an additive “any permission” option is needed for combined approval queues while domain routes should mirror their API read permission.
- Protected domain routes now mirror controller read permissions, including tasks and notifications, and combined approval access supports any relevant approval permission. Integrations now follows its API view permission instead of an inconsistent administrator-only UI role gate; reports navigation now matches its `APPLICATION_VIEW` controller requirement.
- Candidate create/import actions now require `CANDIDATE_CREATE` in-page as well as at direct routes. The candidate modal also registers unsaved-change protection and confirms destructive dismissal while allowing completed submissions to close cleanly.
- The universal approval inbox previously requested all three protected endpoints for every approver, silently tolerated partial permission failures, exposed tabs/zero metrics the user could not access, and fabricated offer fallback labels. It now calls and renders only authorized queues and surfaces any permitted-endpoint failure normally.
- Header notifications no longer swallow unread-count failures or advertise a successful zero when count state is unknown. The header control is permission-aware, exposes an unavailable label/error state, moves focus into the popover, returns focus on Escape, and removes unsafe event/error assertions.
- The initial atmosphere used hard-coded per-theme RGBA values and a shared 18×12px/scale animation for every variant, exceeding the approved operational-workspace drift. Accent colors now live in semantic tokens; auth/dashboard/workspace use 18×12, 12×8, and 8×5px translation-only motion respectively, with the existing reduced-motion and visibility pause behavior.
- Canonical execution, AI playbook, release-readiness, and visual-system documents now consistently state the approved two-mode contract. Historical light-only instructions in those active documents were explicitly superseded rather than left as contradictory implementation rules.
- The existing critical browser suite contains stale assertions for former report navigation/export copy and former pipeline card SLA text, and it does not exercise both themes across 375/768/1024/1440. Keep it as historical regression coverage, but add a focused dual-mode matrix rather than weakening the new truthful UI to satisfy obsolete text selectors.
- First dual-mode matrix: 229/264 checks passed. No document-overflow failures occurred. Repeated failures resolve to four roots: the absent seeded `INTERVIEW_VIEW` permission caused interviewer 403s; license empty content was still invalid table markup; responsive cards and pipeline articles nested controls inside interactive containers; and the running API process predated `/reports/overview`. Axe also identified contrast defects requiring exact-node follow-up.
- The API supports an isolated `API_PORT`, development CORS already accepts local ports, and Vite accepts an environment-specific API base. A fresh API/web pair can therefore validate current code without stopping or mutating the user's existing local listeners.
## 2026-08-18 — Fresh-code dual-mode browser matrix (iteration 2)

- Evidence: `tests/artifacts/dual-mode-v2/matrix-summary.json` records 264 route/theme/viewport checks, with 249 passing and 15 failing.
- Cleared from the first matrix: stale API route failures, interviewer permission failures, license table markup failures, responsive-card list semantics, and all horizontal document overflow.
- Remaining failures are accessibility-only and share four roots: insufficient muted-text contrast, disabled pipeline cards retaining draggable interactive semantics around focusable descendants, invalid direct descendants in one reports definition list, and a horizontally scrollable trend graphic without a keyboard-focusable region.
- No unexpected 4xx/5xx response, console-error, or document-overflow failures remain in this matrix.
- Axe evidence identifies the exact remaining shared contrast roots: light `text-slate-400` at 10–11px, semantic muted text on the light subtle surface at 4.39:1, dark muted text rendered over an inherited white shell surface, and the command shortcut key. Correcting these shared roles is lower-risk than per-route overrides.
- `useDraggable` applies its accessibility attributes to the element passed through `ref`, so attaching `ref` to the whole pipeline article makes even disabled cards interactive. The drag ref must move to the dedicated handle so the article remains a non-interactive group.
- The report summary uses wrapper elements inside a `dl`; Axe rejects an additional inline child emitted by one responsive render path. Replacing the summary `dl` with a neutral grouped container avoids false definition-list semantics, while the visual trend scroller requires `tabIndex=0` and a focus treatment.
- The dark desktop sidebar still inherited literal white backgrounds from `shell.css`; `polish.css` changed text tokens but did not override every shell surface. This produced the apparently impossible dark muted-text-on-white contrast failure. The shell needs semantic surface overrides, not a darker dark-theme muted token.
- Contrast calculation confirms `#5F6F83` reaches 4.74:1 on the light subtle surface and 5.14:1 on white, so it is the minimum-risk replacement for the current light muted token (`#64748B`, 4.39:1 on subtle). Dark muted text already measures 8.46:1 on the intended dark surface.
- Dashboard KPI labels still used route-local `text-slate-400`; candidate identifiers and report micro-labels use the semantic muted token over the subtle surface. These should converge on a stronger semantic secondary-text role instead of increasing font weight alone.
- Post-fix static verification is green: Vitest 5/5 files and 8/8 tests, Vite/TypeScript production build, and the automated semantic-token check across 36 shared-system files.
- Focused post-fix matrix: 12/16 representative theme/viewport checks pass. Pipeline nested-interactive, report definition-list/scroll-region, shell action contrast, and all prior semantic micro-label failures are cleared.
- Four focused failures remain: dashboard mobile cards still contain legacy slate/status classes, candidate pagination has a literal white container in dark mode, and the pipeline page header has a literal near-white background that defeats otherwise-correct dark text/action tokens.
- RF-DATA-UI-001 (P1, dashboard truthfulness): `DashboardPage.tsx` still defines and renders `defaultFunnelStages`, `defaultVacancies`, and `defaultRequests` when persisted collections are empty. This fabricates operational records and hides legitimate empty states, directly violating the implementation gate. Remove the defaults and render truthful empty/unavailable states.
- RF-DATA-UI-002 (P1, dashboard partial failures): dashboard loading uses `Promise.allSettled` but surfaces an error only when three core calls all reject. A single failed KPI, funnel, task, request, or vacancy request is silently converted into an apparently successful zero/empty section. Track failures per data surface and show explicit unavailable states without discarding successful sibling data.
- RF-FE-TRUTH-003 (P1, dashboard unsupported control): the Recruitment Funnel card contains an “All Roles / Engineering / Product & Design / Operations” select with no state or request binding. It advertises a filter that does nothing and includes categories not supplied by the API. Remove it until a real report filter contract backs it.
- Dashboard unavailable KPI values currently coerce missing report payloads to `0`/`0%`, and the vacancy-request modal substitutes “Senior Position”, “Head Office”, and “RecruitFlow Organization” when context fails. These are false success values; unavailable metrics must render an explicit dash/label, and creation must remain disabled until real context is loaded.
- RF-DATA-UI-001, RF-DATA-UI-002, and RF-FE-TRUTH-003 are implemented: no default operational records remain, failed sections render unavailable rather than zero, valid empty collections render empty states, and the non-functional role selector is removed. Static build/tests/token checks pass after the change.
- Accessibility-root remediation is confirmed by `tests/artifacts/dual-mode-focused-v2/matrix-summary.json`: 16/16 representative checks pass with no serious/critical Axe, overflow, runtime-console, failed-response, or theme failures.
- Tailwind semantic text utilities remain dynamic, but some semantic background utilities are being overridden by legacy page rules with higher cascade priority. Evidence: dark text tokens are active while `bg-rf-surface` computes near-white in Applications and the Candidates pagination ancestor computes white. The compatibility layer needs a final dark semantic-surface precedence rule while route-local CSS is retired.
- Exact cascade root: `PageEnhancementsV2.css:48-50` and `:68-69` force `.rf-panel`/`.rf-table-shell` to white with `!important`, while `:74-78` forces light filter gradients. This imported page polish stylesheet defeats both semantic Tailwind utilities and the dark compatibility bridge. Converting those declarations to semantic variables fixes every importing route at once.
- Prisma is owned by the `database` workspace, not `apps/api`; the canonical root commands are `pnpm db:validate` and `pnpm db:migrate:status`. The failed API-directory invocation was the wrong workspace and referenced a stale pnpm virtual-store suffix, while the installed Prisma package is present under the database dependency graph.
- Database verification evidence: `pnpm db:validate` reports the schema valid; `pnpm db:migrate:status` finds 6 migrations and reports the PostgreSQL schema up to date. No schema or applied migration was changed.
- Working-tree safety evidence: the repository remains heavily dirty across application code, generated reference pages/screens, database scripts, and documentation. Verification did not reset or delete unrelated user changes; the initial diff check surfaced only whitespace hygiene, which was corrected without changing behavior.
- Final diff hygiene is now clean (`git diff --check` exit 0) after removing the specific trailing whitespace previously reported; the broader dirty working tree remains preserved.
- Final route evidence: `tests/artifacts/dual-mode-final/matrix-summary.json` records 264 checks, 264 passed, 0 failed. No tested route has horizontal document overflow, unexpected console errors, unexpected HTTP failures, theme mismatches, or serious/critical Axe violations on the representative scan set.
- Production Lighthouse 13.4.1 on `/login` meets the requested gate: performance 91 and accessibility 100 (`FCP 2.8s`, `LCP 2.8s`, `TBT 0ms`, `CLS 0`). The earlier development-server score of 53 is intentionally excluded from release scoring.
- Installed test discovery found no API `.spec`/`.test` files. API build/typecheck and live browser contracts are verified, but dedicated unit/integration regression tests for the new search and report service contracts remain missing evidence.
- Final static anti-fallback scan found one remaining silent integration path in `InterviewsPage.tsx`: application failures become `{data: []}` and interviewer failures cascade to `/users` and then `[]`, while the schedule action remains visible. This must fail truthfully because applications and authorized interviewers are required scheduling dependencies.
- The same scan found invented field fallbacks (`Senior Position`, `Head Office`, and organization labels) across vacancy creation, application/candidate/interview/offer detail surfaces. Nullable contract fields should display “not reported” or block context-dependent creation; they must not become plausible business facts.
- `CreateVacancyRequestPage` header actions use unsafe casts from button click events to form submit events. Native form association and named submit buttons can preserve draft/submit intent without assertions.
- RF-DATA-CONFIG-004 (P1, runtime truthfulness): `VacancyCoreModule` defaults `VACANCY_CORE_ADAPTER` to `in-memory`, and `.env.example`/setup docs endorse it as the normal UI default. A missing environment variable can therefore serve fabricated request/vacancy/context records instead of failing against PostgreSQL. Preserve the adapter for explicit isolated tests, but make Prisma the default and document in-memory as non-release only.
- RF-DATA-CONFIG-004 is resolved: Prisma is now the code/config/documentation default; the in-memory adapter remains available only by explicit test configuration. The anti-fallback scan is clean in the targeted production UI/API surfaces except for the isolated in-memory repository implementation itself.
- The final anti-fallback implementation is browser-confirmed by `tests/artifacts/dual-mode-final-targeted/matrix-summary.json`: 48/48 affected route/theme/viewport checks pass with no runtime, response, theme, or overflow regressions.
- Design-system migration debt remains measurable: 1,108 legacy palette utility occurrences across 37 production source files. Shared-system boundaries are fully semantic and dark compatibility is runtime-verified, but a truthful 9.6/10 design-system score requires continued route-level migration. The automated check should cap this baseline so debt cannot grow during the one-release compatibility window.
- The design-token check now enforces both boundaries: zero literals/palette utilities in 36 shared-system files and a non-increasing 1,108 occurrence production legacy budget. It passes after final implementation.
- Visual QA of final screenshots found RF-FE-RESP-005 (P1): `ResponsiveDataView` renders mobile record cards and the desktop table simultaneously at 1440px, duplicating content and making Reports/Candidates excessively tall. The component relies on Tailwind `md:hidden`, but the generated production CSS did not contain the expected escaped selector in the initial bundle check. Use component-owned semantic display classes with explicit media queries so responsive visibility cannot be defeated by utility generation/order.
- RF-FE-RESP-005 is implemented in the shared component and passes static/component checks; refreshed desktop/mobile screenshots remain required before closing the finding.
- RF-FE-RESP-005 is closed. `tests/artifacts/responsive-data-final/` provides refreshed light/dark desktop/mobile screenshots; duplicate card/table content is gone, and the 8/8 runtime matrix has no overflow or accessibility regression.

---

## RecruitFlow V2 Frontend Integration — 2026-08-19

### Initial scope

- Current app: repository root (`apps/web`, `apps/api`, shared packages, database workspace).
- Comparison source: `recruitflow_v2` under the same workspace.
- No source or application files have been changed for this request yet.
- Existing dirty-worktree changes are user-owned and must be preserved.

### Audit notes

- Pending: route/page inventory for both workspaces.
- Pending: shared component and token comparison.
- Pending: source-only feature list and contract compatibility assessment.

### Workspace inventory checkpoint

- The current product is a Vite/React/TypeScript app in `apps/web`, backed by the existing API and shared packages.
- The comparison source is a static HTML/CSS/JS design reference, not a second React app: `recruitflow_v2/index.html`, `css/{tokens,theme,components,app}.css`, and `js/{data,app}.js`.
- The source includes a design-system document, migration/theme notes, QA/validation reports, SVG light/dark backgrounds, and dashboard/candidate/approval screenshots.
- The current app already has a more capable semantic token system, theme context, responsive primitives, command palette, quick-create menu, and route-level data integrations; integration should be selective and source-informed rather than a wholesale replacement.

### Source design and feature intent

- Source design direction: action-first enterprise recruitment operations UI, Inter-based typography, restrained borders/shadows, blue/green/orange/red/purple semantic states, 244px desktop sidebar, 66px top bar, and responsive thresholds around 1180/860/520px.
- Source page-family guidance: insight-led dashboard, dense directories, decision-focused approvals, identity/status detail heroes, horizontal application Kanban, wizard forms, and chart-led reports.
- Source-specific visual assets: light/dark wave/hex/skyline SVG application backgrounds and a static login-first entry treatment.
- Source prototype-only behavior: 51 preview states, static demo data, prototype mobile drawer/approval filters, password visibility control, and no API/auth/permission/router contracts.
- Migration boundary explicitly forbids changing API payloads, routes, authentication/session behavior, permission evaluation, approval logic, stage transitions, offer calculations, or SLA calculations.
- Current app already implements several source recommendations in real React components; likely gaps are visual alignment, density/page-family consistency, source atmosphere assets, and any source prototype affordances absent from production components—not wholesale feature replacement.

### Source screen coverage comparison

- Source maps 51 states to current routes, including six modal/overlay states and four vacancy sub-tabs.
- Current React routes cover the source's primary page families and add real detail pages, but source-specific overlay states are not all represented as explicit route/query-driven UI: Add Candidate, Apply Candidate, Schedule Interview, Create User, Create Role, and Create Master Data Record need verification against current page actions.
- Source's 244px/66px shell and 1180/860/520 breakpoints differ from the current shell's semantic layout and existing 1024px drawer decision; the source values are useful visual targets, not automatic replacements.
- Source uses source-local CSS/template strings and prototype demo values; only layout, tokens, interaction affordances, and asset direction are candidates for migration.

### Current-vs-source visual observations

- Source screenshots show a calm light-blue canvas, white/soft-glass surfaces, compact 244px navigation, high-contrast blue active states, restrained metric cards, and clear table-first workflows.
- Source dashboard prioritizes a five-card KPI row followed by funnel, tasks/SLA risk, hiring trend, and department mix; the current app has the same broad intent but needs a screenshot-level comparison after running the real React UI.
- Source candidates and approvals emphasize compact density, tabs, filter/search toolbars, visible pagination, and action columns; current pages have real data and components but still contain substantial page-local palette utilities and likely visual drift.
- Source login is a two-column, theme-aware experience with a secure sign-in card and password visibility action; current login implementation must be inspected visually and behaviorally before deciding whether to port the source copy/layout.

### Existing verification artifacts

- Current app screenshots already show an implemented semantic dual-theme shell, command-center dashboard, responsive data views, pipeline board, and login atmosphere.
- One older `dual-mode-final` candidates screenshot still shows the previously observed mobile-card/table duplication at desktop; the newer `responsive-data-final` artifact is the authoritative post-fix candidate/report evidence and should be used for comparison.
- The current login atmosphere already adopts the source's light geometric visual direction, while the current shell differs by using a more operations-focused command center and semantic workspace chrome.

### UI/UX design-system checkpoint

- Generated recommendations for an enterprise recruitment operations dashboard: high-contrast trust-blue actions, restrained density, visible focus states, semantic red/green alerts, and responsive checks at 375/768/1024/1440px.
- Existing RecruitFlow tokens already match the source's core blue/green/orange/red/purple semantic palette closely; implementation should reuse current semantic variables and add the source background art as a layered enhancement.

### Integration decision

- Implement the source's light/dark application background assets as production Vite public assets and layer them through the existing `AtmosphericBackground` so auth, dashboard, and workspace variants keep their current motion/accessibility behavior.
- Add source navigation coverage for Notifications, Interview Calendar, Users & Roles, Master Data, Workflow Settings, and Integrations using the current permission-gated routes.
- Add the source's Schedule Interview quick-create action using the real `APPLICATION_MOVE_STAGE` permission and an existing `InterviewsPage` modal, opened through a `?create=1` handoff.
- Add a source-inspired Help Center card that opens the existing command search, keeping the action truthful without inventing a support endpoint.
- Accept the source's legacy `rf-theme` localStorage key as a one-time migration fallback into the canonical `recruitflow.theme` key.
- Do not port static prototype data, source template strings, source route substitutions, or source demo counts.

### Implemented integration and evidence

- Added the source light/dark application background SVGs to `apps/web/public/assets` and layered them into the existing semantic atmospheric background.
- Added permission-aware navigation for Notifications, Interview Calendar, Users & Roles, Master Data, Workflow Settings, and Integrations.
- Added a truthful Schedule Interview quick-create action that opens the existing interview scheduling modal after the real application/interviewer data loads.
- Added a compact help card that opens the existing command search, plus legacy `rf-theme` preference migration into the canonical theme key.
- No API, database, authentication, permission definitions, or shared payload contracts were changed for this integration.
- Verification passed for TypeScript compilation, focused Vitest coverage (2 files / 4 tests), Vite production build, ESLint, the design-token guard, and `git diff --check`. The build retains the pre-existing `CVIntakePage` chunk-size warning.
- Static source-only preview states, demo records/counts, and template-only subtab content were intentionally not copied because they are not backed by the current production contracts.

## RecruitFlow V2 Design Parity Pass — 2026-08-19

### Scope change

- The user explicitly expanded the request from a selective source integration to studying `recruitflow_v2` and making the production frontend use the same typical design language across its major page families.
- The earlier background/nav/quick-create work is retained as a foundation. This pass will audit and extend the shared visual system rather than restart or replace the current React application.

### Source design-system rules confirmed

- The reference is explicitly a light enterprise recruitment operations system: action-first, semantic status colors, context-dependent density, and business logic kept outside the visual layer.
- Core geometry is 244px desktop sidebar, 66px sticky top bar, 1540px content maximum, 26px desktop gutters, and responsive thresholds around 1180px, 860px, and 520px.
- Source typography uses Inter/system sans with 25px page titles, 19px detail titles, 15px card titles, 14px body, and 10-12px operational metadata/table copy.
- Source page families are intentionally different: command center, dense directories, decision workspaces, detail heroes, Kanban workflow, wizard forms, contextual modals, and chart-led analytics.
- The parity pass must therefore be structural and component-led. Applying one repeated KPI-card layout to every current page would contradict the source itself.

### Migration sequence and QA boundary

- The source migration guide recommends foundation first: tokens, shell, PageHeader, Button/Badge/FormField/Tabs/Modal, then DataTable and FilterBar, followed by route families in recruitment, hiring/talent, administration, and analytics.
- The source explicitly forbids changing API payloads/routes, auth/session behavior, permission evaluation, approval logic, stage transitions, offer calculations, or SLA calculations.
- The source QA report validates 51 static states, keyboard/modal behavior, responsive drawers, tables, Kanban, and calendars, but confirms that production integrations must be tested in the real frontend.
- Implementation priority for this pass: shared foundation and repeated page-family structures first, then visual QA against the source at 1440, 1280, 1024, 768, and 390 widths.

### Available visual evidence

- Source reference screenshots are available for dashboard, candidates, and approvals under `recruitflow_v2/previews`.
- Production browser evidence is available under `tests/artifacts/browser/market-benchmark-2026-08-18` for dashboard, candidates, vacancy requests, vacancies, applications, interviews, calendar, offers, hires, admin, and reports, with dual-mode and mobile captures for the key routes.
- The parity comparison can therefore be grounded in rendered screens rather than source CSS inspection alone.

### Dashboard visual comparison

- The source dashboard uses a compact 244px shell, 66px top bar, pale blue-gray canvas, five equal KPI cards, then an asymmetric funnel/trend row and task/SLA/departments work area.
- The current dashboard already has the right enterprise palette and action-first intent, but it visually diverges through a larger shell, a prominent blue hero banner, six KPI cards, more rounded container treatment, and a different information hierarchy.
- To match the source typically, the production dashboard needs a calmer page header, source-like five-card rhythm, tighter table/task metadata, restrained radius/shadow behavior, and the same sidebar/topbar geometry while retaining current real metrics and actions.

### Directory visual comparison

- The source candidates directory is intentionally compact: page title and action, three lightweight tabs, one toolbar, one dense table, and pagination. It does not lead with a four-card KPI row.
- The current candidates page has a strong table and real data but adds a large page-family eyebrow, four summary cards, a taller shell, larger row stack, and heavier outer panel treatment.
- The parity move is to make directories table-first and compact, keep only metrics that materially support the workflow, and align toolbar, row density, status badge, avatar, and pagination variants to the source.

### Decision-workspace visual comparison

- The source approvals screen is a decision workspace: tabs with counts, a left filter rail, a compact request table, visible SLA language, and approve/reject actions in the same row.
- The current vacancy-request screen is a strong directory implementation but carries the dashboard metric row and does not visually communicate a decision workspace in the same way.
- Approval parity should focus on the approval inbox and other decision routes: reduce decorative metrics, strengthen filter/action context, and keep explicit SLA and decision affordances close to each item.

### Source CSS foundation

- Source primitives are already a close match for the production semantic palette: `#F5F8FC` canvas, white surfaces, `#1769E8` primary, blue/green/orange/red/purple state families, restrained shadows, and 4/8/12/16/20/24/32/40/48 spacing.
- Source geometry and component tokens are explicit: 244px sidebar, 66px header, 38px controls, 6/8/12/16/22 radius scale, and compact metadata sizes.
- Source dark mode is a full semantic swap with the same hierarchy, not a black overlay. Production tokens can absorb the remaining geometry and page-family refinements without adding a new library.

### Current production foundation inventory

- Current shared styling is split across `tokens.css`, `shell.css`, `ui-primitives.css`, `polish.css`, and page-local styles, with an existing semantic dual-theme system and reusable `Card`, `MetricCard`, `DataTable`, `ResponsiveDataView`, `PageFrame`, `PipelineBoard`, `Modal`, `Drawer`, and form primitives.
- `PageFrame` currently uses a 1720px max width and larger responsive gutters than the source; `AppShell` and `polish.css` contain the main geometry that must be reconciled toward the source's 1540px / 244px / 66px targets.
- Current route pages frequently compose their own summary cards, filters, and tables. The highest leverage is shared CSS geometry and page-family variants before editing every route individually.

### Current token mismatch

- The production token system is already semantic and dual-mode, but its geometry currently declares a 252px sidebar, 64px header, 1720px page max width, and Plus Jakarta Sans, while the source declares 244px, 66px, 1540px, and Inter/system sans.
- The source's restrained enterprise feel will be more recognizable if these shared values are aligned centrally, with compatibility aliases preserved for legacy utilities and dark-mode contrast retained.
- `PageFrame` is the cleanest shared entry point for source-like title/action spacing and should become the primary page-header geometry instead of adding repeated page-local margins.

### Route implementation observations

- `CandidatesPage` already has real pagination, filters, responsive table/card rendering, add-candidate modal, loading/error states, and permission-gated actions. It mainly needs source-like density and page-family framing, not a data rewrite.
- `DashboardPage` currently uses a custom six-card hero-led layout with real parallel data loading, funnel/task/request/vacancy surfaces, and a real creation modal. The safe parity path is to reshape its presentation and metric count while preserving those data surfaces.
- Existing pages sometimes use Tailwind utility colors directly in JSX. Shared parity CSS can correct geometry and surface treatment first; hardcoded data/state colors should only be touched where they create a clear theme or source mismatch.

### Source component patterns to port

- Buttons are 38px controls with 8px radius, 13px text, restrained blue shadow only for primary action, and clear success/danger outline variants.
- Cards use 12px radius and restrained border/shadow; table rows use 12px copy, compact 11-13px cell padding, sticky light header, and subtle hover only.
- The source uses a single horizontal tab treatment, 36px filter controls, 5-column metric rhythm where metrics are justified, 210px approval filter rail, 6-column Kanban with internal scroll, 210px wizard rail, and 5-day calendar grid.
- The production can port these as semantic CSS/component variants without copying source template strings or replacing current React behavior.

### Implementation decision

- Start with centralized geometry/control/table parity and one dashboard metric-rhythm correction. This gives every route a source-like baseline while keeping page-specific data and workflow logic untouched.

### Source screen map

- `recruitflow_v2` defines 51 preview states spanning login, dashboard, tasks, notifications, quick-create, requisitions, approvals, vacancies and four vacancy subtabs, candidates and four candidate states, talent/CV intake, pipeline/application detail, interviews/calendar/scorecard, offers/approvals/detail, hiring/license/joining, reports, admin, 404, and requisition detail.
- The source navigation and screen map confirm that parity is mostly a page-family problem. Current production already owns most of these routes, so the implementation should converge shared patterns and route-level composition rather than add a parallel preview system.
- Source modal states are short contextual actions. Production already has real modal behavior for candidate creation and interview scheduling; remaining source affordances should be added only where current route/API contracts expose them.

### Production route coverage

- The production router already covers the source's main route families, including dashboard, tasks, notifications, vacancy requests/create/detail, approvals, vacancies/detail, candidates/detail/documents, talent pool, CV intake/import, applications/detail, interviews/calendar/detail, offers/create/approvals/detail, hires/detail/approvals, licenses, joining, reports, users, master data, pipeline settings, integrations, audit, and 404.
- This confirms that a broad visual parity pass can stay frontend-only. The biggest visible gaps are shared geometry, repeated metrics in directories/decision pages, source-like table/toolbar styling, and detail/wizard/analytics composition.
- Existing route-level fallback metrics and prototype-like values are data-truth concerns from the earlier audit; this design pass will not use new fake values to mimic the source screenshots.

### Verification path

- The repository already has a Playwright dual-mode matrix covering source-relevant routes and 375/768/1024/1440 widths, with screenshots for dashboard/candidates/applications/reports and axe checks on key pages.
- After the parity CSS/route adjustments stabilize, reuse this matrix for visual and overflow/accessibility evidence rather than creating a separate test harness.

### First parity browser finding

- Focused matrix result: 11/12 routes passed at 375/1440 in light/dark; light 1440 Candidates failed only axe `color-contrast` on table headings (`#68768b` on `#f8faff`), blue initials (`#1769e8` on `#eaf2ff`), and green status badges (`#0b9b6f` on `#eafaf4`).
- No overflow, console, failed-response, or dark-mode issues were reported. The fix is a token-level contrast correction scoped to table metadata and status surfaces.

### Updated visual checkpoint

- The rerun captured the updated dashboard and Candidates screens in both themes at 375px and 1440px; the new production screens now have the source's calmer page header, five-card dashboard rhythm, compact table-first directory, lighter borders, and source background art.
- Approval behavior/axe passed in the matrix, but the existing matrix does not save an approval screenshot. This is a capture limitation, not a route failure.
- A live computed-layout probe confirmed the source geometry is active at 1440px: sidebar width 244px, page content starts at 244px, and the page frame width is 1196px within the available main shell.

### Remaining page-family styling surface

- Production already exposes semantic hooks for the source's remaining families: `rf-detail-hero`, `rf-form-section`, `rf-report-canvas`, `ui-calendar-*`, and `pipeline-*` classes.
- `PageEnhancementsV2.css` currently adds a more decorative gradient/hover layer than the source. The next parity refinement should reduce that extra visual noise and align detail, form, calendar, report, and pipeline surfaces to the same border-first primitives.

### Shared metric and table component observations

- `MetricCard` currently renders 112px minimum-height, 16px padding, 27px value type, 16px radius, and a large soft shadow. The source metric primitive is closer to 12px radius, 16px padding, 24px value type, and restrained border-first depth.
- `DataTable` currently uses 16px horizontal padding, 14px vertical cell padding, 10px uppercase headings, and a 680px minimum width. Source tables are compact with 11-13px cell padding and a 10.5px header, so shared CSS can narrow the visual rhythm without changing data columns.

### Decision inbox implementation target

- `ApprovalInboxPage` currently has permission-aware real queues and direct approve/review actions, but places a metric row before the active queue and uses button tabs.
- The safe source-parity adjustment is presentational: remove the decorative metric row, make the queue tabs source-like, and retain the existing authorized queue data and mutations.

### Dashboard composition decision

- The current dashboard's lower sections already contain real task, vacancy, and request states, including empty/error handling. The visual parity pass will keep those truthful sections and use source-like card proportions, headings, borders, and spacing rather than substituting static SLA or hiring-trend data.
- `My Action Items` is the current product's equivalent of the source `My Tasks` block; the source-like treatment can be achieved through the shared list/card surface without renaming domain copy unnecessarily.

### Shared control observations

- Production `Button` and `Input` primitives are already semantic and accessible, but default to 12px radius, 40-44px controls, and softer shadows than the source's 8px / 38px / border-first treatment.
- The parity stylesheet can target `data-slot="button"` and `data-slot="input"` to align controls globally while preserving existing variants, focus rings, disabled states, and mobile touch-target expansion.

### Expanded parity matrix finding

- The first broader source-parity matrix covered `/`, `/candidates`, `/applications`, and `/reports` at 375px and 1440px in light and dark themes. It passed 13/16 checks with no overflow, runtime, or failed-response findings.
- The three failures were accessibility-only: one application count badge used action blue on action-soft in light mode; six report success badges and one danger badge used the base semantic text tokens on soft backgrounds in light mode; and twelve dark application avatars used white initials on the dark action background.
- The safe fix is centralized in `apps/web/src/styles/v2-parity.css`: shared Badge instances now use strong semantic text tokens, action-soft labels use the action-strong token, and dark avatars use the theme's on-action token. No page data, workflow, or API contract is involved.

### Expanded parity visual checkpoint

- The fresh 1440px light captures show the intended family split: Applications is a horizontally scrollable, compact Kanban workspace with short cards and visible stage controls; Reports is a calmer analytics canvas with a compact filter band, four critical metrics, chart context, evidence summary, and dense workload table.
- Both screens retain real production values and existing controls. The pipeline's right-edge clipping is intentional horizontal stage-board overflow rather than viewport overflow; the matrix's document-overflow check passes.
- The dark captures preserve the same hierarchy with dedicated navy surfaces, restrained borders, readable semantic states, and non-neon atmospheric art. The avatar initials now use the dark on-action token rather than relying on white text.

### Final test finding

- The frontend suite initially passed 8/9 tests; the single failure was `StatusBadge.test.tsx`, where `getStatusTone('Scheduled')` returned `purple` instead of `info` because the shared status matcher allowed a broader substring rule to win.
- This is a presentation-only precedence defect in the existing status-tone helper. The correction must preserve the underlying workflow/status strings and only restore the intended semantic color mapping.
- Corrected `scheduled` to the existing `info` tone in `apps/web/src/components/StatusBadge.tsx`; the helper still preserves the distinct `interview scheduled` and `rescheduled` workflow tones.

### Final responsive verification

- The final targeted browser matrix passed 48/48 checks for `/`, `/candidates`, `/applications`, and `/reports` at 375, 430, 768, 1024, 1280, and 1440 pixels in both light and dark themes.
- The matrix includes serious/critical accessibility scans, overflow checks, theme checks, console checks, and failed-response checks for the selected routes. No responsive, accessibility, runtime, or HTTP regression was reported.
- The previously generated handoff archive was verified with `tar -tf`; the user subsequently clarified that no ZIP is needed, so only that generated archive was removed. No source files were removed.

## Full reference-to-production comparison audit - 2026-08-19

This section records the page/component comparison requested after the initial parity pass. The source is a static visual reference; production behavior, data, permissions, routes, and workflow rules remain authoritative.

Audit status: inventory in progress.

### Inventory checkpoint 1 - source and production structure

- The reference contains 19 files, including `index.html`, `js/app.js`, `js/data.js`, four CSS layers, design/migration/QA documentation, and the theme update notes.
- `recruitflow_v2/js/data.js` declares 51 numbered visual states. These include 1 login state, 4 command-center states, 9 demand/approval states, 8 candidate/talent states, 2 application states, 4 interview states, 4 offer states, 4 hiring/joining states, 1 reports state, 7 administration/modal states, 1 404 state, and 1 vacancy-request detail state.
- The source's state list is a visual coverage contract, not a production route contract: several entries are modal or tab variants sharing one URL, and several source rows use placeholder values/functions in `app.js`.
- The production frontend currently declares the source route families plus additional operational routes: 37 page files, authenticated route guards, `/cv-intake/:jobId`, `/import`, and a development-only `/__design-system` route. It has 35 reusable UI/utility files after including tests and the newly integrated `MagicBento` primitive.
- Production route protection is materially stricter than the static reference: page access is wrapped with `ProtectedRoute`, `AppShell`, and per-route `PermissionGate`/permission sets. The comparison must therefore evaluate visual parity without weakening reachability rules.

### Source state inventory (51 states)

| Family | Source states | Production mapping status |
|---|---|---|
| Access and shell | Sign In; Quick Create Menu | `/login`; shell `QuickCreateMenu` |
| Command center | Executive Dashboard; Assigned Tasks & SLAs; Notifications Center; Quick Create Menu | `/`; `/tasks`; `/notifications`; shell menu |
| Demand and approvals | Vacancy Requests Directory; Create Vacancy Request; Approval Inbox; Vacancies Directory; Vacancy Overview; Vacancy Candidates; Vacancy Pipeline; Vacancy Interviews; Vacancy Offers; Vacancy Request Detail | All route families exist; vacancy detail tabs share `/vacancies/:id`; request detail exists at `/vacancy-requests/:id` |
| Talent and intake | Candidates Directory; Add Candidate Modal; Candidate Profile Overview; Candidate Applications; Candidate Documents; Candidate Activity; Apply Candidate Modal; Candidate Document Vault; Talent Pools; CV Intake | Directories/details exist; modal/tab states are expected sub-states; CV intake also has production import-preview routes |
| Application workflow | Application Pipeline; Application Lifecycle | `/applications`; `/applications/:id` |
| Interviews | Interviews Overview; Schedule Interview Modal; Interview Calendar; Interview Scorecard | `/interviews`; modal/sub-state; `/interviews/calendar`; `/interviews/:id` |
| Offers | Offers Management; Create Offer Package; Offer Approval Inbox; Offer Package Detail | `/offers`; `/offers/create`; `/offers/approvals/inbox`; `/offers/:id` |
| Hiring and joining | Pre-Hire Management; Final Hiring Approval; License Compliance; Joining & Onboarding | `/hires`; `/hires/approvals/inbox`; `/licenses`; `/joinings` |
| Insight and administration | Analytics & KPI Reports; Users & Roles; Create User Modal; Create Custom Role Modal; Master Data (Legal Entities/Branches/Positions); Create Master Data Record; Security & Audit Log; Pipeline Stage Settings; System Integrations | `/reports`; `/users`; `/master-data`; `/audit-log`; `/pipeline-settings`; `/integrations`; modal/tab states are page-local |
| Fallback | 404 Error State | production `NotFoundPage` wildcard |

### Production route/page inventory

`App.tsx` confirms the production mapping is not a static demo: each route renders a real page component and, where applicable, is permission-gated. The next matrix pass will inspect each page file and shared primitive for source-family gaps rather than treating route existence as visual parity.

### Complete source-state to production route matrix (coverage pass)

The matrix below is the route/component coverage baseline. `Visual review` is intentionally left open until each family and shared primitive has been inspected; route existence alone is not being counted as design parity.

| # | Reference state | Production route/component | State type | Coverage | Visual review |
|---:|---|---|---|---|---|
| 1 | Sign In | `/login` - `LoginPage` | page | matched | pending |
| 2 | Executive Dashboard | `/` - `DashboardPage` | page | matched | pending |
| 3 | Assigned Tasks & SLAs | `/tasks` - `TasksPage` | page | matched | pending |
| 4 | Notifications Center | `/notifications` - `NotificationsPage` | page | matched | pending |
| 5 | Quick Create Menu | shell menu on `/` - `QuickCreateMenu` | overlay | matched | pending |
| 6 | Vacancy Requests Directory | `/vacancy-requests` - `VacancyRequestsPage` | page | matched | pending |
| 7 | Create Vacancy Request | `/vacancy-requests/create` - `CreateVacancyRequestPage` | page/wizard | matched | pending |
| 8 | Approval Inbox | `/approval-inbox` - `ApprovalInboxPage` | page | matched | pending |
| 9 | Vacancies Directory | `/vacancies` - `VacantListPage` | page | matched | pending |
| 10 | Vacancy Overview | `/vacancies/:id` - `VacancyOverviewPage` overview tab | detail tab | matched | pending |
| 11 | Vacancy Candidates | `/vacancies/:id` - `VacancyOverviewPage` candidates tab | detail tab | matched | pending |
| 12 | Vacancy Pipeline | `/vacancies/:id` - `VacancyOverviewPage` pipeline tab | detail tab | matched | pending |
| 13 | Vacancy Interviews | `/vacancies/:id` - `VacancyOverviewPage` interviews tab | detail tab | matched | pending |
| 14 | Vacancy Offers | `/vacancies/:id` - `VacancyOverviewPage` offers tab | detail tab | matched | pending |
| 15 | Candidates Directory | `/candidates` - `CandidatesPage` | page | matched | pending |
| 16 | Add Candidate Modal | `/candidates` - `CandidatesPage` create interaction | modal/drawer | matched route, interaction check | pending |
| 17 | Candidate Profile Overview | `/candidates/:id` - `CandidateDetailPage` overview tab | detail tab | matched | pending |
| 18 | Candidate Applications | `/candidates/:id` - `CandidateDetailPage` applications tab | detail tab | matched | pending |
| 19 | Candidate Documents | `/candidates/:id` - `CandidateDetailPage` documents tab | detail tab | matched | pending |
| 20 | Candidate Activity | `/candidates/:id` - `CandidateDetailPage` activity tab | detail tab | matched | pending |
| 21 | Apply Candidate Modal | `/candidates/:id` - `CandidateDetailPage` apply interaction | modal/drawer | matched route, interaction check | pending |
| 22 | Candidate Document Vault | `/candidates/:id/documents` - `CandidateDocumentsPage` | page | matched | pending |
| 23 | Talent Pools | `/talent-pool` - `TalentPoolPage` | page | matched | pending |
| 24 | CV Intake | `/cv-intake` - `CVIntakePage` | page | matched | pending |
| 25 | Application Pipeline | `/applications` - `ApplicationsPage` / `PipelineBoard` | page/Kanban | matched | pending |
| 26 | Application Lifecycle | `/applications/:id` - `ApplicationDetailPage` | detail page | matched | pending |
| 27 | Interviews Overview | `/interviews` - `InterviewsPage` | page | matched | pending |
| 28 | Schedule Interview Modal | `/interviews` - `InterviewsPage` schedule interaction | modal/drawer | matched route, interaction check | pending |
| 29 | Interview Calendar | `/interviews/calendar` - `InterviewCalendarPage` | page/calendar | matched | pending |
| 30 | Interview Scorecard | `/interviews/:id` - `InterviewDetailPage` / `Scorecard` | detail page | matched | pending |
| 31 | Offers Management | `/offers` - `OffersPage` | page | matched | pending |
| 32 | Create Offer Package | `/offers/create` - `CreateOfferPage` | page/wizard | matched | pending |
| 33 | Offer Approval Inbox | `/offers/approvals/inbox` - `OfferApprovalInboxPage` | page | matched | pending |
| 34 | Offer Package Detail | `/offers/:id` - `OfferDetailPage` | detail page | matched | pending |
| 35 | Pre-Hire Management | `/hires` - `HireManagementPage` | page | matched | pending |
| 36 | Final Hiring Approval | `/hires/approvals/inbox` - `FinalApprovalInboxPage` | page | matched | pending |
| 37 | License Compliance | `/licenses` - `LicenseManagementPage` | page | matched | pending |
| 38 | Joining & Onboarding | `/joinings` - `JoiningManagementPage` | page | matched | pending |
| 39 | Analytics & KPI Reports | `/reports` - `ReportsPage` | page/analytics | matched | pending |
| 40 | Users & Roles | `/users` - `UsersRolesPage` | page/admin | matched | pending |
| 41 | Create User Modal | `/users` - `UsersRolesPage` create-user interaction | modal/drawer | matched route, interaction check | pending |
| 42 | Create Custom Role Modal | `/users` - `UsersRolesPage` create-role interaction | modal/drawer | matched route, interaction check | pending |
| 43 | Master Data - Legal Entities | `/master-data` - `MasterDataPage` legal entities view | page/tab | matched | pending |
| 44 | Master Data - Branches | `/master-data` - `MasterDataPage` branches view | page/tab | matched | pending |
| 45 | Master Data - Positions | `/master-data` - `MasterDataPage` positions view | page/tab | matched | pending |
| 46 | Create Master Data Record | `/master-data` - `MasterDataPage` create interaction | modal/drawer | matched route, interaction check | pending |
| 47 | Security & Audit Log | `/audit-log` - `AuditLogPage` | page/admin | matched | pending |
| 48 | Pipeline Stage Settings | `/pipeline-settings` - `PipelineSettingsPage` | page/admin | matched | pending |
| 49 | System Integrations | `/integrations` - `IntegrationsPage` | page/admin | matched | pending |
| 50 | 404 Error State | wildcard - `NotFoundPage` | fallback | matched | pending |
| 51 | Vacancy Request Detail | `/vacancy-requests/:id` - `VacancyRequestDetailPage` | detail page | matched | pending |

### Inventory checkpoint 2 - design rules and shared primitive coverage

- The reference design system explicitly separates page families: command center, dense directories, decision workspaces, detail pages, workflow visualization, forms/wizards, modals, and analytics. This is the primary comparison axis, not a single dashboard template.
- Source shared primitives include button/icon button, status badge, card/metric card, form controls, tabs, data table/toolbar/filter/pagination, progress, empty state, modal/drawer, timeline, stepper, avatar/person cell, and Kanban card.
- Production has direct shared equivalents for most primitives: `Button`, `IconButton`, `Badge`/`StatusBadge`, `Card`/`MetricCard`, `Input`/`Select`/`FormField`, `DataTable`, `FilterChips`, `PageState`, `Drawer`, `ResponsiveDataView`, `PipelineBoard`, `Scorecard`, `Avatar`, `Toast`, and `PageFrame`. The production app also has shell-level `CommandPalette`, `QuickCreateMenu`, `ThemeToggle`, and `MagicBento`.
- The page usage scan shows all 37 production page files use `PageFrame` or a deliberate exception (`DashboardPage` and `NotFoundPage`), while page families vary in their use of `DataTable`, `MetricCard`, `FormField`, `PipelineBoard`, and detail layout. This supports shared CSS/component parity work rather than flattening all routes into one layout.
- Production has no standalone `Tabs.tsx` primitive in the shared UI directory; tabs are implemented through page-local markup/styles. This is a likely reuse/accessibility gap because the source treats tabs as a first-class shared component.
- The source baseline calls for 244px sidebar, 66px top bar, 1540px content max, 26px desktop gutter, compact 12px operational table copy, and border-first depth. These values are already represented in the parity tokens and must be checked against page-local overrides next.

### Shared primitive checkpoint

- `PageFrame` is the correct source-equivalent shell primitive and already exposes source geometry, eyebrow/title/description/action hierarchy.
- `DataTable` is the main source-equivalent table primitive, but its base class still declares a 680px minimum table width, 16px horizontal/14px vertical cells, 10px uppercase headings, 2xl outer radius, and card shadow. The parity stylesheet narrows many `rf-table-shell` instances; the base primitive should be checked for routes that do not wrap it in that class.
- `MetricCard` still defaults to 112px minimum height, 27px values, 2xl radius, and card shadow. Source metrics are smaller and more border-first. Existing parity selectors may cover some page instances, but the shared default is a drift risk.
- `PipelineBoard` preserves real drag/drop and allowed-stage behavior, which must remain unchanged. Its production card has more operational controls than the reference card; comparison should style density and hierarchy rather than remove controls.
- Production page-local tabs are inconsistent: `ApprovalInboxPage` has source-like semantic tabs, while `CandidateDetailPage` currently uses filled blue pill buttons. The source uses a quiet underline/tab-strip treatment, so candidate/vacancy/detail tabs are a high-impact parity target.
- The attempted shell/login read used non-existent paths (`components/layout/AppShell.tsx`, `pages/LoginPage.tsx`); the actual files will be located before the next comparison pass.

### Shell and login checkpoint

- Actual production shell is `apps/web/src/layout/AppShell.tsx`; it has the requested grouped navigation, permission-aware item visibility, persistent collapsed state, responsive mobile navigation, global command palette, notifications popover, breadcrumbs, theme toggle, account/logout controls, and `AtmosphericBackground` variants.
- The source shell groups navigation as My Work, Recruitment, Pipeline, Hiring, Analytics, and Administration. Production deliberately refines this into Command Center, My Work, Workforce & Openings, Talent & Intake, Hiring, Insights & Trust, and Administration. The labels/routes differ in a few places, but the production shell exposes the same source coverage plus permission constraints; this is an information-architecture comparison item, not a reason to change route names.
- Actual production login is `apps/web/src/auth/LoginPage.tsx`; it preserves the source's two-column product story, three benefits, secure sign-in cue, credentials form, password visibility, organization policy, responsive mobile simplification, and environment-gated persona helpers. It is more spacious and rounded than the source baseline, so the visual pass should reduce excess hero/card scale without removing authentication feedback or development gating.
- The production shell and login both use shared theme/background infrastructure. Any tightening must preserve the `AtmosphericBackground`, persisted theme preference, auth error states, focus behavior, and permission/session behavior.

### Visual checkpoint - current parity captures

- The current dashboard/candidates/applications/reports captures are coherent with the reference's shell geometry: 244px rail, 66px top bar, compact page header, light atmospheric background, border-first surfaces, and restrained semantic status colors.
- Candidates is table-first and operationally readable, but the source reference includes a page-level tab strip (`All Candidates`, `Talent Pool`, `Disqualified`) that is not visible in the current production capture. The production route has real filters and a separate talent-pool route; the missing/relocated tab treatment should be resolved without inventing unsupported filtering behavior.
- Applications is visually polished but still shows four KPI cards before the Kanban. The source `kanban()` render has only page header, toolbar, and the horizontal stage board; this is a clear page-family mismatch and a P1 fix candidate. Removing only the decorative summary row preserves the existing board, drag/drop, allowed-stage checks, and API data.
- Reports closely matches the source analytics family: filter band, four decision metrics, trend context, evidence summary, conversion sections, and workload table. No structural change is required from this checkpoint.
- Dashboard's newly integrated MagicBento operational-pulse section is not present in the static source. It should remain only as a deliberately labeled, restrained enhancement, with mobile/reduced-motion disabling and real API-derived values; it must not displace the source funnel/action hierarchy.

### Parity implementation checkpoint

- Added a shared accessible `Tabs` primitive with source-style underline treatment, counts, keyboard arrow/Home/End navigation, focus-visible state, and mobile horizontal scrolling. Migrated candidate detail, vacancy detail, master data, and candidate directory views to it.
- Added candidate directory views that map the source's `All Candidates`, `Talent Pool`, and `Disqualified` states to existing production behavior (`/talent-pool` and the existing `Blacklisted` status filter); no new route or backend filter contract was introduced.
- Removed decorative KPI rows from production states whose source render is table/detail/workflow-first: application pipeline, candidate document vault, offer/final approval inboxes, notifications, master data, integrations, workflow settings, vacancy request detail, application detail, offer detail, interview detail, and hiring case detail. Existing data remains visible in the corresponding tables, checklists, timelines, and detail surfaces.
- Reduced the shared `DataTable` and `MetricCard` primitives toward the source's 820px table rhythm, 11px/24px metric typography, 12px surface radius, and border-first shadow treatment. These are shared visual changes only.
- The removal pass intentionally left source-equivalent generic directory metric rows in vacancies, vacancy requests, interviews, offers, hires, licenses, joinings, users, audit, and talent-pool pages because the reference `listPage()`/`talentPool()` states include summary metrics there.

### Complete shared-component comparison

| Reference primitive | Production implementation | Result |
|---|---|---|
| Button / IconButton | `Button`, `IconButton` | matched; existing variants/focus/disabled/loading behavior preserved |
| StatusBadge | `Badge`, `StatusBadge`, `PriorityChip` | matched; semantic text retained and the `Scheduled` precedence fix remains covered |
| Card / MetricCard | `Card`, `MetricCard`, `rf-panel`/`rf-elevated-card` styles | matched after radius/typography/shadow tuning |
| FormField / Input / Select / Textarea | `FormField`, `Input`, `Select`, native textarea patterns, modal/form pages | matched; business validation untouched |
| Tabs | new shared `Tabs`; approval tabs remain scoped because permissions determine visible queues | improved; candidate, vacancy, master-data, and candidate-directory tabs now use source geometry and keyboard navigation |
| DataTable / TableToolbar / Filters / Pagination | `DataTable`, `ResponsiveDataView`, page filter bars, `FilterChips`, page-local pagination | matched at family level; common cell/header rhythm tightened |
| Progress | page progress bars and readiness indicators | matched through existing semantic progress styling |
| Empty / Loading / Error | `PageState`, `Alert`, `Spinner`, route error boundaries | matched; source-only blank states are not used |
| Modal / Drawer | `Modal`, `ConfirmDialog`, `Drawer` | matched; existing focus/escape behavior preserved |
| Timeline / Stepper | page-local timeline surfaces plus `PipelineStepper`/stepper styles | matched at detail/workflow family level |
| Avatar / Person cell | `Avatar`, page person-cell patterns, `getInitials` | matched; real identity data remains authoritative |
| Kanban card | `PipelineBoard` with drag/drop, allowed-stage select, action menu | matched and deliberately richer; operational controls were not removed |

### Final route verification evidence

- Full authenticated dual-mode matrix: 264/264 passed across all static and dynamic routes, light/dark themes, and 375/768/1024/1440 widths.
- The matrix included route loads, visible headings, theme persistence, document overflow, console errors, failed HTTP responses, and serious/critical axe checks for `/login`, `/`, `/candidates`, `/applications`, and `/reports`.
- The one initial axe finding on the lazy MagicBento fallback was fixed and the targeted 1440px light dashboard rerun passed 1/1.
- Visual spot checks of final light dashboard, candidates, applications, and dark reports captures show: bento enhancement contained below critical dashboard metrics; candidate tabs now mirror the source underline strip; pipeline is board-first without a KPI wall; reports retain the dedicated dark analytical surface.

### Remaining reference differences

- The static reference includes modal-open variants for Add Candidate, Apply Candidate, Schedule Interview, Create User, Create Role, and Master Data. Production has the underlying interactions, but the automated route matrix does not open every modal variant; those require manual click-through verification.
- Offer Approval and Final Hiring Approval are separate production permission-gated routes without the source's full pending/approved/rejected tab-state simulation. This is an intentional behavior/data boundary, not a route break; no fake tabs or mock approval records were added.
- Production uses real API values and permission-aware visibility instead of the source's fixed reference data. Text/count differences are expected and are not visual parity defects.
- MagicBento is a requested enhancement rather than a source component. It is contained to the dashboard operational-pulse section, uses real values, disables animation on mobile/reduced-motion, and should be manually reviewed for product preference before release if strict source-only parity is required.

### Release verification checkpoint

- Post-fix static checks on the exact current files: TypeScript passed; root web ESLint passed with zero warnings; design-token guard passed; Vitest passed 5/5 files and 9/9 tests; Vite build passed for the web app.
- `git diff --check` passed. Git emitted only existing line-ending normalization warnings for the dirty worktree; no whitespace error was reported.
- The requested generated archive path is absent. No ZIP was created for this comparison audit.

## 21st.dev component-system research - 2026-08-19

- Official 21st.dev describes its offering as a registry of owned, editable React/Tailwind/shadcn-compatible source rather than one runtime component package. This supports adapting appropriate patterns into RecruitFlow's existing local design system without adding a duplicate UI dependency.
- Its component catalog has dedicated families for the operational needs already present in RecruitFlow, including actions, navigation, cards, inputs/forms, tables, data visualization, dialogs, feedback, loading/empty states, timelines, steppers, and accessibility-sensitive overlays.
- The catalog also includes intentionally expressive marketing effects. For RecruitFlow, those are reference material only: the implementation should retain restrained motion, strong information hierarchy, token-driven light/dark surfaces, and operational density.
- The existing frontend already owns broad primitive coverage (`Button`, `IconButton`, `Badge`, `Avatar`, `Card`, `MetricCard`, `Input`, `Select`, `FormField`, `Tabs`, `DataTable`, `ResponsiveDataView`, `Drawer`, `Modal`, `ConfirmDialog`, `PageState`, `Alert`, `Toast`, `PipelineBoard`, and `PipelineStepper`). The next audit should identify missing composable patterns and expose them as a coherent live catalog rather than replace stable primitives.

### Local-system inventory checkpoint

- The development-only `/__design-system` route already exists and is correctly lazy-loaded outside the production route graph. Its current page is a useful smoke-test gallery, but it omits most shared production families and does not describe token roles or component composition.
- `tokens.css` already has a sound semantic light/dark base: canvas/surface/ink/brand/semantic roles, spacing, radii, elevation, focus, motion, and core shell sizing. The expansion should add missing token families and aliases in place rather than replace this proven foundation.
- The package manifest already includes Tailwind, Radix, Lucide, class-variance-authority, tw-animate-css, and GSAP. No broad 21st.dev dependency is necessary or desirable because 21st.dev itself ships source patterns intended to compose with these tools.
- `@recruitflow/design-system` currently exports a stale, unrelated violet token object and does not represent the app's canonical CSS tokens. It is a design-system drift risk and should be aligned with the RecruitFlow semantic contract before other packages consume it.
- Component inventory confirms strong primitive coverage but no reusable `Skeleton`, `SectionHeader`, `FilterToolbar`, `Pagination`, `FormSection`, `DetailSummary`, or `ActivityTimeline` module. Some page-local equivalents exist, so any additions should consolidate repeated patterns rather than create competing abstractions.

### Primitive implementation checkpoint

- Existing core primitives already use typed props, Tailwind/CVA variants, semantic token utilities, keyboard-aware tabs, labelled icon buttons, and table/mobile responsive views. The work should extend this contract, not duplicate it under a second component API.
- A generic `SkeletonLoader` exists in `Spinner.tsx`, but there is no composed skeleton family that matches cards, tables, detail headers, or boards. This is the highest-value missing feedback primitive.
- `PageFrame` owns the page-level header, while the current catalog has no lower-level `SectionHeader`/`FormSection` for repeated content groups. Adding scoped variants would let detail and form pages become more consistent without replacing page headers.
- `DataTable` supplies the surface and row rhythm, while filtering and pagination remain page-local. A composable `DataToolbar` and accessible `Pagination` would consolidate a repeated operational pattern without changing any query, filtering, or data behavior.
- Current field primitives have helpful error/hint semantics, but `FormField` does not automatically wire `aria-describedby`/`aria-invalid` to its child. A non-breaking clone-based enhancement can close that accessibility gap for native controls.

### Adoption-pattern checkpoint

- Candidates already has server-backed search/filter state and total-count pagination. A shared `DataToolbar` and `Pagination` can replace only the visual/composition markup while retaining the exact query parameters, request timing, and page state.
- Five production routes repeat the same previous/next pagination pattern (`Candidates`, `Import Preview`, `Audit Log`, `Notifications`, and `Tasks`). A small semantic primitive is justified and can be adopted incrementally without changing pagination contracts.
- Candidate Detail is a genuine detail/timeline surface with overview, applications, documents, and activity tabs. It is the right place to adopt a reusable detail summary and activity-timeline pattern, preserving the API-derived tab data and existing actions.
- Create Vacancy Request and Create Offer repeat a predictable titled-card form-section pattern. A `FormSection` component can improve semantic section structure and remove styling duplication while preserving all field validation, payload construction, and submission behavior.
- Comments and multiple form pages use raw textareas, demonstrating that a shared textarea primitive has an immediate upgrade path. Existing formatting controls remain intentionally non-functional and must not be made to imply unsupported rich-text behavior.

### B1 implementation checkpoint

- Expanded the semantic token contract with interactive surfaces, field, link, skeleton, typography, layer, focus, spacing, and motion roles in both light and dark mode. The portable `@recruitflow/design-system` package now describes the real blue RecruitFlow system instead of a stale violet placeholder.
- Added source-owned, composable primitives: `SectionHeader`, `FormSection`, `DataToolbar`, `Pagination`, `Textarea`, `CheckboxField`, `ProgressBar`, layout-matched skeletons, `DetailSummary`, `ActivityTimeline`, and a deliberately restrained 21st-inspired `SpotlightCard`.
- The new spotlight surface uses only a pointer-position CSS variable and a subtle token-colored radial layer; it has no tilt, particle, or attention-seeking animation and is disabled visually under reduced motion.
- The first production adoption is Candidate Directory: it now uses the shared toolbar, active filter chips, table-shaped loading state, and semantic pagination while retaining its existing server query, filters, search submission behavior, deep-link behavior, and create flow.

### B2 adoption checkpoint

- Create Offer and Create Vacancy Request now share a real `FormSection` shell for field groups; both retain all existing form state, validation, submission routing, and payload logic. Vacancy readiness now uses the reusable accessible `ProgressBar`, and the business-justification control uses the shared `Textarea`.
- Candidate Profile now uses the `DetailSummary` and `ActivityTimeline` patterns for identity/contact facts and audit context. The same API-derived values and tabs remain in place; only presentation and semantic structure changed.
- The new live components are deliberately being adopted where identical patterns already existed, which keeps the design system grounded in production behavior instead of isolated showcase code.

### Live catalog and type-safety checkpoint

- Rebuilt the development-only `/__design-system` route into a live catalog spanning foundations, actions/status, data entry, navigation/data controls, surfaces/data display, feedback/loading, workflow patterns, and overlays. It renders real production components instead of screenshots or a separate demo app.
- Added multi-page `Pagination` adoption to Import Preview, Audit Log, Notifications, and Tasks in addition to Candidates. The pager only composes the existing page/total state and invokes the existing setters; endpoint contracts and query semantics are unchanged.
- The initial TypeScript gate identified an unused catalog import and an existing Import Preview state variable named `loading` rather than `isLoading`. Both were corrected; the exact current TypeScript project build now passes.

### Consistency checkpoint

- All former page-level raw textareas now use the shared `Textarea` primitive (Candidate Documents, Dashboard quick request, Interview Scorecard, Master Data, Create Vacancy Request, Comments, and Confirm Dialog). The component preserves the caller’s `rows`, so compact scorecards do not become oversized.
- All direct production pagination surfaces now use the one semantic `Pagination` primitive. The remaining raw `<textarea>` is the implementation inside that shared primitive itself.
- The workspace is intentionally very dirty from prior user and redesign work. The current implementation is additive and scoped to the listed shared components, design-system route, token contract, and targeted page compositions; no unrelated changes were reverted or discarded.

### Performance checkpoint

- `ClickSpark` wraps both the authenticated application shell and login page. Its current canvas draw loop schedules a new animation frame even when there are no active sparks, making it a meaningful idle-render risk across the entire product. The performance pass should change it to demand-driven drawing and respect reduced-motion preferences without removing the click feedback.
- Dashboard-only `MagicBento` is already lazy loaded and configured to disable animation on mobile/reduced motion. The new `SpotlightCard` does not create an animation loop; it only updates CSS variables while a pointer moves over the card.
- `git diff --check` reports no whitespace errors; its output contains only existing line-ending normalization warnings from the intentionally dirty repository.

### Performance implementation checkpoint

- Changed `ClickSpark` from an always-running canvas `requestAnimationFrame` loop to demand-driven drawing: it now schedules frames only while sparks are active, cancels cleanly when they finish, and clears/suppresses effects when reduced motion is requested. This improves idle cost on both Login and the authenticated application shell without removing click feedback for users who allow motion.
- Post-change TypeScript and zero-warning ESLint checks both pass.

### B4 browser validation checkpoint

- The focused authenticated design-system matrix passes 56/56 checks across `/`, `/__design-system`, Candidates, Create Vacancy Request, Create Offer, Pipeline, and Reports at 375/768/1024/1440 in both light and dark mode. It reports no viewport overflow, console errors, or failed non-auth responses.
- The initial matrix/catalog URL used the stale `/__design-system` path, which renders the authenticated 404 page. Those results are invalid for catalog verification. The real protected catalog routes already present in `App.tsx` are `/design-system` and `/components`; the focused catalog checks must be rerun against `/design-system`.

### B4 catalog-accessibility findings

- The real `/design-system` route loads correctly at all four tested widths and both themes; the corrected focused route matrix passes 56/56 with no overflow, console errors, or failed non-auth responses.
- The real catalog axe scan found two serious shared-component issues: `DetailSummary` placed its `dt`/`dd` inside nested wrappers rather than directly under its `dl`, and the mobile-horizontal `PipelineStepper` scroll container was not keyboard focusable. These must be fixed before release verification can pass.
- The reduced-motion style contract itself works as designed on the real catalog: the spotlight card exists, its pseudo-element is hidden, and its transition duration resolves to `0s` when motion reduction is requested.

### B4/B5 completion checkpoint

- Corrected `DetailSummary` to use a semantic `ul` fact list and made the horizontal `PipelineStepper` region keyboard focusable with a visible focus ring. New unit tests cover both contracts.
- The post-fix real catalog scan passes at light 1440 and dark 375 with no serious/critical axe violations, no horizontal overflow, two live spotlight surfaces, and reduced-motion transitions resolved to `0s` with the spotlight pseudo-element hidden.
- Exact static gates pass: TypeScript project build, zero-warning `lint:web`, design-token guard (58 strict files), and Vitest (9 files / 16 tests).
- The production build passes. It builds both `apps/web` and the pre-existing backup workspace because they share the package name; the only Vite chunk warning remains the pre-existing approximately 937 kB `CVIntakePage` chunk.
- The full authenticated browser matrix passes 264/264 across all static routes plus populated vacancy, opening, candidate, application, offer, and hiring detail routes at 375/768/1024/1440 in light and dark mode. No source/API/auth/permission/workflow contract was changed, and no dependency was added or removed.

## System-wide adoption audit - 2026-08-19

- The current component system is strong across its recently adopted surfaces, but the user has requested the next necessary step: systematic coverage of every remaining routable screen and legacy/local component pattern.
- The refreshed enterprise guidance reinforces the current RecruitFlow direction: flat, information-first surfaces; compact data density; clear focus/keyboard states; subtle 150–200ms feedback; and responsive layouts without decorative effects. The recommendation to use a landing-page CTA pattern is intentionally not adopted because RecruitFlow is an authenticated operations product.
- The audit will use the real authenticated application and existing routes, not static source references or mock data. Findings will distinguish shared-primitives improvements from page-specific composition work so existing workflow behavior remains intact.

### ZIP replacement initial findings - 2026-08-19

- **RF-ZIP-001 / P1 / archive-source boundary:** The supplied archive is a design-system resource bundle, not a complete replacement application. It includes no route/page implementations for the live workflows beyond the design-system showcase. The safe boundary is visual/component replacement inside the existing app; replacing the application source wholesale would remove live behavior.
- **RF-ZIP-002 / P1 / host integration:** The archive README explicitly identifies `CommandPalette.tsx` and `QuickCreateMenu.tsx` as host-dependent. Their current application versions contain live API/auth integration and must be reconciled, not overwritten without a consumer and behavior diff.
- **RF-ZIP-003 / P1 / token drift:** The archive's Enterprise V3 tokens differ from the active source in canvas, surface, border, typography scale, spacing/density, and dark-mode values. The preview shows a calmer, denser enterprise language. Token adoption must be checked against current page CSS and the design-token guard before changing the canonical layer.
- **RF-ZIP-004 / P2 / shared-component drift:** Archive versions differ from the active implementations for Button, Input, Card, Badge, FormField, ResponsiveDataView, PipelineBoard, PageState, MetricCard, overlays, and the showcase. Many other components match exactly, which indicates the archive is a later/parallel design-system export rather than an independent product.
- **RF-ZIP-005 / P2 / missing core path:** The archive stores `components/core/*` while the active app keeps equivalent components under `components/*`. These require import-path reconciliation and consumer checks before adoption.
- **RF-ZIP-006 / P2 / visual target:** The supplied preview is a light enterprise component showcase with a narrow left rail, compact 36px controls, crisp low-elevation surfaces, dense data display, and a dark-mode token companion. It is suitable as the visual direction for the live design-system route and shared primitives, not as an unauthenticated product landing page.

### ZIP replacement resolution - 2026-08-19

- RF-ZIP-001 resolved by treating the archive as the authoritative visual/design-system source and the live RecruitFlow app as the authoritative workflow/runtime source.
- RF-ZIP-002 resolved by preserving the current host-integrated Command Palette and Quick Create implementations.
- RF-ZIP-003 resolved by adopting the archive's V3 semantic tokens and Tailwind mappings; the token guard still passes.
- RF-ZIP-004 resolved by adopting the archive versions of shared controls, cards, metrics, tables, responsive data views, overlays, and the V3 showcase after TypeScript, unit, and browser verification.
- RF-ZIP-005 resolved through import-path reconciliation to the current `components/*` layout; no duplicate `components/core` tree was introduced.
- RF-ZIP-006 verified in captured light/dark showcase screenshots under `tests/artifacts/zip-v3-browser` and in the full route matrix.
- No remaining P0/P1 blocker was introduced by this replacement. The only known follow-up is the pre-existing large CV Intake production chunk.

### C0 source-coverage checkpoint

- The current web source has 37 routable TSX pages plus the live catalog and a broad shared component inventory. The new system primitives are directly adopted by 13 pages, leaving a meaningful number of live pages still composed from local Tailwind markup or older components.
- Native controls or tables still appear in 14 page modules, most notably list/admin/workflow pages such as CV Intake, Interviews, Offers, Hiring, Joining, Users & Roles, Pipeline Settings, and approval inboxes. These are the highest-value candidates for C1/C2 standardization.
- The existing component layer already owns most primitives, so the next pass should strengthen and adopt it rather than introduce another component set. Likely reusable gaps to verify include compact filters, list/table states, schedule/agenda views, management checklists, access/settings rows, and dense operational detail headers.

### C0 visual-evidence checkpoint

- Captured first-view authenticated screenshots for all 33 currently reachable application routes (including populated detail routes) at 1440px and 375px, plus Login. The visual audit artifacts are stored under `tests/artifacts/system-wide-c0-2026-08-19` for systematic page-family review.
- The source scan confirms full shell/PageFrame coverage is already strong. The implementation focus should be on the contents inside those frames: local form controls, list/table rhythm, page-specific summaries, decision controls, schedule presentation, settings rows, and compact mobile treatment.

### C0 visual-review findings

- Desktop coverage has a coherent shell and core palette, but empty/low-data workspaces (Tasks, Notifications, approval inboxes, Reports, Master Data, and some management pages) still read as large generic surface areas rather than intentional operational states. They need stronger shared section hierarchy, actionable empty/attention states, or compact summary rows as supported by their real data.
- Mobile layouts remain usable and avoid visible horizontal overflow, but several legacy table/management screens compress filters and metadata more than necessary. The adoption pass should preserve table semantics while using the existing responsive data patterns, stacked controls, concise stat strips, and full-width primary actions where each page already supports them.
- Candidate, vacancy, offer, and hiring detail pages are structurally sound but vary in fact-summary, progress/checklist, and action-panel composition. Reusing the strengthened `DetailSummary`, `ActivityTimeline`, `ProgressBar`, `FormSection`, and status patterns can make those related workflows feel like one system without flattening their distinct goals.

### C1 shared-primitives baseline

- `PageFrame`, Button, Card, Input, Select, FormField, DataTable, PageState, Badge, and StatusBadge already provide a solid token-driven base. The adoption pass should favor these rather than recreate page-local variants.
- The audit found a real semantic issue in `FilterChip`: an interactive span can contain an interactive remove button. It should be restructured as sibling controls before further filter adoption.
- `PipelineBoard` and `PipelineStepper` remain the most visible workflow primitives with legacy raw control/color composition. They should be brought fully onto the current Button/Select/token contract while preserving drag/drop and stage-move behavior.
- `ResponsiveDataView` offers the correct mobile/desktop switch but its clickable desktop rows need keyboard activation parity. This can be addressed centrally, benefiting every list that adopts it.

### C1 implementation checkpoint

- Reworked shared icon actions into a token-driven, ref-forwarding `IconButton` with semantic labels, keyboard focus, tones, and responsive sizing. Pipeline cards now reuse it for drag and overflow controls, and use the shared Select primitive for stage movement.
- Rebuilt `FilterChip` so its optional toggle and remove action are siblings rather than nested interactive controls. Added matching token-based chip, saved-view, and icon-button styles without breaking the legacy `.filter-chip` class still used by a live approval surface.
- Added keyboard activation to clickable desktop rows in `ResponsiveDataView`, matching the existing mobile-card behavior. TypeScript, Vitest, and zero-warning ESLint pass after the first shared-primitives wave.

### C1 component-review findings

- Modal and Drawer already provide Escape, focus-trap, focus restoration, scroll lock, and semantic dialog structure. Modal alone still owns a bespoke close control, so it should adopt the upgraded `IconButton` for consistent visual/focus behavior.
- Command Palette is a bespoke, behavior-sensitive search surface but can safely use the shared Input primitive without changing request timing, results, navigation, or keyboard semantics.
- Scorecard and Comments Thread are the two remaining interaction-heavy components that visibly bypass the current system. Scorecard needs tokenized status/recommendation/rating controls; Comments must not imply unsupported rich-text or attachment behavior through active-looking formatting controls.

### C2 operational-list family findings

- CV Intake is functionally rich but still has the largest concentration of pre-system utility styling. Its lifecycle, upload surface, document specs, and batch history can be restyled with the current workflow, section, status, and page-state primitives without touching parsing/upload behavior.
- Interviews, Offers, Hire Management, Joining, and Users & Roles repeat the same local search + status-pill + raw-table pattern. `DataToolbar`, `FilterChip`, `ResponsiveDataView`, `DataTable`, and the new shared fields can replace that composition consistently while preserving exact filter state and API behavior.
- Several pages place `PageState` directly inside a table after the body. Standardizing on `ResponsiveDataView` or moving the empty state outside the table will improve valid table semantics and create useful mobile record cards at the same time.

### C2 first implementation checkpoint

- Interviews, Offers, and Hire Management now use the same real `DataToolbar` + `FilterChip` + `ResponsiveDataView` composition. Their existing in-memory search/filter logic, loading/error handling, actions, and deep links are unchanged; the replacement adds mobile record cards, valid empty-state placement, table-shaped loading, and consistent action treatment.
- Joining Management, Users & Roles, and CV Intake are the next inspected family. They use the same legacy filter/table or local utility composition, so they can adopt the existing primitives without inventing new workflow behavior. CV Intake should express its existing upload lifecycle through the shared `PipelineStepper` and a token-driven upload surface while retaining the parser and upload request unchanged.

### C2 workflow and administration checkpoint

- Joining Management, Users & Roles, CV Intake, both approval inboxes, License Management, Tasks, Notifications, and Pipeline Settings now use the shared filter, responsive data, list skeleton, status, field, and section patterns appropriate to their real workflow goal. The former local filter pills, raw empty table rows, false drag-and-drop copy, and generic loading surfaces have been removed or corrected without altering endpoint calls or mutation payloads.
- Tasks previously displayed fabricated metric fallbacks when real counts were zero. Those values now report the actual API totals, so a clear task inbox reads as intentionally clear rather than as four fictional tasks.
- Master Data and Audit Log remain the significant administration tables still using their legacy direct-table composition. Integrations already has a card-list layout that is structurally appropriate, but its heading/card internals can use the new section/list pattern in the final admin polish wave.

### C3/C4 visual checkpoint

- Focused visual captures of CV Intake, Tasks, Pipeline Settings, Users, Audit Log, and Final Hiring Approval exposed a shell-level mobile defect at 375px: the v2 parity layer set the sidebar width variable to `0px`, while the fixed sidebar's min-content remained visible at the left edge. This caused clipped help/profile copy even though the page reported no horizontal overflow.
- The mobile shell now gives the hidden drawer a real responsive width, hides it and disables pointer interaction until the mobile navigation is opened, and preserves the full drawer when open. The corrected Users mobile capture has a clean header, page content, responsive records, and no sidebar bleed.
- The same visual review confirms the new page-family language is coherent in both themes: CV intake reads as a guided upload workflow, Tasks as an action inbox, Pipeline Settings as a configuration workspace, and approvals as compact decision records rather than generic dashboard cards.

### C5 final verification checkpoint

- Completed system-wide adoption across the remaining operational and administration surfaces: Master Data, Audit Log, Joining, Users & Roles, CV Intake, approval inboxes, License Management, Tasks, Notifications, and Pipeline Settings. Shared tables, toolbars, filters, badges, fields, skeletons, lists, section headers, responsive records, and workflow patterns are now used consistently where the page goal supports them.
- Fixed the final targeted accessibility issue found in the new route-family scan: the hidden CV Intake file input now has an explicit accessible label. The targeted axe scan passes 36/36 checks across nine newly standardized routes, both themes, and 375/1440 widths with zero serious/critical violations.
- The exact final source passes the authenticated browser matrix 264/264 across all static routes plus populated detail routes at 375/768/1024/1440 in light and dark themes. No overflow, console error, or failed non-auth response was reported.
- Final static gates pass: web TypeScript no-emit, Vitest (11 files / 18 tests), ESLint with zero warnings, design-token guard (65 strict files), full workspace production build, and `git diff --check`.
- The build still reports only the known large CV Intake chunk at approximately 933 kB. No new dependency was added, no archive was created, and no route, API, auth, permission, data-contract, or workflow behavior was changed by this adoption pass.

## Dashboard reference redesign findings - 2026-08-20

- **RF-DASH-001 / P2 / presentation composition:** The live dashboard has truthful data surfaces but does not yet match the supplied compact reference hierarchy. Root cause is page-local KPI/list/chart composition and legacy dashboard polish CSS, not missing backend data. The minimum-risk fix is a dashboard-only composition using existing shared MetricCard, FunnelChart, TrendBarChart, DonutChart, PageState, and a new section wrapper.
- **RF-DASH-002 / P2 / available overview contract:** `GET /reports/overview` already supplies comparison-aware KPIs, trend points, funnel stages, hiring-by-position, and organization-scoped filter options. No schema or endpoint change is currently justified.
- **RF-DASH-003 / P2 / reference naming:** The reference says “Top Hiring Departments,” but the API persists position-based values. The redesign must label the visual as “Top hiring positions” (or equivalent) and must not invent department data.
- **RF-DASH-004 / P2 / task risk semantics:** The task API exposes overdue, priority, status, due date, and title but no aggregate SLA category/count fields. The redesign can truthfully show at-risk task records and their real overdue/priority signals; it must not fabricate counts such as “8 overdue.”
- **RF-DASH-005 / P2 / scope:** The first implementation slice is dashboard-first plus shared component reuse in a related operational page. Full route-by-route redesign remains a follow-up unless verification shows the shared change affects additional pages safely.

### Dashboard implementation checkpoint

- RF-DASH-001 resolved in the dashboard slice: the new layout uses shared semantic components and scoped dashboard composition CSS instead of the former page-local KPI wall, MagicBento surface, and raw list treatment.
- RF-DASH-002 resolved without contract changes: the dashboard reads current-period and six-period data from the existing `/reports/overview` endpoint and keeps existing request/vacancy/task endpoints for their dedicated live surfaces.
- RF-DASH-003 resolved: the distribution panel is titled “Top hiring positions” and uses `hiringByPosition.joined` only.
- RF-DASH-004 resolved: the risk panel shows the actual returned task records and a derived count of displayed flagged records; it does not claim unsupported SLA aggregate counts.
- RF-DASH-005 resolved for the selected scope: Reports now reuses `DashboardSection`, while broader route redesign is intentionally deferred for a later evidence-based wave.

### Visual verification refinement

- The first focused screenshots passed runtime, overflow, and serious/critical accessibility checks, but exposed a layout issue in the shared funnel when six API stages were rendered against a five-column desktop grid. The grid now adapts to six stages.
- The attached reference uses a simple atmospheric background. Existing shared shell art introduced geometric lines, so the background now uses only the semantic canvas gradient plus the existing two soft animated radial fields; reduced-motion and visibility pause behavior remain unchanged.
- The hiring-position donut was reduced at the dashboard composition level so its legend remains within the compact three-column work grid at desktop widths.
- The shared funnel now suppresses conversion percentages when persisted stage counts are non-monotonic, showing “Stage volume” instead of rendering impossible rates such as 300% or 500%.

### Final status

- The selected dashboard redesign slice is verified and complete. No P0/P1 blocker was introduced.
- Remaining scope is product expansion rather than a confirmed defect: applying the reference composition to additional page families would require separate route-by-route evidence and should continue using the same shared primitives.
## Current Reference Reconciliation

Updated: 2026-08-20
Branch: main
Working tree: dirty

### Confirmed current findings

| ID | Status | Evidence | Impact |
|---|---|---|---|
| RF-QUICK-001 | Current | QuickCreateMenu.tsx:21-42 | Quick New uses a fixed action list (/vacancy-requests/create, /candidates, /cv-intake, /interviews, /offers/create) |
| RF-PROFILE-001 | Current | App.tsx route inventory | No personal profile route exists; AuthController GET /auth/me returns UserProfile |
| RF-THEME-001 | Current | App.tsx ThemeToggle | Dual-mode light/dark system exists |
| RF-SIDEBAR-001 | Current | AppShell.tsx:34-63 | Sidebar has Interviews and Calendar |

### Stale or superseded findings

| Finding | Previous statement | Current reality | Action |
|---|---|---|---|
| RF-BE-001 | Cross-Tenant Leakage | Fixed in previous phase | Mark resolved |
| RF-FE-001 | Fake Metric Numbers | Replaced with zero coalescing | Mark resolved |
| RF-FE-002 | Hardcoded branch selection | Fixed in previous phase | Mark resolved |
| RF-AUTH-001 | Permission Denial for Recruiters | Fixed in previous phase | Mark resolved |
| RF-FE-003 | Hardcoded Dummy Currency | Fixed in previous phase | Mark resolved |
| RF-BE-002 | Missing Branch/Position perms | Fixed in previous phase | Mark resolved |
| RF-UX-001 | Missing Frontend Route Guard | Fixed in previous phase | Mark resolved |
| Theme constraint | Light mode only | Dual-mode system exists | Mark superseded |

## 2026-08-20 - Strict targeted enhancement audit

- The strict prompt is scoped to three targeted areas only: unified Interviews navigation/workspace, authenticated personal Profile & Settings, and the Quick New action system. The existing dashboard design system remains the visual authority.
- `AppShell` currently has one `Interviews` sidebar entry but no internal list/calendar view navigation, while the route pair already exists and must remain deep-linkable. Notifications is already absent from the sidebar and remains header/direct-route accessible.
- The current account/avatar is decorative/non-navigating. No `/profile` route exists, and no personal preference endpoint or persistence fields exist in the current auth/users implementation.
- The current Prisma `User` model has `displayName`, `email`, `organizationId`, roles through `UserRole`, `lastLoginAt`, and authentication state, but no timezone/date/time-format, motion, or notification-preference fields. A forward-only migration is required for truthful preferences.
- `QuickCreateMenu` already exposes only supported vacancy, candidate, CV intake, interview, and offer destinations, but its action shape has no stable ID, explicit destination kind, mobile availability, context requirement, or focus-return contract. It also navigates to global interview/offer creation without inventing application context; that behavior must be made explicit and blocked when context is unavailable rather than mocked.
### 2026-08-20 — Strict targeted enhancement implementation checkpoint

- The AppShell now has permission-aware navigation, keeps Notifications in the header, exposes Profile & Settings through the account surface, and renders the shared Quick New menu.
- Remaining UI work is concentrated in the shared Interviews workspace navigation, the `/profile` self-service page, the typed Quick New registry/focus behavior, and responsive styling.
- Existing Interviews and Calendar pages still use the real `/interviews`, `/applications`, and `/users/interviewers` contracts. The Interviews page still has an unsafe error cast and an implicit first-application selection that must be removed for truthful Quick New behavior.
- The current ThemeContext supports persisted light/dark mode but not a persisted user reduced-motion preference; a small extension is appropriate for the new profile preferences without adding a dependency.
### 2026-08-20 — Initial compile checkpoint

- API TypeScript validation passed with `npx --yes pnpm@11.9.0 typecheck` from `apps/api`.
- Web has no `typecheck` package script; the equivalent `npx --yes pnpm@11.9.0 exec tsc --noEmit` passed from `apps/web`.
- Repository-wide `git diff --check` is not clean because pre-existing modified files contain trailing whitespace. This is not being normalized globally to avoid overwriting unrelated user work; changed-file validation remains necessary.
- Prisma schema validation passed earlier. Prisma client generation remains environment-blocked by an EPERM rename of the Windows query engine while the local API process is running; the generated declarations already contain the new preference fields.
### 2026-08-20 — Runtime matrix environment findings

- The first browser run initially targeted an unrelated application on port 5173 (Saudi German Hospital). A focused RecruitFlow Vite server was started on `127.0.0.1:4173` for valid runtime evidence.
- The first focused matrix against the existing API process showed `/me/profile` and `/me/preferences` as 404 because that process was compiled before the new controller. A second API instance was started on port 3001 from the freshly built API output for the next run; the original process was not terminated.
- The first matrix also exposed pre-existing shell overflow from decorative `.edge-light` elements and existing dashboard Axe contrast findings. These must be separated from changed-route failures rather than hidden by disabling checks.
### 2026-08-20 — Changed-route runtime gate

- After applying `20260820_profile_preferences`, authenticated API checks passed for `/me/profile` and `/me/preferences`; unauthenticated `/me/profile` correctly returned 401.
- The changed-route matrix passed 24/24 checks across light/dark themes and widths 375, 768, 1024, and 1440 for `/interviews`, `/interviews/calendar`, and `/profile`.
- Quick New browser interaction verified five supported actions, context hints for interview/offer actions, Escape dismissal, and focus restoration to the trigger.
- The full root/dashboard matrix still reports pre-existing contrast findings in dashboard chart/status utilities. Those were not broadly rewritten because this controlled change is scoped to navigation, interviews, profile/preferences, and Quick New.

## 2026-08-23 — P0 remediation implementation findings

- The independent baseline was 258/264, not 264/264. The failures were serious light-mode contrast findings on Candidates, Applications, and Reports at 375px and 1440px.
- The browser runner did not cover the required 430px and 1280px widths. The matrix now covers six widths and runs selected Axe routes at every width.
- The contrast root cause was the shared `.rf-page-eyebrow` and `.rf-page-header p` parity override using `--color-ink-400`; moving those shared roles to `--color-ink-500` removed the failures. Alert body text also no longer applies an unnecessary alpha blend.
- Vacancy Overview labeled a Pre-Hire application as a confirmed hire. The Hires tab now uses the existing `Joined` workflow stage and derives its count from the returned applications.
- Offer list/detail pages still displayed version `1` when no current version existed. Those displays now show `—` while preserving real version numbers.
- Authentication rate-limit state was process-local. A forward-only `auth_rate_limits` table now stores hashed account/IP keys, attempt windows, and lockout expiry. A fresh API process confirmed the lockout remains active after restart.
- The database integration harness now supports `RECRUITFLOW_API_PORT` while preserving port 3000 as the default, allowing CI and local verification to target the intended API build.
- Final fresh verification passed 396/396 browser route checks across light/dark and widths 375, 430, 768, 1024, 1280, and 1440. Database/security verification passed 93/93 auth checks, all 10 isolation checks, and all RBAC scenarios.

## 2026-08-24 — Bulk Import Center findings

- The existing candidate JSON import pipeline was the safest persistence path for candidate rows, so workbook confirmation delegates to that service. This preserves candidate audit and duplicate behavior.
- Vacancy imports must not create active openings directly. The current business workflow requires a Vacancy Request followed by submit/approval; the importer therefore creates Draft Vacancy Requests and leaves workflow decisions human-controlled.
- `CandidateImportJob` is reused as the import-job ledger and now carries dataset/source metadata so existing CV Intake history remains candidate-only while the new center shows both supported datasets.
- The forward-only `20260824_bulk_import_center` migration adds dataset, source format, worksheet, file size, checksum, and a dataset/organization/created-at index to import jobs.
- No direct Excel parser existed in the API workspace. The API now uses `xlsx@0.18.5` server-side; it is not shipped in the web bundle.
- The importer rejects files over 25 MB, workbooks over 25,000 data rows, duplicate headers, empty workbooks, and formula cells. Candidate and vacancy reference resolution is organization-scoped.
- Confirmation is intentionally bounded and synchronous for this release slice. A queue/worker, resumable processing, and operational retry dashboard are still required before claiming unlimited enterprise-scale processing.
- This slice solves vacancy-list and candidate-database entry from structured spreadsheets. It does not yet implement binary CV-bank ingestion or Excel export; those are separate capabilities.

## 2026-08-24 — Operational hardening findings

- **RF-IMPORT-004 / resolved:** The screenshot's `Cannot GET /api/v1/imports/candidates/jobs` was caused by a stale API process that predated the Bulk Import Center route, not by a missing current controller. A fresh API build registered the route and the end-to-end import test passed. The frontend fallback is intentionally limited to history reads from an older local process; it does not weaken upload contracts.
- **RF-REPORT-003 / resolved:** The report export contract is now Excel-only. The API emits a real Office Open XML workbook with separate Summary, Trend, Funnel, Hiring by Position, and Recruiter Workload sheets. The UI no longer exposes CSV export. Non-monotonic funnel data is labeled as stage volume rather than producing misleading values such as 600% or 400%.
- **RF-MASTER-004 / resolved:** Omitted legal-entity, branch, and position codes are generated within an organization-scoped transaction using PostgreSQL advisory locking. Explicit codes remain supported but duplicate codes are rejected. This prevents duplicate IDs during concurrent creation without requiring a new schema sequence.
- **RF-CVBANK-001 / resolved for bounded V1:** CV Bank now has a paginated, searchable organization-scoped index, Excel manifest export, and protected file upload/download for PDF, DOC, and DOCX. The storage key is internal. The first runtime attempt exposed a CommonJS default-import bug in `node:path`; changing to a namespace import fixed the actual 500 and the test now passes upload plus download.
- **RF-CVBANK-002 / open / release risk:** The current implementation is a controlled local-filesystem adapter with a manifest, not a complete production backup system. Object storage, antivirus scanning, retention, signed URLs, audit/retention policy, backup/restore, and deletion/legal-hold behavior remain required before production CV data is considered durable.
- **RF-PIPE-003 / resolved:** Pipeline template/stage corrections are now auditable soft archives with edit controls. The service rejects archiving a default template or the last active stage, avoiding orphaned applications and invalid workflows.
- **RF-RLS-003 / partially resolved:** Permission-aware Dashboard data loading prevents restricted roles from seeing a red error caused by unauthorized report/vacancy calls. Organization isolation and route permission tests pass. A branch/position row-level scope model is not currently represented in the product contract and remains an explicit design decision, not an assumption.
- **RF-MASTER-005 / open at the time of the hardening slice:** Automatic codes improve manual Master Data entry but do not satisfy large reference-data onboarding. The follow-up implementation below resolves this bounded workbook-import gap with entity-specific templates, foreign-key mapping, inactive-row handling, duplicate policy, and audit-safe confirmation.
- **RF-MATCH-001 / roadmap dependency:** Current code supports CV intake, application screening, interview scorecards, and pipeline comparison. The dedicated M6 CV-to-position matching engine is not yet present. Its safe implementation order remains structured CV fields and structured vacancy requirements, deterministic hard eligibility gates, versioned explainable scoring, evidence/missing-requirement explanations, recruiter review, and only then semantic assistance. No AI recommendation may automatically reject, advance, contact, or create an application for a candidate.

### Hardening verification note

- API, database, static, security, and browser evidence for this bounded slice is recorded in `progress.md` under `2026-08-24 — Operational hardening slice verification`. Light and dark browser checks passed at 1440, 1280, 1024, 768, 430, and 375px for Reports, CV Bank, Pipeline Settings, and restricted Dashboard behavior.
## 2026-08-24 — Master Data Import Architecture Findings

- The existing `CandidateImportJob` and `CandidateImportRow` ledger is dataset-generic in its persisted fields: the dataset is stored as a string and row payloads are JSON. Legal entities, branches, and positions can therefore reuse the audited staging ledger without a Prisma migration.
- Master Data is already protected by `MASTER_DATA_VIEW` and `MASTER_DATA_MANAGE`; the new import routes must use the manage permission for upload, row decisions, and confirmation, while retaining tenant scoping through the existing request context and Prisma access patterns.
- Branches require a legal entity foreign key. Positions may optionally reference a legal entity, but the current schema has no branch relation; the importer must resolve only relationships supported by the schema and must not invent a branch-position contract.
- Master-data codes are already generated under a PostgreSQL advisory transaction lock in `MasterDataService`. Bulk confirmation must reuse that resolver so concurrent imports cannot create duplicate generated codes.
- The current bulk-import error report is JSON converted to CSV in the browser. This conflicts with the Excel-only reporting requirement; the production path will return an actual XLSX error workbook from the API.

### Implementation findings

- `CandidateImportJob`/`CandidateImportRow` successfully support all three master-data datasets without a schema migration. The generic ledger preserves review history and keeps candidate/vacancy contracts intact.
- Master-data row validation distinguishes `Valid`, `Warning` (omitted code will be generated), `Duplicate`, and `Invalid`. Duplicate updates are allowed only when validation identifies an existing record; workbook-only duplicates must be skipped or corrected rather than silently creating another record.
- Master-data confirmation is one transaction. It locks the job, reuses `MasterDataService` transaction helpers and advisory locks, updates staged row evidence, and rolls back the job and records together if any create/update fails.
- The current schema supports Branch → Legal Entity and optional Position → Legal Entity. There is no Position → Branch relationship; the import contract does not invent one.
- API evidence confirms a recruiter receives 403 for staging, a second tenant receives 404 for another tenant's job, automatic codes remain unique, and error reports are valid XLSX responses.
- `RF-MASTER-005` is resolved for workbook onboarding. Production CV object storage/scanning/backup (`RF-CVBANK-002`) remains open and is the next implementation dependency before claiming a production CV Bank backup.

## 2026-08-24 — CV Storage Hardening Phase Baseline

- The current CV Bank stores files on a local filesystem path and exposes controlled downloads, but it has no storage-provider abstraction, content hash, file-format magic validation, malware scanner contract, retention/consent/deletion fields, or backup-readiness endpoint.
- The worker package has BullMQ and Redis dependencies but currently only logs its Redis target; it does not consume document extraction or scanning jobs. This phase will not falsely report asynchronous parsing as complete.
- Existing upload tests use a valid PDF signature and can remain compatible with stricter type validation. Existing metadata-only document creation must remain available for records whose source file is held elsewhere.
- The existing Excel manifest is metadata export, not a binary CV backup. The UI and API must label this honestly and expose readiness/missing-file information without exposing storage keys.

## 2026-08-24 — CV Storage Hardening Implementation Findings

- **RF-CVBANK-003 / resolved for bounded safety:** provider, SHA-256, scan, parser, consent, retention, and reversible archive metadata now exist; uploads are tenant-scoped, signature-checked, and never return private storage keys.
- **RF-CVBANK-004 / resolved for bounded readiness:** backup status reports stored, clean, pending, rejected, metadata-only, missing, and archived counts; both manifest routes return Excel while honestly remaining metadata-only.
- **RF-CVBANK-005 / open / P0 release risk:** local-private storage is not the approved production object-storage implementation; encryption, signed access, provider health, and restore rehearsal remain required.
- **RF-CVBANK-006 / open / P0 release risk:** deterministic signature/EICAR/macro checks are not a full malware engine. Production must connect an approved scanner and fail closed before M5.2 completion.
- **RF-CVBANK-007 / open / M5.2 dependency:** the worker does not consume document extraction jobs; parser progress/retry/version/raw text/evidence/confidence remain unimplemented.
- **RF-CVBANK-008 / partially resolved:** soft archive and download-blocking retention/consent controls exist; automated retention, legal hold, deletion requests, binary backup, and disaster restore remain open.
- Prisma generation is sensitive to the user-owned API holding the Windows query-engine DLL. Normal generation failed with `EPERM`; isolated alternate-output generation enabled current API verification without terminating port 3000. This is environmental evidence, not a source defect.

Exact next work: finish object storage, approved malware scanning, asynchronous parser jobs, signed access, retention/legal-hold/deletion policy, and binary backup/restore rehearsal before deterministic M6 matching.

## 2026-08-30 — App Design and Workflow Reconciliation Findings

The supplied `docs/App Deisgn` images are a useful visual north star: they show
a coherent Odoo-style operational sequence from public job listing through
application pipeline, candidate detail, interviews, offers, joining, CV Bank,
reports, notifications, and publishing. They are not source implementation
evidence. They show static sample data in light desktop compositions only and
do not prove API contracts, permissions, tenant scope, failure states, keyboard
access, dark mode, or responsive behavior.

Current-source reconciliation found that public jobs/apply, vacancies,
candidates, CV Bank, talent pools, applications, interviews, offers, hires,
reports, administration, notifications, and pipeline settings have route
families. Dedicated candidate My Applications, Compare Candidates, Candidate
Communication Center, Career Site/Job Publishing, and Hiring Plan Overview
routes are not currently present and must be implemented in their owning
phases, not represented by static cards or navigation-only placeholders.

The design direction should be adopted as hierarchy and workflow guidance while
preserving purposeful Odoo-style List/Form/Kanban/Detail/Calendar/Approval
layouts. Do not convert every screen into the same card grid. Use real API
state, semantic Lucide icons, existing tokens, role-aware actions, and explicit
loading, empty, unavailable, error, retry, forbidden, not-found, stale, and
partial-success states. Dashboard and report values need source event set,
definition, date range, timezone, scope, and refresh/as-of time. User-facing
exports remain XLSX-only; CV metadata export is not binary CV backup.

The existing M1-G4 review remains a P0 blocker for functional security, not a
current compile failure: a fresh `pnpm typecheck` rerun on 2026-08-30 passed
for API, worker, and web. The functional findings remain: tenant context is
not proven post-authentication in all execution paths; the tenant guard is not
registered/enforced across supported resources; relationship-aware scope is
incomplete; and dedicated isolated API/browser evidence is absent. These must
be remediated before M1-G5 or M2. See
`docs/development/DESIGN_WORKFLOW_REVIEW_2026-08-30.md` for the screen map and
closure contract.

Exact next work: M1-G4 rework and independent verification, then M1-G5 Master
Data integrity, then M2 shell/design-system closure.

## 2026-08-30 — M1-G4 Plan Review Corrections

The delegated M1-G4 implementation plan was reviewed against the current
source. The plan is accepted only after these corrections are incorporated:

- `pnpm typecheck` currently passes for API, worker, and web; the earlier
  compile-failure claim was stale and has been corrected in the planning files.
- `JwtAuthGuard` calls Passport authentication and then reads `request.user`
  without awaiting the result. Tenant context therefore requires an explicit
  post-authentication fix and test; the pre-auth middleware cannot be the
  authority.
- `TenantScopedGuard` is currently only used on a small subset of routes, is
  not registered as an application guard in `CommonModule`, uses unrestricted
  dynamic Prisma access, assumes a direct `organizationId`, and currently has
  a `document` metadata name that does not match the Prisma
  `CandidateDocument` model.
- The plan now requires a typed resource/relationship policy matrix and
  service/database enforcement. A generic guard on every `:id` route is not a
  safe substitute for parent-relation checks.
- Cross-tenant resource access must follow a deliberate safe-404 policy;
  same-tenant actions still require permission and valid workflow state. The
  test plan must not assume every same-tenant mutation succeeds.
- Current route inventory includes screening, tasks, search, integrations,
  users, roles, master data, pipeline settings, nested approvals, import
  jobs/rows, documents/downloads, reports, and notifications in addition to
  the obvious candidate/vacancy/application resources.

The authoritative implementation contract and reviewer prompt are in
`docs/development/RECRUITFLOW_PHASE_EXECUTION_PLAN.md` under M1-G4.

## 2026-08-31 — Frontend scale audit and rebuild roadmap

The current Login page was inspected at 1440px and 375px against the live
development app. The scale concern is valid: desktop uses a 760px minimum card,
48px heading, 52px controls, 32px radius, and large internal spacing; mobile
has no horizontal overflow but still carries generous card/control spacing.
This is recorded as an M2 frontend foundation issue, not a tenant/API defect.

The product-wide frontend roadmap is now split into 12 stages F0-F11 in
`docs/development/FRONTEND_REBUILD_EXECUTION_PLAN.md`. The plan uses the
approved App Design compositions as a visual/workflow north star while keeping
real API state, permissions, tenant isolation, audit, consent, document
security, and human-controlled decisions authoritative.

## 2026-08-31 — F0 frontend baseline discoveries

- The frontend currently has 187 source files, with overlapping primitive
  families under `components/ui` and `design-system` (including separate
  buttons, inputs, badges, backgrounds, tokens, and related exports). F3 must
  consolidate usage without introducing a second system.
- `App.tsx` exposes authenticated route families for dashboard, users, master
  data, audit, vacancy requests, vacancies, candidates/documents, CV intake and
  bank, talent pools, imports, applications, interviews/calendar, offers,
  hiring/joining, reports, pipeline settings, targets, integrations, profile,
  notifications, tasks, and component/design-system showcases. Public routes
  include login/recovery/invitation/verification and career jobs/detail/apply.
- `tokens.css` already defines a 4/8px spacing scale and a 36px default
  control token, but Login overrides it with 52px controls, a 760px minimum
  panel, 48px desktop heading, 32px radius, and `p-12`/`xl:p-16` spacing.
- `v2-parity.css` contains broad `!important` sizing and layout overrides,
  creating a likely source of cross-page scale drift. F1 must map and reduce
  these overrides rather than blindly adding more CSS.
- No source changes were made during the F0 audit. The next audit evidence
  must capture computed dimensions and state/permission behavior for the
  prioritized route set at all six widths and both themes.
