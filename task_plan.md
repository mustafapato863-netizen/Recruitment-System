# Unified Applicant Stage Workspace

## Current task — Requisition planning fields (2026-09-21)

- [x] Audit request and vacancy schema, API validation/mapping, create form, detail and overview display.
- [x] Add budget minimum/maximum, target fill date, and actionable opening state while preserving existing records.
- [x] Update request creation and detail UI so the plan is explicit and useful.
- [x] Verify schema/migration, API and UI tests, typechecks, build, and relevant browser flow.

Working interpretation: a request can recruit after approval or be deferred until a planned opening date; target fill date says when the approved headcount should be filled. The request records a numeric monthly budget range per position and an explicit currency.

---

## Goal

Keep Applicant Profile as the recruiter’s single stage-aware workspace for the persisted pipeline. Each stage exposes its data and actions in place, while stage movement remains protected by server-side gates, permissions, and optimistic concurrency.

## Implementation status

- [x] Audit the existing Applicant Profile, transition route, pipeline settings, permissions, and tests.
- [x] Add the compatible workspace contract and persisted `PipelineStage.required` field.
- [x] Implement the workspace API, gate evaluation, safe error details, tenant checks, permissions, and version-checked transitions.
- [x] Implement the unified stage rail, Applied/Screening/Interview/Offer/Pre-Hire/Joined surfaces, fixed action rail, unsaved-change protection, and responsive layout.
- [x] Keep the legacy Stage Transition route as a redirect into the Applicant Profile workspace.
- [x] Run type checks, lint, builds, database validation/migration checks, focused unit tests, and browser smoke coverage.

## Decisions

- The organization’s active default pipeline is the source for the stage rail and gate metadata. A small legacy fallback keeps applications usable when no default template exists.
- Required entry and exit gates block transitions in this release. Optional gates remain visible as guidance.
- Screening edits use `CANDIDATE_EDIT`; stage movement uses `APPLICATION_MOVE_STAGE`; salary, offer approval, hiring approval, and document access remain separately permissioned.
- Interview scheduling/status changes remain stage-move protected, while scorecard entry follows the existing `VACANCY_VIEW` interview API permission so interviewers can submit feedback without receiving stage-control access.
- Existing offer, hiring, interview, note, activity, and screening APIs are reused so no duplicate persistence tables were added.

## Verification evidence

- API: 19 files / 91 tests passed.
- Applicant Profile focused UI test: 6 tests passed.
- API, web, and worker type checks passed; lint passed; production build passed.
- Prisma schema validation, client generation, migration deployment/status checks passed.
- Local browser smoke confirmed the Applicant Profile workspace, dynamic six-stage rail, Screening fields, and fixed actions. The broader legacy smoke suite still has unrelated route-label/notification expectations that predate this workspace.

## Transition boundary

The persisted pipeline ordering is authoritative whenever it contains the current stage: only its immediate next stage (plus terminal rejection/withdrawal paths) can be entered. Legacy records without a matching pipeline stage fall back to the canonical transition map. Custom stage labels remain bounded and arbitrary jumps are rejected.
