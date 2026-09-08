# Testing readiness findings — 2026-09-07

## Deployment preparation findings

- Clean PostgreSQL replay found an obsolete unique assignment index: DROP CONSTRAINT in a prior migration never removed the actual index. Added an additive migration; aligned declared defaults/indexes to existing history. All 30 migrations apply, with no Prisma schema drift.
- Production image built successfully on Linux. Subsequent container creation failed with Docker engine I/O errors, followed by a read-only metadata filesystem and Docker Desktop unavailable. Runtime/proxy/volume smoke verification remains blocked by that local engine failure, not a passing result.
- An external commit incorporated earlier workspace changes during this task; preserve it and all subsequent edits.

- No Dockerfiles, compose or production reverse proxy configuration exist in the repository.
- Web already defaults to /api/v1; Vite dev proxy does not provide production routing.
- API reads PORT but defaults to 3000. Health routes are /api/v1/health and /api/v1/readiness.
- Supplied report is reference material for another app: its domains, demo seeds and db push --accept-data-loss must not be copied.
- Docker Linux engine is available for isolated verification.

## Current activity review findings

## Independent review after Luna implementation - 2026-09-08

- The delegated version-one slice was reviewed against every phase in `docs/version-one-simplification-plan.md`; no data reset, demo-user creation or external delivery occurred.
- Cross-layer minimum-contact handling is verified for CV intake, candidate API, import and public apply. Email remains unique when present; phone matching uses normalized digits and preserves existing records.
- The review found and fixed two defects before handover: public phone duplicate lookup could select an unrelated candidate because of a nullable-phone OR query, and Master Data paste edits did not reliably mark rows dirty. Regression smokes now cover both cases.
- Final local evidence: web/API/worker tests 153/58/4, typecheck, lint, production builds, current migration status, read-only API audit, and 28/28 browser checks across light/dark desktop/mobile widths. Candidate activity, public phone dedupe, Master Data optimistic concurrency and interview-title persistence smokes all pass.
- Remaining follow-ups are performance/session gates only: CSS/design-token budgets and a prior long-session 401 burst. They are documented in the independent review and should be addressed before a production release.

- Planning follow-up: report endpoints pass organization alone, requiring shared user scope; new role fallback is ALL; role-policy save must preserve userResponsibilities; candidate creation requires actor propagation for private intake; vacancy assignment currently replaces all members for one role code. These are covered by docs/uat-enhancement-plan.md.

- Final verification: persisted cross-application activity smoke and browser workflow passed; 55 API, 141 existing web + 4 new panel, 4 worker tests passed. Types/lint/build pass. Matrix 382/396 with 14 accessibility failures. CSS budget failure 406.24 KiB. See docs/system-review-2026-09-07.md for strengths, code-derived P1 findings and untested external integrations.

- Implemented a candidate-level activity service over existing Task rows (CandidateActivity prefix), with CANDIDATE_VIEW/CANDIDATE_EDIT guards, server-owned actor and tenant, active-assignment and branch/department scoping, PII text masking, and salary-free event projections.
- Added totals, per-recruiter and per-type breakdown, overdue/next follow-up, last completed activity, paged timeline and one-form log/schedule/complete flow. Application notes, screenings and locked interview scorecards feed the count; automatic changes/interview schedules are events only.
- Drawer fake chatter and fabricated resource counts removed; fake email sending, assessment saving and employee creation were replaced with truthful activity logging or links to actual workflows.
- Existing task creation validates neither referenced entity tenant nor assignee tenant. Existing application notes call getApplication without user context. These remain higher-priority review findings outside the new activity endpoint.
- Generic Tasks page now links Candidate tasks to the candidate activity panel.

- Candidate drawer seeds two fictional chatter entries; calls, notes, email, scheduling, scorecards and employee conversion currently only change local state. Those entries disappear on reload and cannot measure recruiter work.
- Real persisted sources exist: application notes, screening logs, interview records, status history and tasks. Scheduled work must not be counted as completed work.
- Task creation requires VACANCY_MANAGE and explicitly rejects recruiter-only roles, so a recruiter self-follow-up flow needs a narrowly scoped endpoint.
- Candidate profile fetches only the first applications page and downloads all interviews/offers before filtering. Candidate activity must aggregate server-side across accessible applications without this truncation.
- Existing application RLS handles ASSIGNED_ONLY but does not enforce BRANCH/DEPARTMENT in its list/detail logic, and its vacancy assignment check includes inactive assignments. Record as system review risks; the new activity path must apply the scope helper and require active assignments.

- Monorepo: React/Vite frontend, NestJS API, Prisma/PostgreSQL, BullMQ worker.
- Existing uncommitted change: application stage audit action renamed to APPLICATION_MOVE_STAGE; preserve.
- Local PostgreSQL and Redis are listening; frontend/API default ports were not running initially.
- Existing browser matrix covers routes, themes, responsive widths and axe checks.
- README describes in-memory default, but setup documents Prisma as required for release verification.
- Initial unit suites pass: web 140, API 43, worker 4.
- Initial build/type check failed on unsupported icons and component variants; lint reported 54 errors. Corrected component values and removed unsafe types without suppressing lint.
- All 22 database migrations are applied on local Recruitment_DB.
- Old browser credentials were stale. Current development login uses the administrator persona; matrix now supports environment overrides.
- Offers lacked vacancyId required by the requisition filter. Added it to API summaries/details and the shared contract.
- Employee dashboard included other requesters when fewer than six records existed. Removed that fallback.
- User responsibility update used an untyped body, bypassing its class-validator DTO; wired existing DTO.

## Verification evidence
- `pnpm typecheck` passed with no errors.
- `pnpm lint` passed with no errors.
- `pnpm build` passed for API, web, and worker. Vite emits its existing chunk-size advisory for large lazy parser/report chunks.
- Root unit tests passed: web 140/140, API 43/43, worker 4/4.
- Local `Recruitment_DB` is current at all 22 migrations.
- Isolated QA database `recruitflow_readiness_20260907` migrated from empty and was seeded successfully.
- Security matrix passed 93/93; cross-tenant isolation 10/10; RBAC 11/11; hardening, bulk/master-data, and CV storage suites passed.
- Email outbox passed 22/22; workflow notifications 5/5; production recovery boundary 4/4; public acquisition 19/19.
- Full browser matrix passed 324/324 across 27 routes, six viewport widths, light/dark themes, overflow, console/network, and critical/serious axe checks.
- Final smoke check: `/api/v1/health` and `/api/v1/readiness` returned 200; local admin login returned 200; repository code-quality checker reported 0 findings.
- Baseline non-blocking repository gates included the raw CSS budget and legacy palette usage. The bundle gate now enforces compressed transfer sizes and passes; `pnpm check:design-tokens` still reports the pre-existing legacy palette migration backlog. These do not prevent local functional testing.

## Dynamic VL workbook

- Source workbook: `D:\Manpower\VL.xlsx` (88,744 bytes), with sheets `Rowdata`, `UAE VL `, `Sheet1`, `Sheet2`, and supporting KPI/empty sheets.
- `Rowdata` contains the operational columns needed for positions and vacancy requests, including `Entity`, `Position`, `Department Name`, `Section`, `Level`, `Status`, `Type`, `Planned`, `Current`, `Vacant`, `Total need`, `FTE`, and compensation fields.
- `UAE VL ` contains vacancy-list rows such as Head of treasury and OPD Coordinator; several rows are held or have no open headcount. Import must select only open/representative rows.
- Existing API bulk import supports `positions` and `vacancy-requests` with workbook inspection, validation, duplicate handling, and tenant-scoped confirmation. The imported sample will use this path rather than frontend constants.

### Dynamic VL sample implementation

- Added `scripts/import-vl-sample.cjs`, which reads the workbook at runtime, selects a bounded set of distinct open rows, writes reviewable CSV payloads, and uses the authenticated import review/confirm APIs. It does not import the full workbook.
- Imported six open Rowdata positions: Senior SEO Specialist, RCM Analyst, Senior IT network adminstrator, IT Application Engineer, General Accountant, and Quality Assurance.
- Created and approved six vacancy requests, converted them through the existing workflow, enriched each vacancy with source-derived department/location and recommended skills, and opened them for CV intake. Source row/sheet references are retained in request text.
- Added `scripts/enrich-vl-sample.cjs` for repeatable source-derived requirement enrichment without hardcoded vacancy records.
- Removed fabricated CV presets, notification records, applicant portal records, and report fallback metrics. Empty states now reflect API results.
- `apps/web` typecheck, build, and root lint pass after the dynamic-data changes.

## Admin-only RBAC audit — 2026-09-07

- `User`, `Role`, `Permission`, `UserRole`, and `RolePermission` currently allow many seed users and a shared system role catalog. `Permission` is global today, so administrator-created permission names require a tenant-aware model change.
- The current seed creates eight organization users, twelve system roles, and a broad permission catalog; the local administrator account is `10000000-0000-4000-8000-000000000000` (`admin@sgh.com` in the seed, with the active local test login configured separately).
- Role mutations currently reject shared system roles, and role creation only accepts code/name. There is no persisted sidebar visibility model, so the sidebar is hard-coded in `AppShell.tsx` and uses coarse legacy role checks.
- Route authorization is server-side through `RequirePermissions` and client-side through `PermissionGate`; the server must remain authoritative when sidebar visibility is customized.
- The existing `Integration` JSON configuration is already used for RLS policies and user overrides, but it is not suitable as the sole source for discoverable permission definitions or navigation metadata.
- User deletion is not currently exposed as an API operation. Many business tables reference users with restrictive foreign keys, so safe cleanup should remove user-role/session/auth rows and mark non-admin users inactive (or delete only unreferenced accounts), preserving audit/business history.

## Admin-only RBAC implementation — 2026-09-07

- Added tenant-local permission names and custom permission definitions while retaining the shared system permission catalog for stable route/API guards.
- Added persisted `ACCESS_CONTROL_CATALOG` role visibility/name overrides and `NAVIGATION_SETTINGS` label/visibility settings in the existing organization-scoped Integration JSON store.
- Role and permission mutations are admin-gated by `ROLES_MANAGE`; shared system roles/permissions remain immutable. Custom roles can be named, renamed, assigned natural permissions, and deleted.
- The sidebar now consumes the navigation catalog at runtime. Visibility and labels are organization settings; direct routes and server endpoints still enforce natural permissions independently.
- Local cleanup keeps the administrator and historical foreign-key integrity: inactive accounts are not shown in the active directory, organization custom roles are removed, and the 27 shared permission definitions remain available for creating restricted profiles.
- Live smoke verified one active admin user, one visible role, 27 permissions, 21 navigation entries, custom role/permission lifecycle, and sidebar hide/restore.

## CV intake and recruiter screening fix — 2026-09-07

- `POST /candidates` used Nest's whitelist validation while the CV intake flow sent `summary`; the field was rejected before the service ran. Candidate DTOs, Prisma schema, contracts, service mapping, and migration now support an optional 5,000-character summary.
- Screening logs now persist `noticePeriodDays`, `expectedSalary`, `currentSalary`, and `salaryCurrency` alongside the existing outcome and recruiter notes.
- Screening list/create responses always include notice period and outcome/notes. Salary numbers are returned only when the authenticated user has `VIEW_CURRENT_SALARY`; the API, rather than the browser, is the disclosure boundary.
- The candidate drawer loads the latest screening record dynamically, clears stale values when switching applications, and posts the recruiter-entered details.
- A service-level permission smoke confirmed that a caller without `VIEW_CURRENT_SALARY` gets null salary values and cannot persist submitted salary numbers; an administrator request returns the entered values.
- Migrations are current at 25 and the live API smoke passed for candidate summary and screening compensation fields.

## Vacancy assignment persistence fix — 2026-09-07

- The manager dashboard previously created only a target task and updated local React state. It never called `POST /vacancies/:id/assignments`, so a refresh or another page correctly showed the vacancy as unassigned.
- The assignment endpoint also passed an in-memory assignment list to a repository method that upserted only vacancy scalar fields. Assignment rows were therefore discarded before the response was re-read.
- Vacancy list responses omitted the related user, while the Command Center and vacancy list expected `assignments[].user.displayName`.
- The fix synchronizes assignment rows in the same Prisma transaction, deactivates replaced active rows, returns active assignments with the user's id/display name, and submits the real assignment before the optional task.
- The manager selector now offers open vacancies only, preventing assignment to closed/filled records.
- API/database and browser round-trip smokes passed; all temporary assignment rows were removed after verification.

## Full scope and dynamic-data hardening — 2026-09-07

- Candidate, vacancy, application, screening, interview, offer, hiring, document, task, export, and report paths now receive the authenticated actor and reuse the canonical organization/assignment visibility predicates. Search clauses are combined with visibility using `AND`, so a search term cannot widen a scoped result set.
- Candidate detail linked resources use candidate-filtered API queries. Application history requests the API maximum page size (100) so the profile does not silently stop at the default first page.
- Candidate activity allows the uploader to work with a private candidate before an application exists while denying unrelated users without an accessible application. Completed activity counts and timeline entries remain server-derived.
- Vacancy assignment and task creation validate scoped linked records and create related notifications in the same transaction. The old role-name-only task gate was removed; action permissions are authoritative.
- Reports use live application source counts and return unavailable values where no observations exist. The default report window is the last 30 calendar days, and department time-to-hire values no longer fabricate zeroes.
- Removed the local persona switcher that referenced deleted demo users and changed the launcher banner to point to the configured administrator account. Dashboard, task assignment, and joining actions now use permissions rather than fixed role-name lists.
- The candidate list accessibility gate now passes at all six widths in both themes (12/12 focused checks), including accessible labels for row actions and higher-contrast initials.

Remaining release limitations are recorded rather than hidden: the full legacy database auth matrix still expects deleted demo accounts, the CSS budget remains above 225 KiB, and global activity/report coverage metrics plus worker heartbeat telemetry are not yet implemented.

## Dynamic candidate metrics and final browser gate — 2026-09-07

- Added an authenticated `GET /api/v1/candidates/metrics` endpoint and shared `CandidateMetrics` contract. Counts use the same candidate visibility predicate as the list, restrict application joins to the tenant, and count only active, eligible talent-pool memberships.
- Replaced the candidate page's fabricated total, pipeline, sourcing-bench, direct/referral percentage, and disqualified values with live API results. Empty observations render as unavailable instead of invented percentages.
- The first live check exposed a stale API process returning 500 for the new route. Restarting the API from the current build fixed the route; a focused browser run then passed 12/12 checks.
- Full browser matrix passed 396/396 across all tested routes, six viewport widths, both themes, overflow, console/network failures, and critical/serious axe checks after the restart.

## Full application detail flow - 2026-09-08

- Applications table rows and board cards now navigate directly to `/applications/:id`; the split review drawer is no longer mounted from the applications list.
- The full applicant profile now combines the recruiter-facing candidate activity panel with the screening details form, including outcome, notice period, expected/current salary, currency, recruiter notes, permission-aware salary visibility, and persisted save/refresh behavior.
- Focused browser verification for `/applications` and the first application detail route passed 12/12 checks across light/dark themes and 375/768/1440px widths. Web typecheck, tests (145/145), lint, and build passed.
- A direct Playwright smoke also clicked the first applications board card and confirmed navigation to `/applications/01dcd7a5-c2ef-431d-b383-8d6220572001`.
- A later long-running 396-check attempt began recording session 401 console responses after several minutes; the fresh-login focused application gate remained 12/12. Long-session authentication should be checked separately from this UI change.

## Simplified CV entry flow - 2026-09-08

- The Add Candidate to Pipeline modal now offers Existing Candidate, Full details, and Upload CV. Upload CV opens the existing full extraction/matching workflow and carries the selected vacancy in the URL.
- CV intake now retains the selected file through confirmation and uploads it to the candidate's organization-scoped CV documents after candidate resolution, preserving extracted text for search and audit review.
- A browser smoke confirmed the modal Upload CV action opens `/cv-intake?vacancyId=...`; the applications and vacancy-aware CV intake routes passed 8/8 focused checks. Web typecheck, tests (145/145), and build passed.

## Smarter CV identity and source capture - 2026-09-08

- CV name extraction now removes known and generic role phrases from header lines and filename fallbacks, so values such as `Data Analyst` or `Senior SEO Specialist` are not stored as part of the candidate name.
- Repeated name/title strings are rejected from the current organisation field when a CV template places them beside contact details.
- Stage 2 now exposes a Source of CV selector. The selected source is carried through candidate creation/update and application creation, and remains visible in candidate/application data.
- Parser regression coverage passes 5/5 focused cases; the focused applications and vacancy-aware CV intake browser matrix passes 8/8.

## Employee one-workspace navigation audit - 2026-09-08

- The application already has an `EmployeeDashboard` that combines the employee's own vacancy requests and active tasks, so a new page is unnecessary.
- The landing decision was too broad: users with read-only `VACANCY_VIEW` access were sent to the full recruitment command center. Employee/requester and read-only roles should land on My Work unless they have operational management permissions.
- The sidebar currently renders several groups independently. A compact employee mode can keep My Work and permission-appropriate requisitions visible while preserving direct route/API authorization for everything else.
- The header clock shortcut must not send users without `TASK_VIEW` to a gated task page.

## Employee one-workspace navigation implementation - 2026-09-08

- Added `isEmployeeWorkspaceUser` as the single frontend decision point for Employee/Viewer/requester and conservative read-only personas; role names are matched without treating generic clinical roles such as Staff Nurse as employees.
- Employee personas now use the existing My Work dashboard and see a compact sidebar with My Work and only permission-appropriate requisitions. Recruitment, sourcing, compliance, and governance groups remain available to operational roles.
- Header task navigation and dashboard actions are permission-safe, so employees do not encounter task/request dead links or misleading data states.
- Verification passed: web tests 149/149, web typecheck, root lint, production build, browser matrix 8/8, API health 200, API readiness 200, and web root 200.

## Duplicate/deferred page audit - 2026-09-08

- TalentPoolDetailPage.tsx is unreferenced dead code; all legacy talent-pool paths already redirect directly to Smart Sourcing & Match.
- DesignSystemPage.tsx is an admin-only component showcase mounted at two duplicate routes (/components and /design-system) and has no product workflow, navigation entry, or test dependency.
- CVBankPage, ImportPreviewPage, CandidateComparisonPage, ApplicantPortalPage, and the manager/command-center dashboards have active routes or workflow links and will remain.
- Legacy redirect aliases (/inbox, talent-pool aliases, /joining, and /my-applications) will remain for bookmarked links; they do not add sidebar destinations.

## Duplicate/deferred page cleanup - 2026-09-08

- Deleted the unreferenced TalentPoolDetailPage redirect component.
- Removed DesignSystemPage and both showcase routes from the protected application shell. The shared design-system primitives, tokens, CSS, and documentation remain in use.
- Rechecked the remaining page imports and routes after cleanup; no references to either removed page remain.
- Verification passed: web tests 149/149, web typecheck, root lint, production build, browser matrix 8/8, API health 200, API readiness 200, and web root 200.

## Current authoritative status — 2026-09-08

New product-scope decisions are recorded in `docs/version-one-simplification-plan.md`. The current V1 slice is implemented for candidate entry, interviews, activity, My Work/navigation, Master Data and persistence. The larger Users & Roles expansion remains a separate scope. Current candidate DTO/database still require email, so minimum-contact entry has a cross-layer dependency.

The focused repair pass recorded in `docs/full-app-audit-2026-09-08.md` is historical; the final performance/UI verification is recorded in `docs/FINAL_PERFORMANCE_UI_UX_AUDIT_2026-09-08.md`. Earlier B01–B11 checks remain useful regression evidence. The current final run passes web 155/155, API 66/66, worker 4/4, typecheck, lint, fresh Docker health/readiness, and a 33/33 browser matrix. The design-token/CSS budgets and long-session refresh observability remain documented follow-ups rather than hidden gates.
## Users & Roles audit — 2026-09-08

- The current Users & Roles page is a single short modal for user creation (name, email, password and one role) and a short role modal (code and name); it does not provide full user detail, multiple-role editing, descriptions, duplicate/archive workflows or impact previews.
- User and role list endpoints are tenant-scoped and permission-gated, but the current User model only stores `jobTitle` beyond identity; branch, department, manager and explicit per-user permission exceptions are not durable fields.
- Roles and permissions have tenant-local versus shared-system records, but role descriptions, version checks and a dedicated audit history are not currently represented in the access-management API.
- Existing RLS responsibility settings are stored in an internal integration JSON document. They provide data scope and sensitive-field flags, but the UI/API do not yet expose a complete effective-access explanation or explicit Allow/Deny/Inherit precedence for individual permissions.
- Navigation visibility is already persisted independently from route authorization, which is a safe foundation to preserve while expanding the management UI.

## Users & Roles implementation decisions — 2026-09-08

- Use one effective-access resolver shared by API guards, list/detail projections and the preview screen. Multiple roles union grants; explicit user denies override grants; explicit user allows add grants; user scope replaces inherited role scope when set.
- Keep shared system roles and permissions immutable at tenant level. Tenant-local roles and permissions are editable, archivable and deletable only when no protected invariant is violated.
- Add optimistic version checks to user access, role, permission and navigation writes. Return a conflict response rather than silently overwriting another administrator's changes.
- Keep the last active administrator protected from deletion, suspension, removal of administrator access or loss of required management permissions.

## Master Data delegated repair and audit — 2026-09-08

- The reported 404 was reproducible only against the stale API process on port 3000. The current Nest source and fresh runtime exposed `GET /api/v1/master-data/catalog/branches`; rebuilding and restarting port 3000 removed the runtime mismatch.
- The delegated implementation registered the catalog controller, validates supported categories and bounded batches, preserves tenant filtering, rejects duplicate values, and keeps optimistic version checks for edits.
- The grid now labels initialization failures as load errors, uses `Promise.allSettled` for optional reference lists, falls back to legacy `/branches` and `/positions` reads during rolling restarts, and stages pasted rows safely.
- Independent audit found and fixed a Job Titles save defect: `legalEntityId` was editable in the table but was not sent in the batch request. The payload now includes it.
- Focused smoke against the rebuilt port-3000 runtime passed for catalog read, invalid-category validation, create/update, metadata persistence and stale-write conflict handling.

## Role creation access setup audit — 2026-09-08

- The screenshot showed the old short role dialog because it collected only the role code and display name; an administrator had to open a second permissions/navigation area after creation.
- The role dialog now reads the live permission catalog and navigation catalog, lets the administrator select both before saving, and uses the existing role-permission contract plus a tenant-scoped role navigation configuration endpoint.
- Role navigation is stored in the existing tenant `NAVIGATION_SETTINGS` integration JSON, so no schema migration or reset of existing roles is required. Global sidebar changes preserve the role-specific section.
- Navigation visibility controls the menu only. Direct route and API access continue to require the effective permission set returned by the server; multiple assigned roles use a union of visible pages.
- A focused regression creates a temporary role, assigns a permission, saves role-scoped page visibility, verifies both results, and removes the temporary role.

## Role access form UX audit — 2026-09-08

- The first access form used two compact panels with native checkbox labels. Long permission identifiers caused a horizontal scrollbar and the selected totals were not visible while choosing items.
- The dialog now uses a wider `max-w-6xl` surface, responsive single-to-two-column panels, shared `CheckboxField` controls, bounded vertical lists, and `min-w-0`/break handling for identifiers and routes.
- Searching by permission name/code/description or page label/group/route reduces scanning time for the current catalog. The footer keeps the save action and a live selection summary visible while lists scroll.

## Final performance and UI repair audit — 2026-09-08

- The applications working set now follows the API's paginated total instead of silently stopping at 100 rows. The isolated 101-application fixture renders all 101 records and keeps the API page boundaries intact.
- Open candidate follow-up tasks are now included in each application summary; a create/read/complete API smoke verified the due date appears and is cleared after completion.
- Fit scoring now reports certification evidence honestly (`provided`, `missing`, or `not_applicable`) and the applicant profile no longer presents an empty certification record as verified.
- Fresh production web/API/worker containers passed health/readiness checks. Nginx serves hashed text assets with gzip enabled.
- The applicant overview Timeline now sizes to its content instead of stretching beside the screening column. The 33-check authenticated Chromium matrix (1440/768/390px) passed with zero JavaScript errors, zero authenticated HTTP errors, zero horizontal overflow, and zero axe violations. Direct applicant-profile smoke confirmed the Log call and Plan follow-up actions.
- Web/API/worker tests passed 155/155, 66/66, and 4/4; typecheck, lint and diff checks passed. `pnpm check:bundle` now passes transfer-size budgets (main CSS 50.70 KiB gzip; main JS 75.72 KiB gzip); the Nginx smoke downloaded 54,132 and 78,419 bytes respectively. Raw CSS remains 396.33 KiB against the historical 225 KiB advisory target; route-safe CSS reduction remains a separate performance phase.

## Modal input focus regression audit — 2026-09-08

- The close button focus ring was a real focus-trap regression, not browser validation. `Modal` stored the first focusable element in an effect whose dependency list included `onClose`; inline handlers changed identity whenever a parent form updated.
- A controlled input therefore triggered the effect on each keystroke, and its request-animation-frame callback focused the close button. The failing test reproduced the exact symptom and showed the input value stopped after the first character.
- `Modal` now keeps `onClose` in a ref and excludes callback identity from the open/close lifecycle dependencies. Escape still invokes the current callback, while typing no longer restarts focus management.
- Interview scheduling audit (2026-09-08): the schema and API already persist optional `locationUrl`, interview lifecycle status, attendee `response`, scorecards and notes, so the requested V1 workflow does not need a migration. Both recruiter scheduling entry points omit the meeting-link field. Rescheduling/cancellation exist on the detail page, but there is no attendee confirmation, reschedule-request or decline action. Ratings and recommendation are required for scorecards while written notes remain optional. Keep lifecycle status separate from attendee response, add validated link capture, and require a written result summary when an interviewer submits feedback.
- Implementation outcome: meeting links now flow through direct scheduling and candidate self-scheduling; the self-schedule path no longer writes a fixed Teams URL. Interviewer responses are tenant-scoped to assigned attendees, reschedule requests require a reason, and response activity is recorded and notified to the panel/primary recruiter. Interview status changes to `Rescheduled` when its time changes and can become `Completed` only after all assigned interviewers have locked scorecards with notes.
- Follow-up hardening: new attendee invites start as `Pending` instead of silently accepted; meeting links accept only explicit HTTP/HTTPS URLs; at least one interviewer is required; completed/cancelled interviews cannot be rescheduled or moved to another status; cancelled interviews cannot receive scorecards.
- Rescheduling resets every panel response to `Pending`, preventing a confirmation for the previous time from being treated as confirmation for the replacement slot.
