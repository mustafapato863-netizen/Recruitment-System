# RecruitFlow V1 — Canonical End-to-End Execution Plan

This is the only active delivery plan for RecruitFlow V1. Older Phase 0–10 and E0–E7 execution lists are retired; their evidence is preserved only in the audit archive and the product/design decision documents.

## Document control

- Version: `V1.1`
- Status: `ACTIVE`
- Product mode: `Light mode only`
- Current delivery position: `P0 complete → P1 complete → P2 reference complete → P2-LIVE-01 done; next ready task is P3.1`
- Product owner approval required for: scope changes, database changes, new dependencies, security claims, pricing claims, AI claims, and new routes.
- Execution instructions: [AI execution playbook](AI_EXECUTION_PLAYBOOK.md)

## V1 boundary

### In scope

- Authentication, organization scope, role-aware access, and the recruiting operations shell.
- My Work, dashboard, notifications, approvals, tasks, and accountable next actions.
- Workforce requests, openings, candidates, applications, CV intake, interviews, offers, hiring cases, joining readiness, reports, administration, audit, and integrations surfaces.
- Responsive light-mode web experience at `375px`, `768px`, `1024px`, and `1440px`.
- Truthful loading, empty, validation, forbidden, server-error, retry, pending, and success states.
- Additive deterministic local fixtures for development and QA.

### Explicitly out of scope for V1

- Dark mode. It is deferred and must not create V1 acceptance work.
- AI screening, AI recommendations, autonomous decisions, or unverified automation claims.
- Production CV binary storage/parsing until a reviewed storage, scanning, retention, and privacy design exists.
- Payroll, full HCM, performance management, and broad ERP replacement.
- Pricing or compliance claims without implementation evidence.
- New visual directions outside the approved RecruitFlow tokens and reference app.

## Live application vs static reference boundary

This boundary is mandatory for every implementation task:

- `apps/web` is the live product. Only real workflow routes, real API contracts, and approved user actions may be shipped there.
- `docs/reference/ui-ux/app` is an offline visual/design reference. It is not a runtime module, route, dependency, fixture source, or production navigation target.
- Design-system laboratories, state galleries, annotated screenshots, and visual experiments belong only under `docs/reference/ui-ux`. Never add them to the live router or sidebar to make review easier.
- A live route must have a named user, job-to-be-done, data contract, permission boundary, next action, and error/empty/loading states. If it does not, keep it as documentation instead of adding a route.
- `/design-system`, `/states-feedback`, and hardcoded demo/maintenance screens are not product routes unless a new product decision explicitly approves them with a real runtime contract.
- Removing a live route does not remove its shared primitives or the static reference; it only removes duplicate product-facing surfaces.

## Mandatory three-page reference gate

These three static pages are the canonical handoff before any frontend page, shared component, role-aware route, approval flow, or visual change is implemented:

| Reference page | Location | What it governs |
|---|---|---|
| **Design System** | [`44_design_system.html`](../reference/ui-ux/app/pages/44_design_system.html) | Visual tokens, layout, component anatomy, states, motion, accessibility, and responsive behavior. |
| **RLS / Security & Access** | [`55_security_access.html`](../reference/ui-ux/app/pages/55_security_access.html) | Role-level security, tenant/object scope, field masking, allowed actions, approval authority, and audit evidence. |
| **Guidelines** | [`56_guidelines.html`](../reference/ui-ux/app/pages/56_guidelines.html) | Story-led operating pipeline for Recruiter, Hiring Manager, HR Manager, approval gates, handoffs, and completion evidence. |

`RLS` in this plan means **role-level and record-scope security**. The reference page defines the authorization contract; it does not claim that PostgreSQL Row-Level Security has already been implemented. Runtime enforcement remains a backend/API responsibility.

### How to use every Design System section

| Design System section | Use it when | Mandatory implementation rule |
|---|---|---|
| Color roles / semantic tokens | Choosing any color | Use semantic tokens (`Canvas`, `Ink`, `Action`, `Success`, `Warning`, `Danger`); do not invent page-specific hex values. |
| Typography & density | Creating headings, metadata, tables, or persona-specific density | Keep the same hierarchy; use comfortable density for managers and compact density for recruiter throughput. |
| Gradient policy | Adding a background, CTA, selected nav item, or focus card | Gradients are reserved for canvas atmosphere, primary actions, selected navigation, and one neon focus card. |
| 12-column grid recipes | Starting any page layout | Declare desktop/tablet/phone columns, gutter, gap, max width, and collapse behavior before coding. |
| Stat cards & neon focus | Showing KPIs or one decision-critical metric | Use one focus card at most; the neon effect must explain priority and never replace readable context. |
| Button matrix | Adding a CTA, secondary action, decision, or loading state | Choose one hierarchy; implement default, hover, focus, pressed, disabled, loading, and accessible labels. |
| Sidebar selection & command search | Adding navigation or global search | Selected nav uses the approved selection treatment; restricted items stay readable and explain the restriction. |
| Data states & feedback | Handling loading, empty, error, success, warning, or permission | Pair icon/color with text, impact, recovery, and the next action; never rely on color alone. |
| Motion & interaction contract | Adding hover, drawer, page entry, shimmer, or attention motion | Use the documented timing/easing and remove transforms, shimmer, and pulse under reduced motion. |
| Page-level handoff checklist | Before a page is accepted | Confirm purpose, grid, hierarchy, states, motion, owner, next action, and handoff. |
| Form fields & validation | Building any input, select, textarea, or switch | Use real controls, associated labels, `aria-invalid`, `aria-describedby`, visible error icons, and recovery text. |
| Status & stage pills | Showing candidate, vacancy, offer, or hiring-case status | Keep meanings stable across the product and pair every color with a text label. |
| Avatar / presence / assignee | Showing ownership or identity | Show initials/name context; presence is supporting status, not the only identity signal. |
| Tables, selection & row actions | Building lists, inboxes, or bulk workflows | Use real table semantics, scoped headers, selection state, labelled row actions, and safe bulk-action rules. |
| Tabs / segmented controls | Switching views or filters | Use `role=tab`/`aria-selected` or `aria-pressed`; selected state must be visible without color alone. |
| Modal / drawer | Confirming, editing, or reviewing evidence in context | Use labelled dialog semantics, focus management, a clear decision hierarchy, and a sticky/available action footer. |
| Timeline / stepper | Showing history or a multi-step workflow | Use ordered-list semantics, actor/time context, active-step semantics, and a mobile variant. |
| Date/time picker & Interview Calendar | Scheduling interviews or date-bound work | Show timezone, selected date/time, availability, conflict recovery, descriptive labels, and mobile-safe internal scrolling. |
| Bulk actions / dropdown | Handling selection actions or overflow actions | Preserve action hierarchy, keyboard behavior, disabled semantics, clear-selection, and confirmation for destructive work. |
| Pipeline board | Showing stage movement and WIP | Show owner/stage/SLA context, five compact cards per desktop row, wrap additional stages, and expose a drop zone. |
| Interview scorecard | Capturing structured evidence | Group competencies, use labelled ratings, require evidence where configured, and expose one overall recommendation. |
| Comments & mentions | Adding accountable discussion | Preserve actor/time, mentions, nested replies, multiline composer semantics, and attachment handling. |
| Security & role stories | Implementing a role-aware page or approval route | Read the RLS page and Guidelines together; define who sees, who acts, what evidence is required, and the next owner. |

### Reference gate procedure

1. Read the three pages and the relevant component row before opening a task.
2. Add the selected reference pages and component sections to the task Definition of Ready.
3. Implement the smallest slice that matches the existing story, grid, tokens, states, and role boundary.
4. Verify desktop and mobile behavior, keyboard/focus behavior, permissions, and handoff evidence.
5. Do not mark the task complete until the implementation can be traced back to the three pages.

## Route visibility contract

- The sidebar contains product destinations only. Every item must map to a route that a normal authenticated user can use.
- Secondary routes may remain deep-linkable only when they represent a real workflow detail, create, approval, or full-list surface. They must not be added to the primary sidebar unless they are a top-level job-to-be-done.
- Hidden UI is not authorization. Route protection and organization/role checks remain backend and router responsibilities.
- Before merging route work, scan for orphan imports, duplicate labs, dead links, and route labels that no longer match the product story.

## Source-of-truth hierarchy

Use documents in this order. If two documents disagree, stop and report the conflict; do not silently choose.

1. `PROJECT_EXECUTION_PLAN.md` — phase order, task status, gates, and V1 scope.
2. `AI_EXECUTION_PLAYBOOK.md` — how a small model or engineer executes one task.
3. `enterprise-saas-product-plan.md` — product positioning, personas, capability boundary, and commercial decisions.
4. `enterprise-page-story.md` — page ownership, user intent, and handoffs.
5. `enterprise-product-direction.md` and `enterprise-visual-identity.md` — visual and interaction rules.
6. `docs/reference/ui-ux/COMPONENT_INTERACTION_REFERENCE.md` and `docs/reference/ui-ux/app/` — static component/page reference.
7. `progress.md` — compact delivery log. `findings.md` — consolidated evidence and risks.

## Status vocabulary

- `DONE`: implementation and gate evidence are complete.
- `REFERENCE DONE`: reference/design artifact is complete; live product work remains.
- `READY`: dependencies and Definition of Ready are satisfied; work may start.
- `IN PROGRESS`: one owner is actively executing the task.
- `BLOCKED`: a named external decision, environment, migration, security, or data issue stops progress.
- `DEFERRED`: intentionally outside V1; do not work on it.
- `REJECTED`: not aligned with V1 or unsupported by evidence.

## Phase map

| Phase | Name | Status | Gate output |
|---|---|---|---|
| P0 | Plan reset, repository baseline, and scope freeze | `DONE` | One canonical plan, no duplicate active roadmap, V1 boundary approved |
| P1 | Product contracts and workflow story | `DONE` | Personas, page story, handoffs, domain rules, and acceptance vocabulary |
| P2 | Light design system, shell, and responsive foundation | `REFERENCE DONE` | Tokens, component contract, light shell, responsive grid, reference evidence |
| P2-LIVE-01 | Live shell foundation and product-surface cleanup | `DONE` | Light tokens, shared shell, product-only navigation, header notification access, and no reference/demo routes |
| P3 | Authentication, organization scope, and access control | `READY` | Login/me/session, route protection, roles, org scope, forbidden states |
| P4 | My Work, Command Center, notifications, and approvals | `READY` | Role-aware queues with next actions, counts, filters, and audit links |
| P5 | Workforce requests and openings | `READY` | Request → approval → opening handoff with ownership and SLA |
| P6 | Candidate identity, CV intake, applications, and talent pools | `READY` | Candidate/application separation, import review, duplicate/consent states |
| P7 | Interviews, scorecards, decisions, and pipeline operations | `READY` | Structured evidence, scheduling, feedback, stage transitions, permissions |
| P8 | Offers, hiring cases, documents, licenses, and joining | `READY` | Offer versions, approval gates, readiness checklist, joining outcome |
| P9 | Insights, administration, integrations, and trust | `READY` | Drill-down reports, configuration, audit, integration health, data controls |
| P10 | Release hardening and commercial readiness | `READY` | Automated tests, accessibility, performance, security, support, demo evidence |

## Phase execution detail

Each numbered item is a micro-task. A small model executes one micro-task per run. Do not combine neighboring items unless the plan explicitly says they are one slice.

### P0 — Plan reset, repository baseline, and scope freeze

Status: `DONE`.

- P0.1 Inventory repository, runtime commands, environments, dirty worktree, and current reference assets.
- P0.2 Freeze V1 to Light mode and record deferred Dark mode.
- P0.3 Retire duplicate phase plans and create the canonical plan/playbook pair.
- P0.4 Record baseline evidence and unresolved risks without claiming release readiness.

Gate: this plan is the only active execution list; historical evidence has a stable archive location.

### P1 — Product contracts and workflow story

Status: `DONE`.

- P1.1 Confirm personas: recruiter, hiring manager, HR leadership, interviewer, administrator, candidate.
- P1.2 Confirm the story: demand → request → approval → opening → intake → application → interview → decision → offer → hiring case → joining → insight/audit.
- P1.3 Confirm entity boundaries: candidate identity, application, opening/vacancy, offer version, hiring case, document/license, task, notification, audit event.
- P1.4 Confirm ownership rules: recruiter, hiring manager, approver, current task owner, and audit actor are distinct.
- P1.5 Confirm every page has purpose, owner, next action, state matrix, and next handoff.

Gate: no page or API task starts without a named contract and handoff.

### P2 — Light design system, shell, and responsive foundation

Status: `REFERENCE DONE`; live product work begins at `P2-LIVE-01`.

- P2.1 Port tokens: color roles, typography, spacing, radii, borders, focus, motion, and light-only theme.
- P2.2 Port shell: workspace identity, top sidebar collapse, role-aware navigation, global search, notifications, support, account context.
- P2.3 Port primitives: buttons, cards, metrics, badges, inputs, selects, tables, alerts, timelines, drawers, dialogs, skeletons, loader, and empty/error states.
- P2.4 Port grid recipes: 12 columns desktop, 8 tablet, 4 phone; dashboard, list, detail, wizard, profile, and kanban layouts.
- P2.5 Validate hover, focus-visible, pressed, disabled, loading, reduced-motion, keyboard order, and `44px` mobile hit areas.
- P2.6 Create one representative live page using the reference before copying patterns elsewhere.
- P2.7 Treat Design System, RLS / Security & Access, and Guidelines as the mandatory three-page reference gate for all future UI, role, and approval work.

Gate: shell and component review passes at 375/768/1024/1440; no Dark mode work is added.

### P2-LIVE-01 - Live shell foundation and product-surface cleanup

Status: `DONE`.

This slice turns the accepted light reference into a clean product shell without importing the static laboratory into the live app.

- P2-LIVE-01.1 Audit every authenticated route, sidebar item, breadcrumb label, lazy import, and page stylesheet. Classify each as product, detail/create/approval support, reference-only, demo-only, or orphaned.
- P2-LIVE-01.2 Remove reference-only and hardcoded demo routes from the live router and navigation. Delete only files proven to have no remaining imports or runtime ownership.
- P2-LIVE-01.3 Keep the real `/notifications` list as a secondary full view, remove it from the sidebar, and expose recent notifications from the authenticated header bell.
- P2-LIVE-01.4 Implement the notification popover with the existing typed API: unread count, recent records, loading, empty, error/retry, mark-read, outside-click, Escape, focus-visible, and mobile-width behavior.
- P2-LIVE-01.5 Update route scans, source-of-truth documentation, and the small-model playbook so future work cannot reintroduce duplicate labs or orphan pages.

Gate: live build passes; the sidebar contains product destinations only; the header bell opens recent notifications without navigation; full notifications remain reachable through `View all`; no removed page/import/reference stylesheet remains in `apps/web`; static reference validation remains unchanged.

### P3 — Authentication, organization scope, and access control

- P3.1 API auth contract: login, me, logout/session behavior, validation, error codes, rate/lockout decision.
- P3.2 Frontend auth boundary: login form, password visibility, pending/error/success states, redirect, session expiry.
- P3.3 Organization context: workspace selection/read-only context, organization-scoped queries, no cross-tenant leakage.
- P3.4 Role matrix: recruiter, hiring manager, approver, HR admin, interviewer, administrator; map route and action permissions.
- P3.5 Forbidden/not-found behavior: distinguish missing record from insufficient access without leaking sensitive data.
- P3.6 Auth browser tests and API tests with dedicated local users.

Gate: unauthenticated, authenticated, expired, forbidden, wrong-org, and validation scenarios pass.

### P4 — My Work, Command Center, notifications, and approvals

- P4.1 Define task/notification contracts, unread counts, priority, due date, owner, SLA, related record, and completion action.
- P4.2 Build Command Center metrics with drill-down links; every metric must identify time range and source.
- P4.3 Build My Tasks queue with filters, saved-view decision, bulk action guardrails, and overdue state.
- P4.4 Build the header notification popover with unread count, recent records, direct mark-read action, loading/empty/error/retry states, keyboard dismissal, and mobile-safe width; keep the full Notification Center as the secondary list view.
- P4.5 Build approval inbox pattern with evidence drawer, decision comment, request changes, approve/reject, and audit event.
- P4.6 Test recruiter and manager journeys from alert → record → action → confirmation.

Gate: no dead-end notification, approval action, or metric card.

### P5 — Workforce requests and openings

- P5.1 Request create/edit contract: organization, branch, department, position, reason, headcount, budget, criticality, target date.
- P5.2 Multi-step request form: client validation, draft, readiness checklist, submit, and server errors.
- P5.3 Approval rules: sequential/conditional approvers, comments, request changes, audit history, and ownership.
- P5.4 Opening creation handoff: approved request creates/links opening without duplicating position or candidate entities.
- P5.5 Openings list/detail: owner, SLA/aging, status, headcount, pipeline summary, and next action.
- P5.6 Test request → approval → opening with budgeted, unbudgeted, replacement, rejected, and changes-requested data.

Gate: every approved request has one traceable opening and every opening links back to its request.

### P6 — Candidate identity, CV intake, applications, and talent pools

- P6.1 Candidate identity contract: unique person profile, contact fields, consent, source, duplicate keys, visibility.
- P6.2 Intake contract: CSV/template preview, row validation, batch status, duplicate decisions, and safe retry.
- P6.3 Candidate profile: reusable identity data separated from application-specific stage, score, source, owner, and status.
- P6.4 Application lifecycle: link candidate to opening, stage transitions, withdraw/reject/close, owner, next action.
- P6.5 Talent pool/consent: membership, source, retention/consent state, and communication eligibility.
- P6.6 Test valid, malformed, duplicate, withdrawn, rejected, consent-expired, and forbidden candidate flows.

Gate: no application data is stored on the candidate identity when it belongs to the opening/application.

### P7 — Interviews, scorecards, decisions, and pipeline operations

- P7.1 Pipeline contract: configured stages, allowed transitions, stage owner, SLA, reason, and audit event.
- P7.2 Interview scheduling: round, participants, timezone, meeting, reschedule/cancel, candidate communication state.
- P7.3 Structured scorecard: competencies, rating scale, evidence comment, required fields, draft, submitted, locked state.
- P7.4 Feedback queue: missing/overdue scorecards, reminders, permissions, and escalation.
- P7.5 Hiring decision: evidence summary, approve/reject/hold, reason, next task, and audit.
- P7.6 Test stage transition permissions, incomplete scorecards, reschedule, timezone, rejection, and decision reversal policy.

Gate: a hiring decision cannot complete without required evidence and a recorded actor/reason.

### P8 — Offers, hiring cases, documents, licenses, and joining

- P8.1 Offer contract: immutable versions, compensation components, expiry, response, owner, and approval status.
- P8.2 Offer approval: conditional approvers, version comparison, comments, request changes, approval audit.
- P8.3 Hiring case: readiness checklist, ownership, offer/documents/license/joining links, and final approval.
- P8.4 Documents: metadata, review status, expiry, permission, secure-file placeholder boundary, and audit event.
- P8.5 Licenses/compliance: requirement, verification status, expiry, missing/blocked state, and responsible owner.
- P8.6 Joining: confirmed date, attendance/readiness state, joined/not-joined outcome, and handoff notification.

Gate: final approval is blocked by explicit missing evidence; joining requires an actual joining date/outcome.

### P9 — Insights, administration, integrations, and trust

- P9.1 Reports: funnel, aging, time-to-stage, source, workload, approvals, and drill-down source links.
- P9.2 Admin: users/roles, master data, workflow settings, feature/configuration boundaries.
- P9.3 Integrations: provider, connection state, last sync, failure reason, retry, and secret boundary.
- P9.4 Audit: actor, organization, action, entity, before/after summary, timestamp, correlation id, export permission.
- P9.5 Data trust: retention/consent display, sensitive-field visibility, access review, and no unsupported compliance badge.
- P9.6 Test admin permissions, stale integration, failed sync, audit filtering, export controls, and report drill-down.

Gate: executive metrics trace to records; trust claims have evidence; sensitive data is scoped server-side.

### P10 — Release hardening and commercial readiness

- P10.1 Automated unit/integration/E2E coverage for critical journeys.
- P10.2 Accessibility: keyboard, focus, labels, contrast, reduced motion, responsive states, and semantic tables/forms.
- P10.3 Reliability: health checks, structured errors, logs, retry policy, background job visibility, and backup/restore decision.
- P10.4 Security: auth/session, authorization/IDOR, tenant isolation, secret scanning, file boundary, headers/CORS, and dependency review.
- P10.5 Performance: bundle, route loading, query/index review, pagination, empty states, and no blocking waterfalls.
- P10.6 Demo/UAT: demo tenant, deterministic fixtures, support runbook, release notes, known limitations, and rollback plan.
- P10.7 Commercial review: only demonstrate implemented capabilities; mark deferred Dark mode, AI, storage, and other roadmap items explicitly.

Gate: release checklist is evidence-backed, not a declaration based on visual completeness.

## Cross-phase dependency rules

1. Product contract before schema/API/UI changes.
2. Schema/migration review before service/controller/UI changes that depend on new data.
3. API contract before frontend integration; use typed contracts and truthful error shapes.
4. Shared component review before copying a new visual pattern to multiple pages.
5. Browser test before phase gate; do not accept screenshots alone.
6. Security/tenant scope is a hard gate and cannot be deferred as polish.
7. Dark mode remains deferred; do not add a theme toggle, dark tokens, or dark acceptance scenario in V1.
8. Never import, route, link, or bundle `docs/reference/ui-ux/app` into `apps/web`; references are handoff evidence only.
9. Every navigation item must map to a real product destination. Reference galleries, state labs, fake maintenance screens, and debug pages are not user-facing routes.
10. Cleanup requires an exact-target audit: search imports, route declarations, links, tests, and documentation before deletion; preserve shared primitives and operational detail routes.
11. Notifications are a cross-route shell concern: the header bell opens the popover, the popover uses typed API data, and the full list is a secondary destination.
12. Every role-aware UI or approval task must cite the three reference pages and must not treat UI hiding as the RLS/security decision.

## Phase handoff record

Every completed phase must add one compact record to `progress.md` containing: phase/task IDs, changed files, commands/checks run, evidence paths, remaining risks, and the next ready task. Detailed discoveries belong in `findings.md`, not duplicated in the plan.
