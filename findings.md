# Findings — RecruitFlow Candidate Journey Audit

## 1. Page Inventory (50 pages total)
Key pages for journey scope:
- `CandidateDetailPage.tsx` (20 KB) — should be "Candidate 360" hub; currently simple read-only
- `ApplicationDetailPage.tsx` (42 KB) — richest page; has 5 tabs, 6 modals; NOT linked bidirectionally to candidate
- `InterviewDetailPage.tsx` (37 KB) — standalone; Scorecard is never persisted to application record
- `HiringCasePage.tsx` (17 KB) — compliance/approval workflow; no breadcrumb back to candidate
- `JoiningManagementPage.tsx` (8 KB) — flat list; no joining completion flow

## 2. Existing UI Building Blocks
Already built, NOT yet wired end-to-end:
- `CommentsThread.tsx` — exists, no API call, no mention of @user, no activity types
- `Scorecard.tsx` — full star-rating UI, no write-back to application/interview record
- `ActivityTimeline.tsx` — imported in HiringCasePage only
- `PipelineStepper.tsx` — imported in ApplicationDetailPage but stage movement fires raw PATCH
- `SLAIndicator.tsx` — exported from components/ui as of P0.3 (ready for Phase 1); unused in any page yet
- `ProgressBar.tsx` — imported in HiringCasePage

## 3. Missing Connections (The 5 Gaps)
1. **Unified Candidate 360 hub** — Resolved in P1.2 (`CandidateDetailPage.tsx` integrates `CandidateWorkspace`, applications table, interview history, offer list, timeline placeholder).
2. **No Smart Action Bar** — Resolved in P1.3 and P1.4 (`SmartActionBar.tsx` created and integrated into `ApplicationDetailPage.tsx` with context-aware stage actions, optimistic locking, blocked action tooltips, ConfirmDialog, and Drawer comments thread).
3. **CommentsThread is UI-only** — Resolved in P2.0-backend and P2.2 (backend `GET/POST /applications/:id/notes` implemented; `CommentsThread.tsx` wired to API mode for `entityType === 'application'`, with server note fetching, posting with spinner, error alerting for 400 validation failures, @mention highlighting, and backward-compatible UI-only mode for legacy callers).
4. **Scorecard is disconnected** — no read/write path from InterviewDetailPage to the Interview or Application record
5. **Joining has no completion ceremony** — JoiningManagementPage has "Manage" button → HiringCasePage, but no joining confirmation modal, compliance checklist, or headcount close

## 4. Backend Assets Available
From schema.prisma (confirmed):
- `HiringCase` — has `status`, `plannedJoiningDate`, `actualJoiningDate`, `complianceItems` relation
- `ComplianceRequirement` — has `isCompleted`, `notes`, `completedAt`
- `Offer` — has `status`, `signedAt`, `acceptedAt`
- Application has `stage`, `version` (optimistic locking)
- Interviews have no Scorecard model yet (UI exists, no DB model)

## 5. API Endpoints Status
- `GET /candidates/:id` — returns `Candidate` record
- `GET /applications?candidateId=:id` — returns `PaginatedResult<Application>` (unpacked via `.data`)
- `GET /interviews` — returns `Interview[]`. Does NOT accept `candidateId` query parameter (fails with 400 due to `forbidNonWhitelisted: true`). Candidate 360 filters client-side by candidate's application IDs.
- `GET /offers` — returns `Offer[]` (scoped to organization). Does NOT accept `candidateId` query parameter. Candidate 360 filters client-side by candidate's application IDs.
- `PATCH /candidates/:id` — accepts `skills?: string[]`, used by Candidate 360 to persist tags.
- `PATCH /applications/:id/stage` — exists (ApplicationDetailPage calls it)
- `POST /applications/:id/notes` — Implemented in P2.0-backend (requires `APPLICATION_MOVE_STAGE` + `TenantScopedGuard`, audit action `APPLICATION_NOTE_CREATE`).
- `GET /applications/:id/notes` — Implemented in P2.0-backend (requires `APPLICATION_VIEW` + `TenantScopedGuard`, returns `ApplicationNote[]` ordered by `createdAt desc`).
- `GET /applications/:id/history` — exists (ApplicationDetailPage fetches it)
- `GET /hiring` — exists (JoiningManagementPage fetches)
- `PATCH /hiring/:id` — exists (HiringCasePage calls it)
- Interview scorecard endpoints — NOT confirmed, likely missing

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
