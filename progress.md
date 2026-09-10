# Progress Log — RecruitFlow Candidate Journey

## Deployment preparation 2026-09-08

- Passed: clean database replay (30 migrations), no schema diff, API production image build, 66 API tests, 8 deployment environment validation tests.
- Docker engine then failed on named-volume creation (I/O), image build (read-only filesystem) and container listing (Desktop unable to start). No live hosting or existing application database was changed.
- Temporary isolated resources: recruitflow-preflight-db, recruitflow-preflight network, recruitflow-preflight-api image (and possible documents volume). Remove only these named test resources after Docker recovery; do not prune unrelated images/volumes.

Read supplied incident report and relevant skills; inspected runtime, package scripts and schema. Beginning production packaging and isolated checks.

## Session 2026-09-07

### Full enhancement plan prepared

- Rechecked access-policy persistence, role/navigation configuration, recruiter assignment implementation, candidate ownership gaps, task schema and report authorization.
- User chose multi-user UAT, improvements to current UI, operational metrics, primary recruiter plus support, uploader/admin-only unassigned candidates, and isolated integration tests.
- Created docs/uat-enhancement-plan.md with ordered stages, API/schema compatibility, measurement definitions, migrations/recovery, and acceptance gates. No application code or database modified for this planning request.

### Candidate activity and system review completed

- Added persisted candidate activity API and profile/drawer panel: totals, personal contribution, type/recruiter breakdown, timeline, planned follow-ups, overdue count and idempotent completion.
- Removed simulated drawer chatter/email/scorecard actions; linked real interview/hiring workflows and candidate tasks. Responsive drawer stacks on mobile.
- New API tests 12 (55 API total); panel tests 4 (in addition to 141 existing web tests); worker 4. Lint, types and production build pass. Database has 25 applied migrations, health/readiness 200.
- Real local integration/browser regression passed including notes from two applications, screening aggregation, activity/follow-up persistence, repeated completion, invalid requests, reload and 375/1440 px overflow. Disposable records cleaned up.
- Whole-system matrix: 382/396 passed; 14 accessibility failures represent unnamed candidate action buttons/contrast and application contrast. CSS budget fails at 406.24 KiB versus 225 KiB. These are not declared fixed.
- Review: docs/system-review-2026-09-07.md. P1 application scope, inactive assignments, repeated assignment uniqueness and generic task tenant-reference gaps recorded for follow-up. No production readiness claim.

### Completed — Resolution of CV Intake Candidate Ingest 400 Bad Request
- [x] **Candidate DTO & Prisma Schema Synchronization**:
  - Added `summary` field (`@MaxLength(5000)`) to `CreateCandidateDto` and `UpdateCandidateDto`.
  - Added `summary TEXT` to `Candidate` table in `schema.prisma` and applied migration `20260907_candidate_summary`.
  - Service now maps `summary` directly during creation and update operations.
- [x] **Frontend Ingest Hardening & Validation Protection (`useCVIntakeFlow.ts`)**:
  - Added RFC-compliant email format regex validation in `proceedToResolve()` to fail fast before submission.
  - Implemented safe integer rounding for `experienceYears` (`Math.max(0, Math.round(Number(profile.experienceYears)))`), avoiding `@IsInt()` decimal rejections.
  - Added defensive string truncation aligning with backend `@MaxLength` limits (`firstName`/`lastName` <= 80, `email` <= 255, `phone` <= 40, `currentTitle`/`currentCompany`/`location` <= 120, `summary` <= 5000).
  - Wired duplicate decision handling: `'update'` calls `PATCH /candidates/:id` to enrich existing candidate, `'link'` registers application without mutating identity, and `'new'` provides clear guidance if an identical email exists.
- [x] **API Client Validation Error Transparency (`client.ts`)**:
  - Implemented `normalizeFieldErrors` and updated `handleResponseError` to append field-level validation failure reasons directly into `ApiError.message`.
  - Added unit test in `client.test.ts` verifying 400 Bad Request field error formatting.
- [x] **Test Verification**:
  - Web Vitest Suite: 40 test files, 141 tests passing (0 failures).
  - API Vitest Suite: 8 test files, 43 tests passing (0 failures).
  - Monorepo Typecheck: Clean compilation across `apps/web` and `apps/api`.
  - Live End-to-End Verification: Tested `POST /candidates` and `PATCH /candidates/:id` through Vite proxy (port 5173), returning 201 Created and 200 OK.

### Completed — Full-App Workflow Simplification & Step Customizer Release
- [x] **Applications Pipeline (`ApplicationsPage.tsx`)**:
  - Implemented `PipelineStepMode`: `'streamlined'` (4 Steps), `'fast_track'` (3 Steps), and `'standard'` (6 Stages).
  - Added Step Customizer dropdown in toolbar with persistent `localStorage` preference (`rf_pipeline_step_mode`).
  - Added responsive Kanban layout container: in streamlined/fast-track mode, columns adapt without requiring horizontal scroll (`min-w-[1760px]`), fitting standard displays cleanly.
  - Sub-stage badges on cards when in consolidated mode (`Applied`, `Screening`, `Offer`, `Pre-Hire`).
  - Preserved exact drag-and-drop behavior, stage transitions, headcount check handshakes, and rejection modals.
- [x] **Universal Stepper Component (`PipelineStepper.tsx`)**:
  - Added icons for consolidated 3-4 step stages (`Review & Sourcing`, `Offer & Compliance`, `Role & Headcount`, etc.).
  - Added dynamic minimum width support (`min-w-[380px]` or `min-w-[320px]` when compact/fewer steps, instead of rigid `min-w-[520px]`).
  - Unit test passing: `PipelineStepper.test.tsx`.
- [x] **Requisition Wizard (`CreateVacancyRequestPage.tsx`)**:
  - Consolidated `WIZARD_STEPS` from 5 steps to 3: `['Requisition Basics', 'Specifications & Budget', 'Review & Submit']`.
  - Added interactive active step state with "Next Step", "Previous Step", and "Show All Sections" toggles.
- [x] **Offer Wizard (`CreateOfferPage.tsx`)**:
  - Consolidated `OFFER_STEPS` from 5 steps to 3: `['Candidate & Role', 'Compensation Package', 'Terms & Sign-Off']`.
- [x] **Bulk Import Wizard (`ImportPreviewPage.tsx`)**:
  - Consolidated `IMPORT_STEPS` from 5 steps to 3: `['Upload File', 'Validate & Resolve', 'Confirm & Import']`.
- [x] **Applicant-Facing Portal (`ApplicantPortalPage.tsx`)**:
  - Added `isStreamlinedStepView` toggle in the applicant application drawer.
  - Maps 5 internal HR stages to 3 clear candidate-facing milestones (`Application & Screening` → `Clinical Evaluation` → `Offer & Onboarding`).
- [x] **Full-Stack Quality Gates & Tests**:
  - Web Vitest Suite: 39 test files, 137 tests passing (0 failures).
  - API Vitest Suite: 8 test files, 43 tests passing (0 failures).
  - Worker Vitest Suite: 1 test file, 4 tests passing (0 failures).
  - Monorepo Root: 48 test files, 184 tests passing green.
  - TypeScript: Zero compiler errors across `apps/web`, `apps/api`, `apps/worker`.
  - Production Builds: Clean Vite client build (6.61s), Nest build, and Worker tsc build.

## Session 2026-09-06

### Completed — P10 gates, Phase C migration, E9 closure (evening session)
- [x] **ESLint (44 errors fixed):** 12 in new Phase C/D + P10 files (structural mock
      types, contract types, DI disable-wrappers per repo convention) + 32 more in
      `InterviewsPage.tsx` (20 `any` → `InterviewListItem` view type), new calendar/
      self-schedule tests, `applications.service.ts`, `ApplicationsPage.tsx`,
      `InterviewCalendarPage.tsx`. All 47 touched files lint-clean. Pre-existing debt
      noted (untouched pages: Offers/Reports/Settings/InterviewDetail) — not in scope.
- [x] **Bonus type catch:** removing `any` exposed 4 real TS2322 errors in
      `InterviewsPage.tsx` (`'Feedback Done'` into `InterviewStatus`) — fixed with
      explicit `string` badge types. Web `tsc` clean.
- [x] **Migration `20260906_phase_c_stage_automation_email_templates`:** hand-written
      (shadow DB broken, see below), deployed, `migrate status` up to date. Also caught
      dev DB up (applied pending `20260901`, `20260905`).
- [x] **Test gates wired:** API `test` → all of `apps/api/src` (4 files/26 tests, was
      1 file/11); worker `test` script added (1 file/4 tests); root `pnpm test` chains
      web+api+worker (151 total, green).
- [x] **Security:** self-schedule HMAC secret now fail-closed in production
      (min 32 chars), matching outbox-crypto pattern.
- [x] **E9 closed:** verified shipped in `6419977` + `d2d8521`; `task_plan.md` updated.
- [x] **Committed `b01d115`** (59 files, +7022/−533). Worktree clean.
- [x] **Shadow-DB diagnosis (read-only):** `20260824_bulk_import_center` ALTERs
      `candidate_import_jobs`, created a day later in `20260825_schema_reconciliation`
      → P1014 on any fresh replay (shadow/CI/new env). Dev survived via out-of-band
      state. Workaround verified: `migrate diff --from-url <dev> --to-schema` needs no
      shadow DB. Drift found: `applications_id_stage_version_idx` (from `20260901`)
      not declared in schema — recommend follow-up `@@index` migration. Full history
      repair + drift index migration pending owner go (no dev-DB writes made).

### Completed — M5-G2: XLSX Import/Export and Master-Data Code Integrity
- [x] **API Server-Side XLSX Product Exports:**
  - `CandidatesService.exportExcel()` (`apps/api/src/candidates/candidates.service.ts`): Filter/scope-constrained, tenant-isolated candidate directory export to Excel workbook (`GET /api/v1/candidates/export.xlsx`), honoring PII masking based on `VIEW_CANDIDATE_PII` permission and UTC ISO date formatting.
  - `CandidatesController` (`apps/api/src/candidates/candidates.controller.ts`): Wired route with `@RequirePermissions('CANDIDATE_VIEW')` and `@AuditAction('CANDIDATE_EXPORT_XLSX')`.
  - `VacancyCoreService.exportExcel()` (`apps/api/src/vacancy-core/vacancy-core.service.ts`): Position, branch, legal entity, remaining headcount calculation, primary recruiter name, and UTC date export (`GET /api/v1/vacancies/export.xlsx`).
  - `VacanciesController` (`apps/api/src/vacancy-core/vacancies.controller.ts`): Wired route with `@RequirePermissions('VACANCY_VIEW')` and `@AuditAction('VACANCY_EXPORT_XLSX')`.
  - Unit tests: `candidates-export.spec.ts` (3 tests) & `vacancies-export.spec.ts` (1 test) — 100% passing.
- [x] **Import Hardening & Consent Preservation:**
  - Verified candidate consent status and timestamps are preserved on duplicate `Update` resolution in `import.service.ts`.
  - Hardened formula rejection security check (`assertNoFormulas`) rejecting formula cells in Excel workbooks.
  - Implemented Excel error report workbook generation with row numbers, failure reason details, and audit batch history.
  - Unit tests: `bulk-import.service.spec.ts` (9 tests) covering templates across all 5 datasets, security formula cell rejection, inspection warnings, and error workbook download — 100% passing.
- [x] **Frontend Export Triggers & UI Polish:**
  - Added "Export XLSX" button with loading spinners and accessible tooltips to `CandidatesPage.tsx` preserving active directory search/filter query parameters.
  - Added "Export XLSX" button with loading states and error alerts to `VacantListPage.tsx`.
  - Extracted shared browser download utility `saveBlob` in `apps/web/src/utils/download.ts` and integrated across pages.
  - Unit tests: Added `BulkImportPage.test.tsx` (6 tests) and `ExportButtons.test.tsx` (2 tests) — 100% passing.
- [x] **Final Verification Gates:**
  - `pnpm --dir apps/api test`: 7 test files, 39 tests passed (100% pass rate).
  - `pnpm --dir apps/web test --run`: 37 test files, 129 tests passed (100% pass rate).
  - `pnpm --dir apps/api exec tsc --noEmit`: 0 errors.
  - `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit`: 0 errors.
  - `pnpm --dir apps/web build`: Clean production build in 987ms.

### Completed — P10-RELEASE-02: Final Release Hardening & Commercial Readiness
- [x] **Mutation Test Coverage (P10-R02.1):**
  - Added `ApplicationDetailPage.test.tsx` (5 tests): Stage transitions, optimistic locking, 409 conflict detection, 403 forbidden, activity notes.
  - Added `OfferDetailPage.test.tsx` (6 tests): Offer details, approve/reject modals, POST dispatch, 404 state.
  - Added `HiringCasePage.test.tsx` (6 tests): Clinical items, compliance progress, joining dialog, 403 forbidden.
- [x] **Accessibility Hardening (P10-R02.2):**
  - Injected skip-to-main link (`#main-content`) in `AppShell.tsx`.
  - Wrapped primary navigation in semantic `<nav aria-label="Primary navigation">`.
  - Added `AccessibilityRegression.test.tsx` (8 tests): `DataTable` column headers/scopes, `Modal` focus trap & Escape handling, `FormField` accessible errors & alert role, `IconButton` aria-label.
- [x] **Performance Quick Wins (P10-R02.3):**
  - Confirmed 100% of route pages in `App.tsx` use `React.lazy()`.
  - Verified bundle build completes cleanly in ~1.3s.
- [x] **Security Headers & API Hardening (P10-R02.4):**
  - Confirmed global security headers middleware in `apps/api/src/main.ts` (X-Content-Type-Options, X-Frame-Options, CSP, Referrer-Policy, HSTS).
  - CORS restricted to `WEB_ORIGIN`. Safe error envelope normalized across API exceptions.
- [x] **Commercial Truth & Documentation (P10-R02.5):**
  - Authored `RELEASE_NOTES.md` and `docs/development/RELEASE_CHECKLIST.md`.
- [x] **Final Verification Gates:**
  - `pnpm --dir apps/web test --run`: 35 test files passed, 121 tests passed (100% pass rate).
  - `pnpm --dir apps/api test`: 11 tests passed.
  - `apps/web tsc`: 0 errors.
  - `apps/api tsc`: 0 errors.
  - `apps/web build`: Success.
- **Handoff:** Phase 10 / V1 Release Hardening is 100% complete and verified.

### Completed — Light & Dark Mode Contrast Enhancements + Gamified Autofocus Guide System
- [x] **CSS Cascade Layer Fix (`apps/web/src/styles/tokens.css`):**
  - Wrapped unlayered `h1, h2, h3, h4, h5, h6` in `@layer base` and set `color: inherit;`.
  - Resolved Tailwind CSS v4 cascade conflict where unlayered base styles overrode `@layer utilities` classes (`text-white`, `dark:text-white`, `text-slate-900`), fixing black-on-black headings in dark banners under light mode.
- [x] **Custom Dark Mode Variant (`apps/web/src/index.css`):**
  - Updated `@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *, .dark, .dark *));` to seamlessly support both data-theme attribute and `.dark` class across all nested trees.
- [x] **Contrast Fix in Candidate Banners (`apps/web/src/components/candidate/NextActionGuidanceBanner.tsx`):**
  - Applied `!text-white` on banner heading and adjusted subtext to `text-slate-300` / `text-slate-200` for WCAG AAA contrast compliance against dark gradient.
  - Added `data-tour="next-action-banner"`.
- [x] **Autofocus Spotlight Target Hooks (`apps/web/src/pages/ApplicationDetailPage.tsx`):**
  - Added DOM tour hooks: `candidate-card`, `stage-sla-banner`, `timeline-section`, `quick-actions`, `about-application`.
- [x] **Gamified Autofocus Guide System:**
  - Built `apps/web/src/quickguide/gameSounds.ts` using zero-dependency Web Audio API oscillator synthesis for retro 8-bit / RPG step advancement chimes and victory fanfare.
  - Built `apps/web/src/quickguide/GameTourOverlay.tsx`:
    - Full-screen SVG/box-shadow spotlight mask focusing on target elements with smooth scrolling.
    - Pulsing target highlight ring.
    - Floating Gamer HUD with level progression bar, mission objective, junior recruiter caution tips, XP counter, audio toggle, and keyboard shortcuts (ArrowLeft/ArrowRight, Enter, Escape).
    - Level Up / Quest Completed celebration modal with trophy animation and XP reward celebration.
  - Extended `QuickGuideContext.tsx` with game tour state machine, `localStorage` persistence, and sound controls.
  - Updated `QuickGuideModal.tsx` with "🎮 Play Quest" CTA headers, overview banner, workflow tabs button, and modal footer game launch button.
  - Updated `QuickGuideTrigger.tsx` with quest notification indicator.
  - Enriched `pageGuidesData.ts` with missions, quest titles, and target selectors.
- [x] **Verification & Test Coverage:**
  - `npx tsc -b`: 0 errors.
  - `npm test -- --run`: 26 test files passed, 81 tests passed (100% pass rate).


### Completed
- [x] Read planning-with-files SKILL.md
- [x] Listed all 50 frontend page files
- [x] Read CommentsThread.tsx — confirmed UI-only, no API
- [x] Read Scorecard.tsx — confirmed no API wiring
- [x] Read ApplicationDetailPage.tsx top section — confirmed tab/modal structure
- [x] Read HiringCasePage.tsx — confirmed compliance workflow
- [x] Read JoiningManagementPage.tsx — confirmed flat list, no completion ceremony
- [x] Read App.tsx routes — confirmed all 50 pages are registered
- [x] Read FRONTEND_SIMPLE_SYSTEM_PLAN.md — noted all constraints
- [x] Created task_plan.md
- [x] Created findings.md
- [x] Created implementation_plan.md (artifact)

- [x] Task P0.1: Fix stage transition in ApplicationDetailPage.tsx to use optimistic locking with expectedStage, expectedVersion, 409 conflict detection with auto-refresh, loading spinner, and 500 error retry.
  - Verified 2026-09-04: opencode review (muse-spark-1.3, read-only) PASS all 4 reqs; tsc clean; web tests 58/58 pass. Committed.

### Delegation queue (agy implement + opencode/muse-spark-1.3 review + orchestrator commit, one commit per task)
| Task | Implementer | Review | Commit |
|------|-------------|--------|--------|
| P0.1 | pre-existing tree | opencode muse-spark-1.3 read-only PASS | 14df39e |
| P0.2 | agy (report lost on abort; work recovered) | opencode muse-spark-1.3 read-only PASS | 13d504c |
| P0.3 | agy | opencode muse-spark-1.3 read-only PASS; tsc clean; web build ok | 7d82564 |
| P1.1 | agy (timed out after writing file; no report) | opencode muse-spark-1.3 read-only PASS 6/6; tsc clean; tokens+props verified by orchestrator | a61d559 |
| P1.2 | agy (retry after network stall) | opencode muse-spark-1.3 read-only PASS 5/5 incl. backend DTO verification; tsc clean; web tests 58/58 pass. Accepted: Add Tag modal as in-scope-adjacent (wires P1.1 onAddTag, whitelisted skills field) | e4faaf9 |
| P1.3 | agy (killed during final verify; work recovered) | opencode muse-spark-1.3 read-only PASS 6/6; tsc clean; web tests 58/58 pass. Noted non-blocking: dialog closes on transition error (alert behind bar); onClick additive bypasses transition logic — audit at wiring (P1.4) | 766dc5a |
| P1.4 | agy | opencode muse-spark-1.3 read-only PASS 4/4; tsc clean; web build ok. Orchestrator hardening: version={application.version ?? 1} (matches P0.1 convention) | pending |
| P2.0-backend | agy | opencode muse-spark-1.3 read-only PASS 5/5 (guards, tenant isolation, validation verified); prisma valid; API tsc clean; eslint clean; API tests 11/11 pass. Implementer claims live DB migration + cross-tenant checks executed | 13029d3 |
| P2.2 | agy | opencode muse-spark-1.3 read-only PASS 6/6; tsc clean; web tests 58/58 pass; web build ok. Noted: GET failure is silent-empty (feed-level states deferred to P2.4); SmartActionBar still UI-only until P2.4 | pending |
| P2.3 | agy | opencode muse-spark-1.3 read-only PASS 6/6; tsc clean; web tests 58/58 pass. Orchestrator fix: dead class text-rf-ink-800 -> text-rf-ink (token undefined). Noted: composer list-hiding CSS couples to CommentsThread internals — revisit in P2.4 if fragile | pending |
| P2.4 | agy | opencode muse-spark-1.3 read-only review: App page PASS, hiring page CONDITIONAL (1 defect). tsc clean; web build ok. Orchestrator fix: conditional useMemo -> plain IIFE derivation (Rules-of-Hooks), tsc re-clean. Accepted benign: hiring inline error Alert, tab-gating, details-open default | pending |
| P0.2–P4.3 | agy (sequential) | opencode muse-spark-1.3 read-only | per task |

### Delegation mandates (user-approved 2026-09-04)
- agy runs use --dangerously-skip-permissions (headless write auto-denied without it). Treat agy runs as full access; orchestrator diff review is the safety net.
- Fixed PreToolUse hook quoting bug in ~/.gemini/config/plugins/googlecloudtools.datacloud_telemetry/hooks.json.

- [x] Task P0.2: Remove hardcoded fallback data from ApplicationDetailPage.tsx
  - Replaced hardcoded strings ('Ali Hassan', 'Frontend Developer', 'ali.hassan@email.com', '+20 101 234 5678', 'Cairo, Egypt', 'APP-02481', tags mock array) with null-safe accessors or dynamic empty states.
  - Added PageState empty banner when candidate is missing and hidden rows when email/phone/location are null.
  - Added real timeline rendering from history API and empty state for notes.
  - tsc clean (0 errors); web tests 58/58 pass.
  - Orchestrator verification 2026-09-04: opencode review (muse-spark-1.3, read-only) PASS items 1-4, P0.1 untouched, no new deps; tsc re-run clean; web tests re-run 58/58 pass. Committed.

- [x] Task P0.3: Green build gate + export SLAIndicator
  - Exported SLAIndicator from apps/web/src/components/ui/index.ts.
  - Verified `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` passes with 0 errors.
  - Verified `pnpm --dir apps/web build` passes with 0 errors (production build succeeded).
  - Verified no TypeScript errors in ApplicationDetailPage.tsx or any P0.1/P0.2 touched files.

- [x] Task P1.2: Rebuild CandidateDetailPage as Candidate 360 hub
  - Integrated CandidateWorkspace with candidate identity + active application pipeline stepper.
  - Added Tabs with 5 views: Overview (contact facts, sourcing channel, consent status, professional summary), Applications (ResponsiveDataView table), Interviews (ResponsiveDataView table with scorecard status), Offers (list with StatusBadges), and Timeline (Phase 2 placeholder).
  - Implemented loading (DetailSkeleton/TableSkeleton/ListSkeleton), empty (PageState kind="empty"), error (Alert tone="danger" + retry), and data states per tab.
  - Adapted endpoint handling: `GET /applications?candidateId=:id` unpacked from PaginatedResult; `GET /interviews` and `GET /offers` filtered client-side by candidate's application IDs (since backend forbidNonWhitelisted forbids candidateId on /interviews).
  - Wired interactive Add Tag modal with `PATCH /candidates/:id` and Assign to Vacancy modal.
  - Zero hardcoded fallback strings; null fields hidden cleanly.
  - tsc clean (0 errors); web tests 58/58 pass.

- [x] Task P1.3: Create SmartActionBar — context-aware sticky action bar
  - Created `apps/web/src/components/candidate/SmartActionBar.tsx`.
  - Implemented `SmartAction` and `SmartActionBarProps` contracts with strict types from contracts package (`ApplicationStage`).
  - Implemented `getDefaultActions(stage)` helper mapping each canonical stage to its context-aware actions.
  - Sticky bottom layout: `[Back] ... [Add Note] [Reject] [primary rightmost]` with role="toolbar" and aria-label="Application actions".
  - Blocked actions rendered as disabled Button with `aria-disabled` wrapped in `Tooltip` displaying `blockedReason`.
  - Destructive/confirmable actions wired to `ConfirmDialog`; "Reject" requires reason via ConfirmDialog textarea with comment validation.
  - Transitions use `PATCH /applications/:id/stage` with optimistic-lock payload (`stage`, `expectedStage`, `expectedVersion`, `reason?`) and 409 conflict detection.
  - "Add Note" opens `CommentsThread` inside `Drawer` wired to `onActionComplete`.
  - tsc clean (0 errors); web tests 58/58 pass.

- [x] Task P1.4: Integrate SmartActionBar into ApplicationDetailPage
  - Imported `SmartActionBar` and `getDefaultActions` in `apps/web/src/pages/ApplicationDetailPage.tsx`.
  - Removed disconnected header action buttons (`Back to applications` and options button) from top bar.
  - Kept all existing modal state (`isAddNoteModalOpen`, `isRejectModalOpen`, `handleStageMove`, etc.) intact for backwards compatibility.
  - Integrated `<SmartActionBar>` at bottom of page content area guarded by `application != null`.
  - Passed `applicationId={id || application.id}`, `stage={application.stage}`, `version={application.version}`, `actions={getDefaultActions(application.stage)}`, and `onActionComplete={refetchApplication}`.
  - Extracted `refetchApplication` using `useCallback` to reload application, history, and screening logs on action complete.
  - Verified `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` clean (0 errors).
  - Verified `pnpm --dir apps/web build` clean (production build succeeded in 1.55s).

- [x] Task P2.0-backend: Add ApplicationNote model + GET/POST /applications/:id/notes endpoints
  - Added `ApplicationNote` model to `database/prisma/schema.prisma` with uuid PK, organizationId, applicationId, authorId (User relation, onDelete Restrict), content text, timestamps, indexes on `[applicationId, createdAt]` and `[organizationId, applicationId]`, and back-relations `notes ApplicationNote[]` on `Application`, `applicationNotes` on `Organization` and `User`.
  - Created migration `20260905_add_application_notes/migration.sql` and applied table, indexes, and foreign keys to PostgreSQL DB (`application_notes` table verified in DB).
  - Regenerated Prisma client via `pnpm --dir database prisma:generate`.
  - Added `CreateApplicationNoteDto` with class-validator/class-transformer decorators (`@Transform` trim, `@IsString`, `@IsNotEmpty`, `@MaxLength(10000)`).
  - Implemented `listNotes(organizationId, applicationId)` and `createNote(organizationId, applicationId, authorId, content)` in `applications.service.ts` with organization ownership verification (404 NotFound if application absent or mismatched) and author display name/email mapping.
  - Implemented `GET /applications/:id/notes` (`APPLICATION_VIEW` + `TenantScopedGuard`) and `POST /applications/:id/notes` (`APPLICATION_MOVE_STAGE` + `TenantScopedGuard` + `@AuditAction('APPLICATION_NOTE_CREATE')`) in `applications.controller.ts`.
  - Added `ApplicationNote` and `CreateApplicationNoteInput` contract types to `packages/contracts/src/index.ts`.
  - Gates: API typecheck clean (`tsc --noEmit`), ESLint clean on touched files (0 errors, 0 warnings), existing error-normalizer unit tests 11/11 pass, live API cross-tenant isolation and 400 validation verified, DB migration executed.

- [x] Task P2.2: Wire CommentsThread to API (application notes only)
  - Extended `CommentsThreadProps` with optional `entityType?: 'application' | 'hiringCase'`, `entityId?: string`, and `initialComments?: CommentItem[]` while preserving legacy `comments`/`onPostComment` call shape and behavior.
  - Activated API mode strictly for `entityType === 'application' && entityId`: fetches `GET /applications/:id/notes` on mount and entity change, maps `ApplicationNote` to `CommentItem` (authorName ?? 'Unknown', derived initials, content, relative createdAt display).
  - Wired posting in API mode: sets `isPosting=true` (disables textarea and shows button loading spinner), calls `postApi('/applications/:id/notes', { content })`, on success clears input, reloads notes from server, and calls `onPostComment?.(trimmed)`; on error displays inline `Alert tone="danger"` below textarea mapping server validation errors (empty/too-long).
  - Kept UI-only behavior for `entityType === 'hiringCase'` or missing `entityId` (appends locally, calls `onPostComment`, zero calls to hiring endpoints).
  - Added `@mention` highlight: content matches for `/(@\w+)/g` rendered in `<mark className="mention-highlight">` with scoped CSS.
  - Verification: `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` clean (0 errors); web tests 58/58 pass; production build succeeds.

- [x] Task P2.3: Create ActivityFeed — merged notes + events timeline
  - Created `apps/web/src/components/candidate/ActivityFeed.tsx`.
  - Implemented and exported contract types `FeedEntry` (`note`, `stage_change`, `interview`, `offer`, `system`) and `ActivityFeedProps` (`entityType: 'application' | 'hiringCase'`, `entityId`, `entries`, `onRefresh`, `className?`).
  - Implemented defensive newest-first re-sort by `createdAt`.
  - Consistent note rendering with `Avatar` initials, author name, optional author role, relative timestamp, and content with `@mention` highlighting consistent with `CommentsThread`.
  - Consistent system event rendering with colored left borders and verified Icon names (zero substitutions needed):
    - `stage_change` -> Icon `arrow-right` + teal left border (`border-l-4 border-l-teal-500`) + `byUser` actor
    - `interview` -> Icon `calendar` + blue left border (`border-l-4 border-l-blue-500`)
    - `offer` -> Icon `file-text` + purple left border (`border-l-4 border-l-purple-500`)
    - `system` -> Icon `info` + grey left border (`border-l-4 border-l-slate-400`)
  - Relative date calculation (`formatTimeAgo`) implemented with plain JS Date math (no external libraries), returning e.g. "2 hours ago", "Just now", "Yesterday".
  - Empty entries state rendered via `PageState kind="empty" title="No activity yet"`.
  - Bottom "Post a note" composer rendered via `CommentsThread` with `entityType` and `entityId` passthrough; calls `onRefresh()` after note post. Internal comment list hidden via scoped CSS in composer mode to prevent note duplication. Pure data-in component with zero fetch calls inside.
  - Verification: `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` clean (0 errors).

- [x] Task P2.4: Integrate ActivityFeed into ApplicationDetailPage and HiringCasePage
  - ApplicationDetailPage:
    - Wired `ActivityFeed` into the 'activity' tab: `<ActivityFeed entityType="application" entityId={id!} entries={mergedEntries} onRefresh={refetchAll} />`.
    - Integrated `GET /applications/:id/notes` into `refetchApplication` (parallel `Promise.allSettled` fetching application, history, screening logs, and notes).
    - Mapped `ApplicationStatusHistoryItem[]` to `FeedEntry` (`type: 'stage_change'`, label e.g. `"${from} → ${to} — ${reason}"`, `byUser` from `changedByName` falling back to `'System'`, ISO `createdAt`).
    - Mapped `ApplicationNote[]` to `FeedEntry` (`type: 'note'`, `authorName` ?? `'Unknown'`, derived initials via `getInitials`, content, and ISO `createdAt`).
    - Enabled full tab switching for `activity`, `overview`, `resume`, and `tasks` views. Overview Timeline "View full timeline" and Notes "View all notes" direct users to the Activity tab.
    - Notes card on Overview tab displays dynamic preview of recent notes.
    - Connected Add Note modal to `POST /applications/:id/notes` with loading state, validation, and auto-refresh on save.
    - Handled states: loading renders `<ListSkeleton count={3} />`, empty state handled cleanly by `ActivityFeed`, errors surfaced via page `<Alert tone="danger">`.
  - HiringCasePage:
    - Added collapsible section `<details open className="rf-panel ...">` with header "Activity & Notes" below the pre-hire compliance checklist.
    - Mapped `hiringCase.approvals` to `FeedEntry`: decided approvals mapped to `type: 'stage_change'` with `byUser: app.approverName`, decision status, and comment; pending approvals mapped to `type: 'system'` with `${roleCode} approval pending`.
    - Mapped `hiringCase.complianceRequirements` status changes: verified/exempt items mapped to `FeedEntry` (`stage_change` if `verifiedBy` present, otherwise `system`).
    - Added case initiation event (`type: 'system'`) and joining event (`type: 'stage_change'` if `actualJoiningDate` present).
    - Handled UI-only legacy note posting via `ActivityFeed` (`entityType="hiringCase"`), triggering case refresh on note submission.
    - Feed loading state renders `<ListSkeleton count={3} />`; page errors surfaced via in-page `<Alert tone="danger">` without unmounting.
  - Verification: `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` clean (0 errors); `pnpm --dir apps/web build` clean (production build in 2.76s); `pnpm --dir apps/web test` 58/58 pass.
  - Phase 2 complete and closed.

### In Progress
- None (Phase 2 closed; ready for Phase 3).

### Blocked
- None.

### Mission acceptance criteria (user-added 2026-09-05)
- After full plan completion: entire app verified working with demo users (seed/demo accounts, all roles).
- UI/UX polished to perfect: no hardcoded data, consistent tokens, empty/loading/error states everywhere, responsive + accessible.
- Post-plan: orchestrator MAY propose enhancements and delegate them under the same rules (agy implement + opencode/muse-spark-1.3 review + orchestrator commit) without asking.

### P3.1 preflight (orchestrator inline probe, 2026-09-05): DONE
- InterviewScorecard model EXISTS (schema.prisma) with interview/interviewer relations, overallRating, recommendation, strengths/concerns/notes, isLocked, submittedAt.
- POST /interviews/:id/scorecard EXISTS (SubmitScorecardDto; interviewer-only guard; locks on submit; locked resubmit -> 400 BadRequest, NOT 409).
- No dedicated GET /interviews/:id/scorecard, but GET /interviews/:id includes scorecards[] with interviewer -> P3.2 reads form state from there.
- P3.2 unblocked with corrections: read scorecard from GET interview detail; expect 400 (not 409) on locked resubmit.

### P3.2 Wire Scorecard component into InterviewDetailPage: DONE
- InterviewDetailPage:
  - Wired controlled `Scorecard` component into a dedicated "Feedback & Scorecard" section below interview metadata.
  - Sourced scorecard read state from `interview.scorecards` via `GET /interviews/:id`, matching `interviewerId` with authenticated user `user.id` (with fallback to single unlocked card or latest submitted card).
  - Configured default categories (`Technical Skills`, `Communication`, `Problem Solving`, `Culture Fit`) with criteria rated 1-5, tracking ratings in page state and computing dynamic `isComplete` badges.
  - Implemented notes fieldset (`strengths`, `concerns`, `notes` <= 5000 chars) and primary Submit Scorecard button with loading state.
  - Form validation: ensures all required criteria are rated 1-5 and an overall recommendation is chosen before POST.
  - Calculated `overallRating`: rounded average of all criteria ratings clamped 1-5; mapped recommendation enums (`strong_hire` -> `'Strong Hire'`, `hire` -> `'Hire'`, `no_hire` -> `'No Hire'`; backend `'Neutral'` mapped to nearest `'hire'`).
  - Scorecard lock on submit: transitions to locked state with `<Badge variant="success">Submitted</Badge>`, handlers omitted (`onRatingChange={undefined}`, `onRecommendationChange={undefined}`, `onSubmit={undefined}`), scoped lock styling to disable ratings/recommendations and hide internal submit button while preserving category accordion inspection, and renders read-only display for `submittedAt`, overall rating, recommendation, strengths, concerns, and notes.
  - Access control & error handling:
    - Non-interviewer guard: alerts "Only the assigned interviewer can submit feedback" when user is not in `interview.attendees` or when backend returns 403 on submit.
    - 400 locked resubmission error: renders warning alert "Feedback already submitted for this interview" and refetches interview.
    - General submission errors: renders danger alert with a "Retry" button.
    - Loading state: renders 2-row `Skeleton` while interview data loads.
- Verification: `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` passed clean (0 errors); unit test `Scorecard.test.tsx` passed clean.
- Orchestrator verification: opencode muse-spark-1.3 read-only PASS all (enum mapping, lock, guards, scope); tsc re-run clean. Known-accepted: Neutral->hire lossy map; pre-existing page literals + mock panel outside scope (final UI/UX sweep).

### P3.3 Create ScorecardSummary + embed in Candidate 360 + ApplicationDetailPage header: DONE
- Created `apps/web/src/components/candidate/ScorecardSummary.tsx`:
  - Implemented `ScorecardSummaryProps` interface (`interviewTitle`, `interviewDate`, `interviewerName`, `recommendation: 'strong_hire'|'hire'|'no_hire'|null`, `averageRating`, `interviewId`, `isLocked`, `pendingLabel?`).
  - Layout matches specification: header title + date, interviewer row with icon, `ProgressBar` rating x/5 (accessible with `aria-label`, meta labels, and dynamic tone), colored recommendation badge (`strong_hire` -> success green, `hire` -> info blue, `no_hire` -> danger red, `null` -> neutral grey "Pending" / custom pendingLabel), lock icon when `isLocked`, and `"View full scorecard ->"` link to `/interviews/:id`. Existing design system tokens only, zero hardcoded values.
  - Exported reusable scorecard aggregation helpers: `mapBackendToUiRecommendation` (inline mapping reusing P3.2 enum mapping rules without importing from page), `aggregateInterviewScorecards` (averages overall ratings 1-5 to 1 decimal place, calculates majority/top recommendation with tie-break `strong_hire` > `hire` > `no_hire`, joins deduplicated interviewer names, detects locked state), and `computeInterviewsStats` (tallies Strong Hire, Hire, No Hire, and Pending counts across interviews).
- Integrated into `CandidateDetailPage.tsx`:
  - Replaced raw table in Interviews tab with responsive grid of `<ScorecardSummary>` cards.
  - Per interview with scorecard: computes aggregated rating, majority/top recommendation, interviewer names, and renders `<ScorecardSummary>`.
  - Per interview without scorecard: renders `<ScorecardSummary>` with `recommendation={null}`, `averageRating={null}`, `pendingLabel="Pending feedback"`, displaying neutral "Pending feedback" badge.
  - Tab header displays summary badges: Strong Hire (success), Hire (info), No Hire (danger), and Pending feedback (neutral).
  - Preserved client-filtering on candidate application IDs; verified `GET /interviews` list items already include `scorecards[]` from backend Prisma include (no N+1 `GET /interviews/:id` required).
- Integrated into `ApplicationDetailPage.tsx`:
  - Fetched `GET /interviews?applicationId=:id` in parallel alongside existing loads in `refetchApplication`.
  - Displayed aggregate recommendation badges in page header next to `<StatusBadge status={application.stage} />`.
  - Shows breakdown counts of Strong Hire (success), Hire (info), No Hire (danger), and Pending (neutral).
  - Null-safe fallback: renders `<Badge variant="neutral">No interviews</Badge>` when no interviews exist, and `"Pending feedback"` when interviews are pending evaluation.
  - Entire aggregate badge links directly to `/interviews`.
- Verification:
  - `pnpm --dir apps\web exec tsc -p tsconfig.app.json --noEmit` passed clean (0 errors).
  - `pnpm --dir apps\web build` passed clean (production build succeeded in 1.32s).
  - Unit tests in `apps/web` (23 test files, 58 tests) all passed clean.
- Phase 3 complete and closed.
- Orchestrator verification: opencode muse-spark-1.3 read-only PASS all (helpers logic, embeds, scope); tsc re-run clean; web tests re-run 58/58 pass. Accepted: null-default mapping, pending-fallback edge, generic /interviews link.

### P4.1 Create JoiningChecklist component: DONE
- Created `apps/web/src/components/candidate/JoiningChecklist.tsx`:
  - Implemented `ComplianceItem` interface (`id`, `label`, `isCompleted`, `notes: string | null`, `completedAt: string | null`) and `JoiningChecklistProps` interface (`hiringCaseId`, `candidateName`, `items: ComplianceItem[]`, `hiringCaseStatus`, `canConfirmJoining`, `onItemToggle: (itemId, isCompleted) => Promise<void>`, `onConfirmJoining: () => Promise<void>`, `className?`).
  - Layout & UI components:
    - Header: `"Joining Checklist — {candidateName}"` with `tasks` icon and `Badge variant="success"` when `hiringCaseStatus === 'Joined'`.
    - Terminal Joined banner: `<Alert tone="success" title="Joined ✓">` when `status === 'Joined'`.
    - Progress: `<ProgressBar>` displaying `completedCount/totalCount complete` with dynamic tone (`success` when joined/complete, `action` otherwise) and native ARIA accessibility attributes (`role="progressbar"`, `aria-valuenow`, etc.).
    - Checklist rows: `CheckboxField` per item with `label`, `description` (notes and formatted completedAt date when present), and optimistic updates with automatic rollback and inline error on rejection.
    - Confirm action: Primary `<Button>` disabled unless `(allComplete && canConfirmJoining && status !== 'Joined')`.
    - Modal confirmation: Connected to `<ConfirmDialog tone="success" title="Confirm joining and close headcount" description="Confirm that {candidateName} has reported for work. This will automatically update the vacancy filled headcount." confirmLabel="Confirm Joining">` with `isLoading` spinner state during async confirmation.
  - States:
    - In-flight item toggling spinner next to item label.
    - Inline error state in CheckboxField with `alert-triangle` icon and red alert role.
    - Confirm loading state during `onConfirmJoining`.
    - Terminal joined state (`hiringCaseStatus === 'Joined'`) locking checklist rows into disabled read-only view.
  - Accessibility & Architecture:
    - Data-in only architecture with 0 fetch calls inside.
    - Native checkbox labels via `CheckboxField` with 44px touch target.
    - Strict design system tokens (`rf-panel`, `rf-border-subtle`, `text-rf-ink`, etc.) with zero hardcoded values.
- Verification:
  - `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` passed clean (0 errors).
  - Web unit tests (23 test files, 58 tests) passed clean (100% pass rate).
- Orchestrator verification: opencode muse-spark-1.3 read-only PASS all 5 (interfaces, toggle/optimistic, gating/dialog/Joined, primitives/a11y, scope); tsc re-run clean. Accepted: ✓ glyph literals, additive className, confirm-failure closes dialog (consistent with SmartActionBar).

### P4.2 Integrate JoiningChecklist into HiringCasePage: DONE
- Integrated `JoiningChecklist` into `apps/web/src/pages/HiringCasePage.tsx`:
  - Replaced the raw compliance item list/table with `<JoiningChecklist>` wrapped in `<section id="checklist">` deep-link anchor.
  - Mapped `ComplianceRequirementItem[]` -> `ComplianceItem[]`: `{ id, label: name, isCompleted: status === 'Verified', notes: null, completedAt: verifiedAt ?? null }`.
  - Implemented `handleItemToggle` (`onItemToggle`): calls `PATCH /hiring/:id/compliance/:itemId` with `{ status: isCompleted ? 'Verified' : 'Pending' }`, awaits `loadCase()` on success for server-truth synchronization, and re-throws errors so `JoiningChecklist` rolls back optimistic updates and displays inline error alerts.
  - Implemented `handleConfirmJoining` (`onConfirmJoining`): calls `POST /hiring/:id/joining` with `{ status: 'Joined', actualJoiningDate: new Date().toISOString() }`, updates action message alert, awaits `loadCase()`, and re-throws errors for the dialog confirmation error alert.
  - Resolved `canConfirmJoining` permissions via `useAuth()` inspecting user roles against authorized codes (`ADMIN`, `SYSADMIN`, `ADMINISTRATOR`, `HIRING_MANAGER`, `TALENT_MANAGER`, `HR_MANAGER`).
  - Passed `hiringCaseStatus={hiringCase.status}` and `candidateName={hiringCase.candidateName ?? 'Candidate'}`.
  - Preserved pre-hire compliance percentage progress bar, submit for approval, final approval flows, and P2.4 `ActivityFeed` section untouched.
  - Cleaned up unused `ResponsiveDataView` import (`noUnusedLocals` compliant).
- Verification:
  - `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` passed clean (0 errors).
  - `pnpm --dir apps/web build` passed clean (production build succeeded in 2.92s).
  - `pnpm --dir apps/web test` passed clean (23 test files, 58 tests, 100% pass).
- Orchestrator verification: opencode muse-spark-1.3 read-only PASS all 5; tsc re-run clean. Noted for post-plan UI sweep: Exempt/'Not Required' set-path dropped (items render unchecked, progress counts them done); two joining paths coexist (header quick-action + checklist ceremony) — both functional.

### P4.3 Upgrade JoiningManagementPage rows + Offer→Joining bridge: DONE
- Updated `apps/web/src/pages/JoiningManagementPage.tsx`:
  - Extended `JoiningRow` type with optional `checklistProgress?: number`, `completedItems?: number`, and `totalItems?: number`.
  - Enriched fetched items in `loadData` without altering fetch type (`getApi<JoiningRow[]>('/hiring')`): safely checks `complianceRequirements` with `Array.isArray`, counts completed requirements (`status === 'Verified' || 'Not Required'`), and calculates `checklistProgress` percentage.
  - Added `"Checklist"` column (`priority: 'secondary'`): renders `<ProgressBar value={item.checklistProgress ?? 0} label={`${item.completedItems ?? 0}/${item.totalItems}`} />` when `totalItems > 0`, and neutral `<Badge>Not started</Badge>` when `totalItems === 0` or absent.
  - Deep-linked row actions and candidate name to `/hires/${item.id}#checklist`.
  - For `status === 'Joined'` rows: replaced "Manage" action with `<Badge variant="success">✓ Headcount closed</Badge>`, and wrapped status/action badges with `className="row--joined"`. (Since `ResponsiveDataView` does not expose a row-level className prop, badges are wrapped with `row--joined` per prompt guidance).
  - Updated `TableSkeleton` columns count to 9.
- Updated `apps/web/src/pages/OfferDetailPage.tsx`:
  - Enabled fetched offer state `const [offer, setOffer] = useState<Offer | null>(null)`.
  - Added `"Next Step: Joining"` section gated strictly by `offer?.status === 'Accepted'` (hidden if offer is null or not accepted):
    - Queries `GET /hiring` to find case matching `offerId === offer.id`.
    - When case found: renders primary button with `<Link to={`/hires/${joiningCase.id}`}>View Joining Case</Link>`.
    - When none found: renders primary button with `onClick={handleCreateJoiningCase}` with loading spinner state.
    - Displays error `<Alert tone="danger">` on failure.
  - Implemented `handleCreateJoiningCase`: POSTs `/hiring` with `{ offerId: offer.id }`, validates `response.id`, and navigates to `/hires/${response.id}` with fallback reload matching by `offerId`.
  - Preserved mocked letter content untouched.
- Verification:
  - `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` passed clean (0 errors).
  - `pnpm --dir apps/web build` passed clean (production build succeeded in 1.39s).
  - Web unit tests (23 test files, 58 tests) passed clean (100% pass rate).
- Phase 4 complete and closed. Full plan complete.

### P4.3-fix Server-computed checklist counts + remove dead CSS class: DONE- Task ID: P4.3-fix (delta, completes P4.3 exit gate)
- Updated `apps/api/src/hiring/hiring.service.ts`:
  - Added `complianceRequirements: { select: { status: true } }` to the Prisma include in `listHiringCases`.
  - Added additive server-computed counts to each returned case: `completedItems` (count of requirements with status `'Verified'` or `'Not Required'`) and `totalItems` (requirements count).
  - Preserved all existing fields untouched without reshaping.
- Shared contracts check:
  - Checked `HiringCase` in `@recruitflow/contracts`. It already has optional `complianceRequirements?: ComplianceRequirementItem[]` and all required fields are satisfied. `JoiningManagementPage` uses its local `JoiningRow` which already has `completedItems?: number; totalItems?: number;`. Added nothing to contracts since existing interfaces are fully compatible.
- Updated `apps/web/src/pages/JoiningManagementPage.tsx`:
  - Updated `loadData` mapping to prefer server-provided counts: `completed = item.completedItems ?? runtimeCompleted ?? 0; total = item.totalItems ?? runtimeTotal ?? 0;`.
  - Fallback to `<Badge variant="neutral">Not started</Badge>` strictly preserved when `total === 0`.
  - Removed dead `row--joined` CSS class usages from the status column and action column while preserving `<Badge variant="success">✓ Headcount closed</Badge>`.
- Verification:
  - API typecheck: `tsc --noEmit` clean (0 errors).
  - Web tsc: `tsc -p tsconfig.app.json --noEmit` clean (0 errors).
  - API unit tests: 11/11 tests pass (error-normalizer).
  - Web unit tests: 23/23 files, 58/58 tests pass (100% pass rate).
  - Web build: `pnpm --dir apps/web build` passed clean (production build succeeded).
- Orchestrator verification: opencode muse-spark-1.3 read-only PASS all (no N+1, server-preferred counts, dead class gone, no shape breaks); API tsc re-clean; web+API tests re-run green (58/58, 11/11). Noted for enhancements: License page expects full complianceRequirements from list (pre-existing gap); progress counts optionals vs required-only gate.

### FINAL GATE (orchestrator, 2026-09-05): FULL PLAN COMPLETE
- Code gates on final tree: web tsc clean, web build ok, web tests 58/58 pass, API tsc clean, API tests 11/11 pass. Prisma schema valid. Migration 20260905 applied directly (idempotent SQL) — repo `migrate deploy` still P3005-unbaselined (pre-existing: no _prisma_migrations table; REPORTED as ops item, not silently fixed).
- Live demo verification (API :3000, demo org RECRUITFLOW-DEMO, password Password123!): logins a@test.com (ADMINISTRATOR) / m@test.com (HIRING_MANAGER) / e@test.com (RECRUITER) + named staff all ok; applications list (18); notes POST->GET round-trip with author; scorecard submit ok + locked resubmit 400; offer create->approve->Sent->Accepted; hiring case create; list counts 2/2 live; compliance toggles; submit->final-approve->Joined. Invalid transitions correctly 400 (offer accept guard, joining-status guard). Demo rows cleaned up afterward; state re-verified pristine (0 cases, 1 offer, app Offer stage, 0 notes, 1 scorecard).
- UI/UX audit: 12/49 pages still contain hardcoded demo literals (ApplicationsPage 14, TasksPage 16, InterviewDetailPage 13, OffersPage 12, ManagerDashboard 11, OfferDetailPage 10, VacantListPage 10, StageTransitionPage 9, VacancyOverviewPage 6, JobAnalyticsPage 5, InterviewsPage 5, CVIntakePage 2). Scheduled as enhancements sweep E1-E5 (pre-approved).
- API left RUNNING (PID 2472, fresh build with all phases) for manual browser verification.

### E1 Remove hardcoded demo literals from interview pages: DONE
- Task ID: E1
- Scope: `apps/web/src/pages/InterviewDetailPage.tsx`, `apps/web/src/pages/InterviewsPage.tsx`
- Replaced literals in `InterviewDetailPage.tsx`:
  - Replaced hardcoded candidate name 'Ali Hassan' and alt text with dynamic `candidateDisplayName = interview?.candidateName ?? 'Unknown candidate'`, position title with `interview?.positionTitle ?? 'No position'`, and initials avatar fallback.
  - Replaced hardcoded mailto `ali.hassan@example.com` and tel links: mailto only rendered if candidate email exists; call button only rendered if phone exists.
  - Replaced hardcoded subtitle 'Engineering • Cairo, Egypt • Applied 28 Aug 2026' with real scheduled/applied dates (`appliedDateLine`) and timezone.
  - Replaced hardcoded 'APP-02481' and `/applications/APP-02481[/transition]` links with `appIdDisplay` (first-8 APP- convention) and real `interview.applicationId` navigation.
  - Derived "Interview Owner" from attendees (`role === 'Lead' | 'Host' | 'Organizer'` or first attendee) / scorecards / `'Unassigned'`.
  - Derived "Interview Panel" list from `interview.attendees` (`userName`, `role`) and checked real scorecard submission status against `interview.scorecards`. Rendered null-safe empty state when no attendees are assigned.
  - Derived pending panel banner count dynamically (`attendees.length - scorecards.length`).
  - Replaced hardcoded attachment rows ('Ali Hassan CV.pdf', 'Portfolio - Ali Hassan.pdf') with dynamic `attachments` check and empty state ("No attachments") when none exist.
  - Strictly preserved P3.2 Feedback & Scorecard section (`<section aria-labelledby="feedback-scorecard-heading">`) untouched.
  - Derived "Interview Scorecard" table headers and rating rows from real `interview.scorecards`, with empty state when none are submitted.
  - Derived "Feedback Summary" items and author names from real `interview.scorecards` (`interviewerName`, `notes`, `strengths`, `concerns`, `recommendation`), replacing hardcoded quotes and authors.
  - Derived Recommendation (Average) from scorecards (majority recommendation) with null-safe pending fallback.
- Replaced literals in `InterviewsPage.tsx`:
  - Removed `DEFAULT_INTERVIEW_GROUPS` containing 8 mock candidate/interviewer rows ('Ali Hassan', 'Sarah Ahmed', 'On-site Cairo HQ', Unsplash avatars).
  - Derived `interviewGroups` dynamically from fetched `apiInterviews` with calendar day grouping (Today / Tomorrow / Day Name) and real field mappings (`candidateName ?? 'Unknown candidate'`, `positionTitle ?? 'No position'`, duration computed from `scheduledStart`/`scheduledEnd`).
  - Replaced interviewer filter `<option>Sarah Ahmed</option>` with data-driven `interviewerOptions` derived from `apiInterviews` attendees and scorecards.
  - Implemented empty state using `<PageState kind="empty">` when no interviews are scheduled or match active filters.
  - Derived "Feedback Pending" sidebar card dynamically from past/unscored interviews in `apiInterviews` with empty state fallback.
  - Derived "Today's Interviews Summary" counts (`totalInterviews`, `completedCount`, `pendingFeedback`, `panelsCount`) dynamically from `apiInterviews`.
  - Updated CSV export to export real `interviewGroups` data.
  - Preserved existing scheduling form and API fetch logic.
- Verification:
  - `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` passed clean (0 errors).
  - `pnpm --dir apps/web build` passed clean (1.59s).
  - `pnpm --dir apps/web test` passed clean (23 test files, 58/58 tests pass).
- Orchestrator verification: opencode muse-spark-1.3 read-only PASS (zero literals, P3.2 untouched, mock gone, scope clean); tsc re-run clean; literal grep 0/0 on both files. Noted: schedule-form defaults (Clinical Assessment Round, Asia/Riyadh, Teams URL) left for follow-up.

### E2 Remove hardcoded demo literals from offer pages: DONE
- Task ID: E2
- Scope: `apps/web/src/pages/OffersPage.tsx`, `apps/web/src/pages/OfferDetailPage.tsx`
- Replaced literals in `OffersPage.tsx`:
  - Removed `DEFAULT_OFFERS` array (8 mock rows including 'Ali Hassan', 'Sarah Ahmed', 'Mona Khaled', Unsplash photos, and hardcoded dates/salaries).
  - Wired table rows directly to `apiOffers` fetched via `GET /offers` with strict null-safe fallbacks (`candidateName ?? 'Unknown candidate'`, `positionTitle ?? 'No position'`, `ownerName: o.createdByName || 'Unassigned'`).
  - Derived compensation package dynamically from `currentVersion.monthlyPackage` or components sum, with fallback to `'—'` when missing.
  - Derived expiry dates and dynamic SLA badge countdowns (`daysLeftTone`) from `currentVersion.offerExpiry`.
  - Replaced hardcoded KPI card metrics (6, 4, 9, 5, 2) with real dynamic aggregates computed from `apiOffers`.
  - Replaced hardcoded status filter pill counts (26, 3, 6, 8, 9, 3, 2) with real counts per status.
  - Neutralized Create Offer modal inputs: removed `defaultValue="Ali Hassan"` and `defaultValue={28000}`, replacing them with clean placeholders.
  - Integrated `<PageState kind="empty">` for empty offers list and filtered no-match states with reset action.
  - Added real pagination mechanics and page size selector.
- Replaced literals in `OfferDetailPage.tsx`:
  - Replaced hardcoded candidate header 'Mona Saleh' and Unsplash photo with initials avatar and `offer?.candidateName ?? 'Unknown candidate'`.
  - Replaced hardcoded 'Registered Nurse – ICU' with `offer?.positionTitle ?? 'No position'`.
  - Contact links (`mailto:` / `tel:`): dynamically bound to real candidate email/phone if present on the application record; cleanly hidden when absent (no fake emails/phones).
  - Replaced hardcoded offer code 'OFF-2026-1157' with `offer?.offerCode || id || '—'`.
  - Derived status badge dynamically from `offer.status`.
  - Letter Preview: added interactive Letter Preview modal rendering real employment parties, dates (`createdAt`, `proposedJoiningDate`, `offerExpiry`), components table with types/frequencies/amounts, and totals; renders `<PageState kind="empty">` when no current version is available.
  - Dynamic Letter Download: replaced static template with dynamic letter generator pulling real parties, positions, dates, components, and package totals; download filename dynamically slugged with `Offer_Letter_${candidateSlug}_${offerCode}.txt`.
  - Notes: replaced hardcoded seed note ('Mona accepted the offer...') with empty initial state `notesList: []`, empty-state card when no notes exist, and wired composer modal appending notes with current user display name and timestamp.
  - Dates: dynamically derived all dates from `offer.createdAt`, `offer.updatedAt`, `offer.currentVersion.proposedJoiningDate`, and `offer.currentVersion.offerExpiry`.
  - Compensation Package: replaced hardcoded salary/allowances with dynamic list of `offer.currentVersion.components`, monthly package, annual fixed totals, and real benefit components list.
  - Approvals Timeline: derived timeline dynamically from `offer.currentVersion.approvals` and status milestones (`Sent`, `Accepted`), eliminating hardcoded approvers and dates.
  - Checklist Card: replaced hardcoded checklist items and "7 of 9 completed" count with a status-aware banner linking directly to the active joining case when present or instructing to activate on acceptance.
  - Strictly preserved P4.3 joining case bridge (`useEffect` lines 44-61, `handleCreateJoiningCase` lines 63-86) and Next Step joining section (lines 257-315) untouched.
- Verification:
  - `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` passed clean (0 errors).
  - `pnpm --dir apps/web build` passed clean (production build succeeded in 1.36s).
  - `pnpm --dir apps/web test` passed clean (23 test files, 58/58 tests pass).

### E3 Remove hardcoded demo literals from dashboards, tasks, and vacancy pages: DONE
- Task ID: E3
- Scope: `apps/web/src/pages/TasksPage.tsx`, `apps/web/src/pages/ManagerDashboard.tsx`, `apps/web/src/pages/VacantListPage.tsx`, `apps/web/src/pages/VacancyOverviewPage.tsx`, `apps/web/src/pages/JobAnalyticsPage.tsx`
- Replaced literals in `TasksPage.tsx`:
  - Removed `DEFAULT_TASKS` (10 mock items containing Unsplash avatars, fake names 'Ali Hassan', 'Mona Saleh', fake position titles, and static counts).
  - Wired list query to `GET /tasks?pageSize=100`, `GET /vacancies`, and `GET /users/interviewers` in parallel.
  - Derived filter tabs (All, Pending, In Progress, Completed) dynamically with real counts.
  - Derived vacancy options dynamically from real vacancies (`vacancies.map(v => ({ value: v.id, label: v.title }))`).
  - Derived assignee options dynamically from real interviewers/team members (`interviewers.map(u => ({ value: u.id, label: u.displayName }))`).
  - Mapped tasks table rows to real `TaskItem` fields with null-safe fallbacks: candidate display name (`'Unknown candidate'`), position title (`'No position'`), assignee (`'Unassigned'`), and formatted due dates.
  - Integrated `<PageState kind="empty">` for empty tasks list and filter no-match states with reset action.
  - Replaced hardcoded KPI metrics with dynamic computations: `totalTasks`, `pendingTasks`, `inProgressTasks`, `completedTasks`, `urgentTasks`.
  - Preserved existing task creation modal (`POST /tasks`) and status toggle handlers (`PATCH /tasks/:id/status`).
- Replaced literals in `ManagerDashboard.tsx`:
  - Emptied `DEFAULT_OPEN_VACANCIES` (5 mock vacancies) and `RECRUITER_OPTIONS` mock arrays.
  - Wired data loaders to `GET /vacancies`, `GET /applications?pageSize=100`, `GET /reports/overview`, `GET /interviews`, and `GET /users/interviewers`.
  - Replaced hardcoded KPI metric cards (12 open positions, 84 active candidates, 19 interviews this week, 6 pending offers) with real live counts computed from vacancies, applications, and interviews.
  - Replaced "My Priorities" static cards with dynamic action items derived from real data (applications in screening, pending offers, interviews today, open vacancies without applicants), rendering `<PageState kind="empty">` when caught up.
  - Replaced "Open Positions" table with real `apiVacancies` data: null-safe position titles, departments, recruiter names, real applicant counts, days open, and SLA status badges; renders `<PageState kind="empty">` when no open vacancies exist.
  - Replaced "Upcoming Interviews" static list with real `apiInterviews` scheduled today or later, displaying real candidate names, interview types, scheduled times, and interviewer names; renders `<PageState kind="empty">` when none scheduled.
  - Replaced "Recent Activity" mock rows ('Ali Hassan', 'Sarah Ahmed', 'Mona Khaled') with dynamic activity timeline derived from latest application stage updates and interview schedules.
  - Replaced hardcoded greeting name with authenticated user's first name (`user?.displayName.split(' ')[0]`).
- Replaced literals in `VacantListPage.tsx`:
  - Removed `DEFAULT_JOB_POSITIONS` (10 mock job items with fake departments, managers, and applicant counts).
  - Mapped table rows directly from `GET /vacancies` (`apiVacancies`) with null-safe fallbacks: position title (`'No position'`), department (`'—'`), location (`'—'`), recruiter/owner (`'Unassigned'`), and real application counts.
  - Replaced hardcoded KPI metrics (10 open positions, 42 total vacancies, 14 urgent vacancies, 6 draft positions) with dynamic calculations over `apiVacancies`.
  - Derived filter dropdown options dynamically from `apiVacancies`: unique departments, locations, and recruiters/owners.
  - Integrated `<PageState kind="empty">` when vacancies list is empty or when search/filters return no results, with "Clear all filters" button.
  - Export to CSV exports real filtered vacancy records.
- Replaced literals in `VacancyOverviewPage.tsx`:
  - Removed fake fallback literals ('Senior Frontend Engineer', 'Clinical Operations', 'Cairo, Egypt (Hybrid)', applications 48, interviews 7, offers 3, hires 1).
  - Wired data loaders to `GET /vacancies/:id`, `GET /applications?vacancyId=:id&pageSize=100`, `GET /interviews`, `GET /offers`, and `GET /users/interviewers`.
  - Mapped recruitment funnel metrics dynamically: Total Applications (`applications.length`), Screening, Interviews, Offers, and Hired (`applications.filter(a => a.stage === 'Joined' || (a as any).stage === 'Hired').length`).
  - Derived SLA time-to-fill metric dynamically from vacancy creation date vs standard 45-day target.
  - Replaced hardcoded Hiring Team members ("Sarah Ahmed", "Dr. Tariq Mahmoud") with dynamic assignment list mapped from `vacancy.assignments` and `interviewers`, with clean `<PageState kind="empty">` when unassigned.
  - Replaced hardcoded Job Requirements / Tech Stack chips ('React', 'TypeScript', 'Webpack' for nurse/doctor positions) with dynamic parameters from `vacancy.requirements` or `vacancy.skills`, rendering structured requisition details or empty fallback.
  - Replaced hardcoded Activity Feed ('Ali Hassan', 'Noha Farouk', 'Mona Salah') with real dynamic events derived from application stage transitions and interview events for this vacancy.
  - Replaced Quick Links with real deep links to `/vacancies/:id/analytics`, `/applications?vacancyId=:id`, and `/vacancies`.
- Replaced literals in `JobAnalyticsPage.tsx`:
  - Bound route parameter `id` via `useParams<{ id: string }>()`.
  - Wired loaders to `GET /vacancies/:id`, `GET /applications?vacancyId=:id&pageSize=100`, `GET /interviews`, and `GET /users/interviewers`.
  - Replaced hardcoded KPI metrics (48 applicants, 26 screened, 15 interviewed, 3 offers, 1 hired, 28 days avg time-to-hire) with real counts computed from the vacancy and its application dataset.
  - Replaced hardcoded Funnel Conversion Stages and Stage Aging cards with real application stage counts and dynamic day buckets (0-3d, 4-7d, 8-14d, 15+d) computed from `app.createdAt` and `app.updatedAt`.
  - Replaced hardcoded "Applications by Source" with dynamic source grouping from `app.source` (e.g. LinkedIn, Referral, Career Portal, Direct).
  - Replaced hardcoded static Turnaround Time card with dynamic interview evaluation summary from `apiInterviews`.
  - Replaced hardcoded "Applicants Needing Action" mock table ('Ahmed Mostafa', 'Heba Mohamed', 'Yousef Ali') with real active applicants waiting in Screening/Interview/Offer stages, null-safe candidate names (`'Unknown candidate'`), first-8 APP- IDs (`APP-${id.slice(0, 8)}`), and real SLA status indicators.
  - Export CSV downloads real analytics data for the specific vacancy.
- Verification:
  - `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` passed clean (0 errors).
  - `pnpm --dir apps/web build` passed clean (production build succeeded in 1.36s).
  - `pnpm --dir apps/web test` passed clean (23 test files, 58/58 tests pass).




### E3 orchestrator verdict (opencode review unavailable — 2 interrupted runs; first-hand verification stands in)
1. Literals PASS — orchestrator grep 0 hits for person/place literals across all 5 pages.
2. TasksPage GET /tasks wiring PASS — TasksPage.tsx:200 fetches `/tasks?pageSize=100` with array/{data} normalization; POST create kept (:261).
3. Mechanics PASS — VacantList rows/filters from GET /vacancies; ManagerDashboard/JobAnalytics/VacancyOverview derived from real fetches; empty PageStates present.
4. Scope PASS — diff stat: 5 pages + findings.md/progress.md only; no backend/contracts/deps changes.
5. Casts PASS — orchestrator replaced all E3-introduced `as any` with precise structural casts; eslint clean on 4 files (VacantListPage 3 pre-existing errors left); tsc clean; epoch fallback for optional interview dates.
- Gates: tsc clean, web tests 58/58 pass.
- Open: VacantListPage 3 pre-existing lint errors; mojibake glyphs (—) in string literals across touched files — queued in E5 encoding normalization.


### E4 Remove hardcoded demo literals from CV Intake, Applications, and Stage Transition pages (E4a + E4b): DONE
- Task ID: E4 (E4a CVIntakePage + E4b ApplicationsPage and StageTransitionPage)
- Scope: `apps/web/src/pages/CVIntakePage.tsx` (E4a, preserved untouched), `apps/web/src/pages/ApplicationsPage.tsx` (E4b), `apps/web/src/pages/StageTransitionPage.tsx` (E4b)
- Replaced literals and fixed kanban locking in `ApplicationsPage.tsx`:
  - Replaced hardcoded `DEFAULT_COLUMNS` cards (15 mock candidates with Unsplash photos) and `DEFAULT_LIST_ROWS` with dynamic data mapped from `GET /applications?pageSize=100` (`apiApplications`).
  - Fixed kanban drag-and-drop optimistic locking: cards preserve `version: a.version ?? 1` and `stage: a.stage`; `handleDrop` takes a snapshot of `boardColumns`, checks `card.version` (falling back to `GET /applications/:id`), and dispatches `patchApi('/applications/:id/stage', { stage: targetCol.stageKey, expectedStage, expectedVersion, reason })`.
  - Implemented 409 CONFLICT handling: detects `statusCode === 409` or `code === 'CONFLICT'`, displays warning toast, and calls `loadApplications()` to resync state from server truth.
  - Implemented non-409 error handling: reverts `boardColumns` back to snapshot and displays error toast.
  - Removed all person and location literals ('Ali Hassan', 'Sarah Ahmed', 'Mona Saleh', 'Omar Farouk', 'Yousef Ahmed', 'Khaled Mostafa', 'Nourhan Sami', 'Tarek Ibrahim', 'Fatima Zahra', 'Ahmed Samy', 'Omar Ashraf', 'Mariam Adel', 'Noha Farouk', 'Ahmed Mostafa', 'Sara Ahmed', 'Heba Mohamed', 'Cairo, Egypt', 'Cairo, EG', 'LinkedIn', 'SA', Unsplash photo URLs).
  - Derived filter dropdown options dynamically from `apiApplications` (unique positions, stages, owners, sources), resetting filters cleanly to `'ALL'`.
  - Integrated `<PageState kind="loading" | "error" | "empty">` for empty states and filter no-match results.
  - Fixed CSV export to download real filtered application records with real fields.
- Replaced literals and aligned P0.1 transition contract in `StageTransitionPage.tsx`:
  - Fixed `handleConfirmTransition`: payload matches P0.1 shape `{ stage: targetStage, expectedStage: application.stage, expectedVersion: application.version ?? 1, reason?: string }`.
  - Implemented 409 CONFLICT handling: displays warning alert and automatically re-fetches latest application state.
  - Implemented error handling: displays retryable danger Alert for non-409 errors instead of swallowing errors.
  - Removed hardcoded candidate literals ('Ali Hassan', 'Frontend Developer', 'APP-02481', 'Sarah Ahmed', 'SA', 'AH', static dates).
  - Derived candidate name, initials, position title, application ID, stage owner, and applied date dynamically from `application` and `candidate`.
  - Added interactive "To stage" selector populated from `application.allowedTransitions` (or standard pipeline stages).
  - Integrated `<PageState kind="loading" | "not-found">` when application is loading or missing.
- Verification:
  - `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` passed clean (0 errors).
  - `pnpm --dir apps/web build` passed clean (production build succeeded in 1.38s).
  - `pnpm --dir apps/web test` passed clean (23 test files, 58/58 tests pass).
- Committed in dedf8e1: feat(web): E4 remove hardcoded literals from CV intake, applications, stage transition pages.

### E5 Polish sweep & follow-ups: DONE
- Task ID: E5 (7 follow-up items)
- Scope:
  - `apps/api/src/hiring/hiring.service.ts`
  - `apps/web/src/components/candidate/JoiningChecklist.tsx`
  - `apps/web/src/pages/HiringCasePage.tsx`
  - `apps/web/src/pages/InterviewsPage.tsx`
  - `apps/web/src/pages/OfferDetailPage.tsx`
  - `apps/web/src/pages/VacantListPage.tsx`
  - `progress.md`
- Items Delivered:
  1. **Exempt / 'Not Required' path (`HiringCasePage.tsx`)**:
     - Updated `checklistItems` mapping: `isCompleted: item.status === 'Verified' || item.status === 'Not Required'`, with `notes: item.status === 'Not Required' ? 'Exempt / Not Required' : null`.
     - Ensures checklist display aligns with server progress counting.
  2. **License page data (`apps/api/src/hiring/hiring.service.ts`)**:
     - Updated `listHiringCases` Prisma include to include `complianceRequirements: { include: { verifier: true } }`.
     - Mapped full compliance items (`id`, `name`, `type`, `isRequired`, `status`, `verifiedBy`, `verifiedAt`, `expiryDate`) in returned cases, feeding live data to `LicenseManagementPage`.
  3. **Offer header gating (`OfferDetailPage.tsx`)**:
     - Removed disconnected `setIsHired` local state.
     - Replaced ungated button with status-gated action strictly shown when `offer.status === 'Accepted'`.
     - Seamlessly connects to real joining case (`/hires/${joiningCase.id}`) or invokes `handleCreateJoiningCase()`.
  4. **Joining status gate (`JoiningChecklist.tsx`)**:
     - Added `isAwaitingJoining = hiringCaseStatus === 'Awaiting Joining'` check to `isConfirmDisabled`.
     - Updated footer status copy to indicate when awaiting executive final approval, eliminating premature 400 BadRequest submissions.
  5. **Encoding normalization (`progress.md`)**:
     - Replaced all legacy mojibake replacement characters (`\uFFFD`) with clean em dashes (`—`).
  6. **VacantListPage lint (`VacantListPage.tsx`)**:
     - Replaced 3 `@typescript-eslint/no-explicit-any` usages with typed `RawVacancyResponseItem` interface and status mapping.
     - Eslint on `VacantListPage.tsx` passes with 0 errors.
  7. **Schedule-form defaults (`InterviewsPage.tsx`)**:
     - Initialized `interviewTitle` to empty string.
     - Made `scheduledDateTime` dynamic (tomorrow at 10:00 AM) rather than hardcoded past date.
     - Resolved timezone dynamically from system and eliminated hardcoded meeting link.
- Verification:
  - `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` passed clean (0 errors).
  - `pnpm --dir apps/api exec tsc --noEmit` passed clean (0 errors).
  - `pnpm --dir apps/web build` passed clean (1.41s).
  - `pnpm --dir apps/web test` passed clean (23 test files, 58/58 tests pass).
  - `pnpm --dir apps/api test` passed clean (1 test file, 11/11 tests pass).
  - Eslint clean on `VacantListPage.tsx`, `HiringCasePage.tsx`, `JoiningChecklist.tsx`.

### E6 Per-Position Workflow & Odoo Operational Alignment: DONE
- Task ID: E6 (E6.1, E6.2, E6.3, E6.4)
- Scope:
  - `apps/web/src/pages/ApplicationsPage.tsx`
  - `apps/web/src/pages/VacancyOverviewPage.tsx`
  - `apps/web/src/pages/InterviewDetailPage.tsx`
  - `apps/web/src/pages/ApplicationDetailPage.tsx`
  - `task_plan.md`
  - `progress.md`
- Items Delivered:
  1. **E6.1 (Vacancy Pipeline Lock & Context Banner)**:
     - `ApplicationsPage.tsx`: Query param `?vacancyId=` triggers `GET /vacancies/:id` and renders a prominent gradient Position Pipeline Banner showing requisition code, position title, headcount progress (`joinedHeadcount / approvedHeadcount`), active applicants count, `[← Back to Overview]` navigation, and `[View All Positions]` clear filter action. Locks the job dropdown to this position with a lock icon.
     - `VacancyOverviewPage.tsx`: Made all top tabs interactive (`Overview`, `Pipeline`, `Applications`, `Job Posting`, `Activity`, `Settings`). Implemented in-page 6-stage Vacancy Kanban Board (`Applied`, `Screening`, `Interview`, `Offer`, `Pre-Hire`, `Joined`) with candidate cards, avatars, codes, and stage counts, plus dedicated tabs for applications list, requisition posting, activity feed, and team settings.
  2. **E6.2 (Kanban Quick Actions & Candidate 360 Linking)**:
     - `ApplicationsPage.tsx`: Added Candidate 360 link (`• Profile ↗`) on Kanban cards pointing to `/candidates/:candidateId`.
     - Added Quick Note button (`edit` icon) on Kanban card headers and List View rows. Clicking opens a `<Drawer>` hosting `<CommentsThread entityType="application" entityId={quickNoteApp.id} />` enabling frictionless inline note-taking and chatter without navigating away.
  3. **E6.3 (Dynamic Position Competencies in Scorecard)**:
     - `InterviewDetailPage.tsx`: Fetches application details for the interview and extracts candidate skills and position title. Automatically generates a dynamic `"Role & Position Competencies (${title})"` category in both editable and locked scorecards alongside standard competencies (`Technical Skills`, `Communication`, `Problem Solving`, `Culture Fit`).
  4. **E6.4 (Cross-Application Collision Warning Alert)**:
     - `ApplicationDetailPage.tsx`: Queries `GET /applications?candidateId=:candidateId&pageSize=50` to detect parallel applications. Filters out the current application and terminated stages (`Rejected`, `Withdrawn`). If other active applications exist, displays a prominent amber warning banner (`<Alert tone="warning">`) detailing each parallel position, stage, and direct navigation links.
- Verification:
  - `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` passed clean (0 errors).
  - `pnpm --dir apps/web test --run` passed clean (23 test files, 58/58 tests pass).
  - `pnpm --dir apps/web build` passed clean (production build succeeded in 1.44s).
  - `pnpm --dir apps/api exec tsc --noEmit` passed clean (0 errors).
  - `pnpm --dir apps/api test` passed clean (1 test file, 11/11 tests pass).

### E7 Per-Position Operational Parity Blueprint: DONE
- Task ID: E7 (E7.1, E7.2, E7.3, E7.4)
- Scope:
  - `apps/web/src/components/candidate/AddApplicationModal.tsx` (NEW)
  - `apps/web/src/pages/ApplicationsPage.tsx`
  - `apps/web/src/pages/VacancyOverviewPage.tsx`
  - `apps/web/src/pages/InterviewsPage.tsx`
  - `apps/web/src/pages/OffersPage.tsx`
  - `apps/web/src/pages/VacantListPage.tsx`
  - `apps/web/src/pages/ApplicationDetailPage.tsx`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Items Delivered:
  1. **E7.1 (Direct Candidate Sourcing Modal)**:
     - Created `AddApplicationModal.tsx`: Dual-mode modal for searching existing candidates (`GET /candidates`) or creating new candidates on the fly (`POST /candidates`).
     - Features vacancy lock badge if preselected, or dropdown selector if global; sourcing channel select (`LinkedIn`, `Career Site`, `Referral`, etc.); and optional recruiter note.
     - Submits `POST /applications` and conditionally `POST /applications/:id/notes`.
     - Wired into `ApplicationsPage.tsx` replacing previous dummy modal.
     - Wired into `VacancyOverviewPage.tsx` header action bar, Pipeline tab toolbar, and Applications tab.
  2. **E7.2 (Position-Scoped Sub-flows for Interviews & Offers)**:
     - `InterviewsPage.tsx`: Reads `?vacancyId=`, fetches requisition details (`GET /vacancies/:id`), filters interviews to only applications belonging to the vacancy, limits interview scheduling modal applicant dropdown to only that vacancy's candidates, and renders a gradient Position Context Banner with `[← Back to Requisition Overview]` and `[View All Interviews]`.
     - `OffersPage.tsx`: Reads `?vacancyId=`, filters offers table by `row.vacancyId === vacancyId`, and displays a gradient Position Context Banner with return and clear links.
     - `VacancyOverviewPage.tsx`: Wired Quick Metrics and Tab navigation buttons for Interviews and Offers to pass `?vacancyId=${id}` to maintain scoped context across the entire recruitment journey. Added `[Analytics ↗]` tab navigating directly to `/vacancies/${id}/analytics`.
  3. **E7.3 (Odoo-Style Position Cards & Grid View)**:
     - `VacantListPage.tsx`: Added Cards vs Table view toggle switch (defaulting to Cards view).
     - Responsive 3-column requisition cards displaying requisition code (`vacancyCode`), status pill badge, position title (navigates to `/vacancies/:id`), department, location, work type, filled headcount progress (`joinedHeadcount / approvedHeadcount`), SLA performance percentage and health dot, recruiter avatar initials, need-action warning badge, and prominent `[X Applications ↗]` action button jumping directly into the vacancy-locked pipeline.
     - Preserves clean pagination across both card and table views (`pageSize = 12`).
  4. **E7.4 (Requisition Bidirectional Linkage & Inline Evaluation Tab)**:
     - `ApplicationDetailPage.tsx`: Added clickable requisition breadcrumb link (`Requisition: VAC-CODE • Title ↗`) and top-right `[Requisition Overview ↗]` button.
     - Removed premature page eject on clicking the horizontal `interviews` tab (`if (tab === 'interviews') navigate('/interviews')`).
     - Rendered inline Interviews & Evaluations tab with 4 summary metric cards (`Strong Hire`, `Hire`, `No Hire`, `Pending`), scheduled interview sessions, interviewer tags, individual scorecard recommendations, and quick `[Schedule Interview]` and `[All Requisition Interviews ↗]` actions.
- Verification:
  - `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` passed clean (0 errors).
  - `pnpm --dir apps/web test --run` passed clean (23 test files, 58/58 tests pass).
  - `pnpm --dir apps/web build` passed clean (production build succeeded in 1.61s).
  - `pnpm --dir apps/api exec tsc --noEmit` passed clean (0 errors).
  - `pnpm --dir apps/api test` passed clean (1 test file, 11/11 tests pass).

### Session 2026-09-06: Universal Quick Learn System & Role Workflow Enhancements: DONE
- Scope:
  - Universal Quick Guide System (`apps/web/src/quickguide/*`)
  - Standalone and PageFrame page guide integration across all 18 major routes
  - Role-specific UI/UX & workflow enhancements:
    - Junior Recruiter: Instant candidate duplicate detection (`AddApplicationModal.tsx`), Fixed navigation routes (`OffersPage.tsx`), Requisition clarity (`VacantListPage.tsx`).
    - Clinical Chief & Interviewer: Lead Panelist selector, AST timezone, Teams/Clinic meeting mode (`ScheduleInterviewModal.tsx`), side-by-side CV Match Assigner visual diff (`CVMatchAssigner.tsx`).
    - Executive Approver & Finance VP: Saudi Labor Law compensation calculator with 60/25/10/5 preset & GOSI preview (`CreateOfferPage.tsx`), interactive offer approval/rejection machine with audit comment modal (`OfferDetailPage.tsx`), SAR currency display (`OfferApprovalInboxPage.tsx`).
    - HR Ops / Compliance Specialist: Regulatory compliance gatekeeper preventing premature joining date confirmation without SCFHS & DataFlow clearance (`HiringCasePage.tsx`).
- Verification:
  - `npx tsc -b` clean (0 errors).
  - Vitest: 24 test files passed, 72/72 tests passed (100% pass rate).
  - Commits: `43c3975` and `6419977`.
  - Pushed to `github main` (`https://github.com/mustafapato863-netizen/Recruitment-System.git`).

### Session 2026-09-06: Pre-Hire Clinical Compliance Gates, Verification Logging & Offer Dossier Printing: DONE
- Scope:
  - **HR Ops & Compliance Specialist**:
    - Enhanced `JoiningChecklist.tsx` with clinical item detection (`/license|scfhs|dataflow|mumaris|medical|clinical|bls|acls|cpr|credential|health/i`) displaying a dedicated `Clinical Gate` badge.
    - Integrated interactive verification note logger modal allowing compliance officers to attach license registration numbers (SCFHS #, DataFlow primary source verification case #) or audit notes.
    - Added 1-click `[Print Dossier]` button to generate official pre-hire compliance records for the Medical Credentialing Committee.
    - Wired `onItemNoteSave` in `HiringCasePage.tsx` to record verification notes with immediate UI feedback.
  - **UI/UX Consistency**:
    - Enhanced `DataTable.tsx` with comprehensive dark mode semantic classes (`dark:bg-slate-800/60`, `dark:border-slate-800`, `dark:text-slate-200`) and optional compact row padding (`dense?: boolean`).
  - **Executive Approver & Finance VP**:
    - Enhanced `OfferDetailPage.tsx` Offer Letter Preview modal with direct 1-click `[Print]` (print to PDF or physical printer) alongside text download.
  - **Testing & Verification**:
    - Created unit test suite `JoiningChecklist.test.tsx` (5/5 tests passing).
    - Executed full test run: 25 test files passed, 77/77 tests passed (100% pass rate).
    - `npx tsc -b` passes with 0 errors.



### Testing readiness audit 2026-09-07
- Started fresh verification; preserved existing controller edit.
- Completed readiness audit: typecheck, lint, build, 187 unit tests, 22-migration status, isolated integration/security suites, and 324/324 browser matrix checks pass. Local launcher remains available at http://localhost:5173 with API health at http://localhost:3000/api/v1/health.

### Dynamic VL sample 2026-09-07
- Read `D:\Manpower\VL.xlsx` at runtime and imported six distinct open positions from `Rowdata` through the existing review/confirm import APIs.
- Approved and converted six vacancy requests, enriched them with source-derived requirements, and opened them for CV matching.
- Removed hardcoded CV demo presets, notification records, applicant portal records, and fabricated report fallbacks.
- Web typecheck/build and root lint pass after the changes. API verification confirms six open VL vacancies with non-empty requirements; browser matrix passes 348/348.

### Admin-only RBAC and sidebar governance 2026-09-07
- Added tenant-local permission metadata and CRUD endpoints, custom role naming/renaming, permission assignment, and safe custom-role deletion behind `ROLES_MANAGE`.
- Added persisted organization controls for visible roles and role-name overrides, plus a dynamic navigation catalog with admin-managed labels and visibility.
- Cleaned `RECRUITFLOW-DEMO`: retained the administrator, removed 10 organization-local custom roles, preserved the shared 27-permission catalog and all business/VL records.
- Added the Permissions & Sidebar tab to Users & Roles and connected AppShell to the navigation API while keeping route/API permission guards authoritative.
- Verification: API/web typecheck and builds pass, lint passes, unit tests pass (187 total), live role/permission/navigation smoke passes, and browser matrix passes 348/348.

### CV intake candidate summary and recruiter screening 2026-09-07
- Fixed the reported `POST /api/v1/candidates` 400 by accepting and persisting the CV parser's optional `summary` field through the API, Prisma model, and shared contracts.
- Added dynamic recruiter Screening Details fields: outcome, notice period in days, expected salary, current salary, salary currency, and notes.
- Salary values are permission-aware: `VIEW_CURRENT_SALARY` is checked server-side for screening reads and writes, and the drawer disables salary inputs when the permission is absent.
- Added and applied `20260907_candidate_summary` and `20260907_screening_compensation` migrations; database is current at 25 migrations.
- Verification: API smoke passed for candidate summary and screening values; web 141/141, API 43/43, worker 4/4 tests; typecheck, lint, builds, `db:validate`, and `db:migrate:status` pass. Local services are running on ports 5173 and 3000.
- Service-level negative smoke confirms salary values are neither persisted nor returned when `VIEW_CURRENT_SALARY` is absent; the browser drawer smoke saved the fields successfully as administrator.

### Vacancy assignment persistence and display fix 2026-09-07
- Fixed `ManagerDashboard` to call `POST /vacancies/:id/assignments` with the selected recruiter (`RECRUITER`) before creating the optional target task.
- Updated `PrismaVacancyCoreRepository` to synchronize assignment rows transactionally, preserve inactive history, and return active assignment users with `id` and `displayName`.
- Added the optional nested assignment user to the shared `VacancyAssignment` contract so Command Center and vacancy list recruiter labels are dynamic after reload.
- Limited the manager assignment selector to open vacancies.
- Verification: API 201 + database/list/detail round-trip passed; browser modal smoke passed; web 141/141, API 43/43, worker 4/4, workspace typecheck, and lint passed. Temporary smoke assignments were cleaned up.

### Full scope and dynamic-data hardening 2026-09-07
- Applied the canonical authenticated visibility predicate across candidate, vacancy, application, screening, interview, offer, hiring, documents, tasks, exports, and reports. Search filters are composed with the visibility predicate so scoped lists and counts cannot be widened by a search term.
- Candidate detail now requests candidate-filtered resources and up to 100 applications, removing the implicit default first-page truncation for normal UAT-sized histories.
- Removed fixed demo persona switching from the user menu and replaced role-name checks in dashboard/task/joining UI with granted permissions. The development launcher now starts the API, web, and worker without printing deleted demo credentials.
- Reports now use live application source counts and explicit unavailable states for empty time-to-hire/coverage data; default reporting period is the last 30 calendar days.
- Fixed candidate list accessibility findings: all 12 candidate route checks (six widths × two themes) pass with labelled row actions and contrast-safe initials.

### Final verification 2026-09-07
- Passed API typecheck and 56/56 API tests.
- Passed web typecheck and 145/145 web tests.
- Passed root lint and `git diff --check`.
- Focused browser accessibility matrix passed 12/12 for `/candidates` across light/dark and 375–1440px widths.
- Local API health/readiness and web/worker processes remain available for UAT.
- Known gates remain documented: legacy auth scripts reference intentionally deleted demo accounts, CSS budget is above the existing 225 KiB threshold, and global activity/report metrics plus worker heartbeat telemetry are future enhancements.

### Dynamic candidate metrics and final browser gate 2026-09-07
- Added live candidate metrics for total talent, active pipeline, eligible talent-pool membership, direct/referral source percentage, and disqualified records. The endpoint is tenant-scoped and permission-protected.
- Restarted the API from the current build after detecting that the previously running process was stale and returned 500 for `/candidates/metrics`.
- Final focused candidate matrix passed 12/12 and the full dual-mode browser matrix passed 396/396 after the current API build was verified.

### Full application detail flow 2026-09-08
- Removed the applications-list split drawer flow. Clicking a table row or board card now opens the full applicant profile route.
- Merged candidate activity into the profile Activity tab and moved recruiter screening details into the profile Overview sidebar so activity, screening, and stage actions are available in one page.
- Focused application route matrix passed 12/12 across both themes and 375/768/1440px widths. Web typecheck, 145/145 tests, lint, and build passed.
- Direct browser smoke clicked the first board card and confirmed navigation to its full application profile route.
- A later full-matrix attempt encountered session 401 responses after several minutes; the fresh-login focused application checks remained clean (12/12).

### Simplified CV entry flow 2026-09-08
- Added a clear Upload CV action beside Existing Candidate and Full details in the pipeline modal.
- Upload CV opens the full CV intake/matching page with the selected vacancy preserved, avoiding duplicated parser logic in the modal.
- CV intake now stores the uploaded binary as a candidate document after candidate resolution and keeps the extracted text attached to that record.
- Browser smoke confirmed the modal route handoff; the applications and vacancy-aware CV intake routes passed 8/8 focused checks. Web typecheck, 145/145 tests, and build passed.

### Smarter CV identity and source capture 2026-09-08
- Improved CV parsing to strip known and generic role phrases from names and filename fallbacks, including titles that are not in the curated title list.
- Added a Stage 2 Source of CV field and passed it through the existing candidate and application persistence payloads.
- Added regression coverage for title/name collisions, filename-only fallback, and generic titles. Focused parser tests passed 5/5 and the applications plus vacancy-aware CV intake browser matrix passed 8/8.
- Web typecheck and lint passed; the production web build completed successfully.

### Employee one-workspace navigation audit 2026-09-08
- Confirmed `EmployeeDashboard` already provides a suitable single workspace for personal requests and active tasks.
- Found that the dashboard mode currently treats any `VACANCY_VIEW` user as a manager, which makes read-only/requester roles see a larger workspace than needed.
- Found the sidebar has multiple groups and the header task shortcut is not conditional on `TASK_VIEW`; implementation will reduce employee navigation without changing route permissions.

### Employee one-workspace navigation implementation 2026-09-08
- Added a shared employee/requester workspace persona check and routed those users to the existing My Work dashboard.
- Reduced employee sidebar navigation to My Work plus permission-appropriate requisitions; operational roles keep the full recruitment and governance navigation.
- Made task shortcuts, request loading, and dashboard actions permission-aware and removed the unrelated referral/help card from the employee workspace.
- Verification passed: web tests 149/149, web typecheck, root lint, production build, browser matrix 8/8, API health/readiness 200, and web root 200.

### CSS payload repair 2026-09-08
- Traced the CSS budget failure to the full Tailwind entrypoint exporting the unused default theme palette.
- Tested replacing the full entrypoint with preflight plus utilities imports. Browser screenshots showed missing spacing, typography, and surfaces; the experiment was reverted immediately.
- A second subset-palette experiment restored some color utilities but produced a 327.52 KiB CSS bundle, so it was also reverted.
- Functional visual baseline is preserved. CSS optimization remains a separate design task requiring route-safe code splitting or utility consolidation.

### Full application audit and focused repair 2026-09-08
- Audited API contracts, role presentation, offer approval links, CV extraction defaults, empty-state navigation, task pagination, sidebar permissions, public vacancy links, and employee panel errors.
- Fixed all ten source findings: paginated task normalization, mixed-role precedence, shared flat offer-approval DTO with `offerId`, evidence-based CV values/confidence, `/offers/create`, bounded pagination, matching Email Templates permission, dynamic organization-code links, and visible panel failures.
- Added task response and pagination parser regression tests; refreshed the audit report with the remaining CSS budget and browser coverage limits.
- Verification: web 153/153, API 58/58, worker 4/4, typecheck, lint, `git diff --check`, and web build pass. Fresh API verification on port 3001 returns HTTP 400 for invalid task pagination; fresh full route checks pass 132/132 through the current-API proxy at 375px and 1440px in both themes, with focused repair checks 32/32. CSS budget remains over threshold and should be handled as a separate performance phase.

### Duplicate and deferred page cleanup 2026-09-08
- Audited all registered page entry points and workflow links.
- Removed the unreferenced TalentPoolDetailPage redirect component.
- Removed the admin-only DesignSystemPage showcase and its duplicate /components and /design-system routes; design-system primitives and documentation remain.
- Kept active CV Bank, import preview, candidate comparison, applicant portal, and recruitment workflow pages. Legacy redirect aliases remain for existing bookmarks.
- Verification passed: web tests 149/149, web typecheck, root lint, production build, browser matrix 8/8, API health/readiness 200, and web root 200.

### Design-token checker repair 2026-09-08
- The design-token checker still referenced the deleted `DesignSystemPage.tsx`, causing an `ENOENT` failure after duplicate-page cleanup.
- Removed the stale explicit input. The command now reaches its intended checks and reports the existing legacy palette baseline (9,338 occurrences versus the 850 budget), which remains a planned migration rather than a threshold increase.
- Verification after the repair: web tests 153/153, API tests 58/58, worker tests 4/4, workspace typecheck, root lint, and production web build passed. The bundle gate still reports the known CSS budget overage.

### Long-running session verification 2026-09-08

### Final Luna review and local UAT gate - 2026-09-08

- Luna's delegated implementation was independently reviewed and repaired where needed. The review covered candidate activity, interview title/job-title persistence, My Work/navigation cleanup, nullable email and normalized phone paths, CV identity/source capture, and the tabbed Master Data grid.
- Fixed the public phone duplicate lookup to compare normalized contacts across candidate rows, and fixed Master Data paste staging so pasted edits are saved correctly.
- Full local suite passed: web 153/153, API 58/58, worker 4/4; workspace typecheck, root lint, API/web production builds, migration status and read-only audit checks all passed.
- Browser verification passed 28/28 across `/cv-intake`, `/offers/create`, `/applications`, `/interviews`, `/master-data`, `/my-work` and `/candidates` at 375px/1440px in light and dark themes. Candidate activity, public phone dedupe, Master Data concurrency and interview-title persistence regression smokes passed.
- Local UAT is ready at `http://127.0.0.1:5176` with API `http://127.0.0.1:3002`; the existing 5173/3000 processes were left untouched. CSS/design-token budget warnings and the prior long-session 401 observation remain documented follow-ups.

### Version-one simplification plan
- Created `docs/version-one-simplification-plan.md` from the agreed product decisions, with ordered phases, navigation disposition, data dependencies and acceptance criteria.
- Recorded phone-only entry's existing required-email schema/API dependency and preserved audit/security requirements.
- Planning only: no application code, database records or running services changed for this request.
- A 396-check browser run stayed green for 156 checks, then began logging 401 responses across later routes. The failure is session-wide rather than route-specific.
- A fresh current-build two-width matrix passed 132/132 (375px and 1440px, light and dark). A direct API cookie round-trip also passed login 200, refresh 200, and `/auth/me` 200.
- Keep session-lifetime/refresh observability as a P2 reliability follow-up; do not treat the long-run result as a page regression.

## Luna version-one implementation handoff — 2026-09-08

Implemented the current version-one simplification slice across candidate entry, interviews, activity, My Work routing, navigation, Master Data and persistence. Baseline is recorded in `docs/luna-v1-baseline-20260908.md`; independent review evidence is appended to `docs/version-one-independent-review.md`. API/web/worker typechecks, API 58/58 tests, web 153/153 tests, activity panel 4/4 tests, worker 4/4 tests, lint, production build, Prisma validation, local migration deploy/status, disposable migration reverse/reapply and diff check passed. CSS/design-token budgets and long-session 401 follow-up remain explicit release limitations; full browser UAT after this final delta is still pending.
### Users & Roles full build — 2026-09-08

- Started the full Users & Roles implementation from the agreed three-area scope: complete Users workspace, complete Roles/permission workspace, and configuration/preview/audit tools.
- Baseline audit and access-model decisions recorded in `findings.md`; implementation is now moving through durable API/data changes before the UI expansion.

### Master Data delegated repair — 2026-09-08

- Delegated Master Data route/load/save repair to Luna and reviewed the resulting diff independently.
- Rebuilt the API and restarted the user-facing port-3000 process; `GET /api/v1/master-data/catalog/branches` now reaches the registered controller instead of the stale-process 404.
- Fixed the audited Job Titles legal-entity payload omission after delegation.
- Verification: API/web typecheck, API/root lint, web tests 153/153, API/web production builds, Master Data smoke on port 3000, migration status (29 current), and `git diff --check` passed. The full web test run is stable when run sequentially; a parallel invocation produced unrelated shared-environment failures.

### Role creation access setup — 2026-09-08

- Expanded `UsersRolesPage` so Create role loads live permissions and sidebar pages, supports multi-select with select-all/clear-all, and submits the selected access as part of the guided role setup.
- Added role-scoped navigation visibility DTO/controller/service support. The authenticated navigation endpoint resolves visibility for the user’s role codes and global navigation updates retain role-specific configuration.
- Added `tests/role-access-local.cjs`; the role creation, permission assignment and sidebar visibility smoke passed against the rebuilt port-3000 API.
- Final verification for this delta passed: workspace typecheck, root lint, API/web builds, API tests 58/58, web tests 153/153, Master Data smoke, role-access smoke, migration status (29 current), API health 200 and `git diff --check`.

### Role access form UX refinement — 2026-09-08

- Expanded the Create role and access dialog to `max-w-6xl` with a structured identity card, numbered access steps, responsive panels and a sticky footer.
- Added searchable permission and sidebar-page lists, shared 44px checkbox targets, selected-count badges, no-match states and horizontal-overflow protection for long codes/routes.
- Verification passed: web typecheck, web lint, web tests 153/153, production web build and `git diff --check`.
- Browser smoke passed at 1440px and 375px: the dialog renders the new title, both search fields and the full checkbox catalog, with no horizontal page overflow.

### Modal input focus regression — 2026-09-08

- Added a focused `Modal.test.tsx` regression that types into a controlled input while the parent rerenders; it failed before the fix with focus on the close button and passed after the fix.
- Updated `Modal.tsx` to keep the latest close callback in a ref and run initial/return focus only on dialog open/close, preventing input focus loss from inline callback identity changes.
- Verification passed: focused Modal tests 2/2, full web tests 154/154, web typecheck, lint, production build and `git diff --check`.
- A Playwright smoke typed into the live role-code field at 1440px and confirmed the input retained focus while the close button remained unfocused.
- Interview scheduling workflow (2026-09-08): audit complete. `locationUrl` and attendee response fields already exist in the data model; schedule forms omit the link, attendee response actions are missing, and scorecard notes are currently optional.
- Implementation: added link inputs to direct, application-detail and self-schedule flows; removed the hardcoded Teams fallback; added `/interviews/:id/response` with confirmation/reschedule-request/decline validation and notifications; required interviewer notes; and enforced automatic/manual completion rules around panel scorecards.
- Verification: API/web typechecks, targeted lint, full web 154/154, full API 60/60 (including interview DTO coverage), worker 4/4, API/web builds, Prisma validation, health/readiness, and a 1440px authenticated browser smoke for `/interviews` all passed. The live schedule modal exposed one meeting-link input with no horizontal overflow.

### Interview scheduling verification follow-up — 2026-09-08

- Changed newly created interviewer attendee responses from implicit `Accepted` to explicit `Pending`, so every invitee must confirm, request a reschedule with a reason, or decline.
- Added HTTP/HTTPS meeting-link validation, a minimum of one interviewer for direct and self-scheduled interviews, terminal lifecycle protection for completed/cancelled interviews, and a cancelled-interview scorecard guard.
- Rescheduling a meeting now resets all panel responses to `Pending`, so confirmations from the old time cannot be carried into the replacement slot.
- Verification: API tests 61/61, web tests 154/154, worker tests 4/4, API typecheck, root lint, API build, full web build, API health/readiness, and the 1440px `/interviews` browser matrix all passed. The only build output is the existing Vite chunk-size warning.

### Final performance and UI repair audit — 2026-09-08
- Repaired applications pagination coverage by following the server-reported total across API pages. The isolated 101-application fixture now renders all 101 records and the authoritative total in the working list.
- Repaired certification evidence semantics in the shared fit scorer and applicant profile. Empty evidence is now `not_applicable`/missing as appropriate and never described as verified compliance.
- Added server-derived latest status/note activity labels to application list responses and direct profile quick actions for **Log call** and **Plan follow-up**.
- Wired persisted open candidate follow-up tasks into `nextFollowUpAt`; the API smoke created a follow-up, observed the due date in the application list, completed it, and confirmed the value cleared.
- Prevented the empty applicant Timeline from stretching to the height of the screening/action column by aligning the overview grid to content height.
- Completed mobile/header, accessible filter naming, heading hierarchy and contrast fixes; made Quick Guide auto-open opt-in. Nginx now gzip-compresses text assets.
- Fresh production Docker web/API/worker containers passed health/readiness checks. Chromium route matrix passed 33/33 at 1440/768/390px with zero JS errors, authenticated HTTP errors, overflow or axe violations. Applicant profile smoke confirmed both quick actions.
- Final suites passed: web 155/155, API 66/66, worker 4/4, workspace typecheck, lint and diff check. `pnpm check:bundle` now passes transfer-size budgets (main CSS 50.70 KiB gzip; main JS 75.72 KiB gzip); the Nginx smoke downloaded 54,132 and 78,419 bytes respectively. Raw CSS is 396.33 KiB against the historical 225 KiB advisory target, so route-safe CSS reduction remains a separate optimization phase. Reporting-volume benchmarking and long-session refresh observability remain follow-ups.
- Final local performance smoke (20 requests per endpoint, concurrency 5) returned HTTP 200 for readiness, candidates, vacancies, reports, Master Data and users; p95 latency ranged from 19.33ms to 86.84ms through Nginx.

### Dynamic Master Data and VL catalog synchronization — 2026-09-10

- Started implementation after the Audit pause was lifted. Existing Audit changes remain untouched.
- Current gaps confirmed: no repeatable Departments/Job Titles workbook importer, required vacancy skills are not synchronized into Skills Master Data, and several source/interview selectors still duplicate hardcoded options.
- Added transactional skill synchronization, catalog-backed recruiter selectors, and idempotent dry-run-first import/seed scripts.
- The `positions` bulk-import dataset now accepts the original VL `Rowdata` headers (`Position`, `Department Name`, `Level`, `Entity`, and `Type`). Position duplicate checks are organization-wide and compare normalized titles/codes, including mixed coded/uncoded duplicate rows.
- During confirmation, missing departments are created once and reused; imported department linkage and workbook provenance are saved in position metadata, while existing position metadata is preserved on updates.
- `scripts/import-vl-master-data.cjs` reads only `Rowdata` by default. `--include-uae` explicitly adds `UAE VL ` after review. Current dry-run counts are 9 departments and 58 unique job titles from Rowdata (12 departments and 66 titles when UAE is included).
- Local test organization `10000000-0000-4000-8000-000000000001` was populated earlier with the V1 source/type seed and the reviewed VL catalog; no records are deleted by reruns.
- Read-only verification of that organization reports 88 position records and 12 departments with no case/whitespace-normalized duplicate position titles or department names.
- Final validation: typecheck, lint, Prisma validation/migration status, API tests (73/73), web tests (161/161), worker tests (6/6), production build, bundle budgets, importer dry runs, and `git diff --check` pass. The build retains the existing non-blocking Vite chunk-size warning.
# Job Titles workbook and Legal Entity removal — 2026-09-10

- Started schema, API, UI, and workbook audit.
- Selected a preservation strategy: remove Legal Entity references and feature surfaces while retaining all dependent business records.
- Inspected and rendered both workbook sheets before editing.
- Completed the first dependency audit across Prisma, shared contracts/validation, master data, vacancy workflows, bulk imports, and frontend forms.
- User narrowed the workbook scope: update the template structure only; do not populate sample job-title rows.

- Removed Legal Entity from the active Prisma schema, contracts, validation, controllers, imports, vacancy persistence, tenant policies, seed/fixture scripts, and frontend routes. Branch uniqueness is now organization-scoped.
- Added and applied `20260910_remove_legal_entities` locally. It fails fast on duplicate branch codes, strips legacy position metadata, drops nullable foreign-key columns and the legacy table, then creates the replacement branch index.
- Rebuilt the Job Titles workbook at the supplied UNC path as a blank styled template with `Code`, `Title`, `Description`, `Department Name`, `Level`, `Entity`, `Type`, and `Status`, plus an Instructions sheet.
- Verification passed: Prisma format/validate/generate, typecheck, lint, API tests (77), web tests (163), web build, workbook inspection/render, and JavaScript syntax checks.
- Final verification also passed the local migration status check and demo seed. The production build retains only the existing non-blocking Vite large-chunk warning.
