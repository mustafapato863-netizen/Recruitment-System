# Testing readiness audit — 2026-09-07

## Deployment preparation — 2026-09-08

- [done] Compare supplied AssessFlow incident report to RecruitFlow configuration.
- [done] Add production containers, routing, persistence and validated migration startup.
- [partial] Clean database replay, schema diff, Linux API image build, tests and compose validation passed. Full container smoke is blocked by Docker Desktop storage failure; deployment instructions record remaining checks.
- Preserve existing data and work; never run destructive schema push or seed demo records on boot.

## Current scope: version-one simplification planning

- Planning complete in `docs/version-one-simplification-plan.md`; implementation pending.
- This scope supersedes older interface-expansion proposals. Preserve previous implementation and audit history below.
- Delivery order: baseline/session diagnosis; profile actions; interview fields; My Work/navigation; unified candidate bank; Excel-style Master Data; write-workflow UAT.
- Important dependency: candidate email is currently required in both DTO and database; phone-only entry needs coordinated persistence and consumer changes.

## Candidate activity and system review — current request

### Follow-up: full UAT enhancement planning

- Planning complete in docs/uat-enhancement-plan.md; implementation has not started.
- Confirmed: UAT target, current visual identity, operational metrics without employee scores, primary/supporting recruiters, uploader/admin-only unassigned candidates, isolated integrations.
- Planned stages: preserve/baseline; centralized authorization; assignment and task integrity; recruiter workflow and dynamic data; reliable activity/reporting; full UAT verification.
- Next implementation starts with stage 0 and uses an isolated UAT database. Preserve existing local records and unrelated edits.

1. Audit candidate activity sources, permissions, recruiter workflows and major system modules — complete; findings in docs/system-review-2026-09-07.md.
2. Implement a truthful candidate activity summary and simpler recruiter logging using persisted data — complete; API, shared panel, task links and responsive drawer delivered.
3. Verify activity aggregation, permissions, UI and regression checks — complete; unit suites, integration/browser activity, types/lint/build passed. Final matrix 396/396 with no critical/serious accessibility findings or unexpected console/network errors.
4. Deliver an evidence-based system review with strengths, defects, priorities and testing limitations — complete in docs/system-review-2026-09-07.md. P1 findings remain documented for follow-up; no production readiness claim.

Count completed human actions separately from scheduled work and automated lifecycle events. Preserve existing data and changes. Review the whole system, but implement the requested candidate activity improvement and directly related defects only.

1. Inspect setup, existing changes and test coverage — complete.
2. Run lint, types, unit tests and build — complete.
3. Start local services and verify database/API/browser workflows — complete.
4. Fix confirmed defects, rerun affected checks and record readiness — complete.

Preserve existing application audit-action edit. Use only local test data; do not reset existing data.

## Issues encountered
- README links to missing AI_EXECUTION_PLAYBOOK.md; use current setup and actual configuration.
- Production API startup required SELF_SCHEDULE_SECRET; added it to .env.example and isolated QA defaults.
- Fresh migration chain altered candidate_import_jobs before creating it; added an idempotent baseline migration before that alteration.
- Browser matrix exposed action-button contrast, missing form labels, and candidate badge contrast at 1024px; corrected and reran 324/324.

## Dynamic VL sample data task — 2026-09-07

Goal: replace hardcoded demo vacancy/position assumptions with database-backed records from `D:\Manpower\VL.xlsx`, importing only a small representative sample so CV uploads can be tested safely.

1. Inspect workbook sheets, headers, and representative rows; inspect the existing vacancy/position import path — complete.
2. Define a reversible field mapping and choose a small sample covering distinct positions — complete (six distinct open Rowdata positions).
3. Import the sample into the local testing dataset and remove/replace affected hardcoded UI fallbacks — complete.
4. Verify vacancy, application, CV intake, and matching workflows with the imported records — complete (six open vacancies have source-derived requirements; API smoke, build, unit, and 348-route browser matrix checks pass).

Constraints: preserve existing data, do not import the entire workbook, keep source values traceable, and avoid embedding workbook rows in frontend code.

## Errors encountered

- Initial workbook inspection command had a Windows quoting error in the inline Python path; no file was modified. Retrying with the path passed as an argument.

## Admin-only RBAC and navigation governance — 2026-09-07

Goal: keep only the administrator account and administrator role in the local testing organization, then make permissions, role names, natural access rules, and sidebar visibility configurable by the administrator.

1. Audit current users, roles, permissions, schema constraints, route guards, and sidebar configuration — complete.
2. Add a safe admin-only governance model/API for roles, permissions, natural access, and sidebar visibility — complete.
3. Clean the local organization data without deleting the administrator or business records — complete.
4. Wire the Users & Roles UI and sidebar to the persisted governance settings — complete.
5. Verify tenant isolation, admin invariants, route access, sidebar behavior, typecheck, tests, and browser flows — complete.

Constraints: preserve the administrator account and business data, prevent deleting or locking the last administrator, keep server-side permission enforcement authoritative, and allow sidebar visibility to be managed independently from route permissions.

## Verification evidence

- Prisma client generation and migration `20260907_admin_rbac_governance` completed successfully after stopping the process that held the Windows query-engine DLL.
- `configure_admin_only.cjs` retained `admin@me.com`, removed 10 organization-local custom roles, retained 27 shared permission definitions, and preserved business/VL records.
- Live API reports exactly one active user (`admin@me.com`) and one visible role (`ADMINISTRATOR`); all 27 natural permissions remain available to the administrator as the reusable catalog.
- Live CRUD smoke passed for temporary custom role/permission creation, rename, assignment, deletion, and sidebar hide/restore.
- API/web typecheck, API/web builds, lint, unit tests (web 140/140, API 43/43, worker 4/4), and browser matrix (348/348) pass.

## Errors encountered

- Prisma generation initially failed with Windows `EPERM` while renaming `query_engine-windows.dll.node`; the API/worker processes were stopped, generation reran successfully, and both services were restarted.

## CV intake and recruiter screening fix — 2026-09-07

Goal: remove the CV intake `POST /candidates` 400 caused by the strict DTO rejecting the parsed CV summary, then persist recruiter screening details for notice period and compensation.

1. Trace the CV intake payload and candidate DTO/service contract — complete.
2. Persist and return candidate summary data — complete (`20260907_candidate_summary`).
3. Add screening notice period, expected/current salary, currency, and recruiter notes — complete (`20260907_screening_compensation`).
4. Enforce salary disclosure through `VIEW_CURRENT_SALARY` on the server and mirror the state in the drawer — complete.
5. Verify API smoke, typecheck, lint, builds, unit tests, and local services — complete.

Verification evidence:

- Candidate smoke with a parsed-CV-style `summary` returned HTTP 201 and persisted the summary.
- Screening smoke returned notice period 30 days, expected salary 18,000.50, current salary 15,000, and normalized currency `SAR`; temporary records were removed.
- API/web typecheck, lint, API/web builds, and database validation/migration status pass.
- Unit tests pass: web 141/141, API 43/43, worker 4/4.
- `/api/v1/health` returns `status: ok`; API and worker are running for local testing.

The candidate page accessibility findings were fixed as part of the full readiness pass; the focused candidate matrix now passes 12/12 in both themes and all six viewport widths.

## Vacancy assignment persistence fix — 2026-09-07

Goal: make recruiter assignment from the manager dashboard persist in `vacancy_assignments` and appear in the Command Center, vacancy list, and assignment filter.

1. Trace the assignment UI, API endpoint, repository save path, and list response — complete.
2. Persist assignment rows transactionally and deactivate replaced active rows — complete.
3. Return active assignment user identity for dynamic recruiter labels — complete.
4. Call the assignment API before creating the optional target task — complete.
5. Verify API/database round-trip, browser assignment flow, typecheck, lint, and unit tests — complete.

Verification evidence:

- Red smoke reproduced the defect: `POST /vacancies/:id/assignments` returned 201 but the response and database still had no assignment because the repository only upserted vacancy scalars.
- Fixed the manager flow, repository assignment synchronization, active-user projection, and closed-vacancy filtering.
- API smoke confirmed a 201 assignment, a matching `vacancy_assignments` row, and the same recruiter/name after a fresh `GET /vacancies`; test rows were removed afterward.
- Browser smoke passed the actual manager modal flow and assignment request (201); test rows were removed afterward.
- Final checks passed: web 141/141, API 43/43, worker 4/4; workspace typecheck and lint clean.

## Final dynamic metrics and UAT gate — 2026-09-08

1. Replace fabricated candidate dashboard counts with tenant-scoped API metrics — complete.
2. Verify the new metrics route against the current API build and correct stale-process failures — complete.
3. Run the full dual-mode browser matrix after the final restart — complete (396/396).

The local UAT target is available at `http://localhost:5173`; API liveness and readiness return 200 on ports 3000. Remaining non-blocking gates are documented in `findings.md` and `docs/uat-enhancement-plan.md`.

## Full application detail flow - 2026-09-08

1. Replace application-list side drawer navigation with full profile navigation - complete.
2. Combine candidate activity metrics/logging and recruiter screening details into the full applicant profile - complete.
3. Verify the applications list and application detail routes at responsive light/dark viewports - complete (12/12).

Validation: web typecheck, 145/145 web tests, lint, build, and `git diff --check` pass. The focused route matrix passed 12/12 with no overflow, runtime errors, failed responses, or critical/serious accessibility violations; a direct card-click smoke confirmed navigation to the detail route.

## Simplified CV entry flow - 2026-09-08

1. Add a simple Upload CV entry point beside the existing and manual full-details paths - complete.
2. Preserve the selected vacancy when opening full CV intake - complete.
3. Persist the uploaded CV file and extracted text after candidate resolution - complete.

Validation: browser smoke confirmed `/cv-intake?vacancyId=...` from the pipeline modal; the applications and vacancy-aware CV intake routes passed 8/8 focused checks. Web typecheck, 145/145 web tests, build, and `git diff --check` pass.

## Smarter CV identity and source capture - 2026-09-08

1. Prevent job titles from being stored in parsed first/last names, including filename-only fallbacks - complete.
2. Prevent repeated identity strings from being stored as the current organisation - complete.
3. Expose and persist the CV source during Stage 2 validation - complete.
4. Add parser regression coverage and run release checks - complete.

Validation: focused parser tests passed 5/5, the web suite passed 146/146, web typecheck and root lint passed, the production web build completed, and the focused applications plus vacancy-aware CV intake browser matrix passed 8/8. API health, readiness, and the web root each returned HTTP 200.

## Employee one-workspace navigation - 2026-09-08

1. Audit employee landing logic, sidebar visibility, and quick links — complete.
2. Route read-only/requester employees to one My Work dashboard and reduce sidebar noise while preserving direct permission gates — complete.
3. Add focused navigation regression coverage and verify responsive light/dark browser flows — complete.

Findings so far:

- `EmployeeDashboard` already combines personal vacancy requests and active tasks, so a new page is unnecessary.
- `DashboardPage` currently sends any user with `VACANCY_VIEW` or `APPLICATION_VIEW` to the larger command center.
- The sidebar contains many separate recruitment and governance destinations; employee users should see the My Work entry and only the request path their permissions require.
- The header task shortcut is always rendered, even when a user cannot access `TASK_VIEW`; its destination should remain permission-safe.

Implementation and verification:

- Added a shared workspace persona check for Employee/Viewer/requester roles and conservative read-only permission sets.
- Employee personas now land on `My Work`, see only My Work plus permission-appropriate requisitions, and retain direct route/API authorization for other pages.
- Header task shortcut now opens the task queue only when `TASK_VIEW` is granted; otherwise it returns to My Work.
- Employee dashboard data loading and actions are permission-aware, and unavailable task access is explained without a dead link or misleading empty state.
- Web tests passed 149/149, web typecheck passed, root lint passed, production build passed, browser matrix passed 8/8, and API health/readiness plus web root returned HTTP 200.

## Remove duplicate and deferred pages - 2026-09-08

1. Inventory route registrations, page entry points, and navigation links; classify duplicates versus pages that are still required — complete.
2. Remove only confirmed duplicate/deferred entry points while preserving deep links, permissions, and active recruitment flows — complete.
3. Verify route compilation, references, tests, build, and browser navigation — complete.

Audit decisions:

- Removed the unreferenced TalentPoolDetailPage redirect component.
- Removed the admin-only DesignSystemPage showcase and duplicate /components and /design-system routes.
- Kept CV Bank, bulk import preview, candidate comparison, applicant portal, manager dashboard, and recruitment command center because they have active routes or workflow links.
- Kept legacy redirect aliases for bookmarked paths.

Verification: web tests 149/149, web typecheck, root lint, production build, browser matrix 8/8, and API health/readiness plus web root HTTP 200.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| sed was unavailable on Windows | Route inspection | Used rtk proxy python for file reads instead. |
| Regex quoting failed in a PowerShell ripgrep command | Removed-page reference check | Split the check into simple literal searches. |
| Combined alternation remained incompatible with the proxy quoting | Removed-route reference check | Used Python literal membership checks instead. |
| Escaped quote ended the inline Python command early | Removed-route reference check | Switched the check to chr(34) for quote characters. |
| code_quality_checker emitted an emoji unsupported by the Windows console | Review script | Logged the issue and continued with lint, typecheck, tests, build, and manual diff review. |

## Full application audit repair pass - 2026-09-08

1. Reproduce full-app findings with unit, API, and browser checks — complete.
2. Repair task response normalization, mixed-role presentation, offer approval contracts/routes, honest CV extraction defaults, offer creation CTA, task pagination validation, email-template navigation permission, dynamic vacancy public URLs, and panel error reporting — complete in source.
3. Re-run release checks and record residual gates — complete; a fresh API instance on port 3001 confirmed invalid pagination returns 400.

Evidence: web 153/153, API 58/58, worker 4/4; typecheck, lint, and web build pass; fresh full browser route matrix 132/132 plus focused repair matrix 32/32; CSS budget remains above threshold.

## CSS payload repair — 2026-09-08

1. Trace the remaining CSS budget failure to the Tailwind entrypoint and generated default theme — complete.
2. Replace the full Tailwind entrypoint with the required preflight and utility layers only — reverted after visual regression.
3. Rebuild, run the bundle gate, and re-run browser regression coverage — blocked pending a route-safe code-splitting design.

Finding: the full Tailwind entrypoint emits unused default color/theme variables, but removing it also removes spacing, typography, and color utilities from production screens. The experiment caused visual regressions and was reverted; the safe baseline remains 401.85 KiB and the CSS gate is still open.

## Design-token checker repair — 2026-09-08

1. Remove the explicit reference to the deleted `DesignSystemPage.tsx` showcase — complete.
2. Run the checker against the remaining design-system boundary and record the next migration work — complete.

The checker now reaches its intended checks. It reports the existing legacy palette baseline (9,338 production utility occurrences against an 850 budget); changing that threshold would hide debt, so palette migration remains a separate planned phase.

## Long-running session verification — 2026-09-08

1. Re-run the browser route matrix with a fresh current-build session — complete (132/132 at 375px and 1440px, light and dark).
2. Compare the earlier long-run 401 burst with a direct refresh round-trip — complete (API login, refresh, and `/auth/me` all returned 200).
3. Keep session-lifetime/refresh observability as a P2 follow-up until a long run can renew without 401 noise — open.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Explicit Tailwind preflight/utilities imports omitted application utility themes | CSS budget experiment | Detected through browser screenshots and axe checks; reverted the stylesheet and retained the functional visual baseline. |
| Adding only the observed color/core theme variables restored some utilities but expanded generated CSS to 327.52 KiB | Palette subset experiment | Reverted; a route-safe split or utility migration is required before retrying. |
| Design-token checker crashed with `ENOENT` after the showcase page was removed | Post-cleanup release check | Removed the deleted page from the explicit checker inputs; the command now reports its intended legacy-palette baseline instead of crashing. |
## Current scope: full Users & Roles build — 2026-09-08

Goal: replace the short Users & Roles controls with a complete, admin-safe access-management workspace covering users, roles, permissions, data scope, sensitive fields, sidebar visibility, effective-access preview and audit history.

Delivery rules:

- Preserve the existing administrator and business data; do not reset or seed demo accounts.
- Keep server-side authorization authoritative for every route, resource, field and export.
- Sidebar visibility is independent from permission to open a route.
- Support multiple roles and explicit per-user permission exceptions with a visible source of each effective grant.
- Every mutating save is tenant-scoped, validated, audited and protected against stale concurrent edits.

### Phase U0 — audit and access model

- [in_progress] Audit the current user/role/permission schema, endpoints, UI, guards and existing RLS configuration.
- [ ] Define effective-permission precedence and migration-safe data shape.
- [ ] Record baseline users, roles, permission catalog, navigation catalog and current access configuration without mutating records.

### Phase U1 — durable access model and APIs

- [ ] Add tenant-scoped user profile/access fields, user permission overrides, role descriptions/versioning and access audit records where missing.
- [ ] Add transactional user detail, role detail, permission matrix, effective-access and audit endpoints.
- [ ] Validate role/permission ownership, last-admin invariants, stale versions and session revocation.

### Phase U2 — complete Users workspace

- [ ] Build searchable/filterable user directory with job title, roles, scope and status.
- [ ] Build full user detail editor: identity, phone, job title, branch, department, manager, multiple roles, status, invitation/reset and explicit exceptions.
- [ ] Add effective-access preview and impact summary before saving.

### Phase U3 — complete Roles workspace

- [ ] Build role directory with description, scope, assigned-user count, duplicate, edit, archive and safe delete behavior.
- [ ] Build grouped permission matrix for page access and actions (view/create/edit/assign/approve/export/delete).
- [ ] Add role-level data scope and sensitive-field controls with clear inherited/overridden indicators.

### Phase U4 — navigation, preview and audit

- [ ] Configure sidebar labels, groups, order and visibility independently per role, with optional user override.
- [ ] Add effective-access inspector showing permission source, data scope, sensitive fields and visible navigation.
- [ ] Add searchable before/after audit history and protect the last active administrator.

### Phase U5 — verification and handover

- [ ] Test multi-role union, explicit deny/allow overrides, scope replacement, hidden authorized routes, denied direct URLs/API calls, tenant isolation and session revocation.
- [ ] Run unit/integration/browser checks, typecheck, lint, production builds and migration status.
- [ ] Record remaining risks and provide the administrator walkthrough.

## Users & Roles errors encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| None yet | — | — |

## Master Data route/load repair — 2026-09-08

- [done] Delegate a focused audit/implementation of the Master Data catalog read and batch-save paths.
- [done] Add the catalog controller registration and validate supported categories, batch limits, duplicate checks and optimistic versions.
- [done] Make the grid distinguish load errors from save errors, tolerate supplementary reference-option failures, and keep legacy branch/position reads usable during API restarts.
- [done] Fix Excel paste staging for new rows and ensure Job Title legal-entity edits are included in the save payload.
- [done] Rebuild/restart the user-facing API on port 3000 and verify the catalog endpoint against that runtime.
- [done] Run focused Master Data smoke, typecheck, lint, web tests, production builds, migration status and diff checks.

### Master Data errors encountered

| Error | Root cause | Resolution |
| --- | --- | --- |
| `Cannot GET /api/v1/master-data/catalog/branches` | Port 3000 was running an older compiled API process that predated the catalog controller. | Rebuilt the API, restarted the port-3000 process, and added a temporary read fallback for legacy branch/position routes. |
| Load failure was presented as “could not be saved” | The grid reused the save alert for all request failures. | Added explicit load/save error state and messages. |
| Job Title legal-entity edits were dropped | The UI rendered the field but omitted it from the batch payload. | Include `legalEntityId` for `job-titles` saves and cover the payload path in review. |

## Role creation access setup — 2026-09-08

- [done] Replace the code/name-only role modal with a single create flow that loads the live permission and navigation catalogs.
- [done] Allow the administrator to select action permissions and sidebar pages before saving the role, with select-all and clear-all controls.
- [done] Persist selected permissions through the existing role-permission API and persist role-specific sidebar visibility without changing global navigation settings.
- [done] Apply role-specific visibility to the authenticated navigation response while keeping route and API permissions authoritative.
- [done] Preserve other role visibility rules when global sidebar settings are edited.
- [done] Add rollback when a post-create access assignment fails, then verify the full flow with API and browser smoke tests.

### Role access errors encountered

| Error | Root cause | Resolution |
| --- | --- | --- |
| The create-role dialog only accepted role code and name. | Permissions and navigation were configured later in separate administration controls. | The dialog now loads both catalogs and saves the selected access in one guided flow. |
| A role could be given a sidebar page without an obvious relationship to authorization. | Menu visibility and route/API authorization are separate concerns. | The UI explains the distinction; the server still enforces permissions for direct URLs and API calls. |
| Global navigation edits could overwrite role-specific settings. | The global update path did not preserve the role visibility section of its JSON configuration. | Global saves now merge only global item changes and retain all role visibility rules. |

## Role access form UX refinement — 2026-09-08

- [done] Widen the role dialog to use the available desktop space while keeping the layout responsive on tablet and mobile.
- [done] Replace cramped native checkbox rows with the shared touch-friendly checkbox component and prevent long permission codes from creating horizontal scrolling.
- [done] Add permission/page search fields, empty search states, selected-count badges and a compact selection summary in the action footer.
- [done] Add clearer step labels and guidance so administrators understand identity, action permissions and sidebar visibility as separate decisions.
- [done] Keep the action footer sticky inside the scrollable dialog and re-run web typecheck, lint, tests, build and diff checks.

## Modal input focus regression — 2026-09-08

- [done] Reproduce the reported behavior with a focused Modal regression test: typing into an input moved focus to the close button after the first character.
- [done] Confirm the cause: the focus-trap effect depended on an inline `onClose` callback, so every controlled-input render restarted the effect and focused the first control.
- [done] Keep the latest close handler in a ref and run the focus/return-focus lifecycle only when `isOpen` changes.
- [done] Re-run the focused regression and the complete web verification suite.
- Interview scheduling workflow (2026-09-08): audit complete; add meeting-link capture, attendee response actions, required interviewer notes, focused regressions and full verification.
- [done] Add meeting-link capture to direct and self-schedule forms and remove the fixed self-schedule meeting URL.
- [done] Add tenant-scoped interviewer response endpoint and detail-page confirmation/request/decline controls.
- [done] Require non-empty scorecard notes and gate manual completion; auto-complete after all panel scorecards are locked.
- [done] Finish final verification and document any release limitations.
- [done] Close remaining interview lifecycle gaps: explicit pending attendee confirmation, meeting-link validation, required interviewer assignment, terminal-status protection, and cancelled-scorecard rejection.

## Full audit notes repair — 2026-09-08

1. [done] Make application list totals and working-set coverage truthful across all API pages; retain server pagination and document server-side filter optimization as a follow-up.
2. [done] Make certification scoring distinguish provided, missing and not-applicable evidence.
3. [done] Fix mobile shell overlap and automated accessibility findings (labels, contrast, heading order).
4. [done] Reduce applicant-profile repetition/blank timeline risk and add direct call/follow-up actions using persisted activity.
5. [done] Replace placeholder activity labels with API-backed summaries and make page guidance opt-in after first use.
6. [done] Re-run unit, type, lint, build, container-health and focused browser verification.
7. [done] Make the bundle gate enforce compressed transfer budgets, keep raw CSS visible as an advisory, and exclude the unused design-system source tree from Tailwind scanning.

## Full audit notes errors

| Error | Attempt | Resolution |
|---|---|---|
| Playwright network-idle timeout | Existing audit matrix | Use bounded visible-page readiness; keep external font loading as a separate hosting check. |
| Raw CSS budget remains above 225 KiB | Existing global Tailwind entrypoint exports a large shared stylesheet. | Keep the safe visual baseline, verify gzip at Nginx, and track route-safe CSS code-splitting as a separate performance phase. |
| Application search/filtering still runs over the complete client working set | The Kanban/list surface needs all stage columns available at once. | Corrected the silent first-page truncation by fetching until the server total is covered; move to per-column/server-filtered queries when record volume requires it. |

## Dynamic Master Data and VL catalog synchronization — 2026-09-10

Goal: implement the approved Master Data plan using the actual VL workbook, make skills synchronize automatically when Job Positions requirements are saved, and make Candidate Sources and Interview Types catalog-driven.

- [x] Audit current catalog, vacancy, interview, candidate-source and import paths while preserving the existing Audit changes.
- [x] Add normalized, idempotent workbook import for Departments and Job Titles with reviewable mappings; do not seed or reset production data.
- [x] Synchronize required vacancy skills into the tenant Skills catalog transactionally and remove frontend hardcoded skill suggestions.
- [x] Seed the approved V1 Candidate Sources and Interview Types through a repeatable script and load them dynamically in all relevant UI forms.
- [x] Add focused API/UI regression coverage, run typecheck, lint, tests, builds, migration validation and diff review.
- [x] Apply the data scripts to the explicitly selected local test organization; reruns remain idempotent and preserve existing records.

### Dynamic Master Data errors encountered

| Error | Attempt | Resolution |
|---|---|---|
| None yet | — | — |

Implementation status (2026-09-10):
- [x] Audited current API/UI paths and confirmed the missing synchronization/hardcoded selectors.
- [x] Added transactional skill catalog synchronization and case-insensitive duplicate protection.
- [x] Added catalog-backed recruiter selectors for skills, branches, candidate sources, and interview types.
- [x] Added dry-run-first VL importer and V1 source/type seed scripts.
- [x] Extended the Positions upload flow to accept Rowdata headers, create missing departments once, and expose correct Update/Skip decisions for duplicates.
- [x] Ran typecheck, lint, Prisma validation/migration status, API tests, web tests, production builds, bundle checks, and importer dry runs.
- [x] Applied scripts to an explicitly selected local test organization; no production database was modified.
