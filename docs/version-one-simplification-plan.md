# RecruitFlow version-one simplification plan

Status: current readiness review for controlled UAT and production cutover planning.
Prepared: 22 September 2026.

This is the current product-scope plan agreed in the conversation. It supersedes broader interface expansion in `uat-enhancement-plan.md`, including its old drawer workflow. Existing security, data-preservation and verification requirements still apply. Prior audit results are historical evidence, not acceptance evidence for these changes.

## Current readiness — 22 September 2026

This table reflects the current `main` build (`6071900`) and the deployed web build. “Ready for controlled UAT” means the workflow exists and can be tested with isolated data and configured services. It does not mean that an external provider, production data store, or production release gate is already configured.

| Area | Ready for controlled UAT now | Delayed or conditional work |
| --- | --- | --- |
| Access and authorization | Login, password reset/invitations, refresh-cookie sessions, role/permission guards, tenant-scoped API checks and audit events. | SSO/SAML/OAuth and a long-session soak remain delayed; verify refresh behavior in the final API/web environment before cutover. |
| Requisitions and approvals | Vacancy request creation, budget/headcount planning, AED/EGP currency choice, target fill date, start/defer timing, sequential approvals and conversion to a vacancy. | Production approval-matrix sign-off and migration/rollback rehearsal are still required. |
| Job Positions | Position directory, requisition queue, lifecycle/status controls, recruiter assignment, requirements setup and Job Description import from the Job Positions workspace. | JD import stays scoped to Job Positions; external parsing/provider expansion is delayed until the configured service and error/retry path are accepted. |
| Candidates, CV intake and talent pool | Candidate profiles, duplicate review, CV intake/parsing where configured, CSV/XLSX import, source data, talent-pool storage and candidate-to-position linking. | Production CV binary storage, malware scanning, retention, external backup and full provider validation are delayed. |
| Applications and Applicant Profile | Unified stage workspace, persisted screening, notes/activity, stage gates, optimistic-lock conflict handling, application pipeline and permission-aware actions. | Full multi-role browser matrix and long-session refresh verification remain release gates. |
| Sourcing and comparison | Vacancy-based matching, candidate comparison, matched-first skill tags and truthful fit scoring when a vacancy is selected. | Fit remains assistive; autonomous screening or hiring recommendations are delayed. |
| Interviews and scorecards | Calendar views, scheduling, candidate self-scheduling links, `.ics` export, structured scorecards and fast scorecard entry. | SMTP delivery, external calendar invitations and multi-channel reminders are delayed; use in-app flows and exported calendar files for UAT. |
| Offers, compliance and joining | Versioned offers, approval flow, compensation capture, clinical readiness gates, joining checklist and headcount update. | Payroll/HCM/ERP integration and external onboarding synchronization are delayed. |
| Administration, master data and audit | Users/Roles, master data, controlled imports, email-template management, reports, integration health visibility and immutable audit log. | Scheduled report delivery, broad integration management and additional external providers are delayed. |
| Deployment and operations | Vercel web production build, Docker Compose targets, health/readiness endpoints, release documentation and rollback guidance. | Production API/worker/database/Redis/document-storage cutover, backup-restore drill, mail sink, load test and final monitoring sign-off are still required. |

### Explicitly delayed product scope

| Capability | Decision | Reason |
| --- | --- | --- |
| Autonomous AI screening or hiring decisions | Delay | Matching and fit scores assist a human reviewer; they must not make or approve a hiring decision. |
| Production CV binary lifecycle | Delay | Storage, malware scanning, retention, external backup and recovery ownership are not yet accepted for production. |
| Outbound email, WhatsApp, SMS and external reminder delivery | Delay | Current workflows support in-app notifications, templates, links and `.ics`; external delivery needs an approved outbox/provider design. |
| SSO/SAML/OAuth | Delay | Username/password authentication is the supported release path. |
| Payroll, ERP and full HCM replacement | Delay | RecruitFlow covers recruitment operations and joining readiness, not payroll or the complete HR system of record. |
| Multi-tenant SaaS operation and compliance certification claims | Delay | The deployment model is single-tenant and the repository makes no GDPR, PDPL, ISO or SOC2 certification claim. |
| Scheduled/advanced reporting delivery and custom report builders | Delay | Current reports are read-only operational views with manual export/print paths. |

### Required before production cutover

| Gate | Evidence required |
| --- | --- |
| Current build verification | Typecheck, production build, focused workflow tests and the full web test wrapper failures either fixed or explicitly accepted. |
| Environment readiness | Real API, PostgreSQL, Redis/worker, document storage, secrets, CORS and health/readiness checks verified together. |
| Security and permissions | Administrator, recruiter and restricted employee checks across at least two isolated organizations, including direct URLs and sensitive-field redaction. |
| Data recovery | Migration status, disposable restore rehearsal, document backup/restore plan and rollback commit identified. |
| Operational smoke test | Candidate/CV intake, vacancy approval, application stage move, interview/scorecard, offer approval and joining completion with isolated records. |
| Observability | API/worker health, queue backlog, failed jobs, storage failures, auth refresh failures and audit events visible to the support owner. |

The readiness boundary is intentional: the current build is suitable for controlled UAT and internal workflow validation. Production certification waits for the cutover gates above; delayed scope should not be presented as available functionality.

## Outcome

A recruiter can upload or enter a candidate, link a position, complete screening, record contact and schedule the next action without re-entering information or moving through several management pages.

Use existing records, services and visual components. Preserve current business data and the selected VL samples. No database reset, new demo users, automatic candidate merges or real outbound communications are part of this work.

## Version-one navigation

| Destination | Decision |
| --- | --- |
| My Work Today | Default operational start: overdue, today and upcoming work, interviews and assigned positions. Employee/requester content stays permission-appropriate. |
| Requisitions | Keep the request and approval workflow. |
| Job Positions | Keep position details, assignments and linked applications. |
| Applications | Keep the pipeline and full applicant profile. |
| Candidates / CV Bank | One candidate directory, one identity record, multiple documents and applications. Use `/candidates` as the canonical entry and redirect `/cv-bank` to it. |
| Interviews | Keep scheduling and calendar. |
| Approvals | One unified inbox for existing supported approvals; preserve legacy links. |
| Offers & Hiring | Group existing offer and joining workflows without combining their underlying records or approvals. |
| Administration | Users & Roles, Master Data and essential Settings, with existing permission gates. |

Remove Notification Center, Integrations & API Management and Tasks from the default sidebar, command search and redundant shortcuts. Keep the notification bell and working record links. Keep task storage and follow-up functionality. Move CV Intake to an Upload CV action instead of a separate sidebar destination. Keep Smart Sourcing and candidate comparison as optional, permission-aware modules for controlled UAT; keep advanced reporting outside the default navigation. Fit remains human-reviewed assistance, not an autonomous decision.

Navigation hiding never grants or revokes API access. For retired entry points, use a meaningful authorized redirect after auditing inbound links. `/tasks` must still resolve existing task references to My Work or their linked record; unlinked tasks must remain accessible in My Work before the old entry is retired. Integration configuration stays preserved and outside the ordinary employee flow.

## Ordered delivery

### Phase 0 — baseline and dependency check

- Inventory current changes and map affected navigation, quick actions, routes, DTOs and existing records.
- Verify the actual web/API build pair before tests; the earlier audit found a stale API behind the normal development URL.
- Inspect task references, notification links, existing CV Bank behavior, master-data schemas and interview attendee fields before choosing changes.
- Confirm the source of long-session 401 failures with a controlled refresh test, including multiple requests and tabs. Do not classify all failures as harmless session expiration or hide them by repeatedly logging in.

Acceptance: a recorded baseline, preserved records, mapped route replacements and a reproducible authentication diagnosis. Fix confirmed core session defects before the final UAT gate.

### Phase 1 — applicant profile and quick actions

- Keep a compact header with candidate/position, stage, owner, last contact and next follow-up.
- Provide four clear actions: Log Call, Schedule Follow-up, Schedule Interview and Move Stage. Put less-used actions under More. Avoid duplicate top/bottom/sidebar actions.
- Log Call captures outcome, occurrence time, optional notes and optional next follow-up in one form. Save the call and requested follow-up consistently; an uncertain retry must not duplicate either record.
- Follow-up captures due date/time, owner and purpose. Offer complete/reschedule controls in the profile and My Work. Preserve completion attribution and reschedule history.
- Retain notice period, current salary, expected salary and currency in screening, with server-side field permissions.
- Keep assessments and long timelines collapsed or in existing tabs. Use the full profile rather than restoring the split drawer.
- Preserve form values on errors, prevent double submission and warn before leaving unsaved edits. Show success only after persistence.

Acceptance: a recruiter records a call plus follow-up in one save, reloads and sees both exactly once, and can complete the follow-up from either location. Scheduled work and stage events do not inflate completed activity counts.

### Phase 2 — simpler interview scheduling

- Replace the manually entered Interview Title field with Interviewer Job Title, alongside the selected interviewer.
- Prefill the job title from the selected person's actual profile when available; allow an authorized correction when missing. Do not confuse a security role with a job title.
- Generate the interview's existing title from candidate, position and interview type; retain it for existing calendar/API consumers.
- Keep date/time, timezone, duration, interview type and interviewer selection visible. For a panel, associate each title with its interviewer rather than one ambiguous shared field.
- Audit storage before migration; if a new snapshot field is necessary, preserve existing interviews and leave unknown titles blank.

Acceptance: scheduling works from Applicant Profile, the correct interviewer/title survives reload, and calendar/detail views remain compatible with old interviews. No external invitation is sent by verification.

### Phase 3 — My Work and navigation cleanup

- Reuse persisted tasks and interviews to build the overdue/today/upcoming queue; show candidate, position, owner and next action.
- Allow completion or opening the relevant full profile directly. Include unlinked existing tasks so hiding Tasks loses no work.
- Apply tenant, assignment and action permissions consistently to queues and counts. Show explicit loading, empty and failed states.
- Once replacements work, remove the agreed standalone navigation items and update bell links, search, help text, breadcrumbs and legacy redirects.
- Consolidate approval navigation only after checking every existing approval action has an equivalent destination.

Acceptance: every existing open task has an accessible destination; a recruiter can start from My Work and act without visiting a separate task-management page. Hidden pages produce no broken links or permission bypasses.

### Phase 4 — one Candidates / CV Bank

- Reuse the candidate directory as the sole bank. Offer Upload CV, Enter Details and Add to Position.
- Save candidates without requiring an application. Preserve uploader/administrator privacy rules and existing authorized sharing.
- Show name, current title, experience, location, skills, CV source, owner, last contact and next follow-up; keep less-used columns optional.
- Retain original CV files and history. Candidate source is separate from filename, uploader and upload timestamp. Source options come from Master Data.
- Separate candidate identity/status from per-position application stage, screening and rejection. A rejection for one role must not reject other applications or remove the person from the bank.
- Review duplicate matches using normalized email/phone and accessible records. Phone matches are suggestions, not grounds for automatic merging; never expose inaccessible candidate details.
- Support name plus at least one valid contact method. The current API and database require email, so phone-only entry requires a coordinated schema/API/import/deduplication change, not merely removing a UI required flag. Preserve existing email uniqueness for populated emails, test null handling, and disable email-only actions with a clear missing-email explanation. Never synthesize email addresses.
- Review candidate creation, import, public apply and update paths together. Verify migration recovery against a disposable database; do not roll back nullable emails by inventing values.

Acceptance: a phone-only candidate can be saved and found; a CV remains available without a vacancy; adding a second application reuses the identity; rejecting one application leaves the other intact. Existing bank links and documents continue to work.

### Phase 5 — focused Excel-style Master Data

Provide a reusable tabbed grid with defined columns per category, not a general spreadsheet builder.

| Tab | Initial columns |
| --- | --- |
| Branches | Code, name, city, active |
| Departments | Code, name, applicable branch relationship, active |
| Job Titles | Code, title, department, level, suggested skills, active |
| Skills | Name, category, description, active |
| Candidate Sources | Name, type, active |
| Interview Types | Name, default duration, active |

- Map each tab to current persisted entities. Inspect actual department/branch relationships before adding fields; use linked selectors instead of free-text foreign keys.
- Add inline cell editing, keyboard navigation, search/filtering, multirow add and paste from Excel. Reuse existing import preview/validation where possible.
- Track pending edits with Save Changes and Discard. Validate pasted/imported rows before writing, identify errors by row and column, and clearly distinguish saved from unsaved rows. Define bounded batches and transaction behavior before implementation.
- Prevent duplicate codes/names within their real scope and reject stale concurrent updates. An import must not silently overwrite another admin's edits.
- Deactivate referenced values rather than deleting history. Inactive values remain visible on old records but unavailable for new selection.
- Update the corresponding forms from saved master data. Suggested job skills remain editable requirements and never become invented candidate qualifications.
- No formulas, macros, arbitrary columns, complex spreadsheet formatting or new bulk-delete flow in version one. Use a readable responsive form fallback on small screens.

Acceptance: the admin pastes several rows, corrects invalid cells and saves without opening a modal per record; those values appear in dependent forms. Foreign keys, active flags, concurrent edits and historical labels behave correctly.

### Phase 6 — verification and handover

- Run relevant unit/contract tests, typecheck, lint, production builds and migration checks after each phase.
- Test one complete workflow using isolated records: upload/enter candidate → duplicate review → add application → screening → call with follow-up → complete follow-up → interview → existing offer/approval/joining flow.
- Test Administrator, recruiter and restricted employee behavior, including two-organization isolation, salary redaction and hidden-page direct URLs.
- Test failed saves/uploads, double clicks, retry after uncertain response, stale updates and long-session refresh without losing work.
- Verify mobile and desktop layouts, keyboard editing/focus, both themes, and all updated legacy links. Read-only route checks alone are insufficient.
- Record CSS and design-token failures separately. Target the existing budgets without increasing thresholds or removing required styles. If unresolved, document them explicitly in the UAT handover instead of calling all release checks green.
- Deliver a short recruiter walkthrough, admin Master Data guide, test evidence and remaining limitations.

Acceptance: no unresolved defects in the core workflow, no data loss or authorization failures, and clearly recorded results for every gate. Production deployment and external delivery remain outside this plan.

## Minimum activity indicators

Only last contact, completed activity count and next follow-up are required now. Completed calls count once whether reached or unanswered; their outcomes remain visible. Scheduled follow-ups and automatic stage changes are separate. No employee rankings, weighted productivity scores or advanced analytics in version one.

## Deferred scope

Standalone task management, standalone notification history, spreadsheet formulas/custom columns, scheduled/advanced reporting delivery, broad integration management and new external-provider integrations remain outside the initial operational rollout. Vacancy-based matching and candidate comparison are implemented in the current build as controlled, human-reviewed assistance; they are not autonomous hiring decisions.

Existing capabilities needed for approval, privacy, CV storage or hiring are preserved. “Deferred” means outside the default version-one experience, not deletion of historical records.

## Implementation checklist

- [x] Phase 0: baseline, dependencies and session diagnosis
- [x] Phase 1: profile and call/follow-up actions
- [x] Phase 2: interviewer job title and generated interview title
- [x] Phase 3: My Work and navigation consolidation
- [x] Phase 4: unified bank, minimum entry and duplicate handling
- [x] Phase 5: tabbed Master Data grid
- [x] Phase 6: workflow verification and handover

Implement in this order. Do not hide a page until its useful actions and records have a working replacement. The current implementation is ready for controlled UAT, while the production cutover gates and explicitly delayed scope above remain open.
