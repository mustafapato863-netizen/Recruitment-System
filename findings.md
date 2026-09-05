# Findings — RecruitFlow Candidate Journey Audit

## 1. Page Inventory (50 pages total)
Key pages for journey scope:
- `CandidateDetailPage.tsx` (20 KB) — should be "Candidate 360" hub; currently simple read-only
- `ApplicationDetailPage.tsx` (42 KB) — richest page; has 5 tabs, 6 modals; NOT linked bidirectionally to candidate
- `InterviewDetailPage.tsx` (37 KB) — standalone; Scorecard is never persisted to application record
- `HiringCasePage.tsx` (17 KB) — compliance/approval workflow; no breadcrumb back to candidate
- `JoiningManagementPage.tsx` (8 KB) — flat list; no joining completion flow

## 2. Existing UI Building Blocks
- `CommentsThread.tsx` — wired to application notes API in P2.2 (@mention highlight, error alerts, UI-only fallback for hiring cases)
- `ActivityFeed.tsx` — created in P2.3 (merged notes + system events timeline, newest-first, colored event left borders, plain JS Date math, bottom CommentsThread composer)
- `Scorecard.tsx` — full star-rating UI, no write-back to application/interview record
- `ActivityTimeline.tsx` — imported in HiringCasePage only (style mirrored by ActivityFeed)
- `PipelineStepper.tsx` — imported in ApplicationDetailPage but stage movement fires raw PATCH
- `SLAIndicator.tsx` — exported from components/ui as of P0.3 (ready for Phase 1); unused in any page yet
- `ProgressBar.tsx` — imported in HiringCasePage

## 3. Missing Connections (The 5 Gaps)
1. **Unified Candidate 360 hub** — Resolved in P1.2 (`CandidateDetailPage.tsx` integrates `CandidateWorkspace`, applications table, interview history, offer list, timeline placeholder).
2. **No Smart Action Bar** — Resolved in P1.3 and P1.4 (`SmartActionBar.tsx` created and integrated into `ApplicationDetailPage.tsx` with context-aware stage actions, optimistic locking, blocked action tooltips, ConfirmDialog, and Drawer comments thread).
3. **CommentsThread is UI-only** — Resolved in P2.0-backend and P2.2 (backend `GET/POST /applications/:id/notes` implemented; `CommentsThread.tsx` wired to API mode for `entityType === 'application'`, with server note fetching, posting with spinner, error alerting for 400 validation failures, @mention highlighting, and backward-compatible UI-only mode for legacy callers).
4. **Scorecard is disconnected** — Resolved in P3.2 (`InterviewDetailPage.tsx` wired to `POST /interviews/:id/scorecard` and `GET /interviews/:id` scorecards array; controlled scorecard locks after submission with read-only summary).
5. **Joining has no completion ceremony** — JoiningManagementPage has "Manage" button → HiringCasePage, but no joining confirmation modal, compliance checklist, or headcount close

## 4. Backend Assets Available
From schema.prisma (confirmed):
- `HiringCase` — has `status`, `plannedJoiningDate`, `actualJoiningDate`, `complianceItems` relation
- `ComplianceRequirement` — has `isCompleted`, `notes`, `completedAt`
- `Offer` — has `status`, `signedAt`, `acceptedAt`
- Application has `stage`, `version` (optimistic locking)
- `InterviewScorecard` — exists with interview/interviewer relations, overallRating, recommendation, strengths/concerns/notes, isLocked, submittedAt (confirmed P3.1)

## 5. API Endpoints Status
- `GET /candidates/:id` — returns `Candidate` record
- `GET /applications?candidateId=:id` — returns `PaginatedResult<Application>` (unpacked via `.data`)
- `GET /interviews` — returns `Interview[]`. Does NOT accept `candidateId` query parameter (fails with 400 due to `forbidNonWhitelisted: true`). Candidate 360 filters client-side by candidate's application IDs.
- `GET /offers` — returns `Offer[]` (scoped to organization). Does NOT accept `candidateId` query parameter. Candidate 360 filters client-side by candidate's application IDs.
- `PATCH /candidates/:id` — accepts `skills?: string[]`, used by Candidate 360 to persist tags.
- `PATCH /applications/:id/stage` — exists (ApplicationDetailPage calls it)
- `POST /applications/:id/notes` — Implemented in P2.0-backend (requires `APPLICATION_MOVE_STAGE` + `TenantScopedGuard`, audit action `APPLICATION_NOTE_CREATE`). Wired into ApplicationDetailPage ActivityFeed and Quick Action Note modal in P2.4.
- `GET /applications/:id/notes` — Implemented in P2.0-backend (requires `APPLICATION_VIEW` + `TenantScopedGuard`, returns `ApplicationNote[]` ordered by `createdAt desc`). Integrated into ApplicationDetailPage parallel refetch pipeline in P2.4.
- `GET /applications/:id/history` — exists (ApplicationDetailPage fetches it, mapped to FeedEntry stage_change events in P2.4)
- `GET /hiring` — exists (JoiningManagementPage fetches)
- `PATCH /hiring/:id` — exists (HiringCasePage calls it)
- `HiringCase Activity & Notes` — Hiring cases do not have a dedicated backend notes model; ActivityFeed runs in UI-only mode for notes while mapping approval items, compliance verification timestamps, case creation, and joining dates into FeedEntry events.
- `Collapsible Component Choice` — As no pre-existing Accordion component exists in `apps/web/src/components`, HiringCasePage uses native `<details open className="rf-panel ...">` with `<summary>` styled with `rf-panel`, `rf-border-subtle`, and `rf-surface-subtle` tokens.
- `POST /interviews/:id/scorecard` — Confirmed in P3.1/P3.2. Accepts `{ overallRating, recommendation, strengths, concerns, notes }`, locks on submit, requires interviewer role (403 otherwise), and returns 400 BadRequest (not 409) if resubmitting when locked.
- `GET /interviews/:id` Scorecards — Confirmed in P3.1/P3.2. Read path returns `scorecards: InterviewScorecardItem[]`. UI matches `user.id` to `interviewerId` with fallback to single unlocked or latest card.
- `Scorecard Recommendation Enum Mismatch` — UI component `Scorecard.tsx` uses `'strong_hire' | 'hire' | 'no_hire'`; backend uses `'Strong Hire' | 'Hire' | 'Neutral' | 'No Hire' | 'Strong No Hire'`. UI maps bidirectional with `'Neutral'` mapped to nearest supported `'hire'`.
- `Locked Scorecard Inertness` — In `Scorecard.tsx`, omitting `onRatingChange`/`onRecommendationChange`/`onSubmit` eliminates mutation, while a scoped wrapper disables pointer events on ratings/recommendations and hides internal submit button, preserving category accordion expansion.
- `GET /interviews` Scorecard Population — Verified in `interviews.service.ts` that `listInterviews` executes Prisma `findMany` with `include: { scorecards: { include: { interviewer: true } } }`. Therefore, both `GET /interviews` (client-filtered in Candidate 360) and `GET /interviews?applicationId=:id` (in Application Detail Page) return populated `scorecards: InterviewScorecardItem[]` array. No per-interview `GET /interviews/:id` N+1 queries are necessary.
- `Multi-Scorecard Aggregation Strategy` — For interviews with multiple scorecards, `aggregateInterviewScorecards` calculates average overallRating (rounded to 1 decimal), finds majority recommendation with tie-break precedence `strong_hire` > `hire` > `no_hire`, joins deduplicated interviewer names, and checks locked status. Tab and page header badges reflect aggregate totals across all scheduled and evaluated rounds.

## 6. FRONTEND_SIMPLE_SYSTEM_PLAN.md Constraints
- Never invent fields outside typed contracts
- No drag-and-drop as sole stage control
- No hardcoded candidate/interview data
- Stage transitions require server `version` field (optimistic lock)
- Candidate 360 shape: Identity header + application history + CV/doc metadata + interviews + offers + timeline + notes
- Page contracts: every page must answer: owner / object / status / next action / evidence

## 7. Authority File for This Work
`docs/development/FRONTEND_SIMPLE_SYSTEM_PLAN.md` — authority level 4
Phase mapping from that document:
- Phase 2 (Jobs→Applicants) = our Phase 1+2
- Phase 3 (Candidate→Interview→Offer) = our Phase 3+4
