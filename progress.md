# Progress Log — RecruitFlow Candidate Journey

## Session 2026-09-04

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
- Code gates on final tree: web tsc clean, web build ok, web tests 58/58 pass, API tsc clean, API tests 11/11 pass. Prisma schema valid. Migration 20260905 applied directly (idempotent SQL) � repo `migrate deploy` still P3005-unbaselined (pre-existing: no _prisma_migrations table; REPORTED as ops item, not silently fixed).
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

