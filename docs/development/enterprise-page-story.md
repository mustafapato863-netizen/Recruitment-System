# RecruitFlow Enterprise Page Story

## 1. Product story

RecruitFlow tells one operational story:

> A business identifies a workforce need, creates an opening, routes it through the right approvals, attracts and evaluates candidates with consistent evidence, makes a controlled offer, completes compliance and joining, then measures the result and improves the process.

Every page must move that story forward. A page is not complete when it merely displays records; it is complete when the user knows what happened, who owns the next action, what evidence is missing, and where to go next.

## 2. Handoff contract for every page

Every production page must include:

1. **Context**: organization, object, role, and current workflow stage.
2. **Outcome**: the business result this page is responsible for.
3. **Primary next action**: one obvious action for the current role.
4. **Ownership**: current owner, next owner, SLA, and escalation state.
5. **Evidence**: data, documents, comments, approvals, scorecards, or audit events supporting the state.
6. **Handoff**: a direct link to the next page with the relevant object ID and saved filters preserved.
7. **State matrix**: loading, empty, error, forbidden, pending, success, and responsive behavior.

No page may end with a dead button, a fake metric, an unexplained status, or a navigation jump that loses the user’s object context.

## 3. End-to-end chapters

### Chapter 0 - Enter and orient

`/login` -> `/`

The user signs in, sees the organization and role context, and lands in the correct workspace. The first screen should answer: “What needs my attention today?”

### Chapter 1 - Work the queue

`/` -> `/tasks` or `/notifications` -> relevant object detail

The command center prioritizes approvals, overdue actions, interviews, offers, and blockers. Tasks and notifications are cross-cutting utilities; they hand the user to the object that needs a decision.

### Chapter 2 - Create workforce demand

`/vacancy-requests` -> `/vacancy-requests/create` -> `/vacancy-requests/:id`

The hiring manager describes the need, validates headcount/budget/criticality, and submits a request. The detail page becomes the source of truth for status, approvals, comments, revisions, and next action.

### Chapter 3 - Approve and activate the opening

`/approval-inbox` -> `/vacancy-requests/:id` -> `/vacancies` -> `/vacancies/:id`

The approver sees only assigned decisions, reviews evidence, approves/requests changes/rejects, and the approved request becomes an opening. The vacancy overview owns recruiter assignment, headcount fulfillment, and pipeline entry.

### Chapter 4 - Acquire and normalize talent

`/cv-intake` -> `/cv-intake/:jobId` -> `/candidates` -> `/candidates/:id`

Recruiting operations import candidates, resolve malformed and duplicate rows, preserve source attribution, and hand the clean candidate identity to the talent workspace. The candidate profile is the durable identity; applications belong to a vacancy.

### Chapter 5 - Move candidates through evidence-based hiring

`/applications` -> `/applications/:id` -> `/interviews` -> `/interviews/:id`

Recruiters move applications through configured stages. Interview plans define the evidence to collect; interviewers submit scorecards; the application detail makes the next decision and missing evidence explicit.

### Chapter 6 - Make and govern the offer

`/offers` -> `/offers/create` -> `/offers/:id` -> `/offers/approvals/inbox`

The recruiter creates an offer from the application, the detail page shows immutable versions and compensation components, and the approval inbox routes the decision to the authorized approver. Accepted offers hand off to pre-hire.

### Chapter 7 - Prepare and complete joining

`/hires` -> `/hires/:id` -> `/hires/approvals/inbox` -> `/licenses` -> `/joinings`

The hiring case owns compliance requirements, documents, final approval, and readiness. License checks and joining tasks are explicit downstream work, not disconnected placeholder pages.

### Chapter 8 - Learn and improve

`/reports` -> underlying object page; `/pipeline-settings`; `/integrations`; `/audit-log`

Leaders inspect funnel, SLA, source, workload, and hiring outcomes. Every chart can drill into records. Operations configure templates/integrations and audit who changed what and why.

## 4. Page delivery matrix

### Entry and work management

| Route/page | Owner and purpose | Primary action | Handoff |
|---|---|---|---|
| `/login` Login | All users; authenticate and establish tenant/role context | Sign in, recover access, select workspace if needed | `/` role-aware Command Center |
| `/` Command Center | Recruiter, manager, HR leader; prioritize work and business risk | Open next action, filter by team/role/time, create vacancy request | `/tasks`, `/approval-inbox`, or the owning object |
| `/tasks` My Tasks | Any operational user; work assigned actions | Complete, reassign, snooze with reason, open object | Exact vacancy/application/interview/offer/hire detail |
| `/notifications` Notifications | Any user; review events and mentions | Mark read, filter, follow event to source object | Exact source page, preserving object context |
| `NotFoundPage` | Any user; recover safely from stale/deep links | Return to workspace or search | `/` or global search |
| `/maintenance` Maintenance | Any user during planned outage | See status and retry | Workspace when healthy |

### Workforce demand and approvals

| Route/page | Owner and purpose | Primary action | Handoff |
|---|---|---|---|
| `/vacancy-requests` Vacancy Requests | Hiring managers/recruiters; view demand and bottlenecks | Create, filter, open request, bulk export if permitted | Create or request detail |
| `/vacancy-requests/create` Create Request | Hiring manager; capture complete business need | Validate and submit draft | Request detail or approval inbox |
| `/vacancy-requests/:id` Request Detail | Requester/approver; source of truth for one request | Edit draft, submit, approve, reject, request changes, comment | Approval inbox or vacancy |
| `/approval-inbox` Request Approval Inbox | Approvers; process only assigned decisions | Approve, request changes, reject with evidence/comment | Request detail; approved request to vacancy |
| `/vacancies` Vacant List | Recruiters/HR; see active openings and headcount | Assign owner, filter by status/criticality, open vacancy | Vacancy overview or pipeline |
| `/vacancies/:id` Vacancy Overview | Recruiter/manager; operate one approved opening | Assign team, publish/activate, view funnel, manage headcount | Candidates/applications or request detail |

### Talent acquisition and candidate identity

| Route/page | Owner and purpose | Primary action | Handoff |
|---|---|---|---|
| `/cv-intake` CV Intake Hub | Recruiting operations; bring talent into controlled intake | Upload/import, choose source, review batch history | Import preview |
| `/cv-intake/:jobId` Import Preview | Recruiting operations; validate rows and duplicates | Resolve errors/duplicates, confirm import, download report | Candidate database and candidate profile |
| `/import` Legacy Import Entry | Compatibility route only | Redirect to the active intake flow or show explicit migration notice | `/cv-intake` |
| `/candidates` Candidate Database | Recruiters; search durable candidate identities | Search, filter, bulk action, create candidate, open profile | Candidate detail or application creation |
| `/candidates/:id` Candidate Profile | Recruiter/hiring team; see identity, history, consent, skills, documents | Apply to vacancy, contact, add note, resolve duplicate, open documents | Application, documents, talent pool, communications |
| `/candidates/:id/documents` Candidate Documents | Recruiter/HR ops; manage secure evidence | Upload, request scan, view authorized file, replace/version, record consent | Candidate profile or hiring case |
| `/talent-pool` Talent CRM/Pools | Recruiters; nurture and rediscover candidates | Add/remove, segment, search, enroll in campaign, open profile | Candidate profile or application |

### Hiring execution

| Route/page | Owner and purpose | Primary action | Handoff |
|---|---|---|---|
| `/applications` Pipeline | Recruiters/managers; see stage health and next actions | Move stage with reason, assign owner, filter saved view, bulk action | Application detail or interview |
| `/applications/:id` Application Detail | Hiring team; make a defensible application decision | Review evidence, schedule, advance/reject/withdraw, add decision note | Interview, offer, or candidate profile |
| `/interviews` Interview Management | Recruiters/coordinators; plan interviewer workload | Schedule/reschedule, assign interviewers, filter feedback gaps | Interview detail |
| `/interviews/:id` Interview Detail | Interviewers/recruiter; run plan and capture feedback | Complete scorecard, lock feedback, debrief, reschedule | Application detail or offer |
| `/offers` Offers | Recruiters/HR; monitor offer status and expiry risk | Create, open, withdraw, resend, filter approval state | Create/detail/approval inbox |
| `/offers/create` Create Offer | Recruiter; create controlled offer version | Select application, compensation, expiry, attachments, submit approval | Offer detail or offer approval inbox |
| `/offers/:id` Offer Detail | Recruiter/approver; inspect immutable version history | Approve, send, withdraw, revise as new version | Approval inbox or hiring case |
| `/offers/approvals/inbox` Offer Approval Inbox | Authorized approvers; decide offers | Approve/reject/request changes with reason | Offer detail; accepted offer to hiring case |

### Joining and compliance

| Route/page | Owner and purpose | Primary action | Handoff |
|---|---|---|---|
| `/hires` Hire Management | HR/recruiting; see pre-hire readiness and blockers | Filter by readiness, open case, assign owner | Hiring case or final approval |
| `/hires/:id` Hiring Case | HR ops; complete compliance and pre-hire evidence | Verify checklist, request document, submit final approval | Final approval, license, or joining |
| `/hires/approvals/inbox` Final Approval Inbox | Final approvers; accept/reject ready cases | Decide with evidence and reason | Hiring case, then joining |
| `/licenses` License Management | Compliance/HR; verify regulated role requirements | Add evidence, verify/reject, track expiry | Hiring case or joining |
| `/joinings` Joining Management | HR ops/manager; complete day-one readiness | Assign joining tasks, confirm joined/no-show/postpone | Reports and employee handoff |

### Insights and administration

| Route/page | Owner and purpose | Primary action | Handoff |
|---|---|---|---|
| `/reports` Reports | HR leaders/executives; understand outcome and risk | Filter, drill down, save, schedule, export | Source object page |
| `/pipeline-settings` Pipeline Settings | TA operations; configure stages, required evidence, automation | Edit draft template, publish version, preview impact | Applications/interview plans |
| `/integrations` Integrations | Admin/ops; connect and monitor ecosystem | Connect, test, rotate, retry, inspect health/logs | Relevant workflow or support |
| `/users` Users & Roles | Admin; manage access and role scope | Invite, deactivate, assign role, review permissions | Any protected workflow with new access |
| `/master-data` Master Data | Admin/ops; govern organization, branches, positions, values | Add/edit/archive with impact preview | Vacancy/request forms |
| `/audit-log` Audit Log | Admin/security; prove who changed what and why | Search, filter, export authorized events | Source object or support case |
| `/design-system` Design System | Product/design/QA only; inspect shared components and states | Validate component states and accessibility | Implementation review, never daily HR navigation |
| `/states-feedback` States Feedback | Product/QA only; verify loading/empty/error/forbidden states | Record defects and acceptance evidence | Relevant page or release gate |

## 5. Page state standard

Each page specification must include these states before implementation approval:

- Loading: skeleton preserves layout and identifies the object being loaded.
- Empty: explains why there is no data and offers one safe next action.
- Validation: inline field-level error plus summary for forms.
- Forbidden: explains missing permission without leaking object data.
- Server error: actionable message, retry, correlation/reference ID where appropriate.
- Pending mutation: disable duplicate submission and show the current operation.
- Success: confirm the resulting state and link to the next handoff.
- Mobile: no clipped controls, no hidden primary action, and drawer/table fallback defined.

## 6. Delivery order

1. E1 shell and role-aware entry points.
2. E2 tokens and shared page primitives.
3. Command Center + My Work.
4. Vacancy request -> approval -> vacancy story.
5. CV intake -> candidate -> application story.
6. Application -> interview -> scorecard story.
7. Offer -> approval -> hiring case -> joining story.
8. Insights, administration, trust, integrations, and commercial readiness.

The next page is not selected by convenience; it is selected by the next handoff in this story.
