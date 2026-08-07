# RecruitFlow Findings

## Repository

- The supplied planning and UI/UX reference pack is now consolidated under `docs/reference/` so planning, UI/UX, and design-system guidance have clear ownership.
- The old `Refrence/` root name is no longer part of the tracked repository structure.
- The GitHub remote appears to be reachable and currently has no visible branch refs, consistent with a new/empty repository.
- The repository now has a pnpm monorepo with independently buildable web, API, and worker applications.

## Approved baseline

- Frontend: React 19.2+, TypeScript strict mode, Vite, React Router, Tailwind CSS 4, shadcn/ui, TanStack Query, React Hook Form, Zod.
- Backend: NestJS modular monolith, REST/OpenAPI, Prisma, PostgreSQL 18.
- Async work: Redis + BullMQ worker.
- Testing: Vitest, React Testing Library, Supertest/Testcontainers, Playwright.

## Non-negotiable domain rules

- Position, Vacancy Request, Vacancy, Candidate, Application, Offer Version, and Hiring Case are separate concepts.
- Stage, source, recruiter, task owner, screening, interviews, offer, and outcome belong to the Application context.
- Primary Recruiter is distinct from Current Task Owner.
- Vacancy fulfillment is based on actual Joined records, not accepted offers.
- Approved/sent offer versions are immutable; material changes create a new version.
- Workflow enforcement and authorization are server-side; UI visibility is not security.
- Files are private, scanned/validated, versioned, and delivered only through temporary authorized access.
- Final Hiring Approver is configurable; no named user may be hard-coded into business logic.

## Initial implementation direction

- Start with Foundation plus Vacancy Core.
- First vertical flow: create vacancy request -> submit -> approval route -> approved request -> vacancy conversion -> assignment/headcount/status.

## Cleanup decisions

- Keep the complete UI prototype and source images as reference material, but move them out of the repository root.
- Keep the design-system implementation in `packages/design-system` and document the corresponding prototype screen instead of duplicating design assets.
- Remove Vite starter-only code/assets from the real application shell once the RecruitFlow shell is in place.
- The generated Vite starter page and its four unused assets were removed; `apps/web` now renders a RecruitFlow dashboard shell based on the approved visual direction.

## Vacancy Core implementation

- The Prisma schema already contains the first-slice entities: `VacancyRequest`, `VacancyRequestApproval`, `Vacancy`, and `VacancyAssignment`.
- The first runnable slice uses a repository interface so domain rules do not depend on Prisma client generation or a live database during local bootstrap.
- The API must enforce the state transitions server-side: Draft -> Pending Approval -> Approved/Rejected/Changes Requested, then Approved -> Converted to Vacancy.
- Conversion must be idempotent and preserve the approved headcount in the created vacancy.
- The web form uses the shared Zod schema; the Nest API uses class-validator DTOs so runtime metadata remains available to the global ValidationPipe.

## Prisma integration checkpoint

- The current API repository token can be switched without changing controllers or the domain service.
- The generated Prisma client is owned by `@recruitflow/database` and is recreated under the ignored `database/generated/` directory.
- The initial migration has been reviewed and applied to the new local `Recruitment_DB`; the database diff is now empty and no destructive table operation was used.
- Keep `VACANCY_CORE_ADAPTER=in-memory` as the safe default; introduce the Prisma adapter only after generated client and migration checks pass.
- Confirmed at runtime that constructing `PrismaClient` succeeds after generation; the earlier initialization error was caused by missing generated artifacts.
- Windows has a Zscaler Root CA installed in both the user and machine root stores, while Node/npm have no custom CA configured; this is a viable certificate-chain repair path without disabling TLS.
- The root `db:generate` script ran Prisma from the workspace root, causing Prisma's package auto-install step to target the wrong package. Prisma generation should run from `apps/api`, where `@prisma/client` is declared.
- The repeated `pnpm add` message is emitted by the `@prisma/client` lifecycle path when `.prisma/client` is still absent; generated output must be verified after the lifecycle completes, not based on the initial schema-loaded message.

## Prisma integration result

- The Windows Zscaler root certificate was exported only to the current process through `NODE_EXTRA_CA_CERTS`; TLS verification remained enabled.
- Prisma `6.19.3` now generates successfully through the `database` workspace package when `PRISMA_GENERATE_SKIP_AUTOINSTALL=1` is set.
- The generated client is intentionally owned and exported by `@recruitflow/database`; this avoids pnpm virtual-store instances being generated for one workspace and imported from another.
- `PrismaService` and `PrismaVacancyCoreRepository` are available behind `VACANCY_CORE_ADAPTER=prisma`. The default remains in-memory until migration and seed data are applied.
- A `CodeSequence` model was added so request and vacancy business codes can increment atomically through PostgreSQL instead of relying on process-local counters.
- The target `Recruitment_DB` was audited with Prisma `migrate diff` before mutation: it had no project tables, the diff contained 15 table creations, and no `DROP TABLE`/`DROP COLUMN` operations.
- The initial migration is stored at `database/prisma/migrations/20260806_init/migration.sql`; the seed uses idempotent upserts and does not delete or overwrite existing reference values.

## Full-product planning decision

- The bootstrap plan phases are not the same as full product delivery phases. The repository is currently at the end of foundation setup and the first Vacancy Core vertical slice.
- The next controlled phase is Identity/Access/Master Data. Candidate, Application, Interview, Offer, Hiring, Joining, Analytics, Administration, Mobile, and Release phases remain separate and must not be merged into one unreviewable task.
- Each phase in `docs/development/implementation-roadmap.md` has explicit scope, out-of-scope boundaries, dependencies, and acceptance gates for team handoff.

## Pre-Phase 3 audit — initial UI/UX findings

- The approved direction is an enterprise recruitment dashboard: navy/slate foundation, restrained blue action color, high-contrast surfaces, consistent Lucide/SVG iconography, visible keyboard focus, and responsive behavior at 375/768/1024/1440px.
- The current web source still contains prototype-like single-letter/text icons (`D`, `T`, `⌕`, `◉`, `⌄`, `•••`) and many `href="#"` navigation placeholders. These reduce discoverability and create dead interactions.
- Several Phase 1/2 controls are visibly present but not connected to mutations or navigation, including approval-inbox approve actions, user/role creation actions, master-data create actions, vacancy detail actions, report links, global search, branch scope, and notification controls.
- The UI uses very small body/control sizes in the shared CSS (roughly 8–10px in tables/forms), which is below a comfortable enterprise-app reading size and will hurt mobile usability and accessibility.
- Modal markup needs a proper dialog contract and focus behavior: `role="dialog"`, `aria-modal`, labelled heading, Escape handling, focus return, and a focus trap. Current `role="presentation"` is insufficient.
- Review must verify all screen states, not only happy paths: initial loading, empty data, validation, unauthorized/forbidden, server error, retry, mutation pending, success feedback, and responsive overflow.

### UI/UX evidence from implementation review

- `AppShell` mixes real `NavLink` routes with dead `href="#"` anchors, has no mobile navigation, and uses text glyphs instead of a consistent icon set. Breadcrumbs also do not cover the vacancy routes.
- `Modal` lacks dialog semantics, keyboard Escape support, focus trapping/return, and backdrop close behavior. The close glyph is also currently mojibake in the source display.
- `ApprovalInboxPage`, `VacancyRequestDetailPage`, and `VacancyOverviewPage` are still static reference-like views; visible approval, cancellation, hold, candidate, and tab controls do not perform actions or expose pending/error/success states.
- `UsersRolesPage` and `MasterDataPage` open forms whose submit buttons only close the modal; invite, role creation, and master-data creation are not wired to the API and lack validation.
- The visual language is currently purple/light and uses 8–12px text in many controls, while the generated enterprise dashboard recommendation favors a navy/slate high-contrast system and readable body text. Any visual change must preserve the approved reference intent and be applied through shared tokens, not page-specific inline styles.

## Backend and security evidence

- Authentication currently falls back to hard-coded JWT secrets when `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` is missing. This must fail fast in non-test environments; otherwise a misconfigured deployment can issue predictable tokens.
- JWT access and refresh strategies validate token version but do not reject users whose status has since changed to inactive. Deactivation therefore does not immediately stop an already-issued token.
- Refresh currently issues a new access token but does not rotate/revoke the refresh token. The phase acceptance criteria call for a complete session/token lifecycle, so rotation or an explicit documented decision is required before closure.
- Permission identifiers are inconsistent across controllers (`USERS_VIEW`/`VACANCY_REQUEST_CREATE` versus `audit:read`/`vacancy_requests:write`). They must be normalized against the seeded permission catalog or valid users will receive unexpected 403 responses.
- Master-data creation accepts related IDs without verifying that the referenced legal entity belongs to the current organization. This is a tenant-integrity risk even though the top-level record receives the current organization ID.
- `UsersService.update` uses `updateMany` and then returns the record without distinguishing “not found” from “updated zero rows”; mutation endpoints should return a deterministic 404 when the scoped record does not exist.
- Audit writes are fire-and-forget and use a generic `entityType=system`/`entityId=none`, which weakens the audit trail and can silently lose evidence on database errors. The review should improve the minimum reliable contract without widening module scope.

### Confirmed controller/seed mismatch

- The seeded permission catalog contains `AUDIT_VIEW` and `VACANCY_REQUEST_CREATE`, but the controllers currently require `audit:read` for audit logs and `vacancy_requests:write` for request creation. These endpoints will reject seeded users even when their roles have the intended permission.
- `getApproverInbox` falls back to a hard-coded list of role codes when roles are absent from the JWT actor context. Because the JWT payload currently returns only user ID, organization ID, and token version, this fallback can expose every approval role's inbox to any authenticated user who reaches the endpoint.
- Vacancy approval service transitions are not yet tied to the actual authorized approver assignment; permission presence alone is not enough to prove the actor is the pending step's assignee/role. This must be hardened before treating Phase 2 as production-ready.

### Hardening changes applied in this audit

- Added fail-fast JWT secret validation, active-user checks for access/refresh strategies, refresh-token rotation, and organization/status scoping in the permission guard.
- Normalized the audit and vacancy-create permission codes to the seeded catalog and removed the approval-inbox role fallback; the actor now carries server-resolved role codes.
- Enforced approval-step role authorization and organization checks for vacancy request references and team assignments.
- Made user creation, role creation, and master-data creation forms submit to their real API endpoints with validation, pending states, retryable errors, and refreshed lists.
- Replaced dead navigation anchors with real routes or visibly disabled future-phase items, added SVG icons, and improved modal semantics, focus management, Escape handling, and responsive form behavior.
- Replaced the static approval inbox, request detail, and vacancy overview with API-backed states. Candidate controls remain explicitly disabled until Phase 3 rather than pretending to work.

### Database gate result

- `pnpm db:validate`, `pnpm db:migrate:status`, and two consecutive `pnpm db:seed` runs passed; the database remains up to date and the seed is repeatable.
- The existing Phase 1 migration contains `DROP COLUMN IF EXISTS` statements for legacy snake_case authentication columns. No such columns exist in the current local database, so no data was removed, but the migration is a release-review item because it could discard legacy values on a differently shaped target. It is already applied locally and must not be edited in place; resolve through an explicit migration-history decision before production use.

### Remaining UI scope check

- The dashboard already has real Vacancy Core mutations, but the create-request and list pages still contain a few prototype-only controls such as `Save Draft`, `Submit for Approval`, and `View report` that need either wiring or an explicit future-phase disabled state.
- Admin CSS still uses 9–11px table/filter text and has no table overflow wrapper or mobile layout rules; the new page markup now adds accessible regions, but shared admin styles still need the final responsive/readability pass.

### Final UI cleanup items found

- A final scan found a few remaining text-glyph controls in Dashboard and directory search fields, plus Dashboard still uses a separate custom modal instead of the shared accessible dialog. These are the last consistency fixes before the UI gate is closed.

### Final audit resolution

- Resolved the final UI consistency items: Dashboard now uses the shared accessible modal, directory search fields use the shared SVG search icon, and no forbidden glyphs, `href="#"` placeholders, or default JWT secrets remain in application source.
- Dashboard, vacancy request detail, approval inbox, vacancy directory, users/roles, master data, and audit log now present truthful API-backed loading, empty, error, retry, pending, and success states within the completed Phase 0/1/2 scope.
- Shared styles now provide readable control sizing, visible focus states, mobile navigation/drawer behavior, responsive table scrolling, disabled future-phase affordances, and reduced-motion handling.
- Quality evidence: lint, typecheck, production build, Prisma schema validation, migration status, diff whitespace check, and the web test command all passed. No live authenticated API smoke result is claimed because temporary process startup was blocked by the local Windows policy.
- Historical handoff note: Phase 3 was the next implementation boundary at the time of this audit; it has since been implemented along with Phases 4–8. The current boundary is Phase 9.

### Execution-plan governance gap and resolution

- The existing roadmap had useful principles and a handoff checklist, but it did not make phase readiness, stop conditions, evidence, scope changes, or unverified checks strict enough to prevent repeat errors.
- Added a mandatory execution contract to the roadmap: Definition of Ready, schema/contracts/server/UI/test order, non-negotiable safety rules, change control, evidence gates, completion status rules, reviewer records, and a specific Phase 3 entry gate. The Phase 3 gate is now historical; the current active gate is Phase 9.

### Local API startup and route verification — 2026-08-07

- The frontend's auth 404 was initially caused by a stale API process and an invalid Nest start assumption: the compiled entry is `apps/api/dist/apps/api/src/main.js`, not `apps/api/dist/main.js`.
- The fresh API process then exposed a real runtime defect hidden by typecheck: Nest-injected classes had been imported with `import type`, producing `Function` metadata. Converted all DI classes to runtime imports and preserved lint exceptions only where required.
- Updated `apps/api/package.json` so `start` uses the compiled entry and `start:dev` builds before launching it.
- Verified the live routes without credentials: `/api/v1/health` returns 200, `/api/v1/auth/me` returns 401, and `POST /api/v1/auth/login` with an empty object returns 400 validation instead of 404.

## Phase status reconciliation — 2026-08-07

- The repository now contains implementation modules, routes, shared contracts, and migrations spanning Phases 3–8. The previous documentation still described Phase 3 as the next target, so the roadmap, task plan, and progress log were out of sync with the working tree.
- The project owner confirmed that implementation should now move to Phase 9. Phase 0–8 are therefore recorded as implementation-complete, while the remaining lint, automated-test, runtime-smoke, and release-review items remain tracked as technical debt and Phase 10 release gates.
- Phase 9 is the active phase and is limited to responsive/mobile behavior, themes, accessibility, UI state completeness, and removal of remaining placeholder interactions. It must not expand into new business-domain features.
- Current verification evidence remains: typecheck passed, production build passed with a Vite chunk-size warning, Prisma validation and migration status passed, while the repository-wide lint command currently reports 109 errors. No project test files or test scripts were found, and the API was not running during the latest health check.

## Comprehensive phase audit — 2026-08-07

Initial inventory findings:

- The API is wired with modules for Candidates, Applications, Documents, Screening, Interviews, Offers, Hiring, Talent Pool, Import, Reports, Pipeline Settings, and Integrations.
- The web app exposes routes for the same domains plus Design System and States/Feedback pages.
- The migration directory contains `20260806_init`, `20260806_phase1_auth`, `20260807_phase3_candidate_application`, `20260807_phase4_documents_interviews`, and `20260807_phase5_offers`; no separate Phase 6–8 migration directories were found in the initial inventory.
- The repository has package build/typecheck scripts but no project test scripts or discovered test files in the current baseline.
- One inventory command used Bash-style wildcard assumptions in PowerShell and failed with an OS path syntax error; no project state was changed by that command.

Quality gate results:

- `pnpm lint` failed with **109 errors / 0 warnings**. The dominant categories are invalid type-only import style, `no-explicit-any`, unused variables/parameters, and a useless assignment across the Hiring, Import, Integrations, Offers, Pipeline Settings, Reports, Talent Pool, and related frontend pages.
- `pnpm typecheck` passed for the worker and API workspaces.
- `pnpm build` passed for worker, API, and web. Vite emitted a bundle warning: the main JavaScript chunk is **544.55 kB** after minification.
- `pnpm db:validate` passed.
- `pnpm db:migrate:status` passed; five migrations are applied and the database is up to date.
- `git diff --check` failed on three added trailing-whitespace lines in `packages/contracts/src/index.ts` (lines 702, 708, and 711 in the current working tree).

Database/release-risk findings:

- The current Prisma schema includes Hiring, Compliance, Talent Pool, Candidate Import, Pipeline Template/Stage, and Integration models, but the migration inventory has no dedicated forward migrations for those Phase 6–8 models.
- `20260807_phase5_offers/migration.sql` contains legacy-column drops on `users` (`last_login_at`, `password_hash`, `token_version`) in addition to offer tables. This is a migration-history/data-preservation risk and must be handled with an explicit forward-migration decision before production.
- A read-only schema-to-migration diff is required before any phase can be called database-complete; `migrate status` alone only confirms the migration history is marked applied, not that every current schema model has a reviewed migration.
- The live `_prisma_migrations` table contains three records for `20260807_phase5_offers`: two rolled-back failures and one successful application. The failures include a BOM syntax error and an embedded-null encoding error. This is a **P1 migration-history/release risk** even though the latest status command reports the database as up to date.
- The live database contains tables for Hiring, Compliance, Talent Pool, Candidate Import, Pipeline Settings, and Integrations despite no corresponding migration files in the repository inventory. Their provenance must be established and captured in reviewed forward migrations or an approved baseline decision.

Backend authorization and workflow findings:

- `HiringController`, `TalentPoolController`, `ImportController`, `ReportsController`, `PipelineSettingsController`, and `IntegrationsController` use `JwtAuthGuard` but define no `@RequirePermissions` metadata or audit actions. Because the global permissions guard returns true when no permission metadata exists, any authenticated user can call these business endpoints. **P1 authorization gap.**
- `HiringService.decideFinalApproval` finds a pending `HR_DIRECTOR` approval but does not verify that the current actor has the required role/permission or is the assigned approver before approving/rejecting. **P1 approval bypass.**
- `HiringService.confirmJoining` increments vacancy `joinedHeadcount` outside a transaction and without an idempotency/state guard. Repeating the Joined request can increment headcount more than once; the vacancy update is not explicitly organization-scoped. **P1 data-integrity risk.**
- `HiringService.createHiringCase` performs case creation, application stage update, and history creation across separate writes rather than one transaction, so a partial failure can leave inconsistent state.
- `TalentPoolService.addCandidate` verifies the pool organization but does not verify that the candidate belongs to the same organization before creating membership. **P1 tenant-integrity risk.**
- `ReportsService` returns hard-coded funnel, department, recruiter, and KPI values. Two database counts are calculated but unused. Reports therefore do not satisfy the roadmap requirement that numbers match transactional data. **P1 functional gap.**
- `IntegrationsService.getIntegration` returns the raw integration record, including `configJson`, while the roadmap requires integration secrets never be returned to the browser. **P1 secret-exposure risk.**
- `IntegrationsService.testIntegration` always returns success without testing a provider connection. This is a fake success path and violates the roadmap's no-fake-feedback rule.
- `OffersController` also has only `JwtAuthGuard` and no permission metadata, so offer creation, revisions, status changes, and approval decisions are callable by any authenticated user. The service-level approval check does not protect list/create/status operations. **P1 authorization gap.**
- `ApplicationsService.createApplication` validates vacancy and candidate organization but does not validate `primaryRecruiterId` or `taskOwnerId` against the current organization. **P1 tenant-integrity risk.**
- `InterviewsService.createInterview` accepts attendee user IDs without verifying that they belong to the same organization; scorecard submission does not verify that the actor is an assigned interviewer. **P1 authorization/tenant risk.**
- `DocumentsService` is metadata-only: it accepts a client-supplied `storageKey`, uses a hard-coded file size, marks every upload `Clean`, and returns storage metadata directly. There is no actual private object-storage upload, virus scan, temporary authorized download, versioning, or recoverable scan failure path. **P1 Phase 4 acceptance gap.**
- `ImportService.confirmJob` performs row mutations without a transaction or idempotency key, uses time/random candidate codes, and can partially commit. The `NewApplication` decision creates another candidate rather than an application, and duplicate email/case normalization is not robust. **P1 data-integrity/acceptance gap.**
- `PipelineSettingsService` reports `vacancyCount: 0` as a dummy value and has no audit trail for configuration changes. **P1 functional/audit gap.**
- Approval role identifiers are inconsistent: the seed uses role codes such as `HR_MANAGER` and `FINAL_HIRING_APPROVER`, while offers create approvals with `HR Manager` and hiring creates `HR_DIRECTOR`. These approvals will not reliably resolve to seeded roles and can make inboxes empty or final approval unreachable. **P1 workflow configuration gap.**

Repository hygiene:

- The working tree contains **56 modified/untracked entries**, including all newly added domain modules and migrations. There is no clean, reviewable Phase 9 baseline or focused PR boundary yet.
- The latest local commit is the roadmap commit; the Phase 3–8 implementation currently exists as uncommitted working-tree content. This prevents reliable rollback, review attribution, and phase-by-phase change isolation.

Audit tooling notes:

- The Python Playwright package was installed for local verification because it was absent. Chromium download was not used because the local TLS issuer blocked the download; the installed Chrome executable was used instead.
- The authenticated browser run was intentionally not claimed after the API bootstrap failure. The isolated frontend run verified only Login validation and recorded the expected API connection failures.

Runtime startup finding:

- `pnpm --dir apps/api start:dev` fails during Nest bootstrap with `UnknownDependenciesException` for `HiringService` because `HiringModule` does not import/export `DatabaseModule`. The same missing `DatabaseModule` import is present in `TalentPoolModule`, `ImportModule`, `ReportsModule`, `PipelineSettingsModule`, and `IntegrationsModule`. **P0 local runtime blocker for Phases 6–8 and all authenticated browser workflows.**
- The frontend browser audit could not run with both servers because the API failed to reach port 3000 within 60 seconds. This is recorded as unverified browser/runtime evidence, not a passing result.

Frontend/browser findings:

- The isolated browser audit reached the Login page successfully. Missing email/password submission produced inline messages (`Enter your email address.`, `Enter your password.`) and focused `login-email`, so the specific login UX defect reported earlier is fixed.
- The same browser audit recorded `ERR_CONNECTION_REFUSED` for `/api/v1/auth/me` and `/api/v1/auth/login`; authenticated route, responsive dashboard, mobile drawer, and protected-page browser evidence remain unverified because the API cannot bootstrap.
- No dark-theme implementation or theme persistence was found in `apps/web/src`; the stylesheet has responsive media queries but no theme variables/mode switch.
- `ImportPreviewPage` uses a local `mockRecords` dataset instead of the import API.
- `HireManagementPage`, `JoiningManagementPage`, and `LicenseManagementPage` contain visible Export/Add License controls without corresponding end-to-end handlers. This violates the no-dead-action rule and is in Phase 9 scope.
- `App.tsx` has no catch-all not-found route, so unknown client routes do not have an explicit error/recovery state.
- Responsive styles and accessible modal primitives exist, but cross-page mobile, keyboard, contrast, and screen-reader behavior could not be approved without authenticated browser evidence.

## Remediation pass — 2026-08-07

The confirmed runtime, authorization, integrity, fake-data, UI, and lint defects were addressed in the working tree and re-verified.

### Fixed and verified

- Nest API startup now resolves all Prisma-backed module dependencies. Health returns `200`, unauthenticated `/auth/me` returns `401`, and the authenticated browser flow completes successfully.
- Phase 3–8 route metadata now includes permission and audit coverage for the reviewed offers, hiring, talent-pool, import, reports, pipeline-settings, and integrations routes.
- Organization ownership is enforced for recruiter/task-owner assignments, interview attendees, scorecard authors, and talent-pool membership. Hiring approval, joining, offer status transitions, and import confirmation now enforce workflow/state rules and transactional boundaries.
- Approval role identifiers were normalized to seeded role codes, including offer approval and final hiring approval.
- Import candidate codes now use the database sequence; duplicate rows are detected; confirmation is guarded against repeated processing and partial commits.
- Reports now read organization-scoped records, integrations no longer expose configuration or claim an unconfigured connection succeeded, and document metadata/file constraints are validated without falsely marking a document clean.
- Mock import/report/hiring/joining data and misleading actions were removed or replaced with live API calls and explicit unavailable/future states. A catch-all not-found screen is present.
- Lint/typecheck/build, Prisma validation/status, diff hygiene, and the code-quality checker pass. The web build retains a non-blocking chunk-size warning.

### Fresh browser evidence

Authenticated Playwright coverage passed for the main routes, login missing-field validation/focus behavior, 404 recovery, basic input/button accessibility, mobile navigation, and responsive widths 1440, 768, and 375 without horizontal overflow. The only console messages were the expected pre-login `401` auth checks; no request failures were recorded.

### Remaining release risks

- Candidate documents still store metadata only; private object storage, real upload, virus scanning, and authorized download are not implemented.
- License management has no backed domain/API yet, so its controls remain explicitly unavailable.
- No automated unit, integration, or E2E test suite exists; this is the next release-hardening item.
- The live database matches the current Prisma schema, but Phase 6–8 schema provenance is not represented by separate forward migration directories. This requires an approved baseline/reconciliation decision before production release; no applied migration was edited.
