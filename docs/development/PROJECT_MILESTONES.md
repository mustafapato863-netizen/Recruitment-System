# RecruitFlow V1 — Milestone and Sub-milestone Schedule

This is the execution schedule for RecruitFlow V1. It expands the canonical phase plan into trackable milestones for a developer or an AI coding assistant using Claude, Codex, or an equivalent tool.

The phase order remains governed by [`PROJECT_EXECUTION_PLAN.md`](PROJECT_EXECUTION_PLAN.md). This document adds delivery sizing, dependencies, ownership boundaries, and evidence requirements. It does not create a second product roadmap.

## 1. Estimation model

- **1 AI workday** means up to six focused hours of implementation, verification, and handoff work.
- Estimates include normal coding, targeted tests, documentation updates, and one correction pass.
- Estimates exclude waiting for credentials, unresolved product decisions, external vendors, production deployment approval, and unexpected data recovery.
- A sub-milestone should normally be completed by one AI session or one focused developer task. If it grows beyond three AI workdays, split it before implementation.
- Phase totals include an explicit review and gate check. Completed phases are historical effort, not remaining work.
- These are planning estimates, not delivery promises. The reviewer may stop a task and split it when the Definition of Ready is incomplete.

## 2. Status and ownership rules

| Status | Meaning |
|---|---|
| `DONE` | Implementation, verification, and phase evidence are complete. |
| `REFERENCE DONE` | The design or contract is complete; live implementation may remain. |
| `READY` | Dependencies and Definition of Ready are satisfied. |
| `IN PROGRESS` | One owner is actively executing the sub-milestone. |
| `BLOCKED` | A named decision, environment, migration, security, or data issue prevents safe progress. |
| `DEFERRED` | Explicitly outside V1; do not schedule implementation work. |

Every sub-milestone has one owner, one reviewer, one user outcome, one acceptance gate, and one next handoff. The owner may be a human or an AI assistant; the reviewer must verify the evidence.

## 3. Executive schedule

The estimates below represent sequential AI effort. After P3 contracts are stable, selected backend and frontend work may run in parallel, but the phase gates remain sequential.

| Phase | Name | Current status | Build effort | Gate/review | Total effort | Dependency |
|---|---|---:|---:|---:|---:|---|
| P0 | Plan reset, repository baseline, and scope freeze | `DONE` | 2.0d | 1.0d | 3.0d | None |
| P1 | Product contracts and workflow story | `DONE` | 4.5d | 1.0d | 5.5d | P0 |
| P2 | Light design system, shell, and responsive foundation | `REFERENCE DONE` | 10.5d | 1.0d | 11.5d | P1 |
| P2-LIVE-01 | Live shell foundation and product cleanup | `DONE` | 0.0d remaining | 0.5d | 0.5d | P2 |
| P3 | Authentication, organization scope, and access control | `IN PROGRESS` | 1.0d remaining | 0.5d | 1.5d | P1, P2-LIVE-01 |
| P4 | My Work, Command Center, notifications, and approvals | `IN PROGRESS` | 1.5d remaining | 0.5d | 2.0d | P3 contracts |
| P5 | Workforce requests and openings | `IN PROGRESS` | 2.0d remaining | 0.5d | 2.5d | P3, P4 |
| P6 | Candidate identity, CV intake, applications, and talent pools | `IN PROGRESS` | 2.0d remaining | 0.5d | 2.5d | P5 opening contract |
| P7 | Interviews, scorecards, decisions, and pipeline operations | `IN PROGRESS` | 2.5d remaining | 0.5d | 3.0d | P6 application contract |
| P8 | Offers, hiring cases, documents, licenses, and joining | `IN PROGRESS` | 2.0d remaining | 0.5d | 2.5d | P7 decision contract |
| P9 | Insights, administration, integrations, and trust | `IN PROGRESS` | 4.0d remaining | 0.5d | 4.5d | P3, P8 data/audit contracts |
| P10 | Release hardening and commercial readiness | `IN PROGRESS` | 6.0d remaining | 1.0d | 7.0d | P3–P9 |
| **Current tracked work** |  |  | **21.0d** | **5.0d** | **26.0 AI workdays** |  |

The original `143.0 AI workdays` estimate is historical planning context. The table above tracks only the currently verified remaining work; the separate UI/UX migration stream is estimated at 10 AI workdays and is released only after the quality gates are clear.

With two independent AI workstreams and one human reviewer, the remaining work is expected to require approximately **75–95 calendar workdays**, depending on environment, migration, and security decisions. Do not use the parallel estimate unless the API/component contract is already written and no two workers edit the same file set.

## 4. Detailed milestone schedule

### P0 — Plan reset, repository baseline, and scope freeze

**Phase outcome:** one authoritative plan, a known repository baseline, and a frozen V1 boundary.

| Milestone | Sub-milestone | AI days | Deliverable and evidence |
|---|---|---:|---|
| M0.1 Baseline | P0.1 Repository inventory | 0.5d | Runtime commands, packages, environments, dirty-worktree note, and reference asset inventory. |
| M0.1 Baseline | P0.2 V1 scope freeze | 0.5d | Light-only V1 decision; Dark mode, AI claims, and unsupported storage/compliance claims marked deferred. |
| M0.2 Governance | P0.3 Plan consolidation | 0.5d | Duplicate active roadmaps retired; one canonical plan and one AI playbook linked. |
| M0.2 Governance | P0.4 Baseline risks | 0.5d | Evidence-backed risks and limitations recorded without claiming release readiness. |

**Gate:** the canonical plan is the only active execution source.

### P1 — Product contracts and workflow story

**Phase outcome:** every product surface has a user, purpose, owner, permission boundary, next action, and handoff.

| Milestone | Sub-milestone | AI days | Deliverable and evidence |
|---|---|---:|---|
| M1.1 Personas and story | P1.1 Persona contract | 1.0d | Recruiter, Hiring Manager, HR leadership, Interviewer, Administrator, and Candidate responsibilities. |
| M1.1 Personas and story | P1.2 End-to-end workflow | 1.0d | Demand → request → approval → opening → intake → application → interview → decision → offer → joining → insight/audit. |
| M1.2 Domain contract | P1.3 Entity boundaries | 1.0d | Candidate, Application, Opening, Offer, Hiring Case, Document, License, Task, Notification, and Audit Event ownership. |
| M1.2 Domain contract | P1.4 Ownership rules | 0.5d | Recruiter, Hiring Manager, Approver, Current Task Owner, and Audit Actor remain distinct. |
| M1.3 Page contract | P1.5 Page handoffs | 1.0d | Page purpose, data, states, permission, next action, and next owner documented. |

**Gate:** no new page, API, model, or role-aware change starts without a named contract.

### P2 — Light design system, shell, and responsive foundation

**Phase outcome:** the three reference pages define one light visual, interaction, accessibility, and security handoff contract.

| Milestone | Sub-milestone | AI days | Deliverable and evidence |
|---|---|---:|---|
| M2.1 Visual foundation | P2.1 Tokens and theme | 1.5d | Semantic colors, typography, spacing, radii, borders, focus rings, motion, and Light-only rules. |
| M2.1 Visual foundation | P2.2 Shell reference | 1.5d | Workspace identity, top sidebar collapse, navigation, command search, header notifications, support, and account context. |
| M2.2 Component contract | P2.3 Shared recipes | 2.5d | Buttons, cards, metrics, badges, forms, tables, alerts, timelines, drawers, dialogs, skeletons, loaders, and page states. |
| M2.2 Component contract | P2.5 Interaction/accessibility states | 2.0d | Hover, focus-visible, pressed, disabled, loading, reduced motion, keyboard order, and mobile hit areas. |
| M2.3 Responsive handoff | P2.4 Grid recipes | 1.5d | 12-column desktop, 8-column tablet, 4-column phone layouts for dashboard, list, detail, wizard, profile, and pipeline. |
| M2.3 Responsive handoff | P2.6 Representative page | 1.0d | One reference-backed live-page prototype proving the system before broad reuse. |
| M2.3 Responsive handoff | P2.7 Three-page reference gate | 0.5d | Design System, Security & Access/RLS, and Guidelines pages linked as mandatory preflight references. |

**Gate:** reference validation passes at `375`, `768`, `1024`, and `1440` without Dark mode work.

### P2-LIVE-01 — Live shell foundation and product cleanup

**Phase outcome:** the live application contains product routes only and uses the approved shell behavior.

| Milestone | Sub-milestone | AI days | Deliverable and evidence |
|---|---|---:|---|
| M2L.1 Route audit | P2-LIVE-01.1 Route and import classification | 1.5d | Active product, detail/create/approval, reference, demo, and orphan files classified. |
| M2L.2 Product cleanup | P2-LIVE-01.2 Remove confirmed reference/demo routes | 1.5d | Confirmed orphan/demo routes removed with zero-import and dead-link evidence. |
| M2L.3 Notification shell | P2-LIVE-01.3 Header notification entry | 1.5d | Sidebar notification item removed; header bell opens a recent-notification popover; full list remains secondary. |
| M2L.3 Notification shell | P2-LIVE-01.4 Notification states | 2.0d | Typed API data, unread count, loading, empty, error/retry, mark-read, Escape, outside-click, focus, and mobile behavior. |
| M2L.4 Guardrails | P2-LIVE-01.5 Documentation and route scans | 1.0d | Plan/playbook updated; reference tree is not imported, routed, or bundled by the live app. |

**Gate:** live build, route scan, notification browser flow, and reference validation all pass.

### P3 — Authentication, organization scope, and access control

**Phase outcome:** every authenticated request is tied to a valid session, organization, role, and permitted record scope.

| Milestone | Sub-milestone | AI days | Deliverable and evidence |
|---|---|---:|---|
| M3.1 Auth contract | P3.1 API authentication contract | 2.0d | Login, me, logout/session behavior, validation, error codes, and rate/lockout decision. |
| M3.2 Session UX | P3.2 Frontend auth boundary | 2.0d | Login, password visibility, pending/error/success states, redirect, and session expiry handling. |
| M3.3 Organization scope | P3.3 Organization context | 2.0d | Workspace context, organization-scoped queries, and cross-tenant leakage protection. |
| M3.4 Role access | P3.4 Role matrix | 2.0d | Recruiter, Hiring Manager, Approver, HR Admin, Interviewer, and Administrator route/action matrix. |
| M3.5 Safe disclosure | P3.5 Forbidden/not-found behavior | 1.5d | Missing records and insufficient access are distinguished without sensitive data leakage. |
| M3.6 Verification | P3.6 Auth tests | 2.0d | API and browser tests for unauthenticated, authenticated, expired, forbidden, wrong-org, and invalid input flows. |

**Gate:** all session, organization, role, and forbidden scenarios pass.

### P4 — My Work, Command Center, notifications, and approvals

**Phase outcome:** every user has a role-aware queue of accountable work and can complete approval actions with evidence.

| Milestone | Sub-milestone | AI days | Deliverable and evidence |
|---|---|---:|---|
| M4.1 Work contracts | P4.1 Task and notification contract | 1.5d | Owner, priority, due date, SLA, related record, unread state, and completion action. |
| M4.2 Command Center | P4.2 Metrics and drill-down | 2.0d | Metrics include time range, source record, ownership, and a working drill-down route. |
| M4.3 My Tasks | P4.3 Task queue | 2.0d | Filters, overdue states, saved-view decision, pagination, and safe bulk actions. |
| M4.4 Notifications | P4.4 Notification center behavior | 2.0d | Header popover and full list share typed data, read state, retry, keyboard, and mobile behavior. |
| M4.5 Approvals | P4.5 Approval inbox | 3.0d | Evidence drawer, comments, request changes, approve/reject, permission checks, and audit event. |
| M4.6 Journey proof | P4.6 Role journeys | 2.0d | Recruiter and manager flows: alert → record → action → confirmation → next owner. |

**Gate:** no notification, metric, or approval action ends in a dead end.

### P5 — Workforce requests and openings

**Phase outcome:** an approved workforce request produces one traceable opening with ownership and SLA context.

| Milestone | Sub-milestone | AI days | Deliverable and evidence |
|---|---|---:|---|
| M5.1 Request contract | P5.1 Request create/edit | 2.0d | Organization, branch, department, position, reason, headcount, budget, criticality, and target date. |
| M5.2 Request workflow | P5.2 Multi-step form | 2.0d | Client validation, draft, readiness checklist, submit, server errors, and recovery. |
| M5.3 Approval rules | P5.3 Request approvals | 2.5d | Sequential/conditional approvers, comments, request changes, audit history, and ownership. |
| M5.4 Opening handoff | P5.4 Approved request to opening | 2.0d | One opening is created or linked without duplicating position or candidate entities. |
| M5.5 Opening operations | P5.5 Opening list/detail | 2.0d | Owner, aging/SLA, status, headcount, pipeline summary, and next action. |
| M5.6 Workflow proof | P5.6 Request-to-opening tests | 2.0d | Budgeted, unbudgeted, replacement, rejected, and changes-requested scenarios. |

**Gate:** every approved request links to exactly one traceable opening.

### P6 — Candidate identity, CV intake, applications, and talent pools

**Phase outcome:** candidate identity is reusable and privacy-aware while each application remains specific to an opening.

| Milestone | Sub-milestone | AI days | Deliverable and evidence |
|---|---|---:|---|
| M6.1 Candidate contract | P6.1 Candidate identity | 2.0d | Unique person profile, contact fields, consent, source, duplicate keys, and visibility. |
| M6.2 Intake workflow | P6.2 CV/CSV intake | 2.5d | Template preview, row validation, batch status, duplicate decisions, and safe retry. |
| M6.3 Candidate surface | P6.3 Candidate profile | 2.5d | Identity data separated from application stage, score, source, owner, and status. |
| M6.4 Application lifecycle | P6.4 Application operations | 2.5d | Link to opening, stage transitions, withdraw/reject/close, owner, and next action. |
| M6.5 Talent pools | P6.5 Pool and consent | 2.0d | Membership, source, retention/consent state, and communication eligibility. |
| M6.6 Workflow proof | P6.6 Candidate tests | 3.0d | Valid, malformed, duplicate, withdrawn, rejected, consent-expired, and forbidden flows. |

**Gate:** application data never overwrites reusable candidate identity data.

### P7 — Interviews, scorecards, decisions, and pipeline operations

**Phase outcome:** the team can move candidates through evidence-based stages and make auditable hiring decisions.

| Milestone | Sub-milestone | AI days | Deliverable and evidence |
|---|---|---:|---|
| M7.1 Pipeline contract | P7.1 Pipeline stages | 2.0d | Configured stages, allowed transitions, stage owner, SLA, reason, and audit event. |
| M7.2 Scheduling | P7.2 Interview scheduling | 2.5d | Round, participants, timezone, meeting, reschedule/cancel, and candidate communication state. |
| M7.3 Scorecard | P7.3 Structured scorecard | 3.0d | Competencies, ratings, evidence comments, required fields, draft, submitted, and locked states. |
| M7.4 Feedback operations | P7.4 Feedback queue | 2.0d | Missing/overdue scorecards, reminders, permissions, and escalation. |
| M7.5 Decision | P7.5 Hiring decision | 2.5d | Evidence summary, approve/reject/hold, reason, next task, and audit. |
| M7.6 Workflow proof | P7.6 Pipeline and decision tests | 2.5d | Transition permissions, incomplete scorecards, timezone, reschedule, rejection, and reversal policy. |

**Gate:** no hiring decision completes without required evidence and a recorded actor/reason.

### P8 — Offers, hiring cases, documents, licenses, and joining

**Phase outcome:** approved candidates move through controlled offer, readiness, and joining workflows.

| Milestone | Sub-milestone | AI days | Deliverable and evidence |
|---|---|---:|---|
| M8.1 Offer contract | P8.1 Offer versions | 2.0d | Immutable versions, compensation components, expiry, response, owner, and approval status. |
| M8.2 Offer approval | P8.2 Approval workflow | 2.5d | Conditional approvers, version comparison, comments, changes, and approval audit. |
| M8.3 Hiring case | P8.3 Readiness case | 2.5d | Checklist, ownership, offer/documents/licenses/joining links, and final approval. |
| M8.4 Documents | P8.4 Document controls | 2.0d | Metadata, review status, expiry, permission, secure-file boundary, and audit event. |
| M8.5 Licenses | P8.5 License controls | 2.0d | Requirement, verification, expiry, missing/blocked state, and responsible owner. |
| M8.6 Joining | P8.6 Joining outcome | 2.0d | Confirmed date, readiness state, joined/not-joined outcome, and handoff notification. |

**Gate:** missing evidence blocks final approval and joining requires a recorded date/outcome.

### P9 — Insights, administration, integrations, and trust

**Phase outcome:** leadership can inspect trustworthy metrics and administrators can manage configuration and data access safely.

| Milestone | Sub-milestone | AI days | Deliverable and evidence |
|---|---|---:|---|
| M9.1 Insights | P9.1 Reports | 2.5d | Funnel, aging, time-to-stage, source, workload, approvals, and drill-down links. |
| M9.1 Insights | P9.2 Administration | 2.0d | Users/roles, master data, workflow settings, and configuration boundaries. |
| M9.2 Integrations | P9.3 Integration health | 2.0d | Provider, connection state, last sync, failure reason, retry, and secret boundary. |
| M9.3 Trust evidence | P9.4 Audit log | 2.0d | Actor, organization, action, entity, before/after summary, timestamp, correlation ID, and export permission. |
| M9.3 Trust evidence | P9.5 Data trust | 2.0d | Retention/consent display, sensitive-field visibility, access review, and evidence-backed claims only. |
| M9.4 Verification | P9.6 Administration and trust tests | 2.0d | Permissions, stale integration, failed sync, audit filters, exports, and report drill-down. |

**Gate:** metrics trace to records, trust claims have evidence, and sensitive data is server-scoped.

### P10 — Release hardening and commercial readiness

**Phase outcome:** the product is testable, supportable, secure enough for its declared V1 boundary, and honest in demos and sales materials.

| Milestone | Sub-milestone | AI days | Deliverable and evidence |
|---|---|---:|---|
| M10.1 Test gate | P10.1 Automated coverage | 3.0d | Unit, integration, API, and browser coverage for critical journeys. |
| M10.2 Accessibility | P10.2 Accessibility verification | 2.0d | Keyboard, focus, labels, contrast, reduced motion, responsive states, and semantic tables/forms. |
| M10.3 Reliability | P10.3 Operational reliability | 2.0d | Health checks, structured errors, logs, retries, background-job visibility, and backup/restore decision. |
| M10.4 Security | P10.4 Security review | 2.0d | Auth/session, authorization/IDOR, tenant isolation, secret scanning, file boundary, headers/CORS, dependencies. |
| M10.5 Performance | P10.5 Performance review | 2.0d | Bundle, route loading, queries/indexes, pagination, empty states, and waterfall review. |
| M10.6 UAT | P10.6 Demo and UAT | 3.0d | Demo tenant, deterministic fixtures, support runbook, release notes, limitations, and rollback plan. |
| M10.7 Commercial truth | P10.7 Commercial review | 1.5d | Only implemented capabilities are presented; Dark mode, AI, storage, and other deferred items are clearly marked. |

**Gate:** release evidence is complete; visual polish alone is not a release declaration.

## 4.1 Controlled live UI/UX migration stream

This stream is tracked separately from the domain phase totals. Each task is one route group, must preserve the existing API and permission contracts, and must use the shared Light-mode component system.

| UI task | Route group | Status | AI days | Acceptance evidence | Next task |
|---|---|---|---:|---|---|
| `P6-STATE-01` | Candidates, applications, documents, talent pools | `DONE` | 1.0d | Recoverable related-data states and truthful metrics | `P7-INTERVIEW-01` |
| `P7-INTERVIEW-01` | Interviews and Interview Calendar | `DONE` | 1.0d | Live calendar, truthful metrics, mobile internal scroll | `P7-SCORECARD-01` |
| `P7-SCORECARD-01` | Schedule modal and scorecard detail | `DONE` | 0.5d | Browser control and handoff evidence | `P7-PIPELINE-01` |
| `P7-PIPELINE-01` | Applications pipeline board | `DONE` | 1.0d | Shared board, owner/source context, honest SLA state | `P8-UI-01` |
| `P8-UI-01` | Offers, hiring cases, licenses, joining | `DONE` | 1.0d | Build passed; browser critical journeys 11/11; joining suite 57/57 | `P9-UI-01` |
| `P9-UI-01` | Reports, users/roles, master data, integrations, audit | `DONE` | 1.5d | API/build gates passed; P9 browser critical journeys 12/12; export limitations disclosed | `P10-RELEASE-01` |
| `P10-RELEASE-01` | Cross-route accessibility, responsive, security, performance, UAT | `PARTIAL` | 5.0d | Baseline build/API/route/browser evidence recorded; mutation and final release gates remain | `P10-RELEASE-02` |

## 5. AI execution protocol

Use this protocol for every sub-milestone:

1. Read `PROJECT_EXECUTION_PLAN.md`, `PROJECT_MILESTONES.md`, `AI_EXECUTION_PLAYBOOK.md`, and the three reference pages when the task affects UI, roles, or approvals.
2. Start from one sub-milestone ID. Do not ask the model to implement an entire phase.
3. Write the user outcome, exact files/routes/models, out-of-scope items, permission boundary, states, and acceptance checks before coding.
4. Inspect existing contracts and search for reusable components before creating anything.
5. Implement one smallest vertical slice. A database change, API change, and UI change may be separate tasks unless the contract is already stable and the integration is necessary to prove the outcome.
6. Run targeted checks immediately: type/build, API or migration checks, browser checks, and `git diff --check` as applicable.
7. Update `progress.md` with the sub-milestone ID, files, checks, evidence, risks, and exactly one next task.
8. Stop at the task boundary. The next AI session starts from the written handoff.

### Human approval is mandatory before

- Database schema or migration changes.
- Authentication, authorization, tenant isolation, or sensitive-data behavior.
- New dependencies or external providers.
- New routes, scope changes, compliance claims, pricing claims, or AI claims.
- Deleting files whose ownership is not proven by an import/link/reference scan.

### Parallel execution rule

Parallel work is allowed only when:

- the product/API/component contract is frozen;
- each worker owns a separate file set;
- one reviewer owns the integration gate;
- no worker changes shared schema, auth, tokens, or routing without coordination.

## 6. Standard task card for Claude or Codex

```text
Repository: RecruitFlow
Authoritative plan: docs/development/PROJECT_EXECUTION_PLAN.md
Milestone schedule: docs/development/PROJECT_MILESTONES.md
Execution rules: docs/development/AI_EXECUTION_PLAYBOOK.md

Task ID: <P?.?-??>
Milestone: <milestone name>
Estimate: <number of AI workdays>
User outcome: <one sentence>
In scope: <exact files, routes, endpoints, models, or reference pages>
Out of scope: <explicit exclusions>
Dependencies: <completed task IDs or contracts>
Permissions/scope: <who can see, act, and approve>
Required states: loading, empty, validation, forbidden, server-error, retry, pending, success
Acceptance checks: <testable statements>

Rules:
- Do not redefine the product or start another sub-milestone.
- Do not invent fields, endpoints, statuses, permissions, or security claims.
- Keep Light mode only for V1.
- Keep docs/reference/ui-ux out of the live application runtime.
- Preserve unrelated worktree changes.
- Use existing components, tokens, contracts, and test patterns.
- Stop and report BLOCKED if a required decision is missing.

Return:
DONE / PARTIAL / BLOCKED
Task:
Outcome:
Changed:
Contracts:
States covered:
Checks run:
Evidence:
Known risks:
Next task: <one task ID>
```

## 7. Recommended tracking columns

Use these columns in the project-management tool:

`Phase | Milestone | Sub-milestone | Owner | Reviewer | Status | Estimate (AI days) | Dependency | Acceptance gate | Evidence link | Risk | Next task`

Do not track only percentages. A sub-milestone is complete only when its acceptance evidence exists and the next handoff is explicit.
