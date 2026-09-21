# Findings

## Current task — Requisition planning fields (2026-09-21)

- Screenshot shows pending approval request details with Budget Allocation as only `Budgeted` and Target Start as `Flexible`; user needs monetary range, a target fill date, and whether recruitment should start or stay deferred.
- Existing Prisma `VacancyRequest` has `budgetStatus` and `targetStartDate`, but no range or explicit deferred/open plan fields. Existing planning files below refer to a previous task and are preserved.
- Create form posts directly to vacancy request API. Service and both Prisma/in-memory repositories map request fields; request conversion explicitly creates a vacancy with `Pending Activation` status. Detail UI uses four top summary cards and repeated status-only budget text.
- New plan: optional persisted `budgetMin`, `budgetMax`, `budgetCurrency`, `targetFillDate`, `recruitmentTiming`, `plannedOpenDate` on request. New submitted requests require the planning values; old records remain nullable. Deferred conversion will create an `On Hold` vacancy, so recruitment does not start by accident.
- User clarified allowed currencies: AED (UAE dirham) or EGP (Egyptian pound) only.

---

## Audit

- Applicant Profile already owned the candidate summary, history, screening, interviews, notes, and legacy quick actions. The old Stage Transition page duplicated movement work and was suitable for a compatibility redirect.
- Pipeline stages are organization-scoped records. Their entry/exit gate text was persisted, but there was no persisted flag to say whether a gate should block advancement. `PipelineStage.required` and a migration close that gap without changing existing behavior.
- Stage transitions already had a version column and status history. The workspace now sends `expectedStage` and `expectedVersion`, keeps the transaction atomic, and exposes a conflict response that refreshes current data.
- Existing APIs remain the persistence boundary for screening, interviews, offers, hiring, documents, notes, and activities. This prevents duplicate state between the workspace and the rest of the application.

## Fixes delivered

- Interview records now follow the `VACANCY_VIEW` boundary end to end: the profile skips the list request when the permission is absent and renders a clear restricted state.

- Added `GET /applications/:id/workspace` with tenant-scoped application visibility, persisted pipeline metadata, evaluated requirements, stage summary, and sensitive-data-safe output.
- Required gates are evaluated server-side for identity/CV/assignment, screening, interview feedback, offers, compliance, and joining. A blocked transition returns the safe `STAGE_GATE_BLOCKED` code and actionable requirement details.
- Added a single ApplicantStageWorkspace with a scrollable stage rail and in-place Applied, Screening, Interview, Offer, Pre-Hire, Joined, and custom-stage panels.
- Added fixed Save, Advance Stage, Reject, Add Note, Call, Email, and Follow-up actions. Meeting links and named interviewers stay in the existing scheduling flow; scorecards open in place.
- Added unsaved-screening protection for tab changes and destructive/refetching actions, plus the existing before-unload guard.
- Pipeline Settings can mark a stage as required and preserves the flag through create, edit, and duplicate operations.
- Legacy `/applications/:id/transition` links redirect into the profile workspace.

## Transition boundary

The persisted pipeline ordering is authoritative whenever it contains the current stage: only its immediate next stage (plus terminal rejection/withdrawal paths) can be entered. Legacy records without a matching pipeline stage use the canonical transition map. Custom labels remain bounded and arbitrary jumps are rejected.
