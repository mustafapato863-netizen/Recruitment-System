# RecruitFlow: candidate activity and system review

Review date: 7 September 2026. Environment: local PostgreSQL, API and Vite web application. Existing data and unrelated changes were preserved.

## Delivered: one candidate activity workspace

Open a candidate profile, or the candidate drawer's **Activity & follow-ups** tab.

| Measure | Definition |
| --- | --- |
| Completed | Completed recorded tasks, human-authored application notes, screening records and submitted interview scorecards within the viewer's accessible scope |
| By me | The same completed records attributed to the signed-in user |
| Follow-ups open | Open or in-progress work, separate from completed work |
| Overdue | Open work whose due date has passed |
| Last activity / next follow-up | Last completed record and earliest outstanding due date |
| Type and recruiter breakdown | Completed records grouped by activity type and responsible user |

Recruiters can record a call, note, email, meeting, document verification or offer follow-up in one form. A future follow-up remains open until its owner marks it done. Repeating completion does not increase the count again. Email logging records an email already sent; it does not send mail. Screening and submitted interview assessments are collected from their actual records. Scheduled interviews and stage changes appear as context and do not inflate completed activity totals.

The drawer now opens activity first. Local-only sample chatter, simulated email/scheduling and simulated scorecard submission were removed. Interview assessment and hiring actions lead to the actual workflows. Candidate tasks link back to the candidate activity page. The drawer stacks its columns on smaller screens.

No schema migration was needed: candidate activity uses existing persisted tasks. Server-side checks enforce candidate tenancy, effective scope, ownership for completion and PII masking. Candidate-level shared activity is visible to the candidate's authorized team; ordinary task visibility remains restricted to the assignee. Application records require APPLICATION_VIEW. A recruiter restricted to assigned applications cannot use this endpoint for an unassigned candidate with no accessible application.

These are **recorded activity counts**, not verified effort, hours worked or a quality score. A manually logged note and an application note describing the same real-world call are separate records. Integrations should supply external event IDs before automated communication ingestion is added. The existing task assignee identifies the responsible recruiter; it is not an immutable historical actor for every legacy task.

## What is good

| Area | Evidence and value |
| --- | --- |
| Workflow coverage | Requisitions, vacancies, candidates, applications, interviews, offers, hiring, licensing and joining have dedicated screens and backend modules. Recruiters can follow an end-to-end process in one application. |
| Persistence | PostgreSQL/Prisma relationships and 25 applied migrations provide a real data foundation; current migration status is up to date. The new activity workflow was tested against the database and after browser reload. |
| Interviews and offers | Interview scorecards are locked on submission. Offers have version records, approval transactions and an approval check before sending. See `interviews.service.ts:495` and `offers.service.ts:438,513`. These are useful controls, though every business path was not exercised in this review. |
| Access administration | Permission guards, audit actions, configurable roles and separate navigation configuration already exist. The structure supports admin-controlled access, subject to the scope gaps below. |
| Engineering checks | Unit suites, type checking, lint, production build, database status and a responsive light/dark route matrix are available and executable. |
| Recruiter usability | Candidate activity is now persistent and presented chronologically for the candidate, with explicit empty/error states and next-follow-up visibility. |

## What needs enhancement, in priority order

| Priority | Finding and evidence | Recommended action |
| --- | --- | --- |
| P1: before multi-user UAT | Application listing/detail only handle ASSIGNED_ONLY, omitting branch/department filters. Assignment checks include inactive assignments. Notes call getApplication without the user context. Evidence: `apps/api/src/applications/applications.service.ts:77,81,171,175,451,473`. This is a code-confirmed access-control gap; no unauthorized production access was attempted. | Centralize effective application visibility and reuse it in every list, detail and mutation, including screening/notes. Test two organizations, two branches, two departments, revoked assignment and custom roles through HTTP. The new activity endpoint's stricter filtering does not repair the other endpoints. |
| P1: assignment reliability | Reassignment creates a fresh assignment ID and deactivates the previous row. A unique constraint on `(vacancyId,userId,roleCode,isActive)` allows only one inactive row for that combination. Repeating the same assignment a third time can conflict when another inactive row is created. Evidence: `vacancy-core.service.ts:661`, `prisma-vacancy-core.repository.ts:464`, `schema.prisma:364`. This is a schema/code-derived failure scenario, not a destructive test of existing assignments. | Use stable current-assignment rows and explicit history, or design an appropriate active-only uniqueness constraint with a reviewed migration. Add repeated A→B→A→B and concurrent reassignment tests before changing the schema. |
| P1: task integrity | Generic task creation accepts assignee and linked entity identifiers directly, without organization membership/entity checks in `apps/api/src/tasks/tasks.service.ts:95`. | Validate recipient and referenced entity against the caller's organization and scope; perform task/notification writes consistently. The new activity route assigns only the authenticated user and validates the candidate. |
| P2: misleading success | Task creation catches errors and continues in `apps/web/src/pages/TasksPage.tsx:289` and `ManagerDashboard.tsx:131`. | Display success only after a successful response; preserve form input and expose retryable errors. |
| P2: remaining hardcoded presentation | Interview detail displays a fixed 85% assessment indicator (`InterviewDetailPage.tsx:734`); manager dashboard contains a fixed 85% bar (`ManagerDashboard.tsx:583`). | Replace with an explicitly defined server metric or a clear unavailable state. Removing mock activity does not mean all hardcoded data has been removed system-wide. |
| P2: incomplete candidate history | Candidate detail requests one page of applications, then loads interview/offer collections and filters them in the browser. Evidence: `apps/web/src/pages/CandidateDetailPage.tsx`, `fetchData` and refresh handlers. | Add candidate-filtered, paginated endpoints for linked resources. The activity summary already queries all accessible application IDs, but other candidate tabs can still omit older applications. |
| P2: accessibility | The route matrix reports failures on candidate and application pages; see verification evidence below. | Fix the reported contrast/form issues and rerun the affected screen widths/themes. Successful rendering does not imply accessible interaction. |
| P2: performance | Production CSS is 406.24 KiB against the configured 225 KiB budget. Main JS is within its 300 KiB budget. The new activity summary loads scalar activity rows before paginating its timeline. | Reduce duplicated/legacy CSS. At high activity volumes use database aggregates and bounded timeline queries, with measured query plans and candidate-task indexes as justified. |
| P2: operational readiness | `scripts/dev.mjs` launches API and web; the background worker has a separate command. `/readiness` checks the database only. | Add explicit worker/queue status and operational monitoring. Verify CV processing, queued email, calendar integrations and retries with approved test services. Do not infer those services are working from a green API health endpoint. |

## Measures worth adding next

Use activity volume alongside outcomes; do not rank recruiters by count alone.

1. **Coverage:** assigned active candidates contacted / assigned active candidates; exclude closed applications and deduplicate candidates.
2. **First response:** median and 90th percentile elapsed time from recruiter assignment to first completed contact; define working-hours treatment.
3. **Follow-up reliability:** follow-ups completed by their due time / follow-ups due in the period. Store due-date history before allowing rescheduling to affect this KPI.
4. **Stale candidates:** active candidates without a completed contact within an admin-defined threshold, grouped by owner.
5. **Conversion:** contacted → screened → interviewed → offered → joined, with date cohort and vacancy/branch filters.
6. **Time in stage:** median days by stage, showing waiting-for-candidate versus internal approval delay when that distinction is recorded.

Next recruiter UX priorities: a “My day” list sorted overdue first, explicit next action/owner on each active candidate, structured contact outcome choices, and one-click navigation to the right application. These are recommendations, not features claimed as delivered in this change.

## Verification and limitations

- Unit tests: existing web suite 141/141 plus new panel tests 4/4; API 55/55; worker 4/4.
- Type checking and lint pass. Production build passes. Bundle budget fails for CSS as noted above.
- Database: 25 migrations applied; schema up to date. No migration introduced by candidate activity. No rollback test was required for this change.
- API health/readiness return HTTP 200 with database connected; this does not establish worker, SMTP, calendar or external storage readiness.
- `node tests/candidate-activity-local.cjs` exercises isolated local data, activity logging, follow-up completion, repeat completion, pagination, input validation and missing-candidate rejection. Its browser companion verifies real form submission, reload persistence, mobile/desktop overflow and JavaScript page errors. Test fixtures are removed in cleanup.
- The broad browser matrix is a read-only admin route/accessibility smoke test across six widths and two themes. It does not prove every role or every mutation is correct. Result: **382/396 passed, 14 failed**. Twelve candidate-page combinations reported unnamed buttons and insufficient text contrast; two application-page checks (light theme, 1280/1440 px) reported insufficient contrast. Evidence: `tests/artifacts/dual-mode/matrix-summary.json`. These are repeated screen/theme checks, not 14 separate root causes.
- This was a broad source and local smoke review, not an exhaustive security audit or production certification. External email/calendar delivery, real CV batches, concurrent hiring/approval scenarios, backup restoration and complete role matrices remain to be tested.

Recommendation: use the candidate activity change for local recruiter testing. Resolve the P1 items before opening multi-user UAT or calling the whole system release-ready.
