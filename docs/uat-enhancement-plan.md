# RecruitFlow — issue fixes and full UAT enhancement plan

Status: implementation plan with staged implementation evidence recorded in `progress.md` and `findings.md`. Prepared 7 September 2026 from the current repository and system review.

## 1. Agreed outcome and boundaries

Deliver a reliable, easier recruitment system for multi-user UAT. Preserve the current visual identity and improve existing screens rather than redesigning the product. Metrics are operational indicators, without employee scores, targets or rankings.

Confirmed decisions:

- Each vacancy supports one primary recruiter and multiple supporting recruiters.
- A candidate with no application is private to the uploader/creator and organization administrators, unless explicitly shared.
- CV processing runs against actual test files. Email and calendar use isolated test adapters/accounts; no messages go to real candidates.
- Preserve current records and the six selected VL sample vacancies. Do not import the entire workbook, reset the database, or repeat the earlier user/role deletion.
- Keep the administrator protected. Other users and roles are created through admin configuration. Automated fixtures belong in an isolated UAT database and are removed after testing.
- Production deployment, real external delivery, payroll integration and a complete visual redesign are outside this release.

Baseline evidence: unit tests and builds passed in the preceding review; the admin browser matrix passed 382/396 checks, with 14 accessibility failures. CSS was 406.24 KiB against a 225 KiB budget. Access-scope, assignment and task-reference findings remain unresolved until implemented and verified.

## 2. Ordered implementation stages

### Stage 0 — preserve data and establish reproducible UAT

- Inventory current uncommitted changes, routes, API operations, migrations and integration settings; preserve unrelated work.
- Create a separate UAT database from a sanitized local snapshot. Verify backup restoration there before applying schema changes. Record baseline counts, duplicate assignments and records with unknown ownership.
- Maintain one defect register: reproduction, severity, affected workflow, regression test and result. Record progress in the existing planning files.
- Provide repeatable startup and test commands for web, API and worker. External adapters default to isolated UAT mode and show that status visibly.

Acceptance: baseline results are reproducible, no existing data is deleted, and tests cannot send external messages.

### Stage 1 — consistent access control and admin flexibility

- Introduce a shared authorization service that returns tenant-scoped query predicates and verifies individual resources. Apply it to candidates, vacancies, applications, notes, screening, interviews, scorecards, offers, hires, documents, tasks, search, notifications, reports and exports.
- Permissions control actions; data scope controls records; PII/salary/document permissions control fields and downloads; sidebar settings control navigation only. A hidden authorized page remains accessible by its URL; a visible unauthorized page never grants access.
- Combine granted permissions and role scope predicates by union inside the organization. A configured per-user scope override replaces the role-derived scope. Branch and department scopes are separate predicates, not a guessed privilege ordering. Missing required scope assignments deny access. Administrators have organization-wide access only.
- Add candidate creator/uploader ownership and explicit sharing. For candidates without applications, enforce creator/share/admin access even for a non-admin role with ALL application scope. Candidate sharing grants candidate access, not automatic access to every linked application. Backfill creator only from reliable creation/upload evidence; unknown ownership remains admin-only pending assignment.
- Capture actor/organization through every candidate creation path, including manual entry, CV intake, imports and asynchronous jobs. Duplicate intake must not transfer ownership or disclose an inaccessible existing candidate's PII.
- Preserve role policies, user overrides and user responsibilities when saving any settings section. Add version checks to reject stale updates rather than silently replacing newer settings.
- Configure role names, action permissions and per-role sidebar visibility/order through the admin UI. The permission catalog represents implemented capabilities; the admin creates named roles and permission combinations, not arbitrary executable capabilities. New roles begin with no granted actions. Remove hardcoded role-name exceptions from ordinary business operations.
- Keep admin settings reachable and prevent disabling/deleting the last active administrator. Do not recreate deleted demo roles/users during startup or seeding.

Acceptance: HTTP tests cover two organizations, two branches, two departments, custom/multiple roles, explicit overrides, private candidates, shared candidates, field redaction and direct URL access. Lists, counts, exports and details obey identical scope rules.

### Stage 2 — vacancy assignment and database integrity

- Replace recruiter assignment through generic vacancy snapshot saves with dedicated transactional assign/remove operations. General vacancy edits must not overwrite assignments.
- Extend recruiter assignments with PRIMARY/SUPPORT membership and revocation metadata, independent of the user's security role. Keep historical assignment rows. Replace the current boolean uniqueness constraint with active-only constraints: at most one primary recruiter per vacancy and no duplicate active recruiter membership. Preserve non-recruiter assignment semantics.
- Backfill the current active recruiter as primary where unambiguous. If conflicting active recruiter rows exist, stop migration preflight and produce an admin resolution list; never silently discard or choose between conflicting owners.
- Repeating the same assignment is a no-op. Changing the primary closes the previous membership and opens the new one atomically. Supporting recruiters remain unless explicitly removed; promoting a supporter consumes that support membership. Concurrent edits use a vacancy assignment version and return 409 on stale input.
- Active applications inherit vacancy primary ownership unless explicitly assigned separately. Record inherited versus explicit ownership; transfer only inherited ownership on reassignment. For existing records, matching current primary is inherited, a different explicitly populated recruiter remains explicit, and uncertain historical cases are flagged.
- Revoked membership no longer authorizes access. Candidate creator/sharing or a separate active application assignment can still grant legitimate access.
- Update vacancy detail, Command Center, assignment labels, counts and My Assigned Positions from the same persisted active memberships. Return primary and supporting recruiters explicitly and refresh affected queries after a successful mutation.
- Generic tasks must validate an active assignee and linked resource in the organization and authorized scope. Task/notification creation is transactional. Add explicit task creation/assignment capabilities instead of testing for a RECRUITER role name.

Acceptance: same assignment repeated three times; A→B→A→B; add/remove/promote supporter; two simultaneous edits; reload; cross-tenant assignee rejection; stale save rejection; inherited versus explicit application ownership. Verify migration on fresh and populated UAT databases. Recovery uses the verified pre-migration snapshot; do not recreate the old uniqueness constraint over incompatible new history.

### Stage 3 — recruiter workflow, candidate database and truthful data

- Add a My Day view: overdue work first, then due today, then future follow-ups, with candidate, vacancy, owner and next action. Show no-follow-up and stale-candidate filters. Use persisted query results and pagination.
- Make quick actions select the requested activity type and focus the input. Keep CV preview, screening, activity and next-step actions available from the existing drawer. Preserve unsaved input on failed requests; warn before closing a dirty form.
- Keep notice period, current salary, expected salary and currency in screening; validate nonnegative values, preserve missing values as null, and enforce salary disclosure on every response and export.
- Improve candidate search/filtering, pagination and duplicate detection. Review duplicate matches before merging; do not add automatic destructive merges. Preserve original CVs and expose parsing errors with a retry path.
- Add candidate-filtered, paginated application/interview/offer resources. Remove whole-collection client filtering and the implicit first-page history limit. Apply identical filters to totals and visible records.
- Review every screen for demo records, fixed percentages, fake badges, placeholder success and silent catches. Replace business values with real queries and documented calculations; use unavailable/empty/error states when data is missing. Fixed UI labels, validated workflow enums and design tokens are not fake business data.
- Editable departments, positions, skills and operational thresholds come from persisted master data/admin configuration. Do not expand the VL import beyond the selected sample. Proposed skills remain editable suggestions, never fabricated CV qualifications.
- Correct task creation success handling and other equivalent mutations. Wait for persistence, prevent duplicate submission and provide retryable errors. Use idempotency keys where an uncertain network retry can create duplicate business records.
- Add accessible labels to icon buttons, fix reported contrast, test keyboard focus/dialog behavior and improve mobile layouts while retaining current colors and component language.

Acceptance: recruiter completes upload → review → application → screening → follow-up → interview → offer → joining with permission-appropriate actions and no simulated success. Candidate history works beyond 20 applications. Failed uploads/saves preserve recoverable work. Browser checks pass at all six existing widths in both themes.

### Stage 4 — reliable activity and operational reporting

- Preserve existing completed/open/event distinctions. Extend activity with structured contact outcome, immutable performer and occurrence time, optional application association and an idempotency/source key. Keep task assignee separate from completed-by actor so reassignment cannot rewrite historical contribution.
- Record completion, rescheduling and owner changes as history. Backfill only known facts; label legacy unknown attribution/outcomes instead of assigning invented values. Existing candidate activity endpoints remain compatible.
- Give activity lists server-side filters for date/type/actor/status and bounded pagination; calculate totals across all matching records, not just the current page. Use database aggregates and measured indexes rather than fetching all activity rows.
- Provide date, recruiter, vacancy, branch and department filters on operational reports. Default reporting period is the last 30 calendar days; persist organization timezone, initially Africa/Cairo if unset, and use UTC storage. Time metrics use elapsed hours, not an unspecified business-hours calendar.
- Define completed work as saved completed records; attempted contact as completed Call/Email/Meeting with an outcome; successful contact as reached call, sent email or completed meeting. Notes and automated lifecycle events do not count as contact.
- Show current coverage as distinct active assigned candidates successfully contacted in the selected period / distinct active assigned candidates. No denominator means unavailable, not 0% or 100%.
- Show first-response median/P90 for assignment episodes beginning in the period, measured to the first contact attempt by that assigned recruiter. Show unanswered episodes separately. Historical episodes without reliable timestamps are excluded and their excluded count is visible.
- Show follow-up reliability as completed by the originally committed due time / non-cancelled follow-ups originally due in the period. Retain the original due date across rescheduling; show cancelled count separately.
- Show stale candidates with no successful contact for three elapsed days by default, configurable by admin. If never contacted, age starts at assignment.
- Show application-cohort stage conversion from available stage history: applied → screened → interviewed → offered → joined. Count each application once per milestone and distinguish offered from accepted/joined. Show current candidate contact coverage separately from application conversion.
- Show median completed stage duration plus current open-stage age. Do not infer waiting reasons that were never recorded. All metrics expose their definitions and data coverage; no weighted scores or employee rankings.

Acceptance: deterministic fixtures independently verify numerators, denominators, cross-application deduplication, timezone boundaries, reassignment, repeated events, missing history, cancelled/rescheduled work and empty periods. Dashboard, exported report and underlying filtered records reconcile.

### Stage 5 — operational reliability and complete UAT gate

- Make local/UAT startup manage API, web and worker with clear health output. Keep API liveness separate from readiness. Expose database, worker heartbeat, queue backlog/oldest pending job and configured integration status without secrets.
- Exercise real parsing/storage with a small authorized set of varied CVs: valid, scanned, malformed, duplicate and retry cases. Worker retries must not create duplicate candidates/applications.
- Use a local mail sink and calendar test adapter. Verify outbox retries, deduplication, delivery/failure visibility and safe disabled behavior. Record real SMTP/calendar delivery as outside this UAT claim.
- Remove duplicated/unused CSS without changing bundle limits to hide regressions. Meet existing CSS ≤225 KiB and main JS ≤300 KiB budgets, then rerun visual checks.
- Test representative load using an isolated fixture of 10,000 candidates, 20,000 applications and 100,000 activities. On documented UAT hardware, target p95 ≤1 second for warmed paginated list/summary APIs under 10 concurrent users, excluding external/file processing. Record query counts/plans and add only justified indexes.
- Run type checking, lint, unit/integration suites, migration checks, API authorization matrix, meaningful write workflows and the existing full browser matrix. Require no known P1 defects, no serious/critical accessibility findings on tested routes, and no unexpected console/network errors.
- Deliver an admin setup guide, recruiter testing script, test results, remaining limitations and rollback instructions. A passing local gate means UAT-ready, not production-certified.

## 3. Interface and compatibility requirements

| Area | Required contract change |
| --- | --- |
| Authorization | Pass authenticated context into shared scope predicates for list/detail/mutation/export; settings saves accept an expected version and preserve unrelated configuration. |
| Candidate ownership | Add creator and explicit shares; all creation/import jobs carry trusted actor context. Do not expose private duplicate matches. |
| Vacancy team | Assignment mutations accept primary/support intent and expected version; return active team and new version. Preserve old response fields during caller migration. |
| Linked candidate data | Add paginated candidate-specific applications/interviews/offers endpoints using the existing pagination envelope; migrate profile consumers without changing legacy list response shapes. |
| Activity | Add optional structured outcome/application association and idempotency fields; expose performer separately from current owner and preserve old clients' basic logging. |
| My Day and reports | Add scoped work-queue/activity-metrics queries with shared filters, metric definitions, timezone and data-coverage metadata. |
| Administration | Add per-role navigation configuration and task action capabilities to the existing catalog; existing role labels remain configurable. |
| Operations | Add restricted dependency/worker status; retain existing health endpoint compatibility. |

All authorization is server-side. Unknown scopes/identifiers fail closed. Stale writes return conflicts, and error responses do not disclose resources outside the caller's scope.

## 4. Delivery order and completion evidence

Implement stages in order: baseline → access → assignment/data integrity → recruiter workflow → reporting → full UAT gate. Finish the tests attached to each stage before expanding to the next. No separate agents or delegated tasks are required by this plan.

Each stage delivers reviewed code, relevant regression tests, migration/recovery evidence if applicable and an updated defect register. The final handover must list what passed, what failed, which integrations were simulated, and what remains outside scope. Do not describe the system as bug-free based only on builds or read-only page checks.
