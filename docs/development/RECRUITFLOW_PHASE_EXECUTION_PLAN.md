# RecruitFlow Production Phase Execution Plan

**Product:** RecruitFlow — Recruitment Operations / ATS
**Repository:** `D:\Projects\Recruitment Workflow System`
**Plan date:** 2026-08-30
**Execution order:** M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9 → M10
**Status:** Execution plan for delegated implementation and independent review

## 1. Purpose

This document converts the RecruitFlow production master plan into controlled,
delegatable phases. Each phase has a bounded scope, implementation goals,
acceptance criteria, evidence requirements, and a separate verification prompt.

Gemini is the implementation agent. The reviewer must independently inspect the
changed source, run relevant validation, verify browser journeys, and approve a
phase before the next phase begins.

The plan is based on the current source review and the operating simplicity of
Odoo Recruitment. Odoo's useful workflow patterns include job position →
applicant pipeline, quick applicant creation, configurable stages, refusal
reasons, interview scheduling, offer handling, source analysis, velocity
analysis, and team-performance views. RecruitFlow may adopt these workflow
principles, but must preserve its own approval, consent, audit, tenant, and
healthcare-governance requirements and must not copy Odoo code.

Official comparison references:

- [Odoo Recruitment](https://www.odoo.com/documentation/19.0/applications/hr/recruitment.html)
- [Odoo Job Positions](https://www.odoo.com/documentation/19.0/applications/hr/recruitment/new_job.html)
- [Odoo Add Applicants](https://www.odoo.com/documentation/19.0/applications/hr/recruitment/add_applicants.html)
- [Odoo Schedule Interviews](https://www.odoo.com/documentation/19.0/applications/hr/recruitment/schedule_interviews.html)
- [Odoo Offer Job Positions](https://www.odoo.com/documentation/19.0/applications/hr/recruitment/offer_job_positions.html)
- [Odoo Refuse Applicants](https://www.odoo.com/documentation/19.0/applications/hr/recruitment/refuse_applicant.html)
- [Odoo Application Analysis](https://www.odoo.com/documentation/19.0/applications/hr/recruitment/application_analysis.html)
- [Odoo Source Analysis](https://www.odoo.com/documentation/19.0/applications/hr/recruitment/source_analysis.html)
- [Odoo Velocity Analysis](https://www.odoo.com/documentation/19.0/applications/hr/recruitment/velocity_analysis.html)
- [Odoo Team Performance](https://www.odoo.com/documentation/19.0/applications/hr/recruitment/team_performance.html)

## 2. Non-negotiable rules for every phase

1. Work directly in the existing repository. Do not create a demo, mockup,
   replacement application, ZIP, or screenshot-only implementation.
2. Read `AGENTS.md`, the production master plan, `task_plan.md`,
   `findings.md`, `progress.md`, and all relevant source before editing.
3. Preserve user-owned and uncommitted work. Never use `git reset`,
   `git checkout`, `git clean`, force-push, or destructive deletion.
4. Do not weaken authentication, authorization, tenant isolation, validation,
   consent, document security, or audit logging to make tests pass.
5. Preserve existing routes, deep links, query parameters, API contracts,
   permissions, and workflow rules unless the phase explicitly authorizes a
   reviewed contract change.
6. Use existing dependencies, Lucide icons, semantic design tokens, shared
   components, and the existing package-manager commands.
7. Never expose development passwords, tokens, credentials, stack traces, or
   internal database details in production responses or UI.
8. AI recommendations must be explainable, auditable, and human-controlled.
   AI must not automatically reject, advance, contact, shortlist, or create an
   application for a candidate.
9. Use isolated local, test, staging, or UAT data. Never run destructive tests
   against production.
10. Do not mark a phase complete based only on visual inspection, screenshots,
    a route smoke test, or a green frontend-only test.
11. If a command fails, investigate the real cause, fix failures introduced by
    the phase, and distinguish pre-existing failures from new failures.
12. Update `task_plan.md`, `findings.md`, and `progress.md` with exact scope,
    commands, evidence, failures, resolution, and remaining risks.

## 3. Standard phase handoff

Every implementation handoff must include:

- Phase status: complete, incomplete, or blocked
- Goals completed and goals not completed
- Exact files changed
- Shared components created or changed
- Database/schema/migration changes
- API and contract changes
- Authentication, permission, tenant, and row-scope changes
- Light-mode result
- Dark-mode result
- Responsive result at 1440, 1280, 1024, 768, 430, and 375px where relevant
- Accessibility result and keyboard journeys
- Performance impact
- Security impact
- Dependencies added or removed
- Exact commands executed and their results
- Browser journeys executed and their results
- Known failures and whether they are pre-existing
- Remaining risks requiring manual testing
- Rollback or recovery notes
- Exact next phase recommendation

## 4. Standard reviewer decision

The reviewer must classify each phase as one of:

- **Approved:** all acceptance criteria pass with evidence.
- **Approved with documented non-blocking risks:** acceptance criteria pass;
  risks are recorded and do not affect the next phase.
- **Remediation required:** one or more acceptance criteria failed or evidence
  is insufficient. The current phase remains open.
- **Blocked:** progress requires credentials, external infrastructure,
  production authorization, destructive data approval, or an unresolved
  material product decision.

The next phase cannot start while the current phase is `Remediation required`
or `Blocked`.

## 5. Odoo-style ATS capability closure map

This map is the authoritative scope lock for the minimum commercially usable
RecruitFlow ATS. A capability is not considered closed because a route exists
or a page renders. Its owning phase must satisfy the listed operational,
security, data, and browser acceptance evidence. The phases remain sequential;
later phases may improve an earlier capability, but may not silently remove
its acceptance criteria.

| Capability | RecruitFlow closure phase | Closure requirements |
|---|---|---|
| Public jobs listing | M1-G2, completed in M3 | Published/open jobs only, safe public DTO, search, pagination, responsive public page, no shell/private data leakage |
| Public job detail and apply | M1-G2, completed in M5/M7 | Public detail, consent, validation, duplicate handling, secure CV upload, application creation, acknowledgment, audit, no session creation |
| Career site and job publishing management | M7-G1/M7-G2/M7-G4 | Approved vacancies only, real channel configuration/status, preview, publish/unpublish/schedule, sync/failure/retry, audit, tenant/RBAC scope |
| Candidate portal / My Applications | M3-G7 | Candidate authentication or verified-link policy, own applications only, stage/status visibility, permitted documents/messages, no internal notes or scoring leakage |
| Applicant Kanban/List/Form | M3-G3 to M3-G5 | Vacancy-centered pipeline, server stages, filters, pagination, bulk actions, candidate form, preview, keyboard alternative to drag-and-drop |
| Pipeline stages and workflow rules | M3-G3/M3-G4 and M8-G5 | Server-enforced transitions, reasons, entry/exit gates, SLA, audit, versioned templates, safe edit/archive impact handling |
| Candidate profile | M3-G5 and M5-G1/M5-G2 | Structured identity, history, skills, education, licenses, consent, provenance, CV review, duplicate resolution, tenant/RLS protection |
| CV Bank and CV parsing | M5-G2 and M7-G3 | Upload, scan, parse, review, confirm, duplicate handling, structured fields, provenance, retention, authorized download, encrypted/private storage |
| Excel import and export | M5-G3 to M5-G6 and M7-G1 | XLSX templates, inspection, mapping, validation, staging, preview, idempotency, codes, audit, row errors, async large jobs, XLSX-only user exports |
| Interviews and evaluations | M3-G6 | Scheduling, timezone/conflict rules, interviewer assignment scope, scorecards, feedback, reminders, audit, candidate/vacancy continuity |
| Interview calendar | M2-G2 and M3-G6/M7-G4 | Discoverable navigation, list/calendar views, internal calendar, external sync where configured, timezone correctness, conflict and retry handling |
| Offers and approvals | M3-G6 | Offer creation, approval chain, authorization, status transitions, expiry, controlled communication, audit, no bypass through direct API calls |
| Pre-hire and joining | M3-G6 | Readiness checklist, required documents, blockers, approvals, joining status, audit, safe HRIS handoff; no payroll/attendance/leave expansion |
| Talent Pool | M4-G1 to M4-G5 | Pool lifecycle, membership, ownership, consent, eligibility, freshness, search/filter/pagination, history, explicit human actions, audit |
| CV-to-position matching | M6-G1 to M6-G6 | Structured requirements, deterministic hard gates first, versioned explainable score, evidence/gaps, fairness controls, human-only shortlist/application actions |
| Reports and analytics | M8-G1/M8-G2 | Correct event-based metrics, definitions, date/timezone basis, filters, scope, drill-through, no-data states, XLSX export only |
| Users, roles, and RLS | M1-G4 and M8-G3 | Organization/branch/department/recruiter/requester/hiring-manager scope, effective permission explanation, API enforcement, cross-tenant tests |
| Master Data | M1-G5 and M8-G4 | Automatic unique codes, concurrency safety, add/edit/archive/restore, reference protection, import, XLSX export, history, permissions |
| Audit Log | M3/M4/M5/M7 and M8-G6 | Actor, action, entity, result, timestamp, before/after where safe, correlation ID, redaction, search, deep links, XLSX export, tenant scope |
| Notifications and email | M7-G1/M7-G4 | Outbox, templates, preferences, delivery status, retries, deduplication, safe token handling, in-app notifications, audit |
| CV binary backup and restore | M7-G1/M7-G3 | Separate from XLSX metadata export, encrypted binary backup, integrity verification, retention, restore rehearsal, tenant authorization, audit |
| Inbound recruitment email | M7-G4/M7-G5 | Authenticated inbound source, job/application matching, attachment scanning, duplicate/idempotency handling, failure visibility, audit |
| Candidate communication timeline | M3-G8 and M7-G4 | Internal notes, external messages, activities, attachments, permissions, templates, delivery history, audit, no accidental disclosure |

### Global closure rule

M10 must certify every row in this map through static checks, database and
permission tests, critical mutation E2E journeys, responsive/theme/accessibility
evidence, performance budgets, backup/restore rehearsal, and tenant-isolation
verification. “Implemented” means the full row is operational and testable;
“planned” means it is not yet a product capability.

## 2026-08-30 — Design reference and workflow reconciliation

The supplied `docs/App Deisgn` compositions are now an approved visual and
workflow reference only. They are not implementation or release evidence. The
full reconciliation is recorded in
`docs/development/DESIGN_WORKFLOW_REVIEW_2026-08-30.md` and is binding on later
phase acceptance.

The designs establish a useful Odoo-style sequence: public job discovery,
detail/apply, candidate applications, recruiter dashboard, vacancy-centered
pipeline, candidate 360, interviews/calendar, approvals/offers, joining, CV
Bank, reports, notifications, and publishing. Several concepts do not exist
as current routes yet—candidate My Applications, Compare Candidates, Candidate
Communication Center, Career Site/Job Publishing, and Hiring Plan Overview—so
they must be delivered through their owning phases with real contracts rather
than static page additions.

For all future UI work, phase acceptance additionally requires real API-backed
data and explicit loading, empty, unavailable, error, retry, forbidden,
not-found, stale, and partial-success states; role/tenant-aware actions;
semantic Lucide-based controls; keyboard and focus-safe modal/drawer behavior;
reduced motion; light/dark semantic tokens; and browser evidence at 1440,
1280, 1024, 768, 430, and 375px. Dashboard/report metrics must state their
source, definition, date range, timezone, scope, and refresh/as-of time. A
screenshot or a rendered route alone cannot close a goal.

---

# M0 — Baseline truth and release discipline

## Objective

Establish exact-source truth before implementation and identify P0 blockers.

## Goals

### M0-G1 — Worktree and source baseline

Record the current branch, worktree status, modified files, untracked files,
existing commits, package manager, workspace packages, lockfiles, and runtime
listeners. Preserve all user changes.

### M0-G2 — Application surface inventory

Inventory frontend routes, protected/public boundaries, API endpoints, services,
permissions, authentication, Prisma models, migrations, storage, workers,
tests, CI, deployment, environment variables, imports, exports, CV Bank,
reports, Master Data, Pipeline Settings, and integrations.

### M0-G3 — Baseline validation

Run the actual repository commands for dependency validation, design tokens,
lint, typecheck, unit tests, integration tests, database checks, security,
production build, bundle budgets, and browser tests.

### M0-G4 — Failure reproduction and classification

Reproduce the historical full-test memory failure and determine whether it is
environmental, runner configuration, process leakage, database setup, browser
harness, or a source defect. Reproduce and document the local IPv4/IPv6 web/API
origin issue without stopping user-owned processes.

### M0-G5 — Baseline evidence and P0 blockers

Create a dated evidence record and list each P0 blocker, pre-existing failure,
new failure, missing prerequisite, and test that gives false confidence.

## Out of scope

- Product redesign
- New workflow features
- Schema redesign unrelated to baseline evidence
- Cosmetic changes
- Destructive cleanup

## M0 acceptance gate

- Exact worktree state is recorded.
- Current source inventory is complete enough to plan safely.
- Baseline commands have exact results.
- Historical failures are reproduced or explained.
- Browser origin/runtime requirements are documented.
- P0 blockers are identified.
- No unrelated source changes were introduced.

## M0 verification prompt

```text
Review M0 in D:\Projects\Recruitment Workflow System.

Do not modify source during the first review pass. Read the M0 evidence,
task_plan.md, findings.md, progress.md, manifests, route map, API inventory,
schema, migrations, tests, CI, and deployment configuration.

Verify:

1. The recorded branch, modified files, and untracked files match the actual
   worktree.
2. The package, route, API, permission, schema, migration, test, CI, and
   deployment inventories are based on exact current source.
3. Every baseline command was actually executed and has a result.
4. Historical memory and browser-origin failures are accurately classified.
5. Pre-existing and newly introduced failures are clearly separated.
6. P0 blockers are real and prioritized.
7. No product feature was marked complete from screenshots only.

Run targeted read-only checks to confirm the evidence. Report:

- Approved or remediation required
- Incorrect claims
- Missing evidence
- P0 blockers
- Exact commands run
- Exact next action before M1
```

---

# M1 — Authentication contracts, public journeys, and P0 integrity

## Objective

Make authentication, public routes, API errors, permissions, tenant isolation,
and urgent data-integrity behavior safe enough for product implementation.

## Goals

### M1-G1 — Authentication journeys

Verify and repair login, logout, forgot password, reset password, invitation
acceptance, email verification, expired session, expired token, and invalid
route behavior.

Production responses must not expose passwords, development tokens, secrets,
stack traces, SQL details, or internal identifiers.

### M1-G2 — Public/authenticated boundary

Verify that public jobs, public job detail, and public application surfaces do
not access authenticated shell data. Verify authenticated APIs cannot be used
by public clients to access private records. The public application contract
must include secure CV attachment handling, or the report must explicitly
document an approved deferral to M5/M7; no report may claim CV upload closure
without an implemented and tested upload path.

### M1-G3 — Stable API error contracts

Standardize safe error responses with an error code, human message,
field-level validation details, correlation/request identifier where supported,
and retry guidance where relevant.

### M1-G4 — Tenant and row-level scope

Define and test organization, legal entity, branch, department, position,
recruiter, requester, and hiring-manager visibility. Apply scope consistently
to list, detail, search, mutation, report, export, notification, audit, import,
and CV-download operations.
Tenant context must be established after authentication and before any scoped
service query. Any reusable tenant guard/decorator must be registered in the
actual module graph and must support direct organization ownership as well as
supported child relations. Authorization must fail closed when a resource
cannot be safely scoped. Add isolated cross-tenant and cross-scope tests for
authorized, forbidden, and safe-not-found outcomes, including mutation and
document-download paths; middleware ordering, unused metadata, or a frontend
visibility filter are not sufficient evidence.

#### M1-G4 implementation contract

This goal is implemented in five controlled layers:

1. **Authenticated context:** derive `tenantId` only from the verified JWT
   user, after Passport authentication has completed. Do not trust tenant
   headers, query parameters, request bodies, or frontend state. Public routes
   must remain exempt from tenant context requirements.
2. **Typed resource policy:** maintain an explicit resource/relationship
   registry containing route, method, parameter, Prisma model, tenant relation,
   required permission, and cross-tenant response policy. Do not use unrestricted
   dynamic Prisma access, `any`, or a guard attached blindly to every `:id`.
3. **Service/database enforcement:** every list, search, report, export,
   detail, create, update, transition, import, notification, audit, and file
   operation must scope at the query/mutation boundary. Child records must be
   constrained through their tenant-owned parent relation. Referenced records
   in create/update requests must be proven to belong to the same tenant.
4. **Fail-closed errors:** cross-tenant resource reads and mutations must use a
   safe 404 where resource existence must not be disclosed. Same-tenant but
   unauthorized actions use 403. Do not make all same-tenant mutations succeed;
   permission and workflow state still apply.
5. **Evidence:** prove the policy with isolated API/database tests and loaded
   browser sessions. A hidden frontend action, a screenshot, or a route that
   merely renders does not prove tenant isolation.

The first implementation artifact must be a matrix for all current controller
routes, including `screening`, `tasks`, `search`, `integrations`, `roles`,
`users`, `master-data`, `pipeline-settings`, notifications, nested approvals,
import jobs/rows, CV documents/downloads, and report/export endpoints. For
each nested resource, record the exact parent relation, for example:

```text
CandidateDocument -> Candidate -> Organization
Application -> Vacancy/Candidate -> Organization
Interview -> Application -> Organization
Offer -> Application -> Organization
HiringCase -> Candidate/Application -> Organization
PipelineStage -> PipelineTemplate -> Organization
ImportRow -> ImportJob -> Organization
```

The current `TenantContextMiddleware` and `TenantScopedGuard` must be reviewed
against this contract. Middleware that runs before `req.user` exists cannot be
the authoritative tenant mechanism. A metadata entry that is not registered
in the Nest module graph or a model name that does not match Prisma cannot be
counted as enforcement.

#### M1-G4 resource and relationship matrix

This is the minimum current-source inventory for the goal. The implementing
agent must verify every route and extend the table when source inspection finds
another resource. A route parameter is not automatically a direct Prisma model
identifier; the recorded parent relation is part of the security contract.

| Resource family | Current route identifiers | Scope policy to verify |
|---|---|---|
| Candidates | `candidateId`/`id` | Direct `Candidate.organizationId`; branch/department/recruiter visibility where supported |
| Candidate documents/CV downloads | `candidateId`, document `id` | `CandidateDocument.organizationId` and candidate ownership; never expose storage keys |
| Applications/screening | application `id`, `applicationId` | Application organization plus vacancy/candidate parent consistency |
| Vacancies/openings | vacancy `id` | Direct vacancy organization plus branch/position/legal-entity scope |
| Vacancy requests | request `id` | Direct request organization plus requester/branch/approver visibility |
| Interviews/scorecards/attendees | interview `id` | Interview organization and application/vacancy parent; attendee selectors scoped to tenant |
| Offers/approvals | offer `id`, approval `approvalId` | Offer organization and application parent; approval must be reached through its offer |
| Hiring cases/requirements/approvals | case `id`, requirement `reqId` | Hiring case organization and candidate/application parent; child must belong to the case |
| Talent Pools/memberships | pool `id`, candidate `candidateId` | Pool organization and candidate organization; membership mutations check both parents |
| Pipeline templates/stages | template `id`, stage `stageId` | Template organization; stage must belong to the addressed template |
| Import jobs/rows | job `jobId`, row `rowId` | Import job organization; row must belong to the addressed job and dataset |
| Users/roles/permissions | user/role `id`, nested role/permission ids | Organization scope, role-management permission, and no cross-tenant assignment |
| Master Data | legal entity/branch/position `id` | Direct organization plus supported branch/legal-entity/position relationships |
| Notifications/tasks/integrations | record `id` | Organization scope plus recipient/assignee/provider ownership |
| Reports/search/exports/audit | filters/query, any resource identifiers | Scope the underlying query/result set; no ID guard substitute for list/report scope |
| Public jobs/apply | organization code/vacancy code | Public safe DTO and published/open rules; excluded from private tenant guard |

The final M1-G4 report must include the verified method-level matrix, not just
this family summary. Any resource omitted from the matrix is a release blocker.

#### Delegation protocol for every goal

The implementation agent must begin each delegated goal by reporting the exact
source baseline and proposed file scope. During implementation it must preserve
unrelated dirty work, existing contracts, and business rules. At handoff it
must provide exact changed files, API/database changes, permission impact,
commands with exit codes and counts, browser journeys, theme/responsive/
accessibility evidence, known failures, and rollback notes. The reviewer then
re-runs the relevant checks against current source; a claimed completion report
does not replace independent verification.

### M1-G5 — Master Data integrity foundation

Implement or verify automatic unique code generation, database uniqueness,
concurrency safety, human-readable labels, archive behavior, reference checks,
and audit history. Do not allow unsafe physical deletion of referenced data.

Broader Master Data administration remains in M8; this goal is the P0 safety
foundation.

## M1 acceptance gate

- Authentication and recovery journeys work safely.
- Public and private data boundaries are enforced.
- Unauthorized and forbidden API behavior is verified.
- Tenant and row-level scope tests pass.
- Production does not expose development credentials or tokens.
- Master Data codes remain unique under concurrent creation.
- Referenced Master Data cannot be physically deleted.
- Security-sensitive errors are safe and actionable.

## M1 verification prompt

```text
Review M1 in D:\Projects\Recruitment Workflow System, with special focus on
M1-G4 Tenant and Row-Level Scope.

Read the current source first. Do not trust historical reports or a clean
frontend route. Inspect JWT authentication, middleware order, APP_GUARD
registration, tenant decorators/metadata, every controller, every service
query/mutation, Prisma relations, audit interceptor, exports, imports,
documents, tests, and migrations.

For M1-G4 verify:

1. `pnpm typecheck` and `pnpm lint` are run against the current source.
2. tenantId comes only from a verified JWT and is available after authentication.
3. public endpoints do not require tenant context and protected endpoints cannot
   proceed with a missing or client-supplied tenant.
4. the tenant policy/guard is typed, registered in the actual Nest module graph,
   and fails closed for unmapped resources.
5. direct organization-owned models and child resources use correct parent
   relation constraints; verify candidate documents, applications, interviews,
   offers, hiring cases, pipeline stages, import rows, approvals, and pool
   memberships.
6. lists, search, pagination, details, creates, updates, transitions, reports,
   exports, notifications, audit, imports, and CV downloads enforce both
   organization and supported branch/department/recruiter/requester/hiring-
   manager visibility.
7. Org A authorized access succeeds only when permission and workflow state also
   allow it; Org A unauthorized access returns 403; Org B resource access is a
   safe 404 where enumeration must be prevented.
8. audit entries for successful and failed authenticated actions carry the
   verified organizationId and do not leak cross-tenant identifiers or internals.
9. no tenant can override scope through headers, query strings, body fields,
   route parameters, exports, or import payloads.
10. existing deep links, API contracts, public routes, approval rules, consent,
    and document security remain compatible.

Run isolated tests with Org A and Org B fixtures for all resource categories,
then run a loaded browser matrix with administrator, recruiter, requester or
hiring-manager, and restricted-role sessions at 375, 430, 768, 1024, 1280,
and 1440px in light and dark themes. Verify direct Org B deep links, list/search
absence, action visibility, keyboard behavior, no horizontal overflow, no
unexpected console errors/5xx responses, and Axe critical/serious results.

Do not approve M1-G4 from screenshots, route visibility, or frontend filtering.
Report exact commands, exit codes, assertion counts, resource matrix coverage,
browser evidence paths, failed cases, migration risks, and the next phase.
```

---

# M2 — Product shell and design-system closure

## Objective

Create one coherent, accessible, responsive RecruitFlow interface without
changing business behavior.

## Goals

### M2-G1 — One predictable home experience

Consolidate the behavior of `/` and `/dashboard` into one role-aware entry
experience while preserving deep links, query parameters, and permissions.
The dashboard must render only persisted, scope-authorized metrics and must
explain the source, definition, date range, timezone, and refresh/as-of time of
each metric. Each unavailable section needs a truthful reason and safe retry or
next action; fabricated sample numbers are not acceptable.

### M2-G2 — Navigation and shell

Complete the six-group information architecture, active states, collapsed and
mobile navigation, tooltips, breadcrumbs, compact top bar, search,
notifications, theme control, Quick Create, and account controls.
Interview Calendar must be directly discoverable from the shell. The shell
must preserve existing RecruitFlow labels and deep links while making the
operational sequence—vacancy, pipeline, candidate, interview, offer, joining—
clear for each authorized role.

### M2-G3 — Context-aware search and Quick Create

Expand search to candidates, vacancies, applications, interviews, offers,
approvals, tasks, notifications, CV records, Talent Pools, and Master Data
where supported. Preserve permission filtering.

Make actions context-aware. For example, “Add Candidate” from a vacancy must
retain that vacancy instead of sending the recruiter through an unrelated blank
form.

### M2-G4 — Semantic light and dark themes

Replace local light-only classes with semantic design tokens. Audit surfaces,
borders, text, inputs, tables, cards, dialogs, charts, badges, and errors on
all major pages.
Use the design reference's hierarchy and density without copying static sample
data or turning every page into a card grid. Verify both themes on loaded,
empty, error, and permission-denied states.

### M2-G5 — Shared operational components

Standardize PageFrame, PageState, ResponsiveDataView, Modal, Drawer, EmptyState,
ErrorState, RetryState, FilterBar, StatusChip, SLA badge, Timeline, file upload,
confirmation, and unsaved-change patterns.
Shared components must expose semantic names/labels, role-aware actions,
aria-live feedback, visible focus, internal scrolling, Escape handling, and
consistent mobile overflow behavior. Do not introduce a second icon or design
system.

### M2-G6 — Accessibility and responsive behavior

Verify keyboard navigation, focus states, semantic headings, field labels,
aria-live messages, reduced motion, chart alternatives, color-independent
status, dialog focus trapping, Escape behavior, and mobile touch targets.
Run the full six-width matrix (1440, 1280, 1024, 768, 430, 375px) in light and
dark themes for representative loaded, no-data, error, and modal/drawer
journeys. Record keyboard and automated accessibility evidence; do not approve
from visual screenshots alone.

## M2 acceptance gate

- One predictable role-aware home exists.
- Shell works at all required responsive widths.
- Light and dark themes are coherent on loaded pages.
- Shared modals and drawers trap/restore focus and scroll internally.
- Search and Quick Create respect permissions.
- Representative journeys pass keyboard and accessibility checks.
- No new design system or unnecessary dependency was introduced.

## M2 verification prompt

```text
Review M2 in D:\Projects\Recruitment Workflow System.

Inspect the shell, routes, shared UI components, tokens, responsive CSS,
dialogs, drawers, command palette, Quick Create, theme logic, and accessibility
tests.

Verify in a loaded authenticated application using authorized test users:

1. / and /dashboard have predictable behavior and preserve deep links.
2. Navigation labels, active states, collapsed sidebar, mobile drawer,
   breadcrumbs, search, notifications, theme, and account controls work.
3. Search results include supported entities and hide unauthorized records.
4. Quick Create retains record context and enforces permissions.
5. Major pages have no unintended light-only surfaces in dark mode.
6. Every modal and drawer supports keyboard open, Tab trapping, Escape,
   internal scroll, close, and focus restoration.
7. Test widths 1440, 1280, 1024, 768, 430, and 375px.
8. Test keyboard-only navigation and accessible error/success announcements.
9. Confirm reduced-motion behavior.

Do not approve from screenshots alone. Report page-specific defects and exact
commands/journeys used.
```

---

# M3 — Core recruitment workflow and vacancy-centered pipeline

## Objective

Make the daily recruiter workflow simple and vacancy-centered while preserving
approval, audit, permission, and transition rules.

## Goals

### M3-G1 — Vacancy operational workspace

Make every vacancy/opening the context root for:

- Overview
- Applicant pipeline
- Candidate comparison
- Interviews
- Offers
- Hiring readiness
- Vacancy activity
- Vacancy reports

The primary action must be “Open Applicant Pipeline.”

### M3-G2 — Vacancy and requisition usability

Improve Vacancy Requests and Openings with templates, draft handling, duplicate
detection, field validation, approval timeline, current approver, next action,
comments, SLA, recruiter, hiring manager, headcount, aging, target date,
publication state, and linked vacancy.

Resolve all raw position, branch, and legal-entity IDs into human-readable
labels. Remove hardcoded publication/channel markers.
The Request New Role flow must capture the operational approval context:
organization/legal entity, branch, department, position, requester, hiring
manager, recruiter, employment/location details, headcount, target date,
priority, justification, requirements, attachments, SLA, current approver,
comments, and publication state where supported. Missing setup must provide an
actionable, permission-aware next step.

### M3-G3 — Server-configured application pipeline

Load stages from the active workflow template. Do not hard-code stage names in
the frontend. Add server-side filtering and pagination/infinite loading.

Required filters include vacancy, recruiter, source, date, stage, consent,
location, and skills where supported.

### M3-G4 — Pipeline actions and transition safety

Add quick candidate creation, candidate preview, bulk selection/actions, SLA
states, keyboard alternatives to drag-and-drop, rejection/withdrawal reasons,
audit history, and server-side transition enforcement.

### M3-G5 — Application detail workspace

Show candidate, vacancy, stage, recruiter, next action, timeline, CV,
screening, scorecards, interviews, offers, tasks, communications, audit,
source, medium, campaign, referral, rejection reason, SLA, blockers, and
missing requirements.
This is the recruiter candidate-360 workbench: preserve vacancy context in
every action, distinguish internal notes from candidate-visible messages, show
provenance/consent and document state, and expose safe links to related
interviews, offers, readiness, and audit history.

### M3-G6 — Interview, offer, and hiring continuity

Preserve vacancy and candidate context through interview scheduling, scorecards,
offer approval, offer status, pre-hire, compliance, final approval, and joining
readiness.

### M3-G7 — Candidate portal and self-service application tracking

Add an optional but production-ready candidate-facing area for authenticated or
verified candidates to view only their own applications, current public stage,
permitted interview details, requested documents, and approved messages. Never
expose internal notes, scorecards, salary, other candidates, or recruiter-only
workflow data. Define account recovery, consent, privacy, and data-retention
behavior before enabling the portal.
The public/applicant experience must provide a clear application acknowledgement
and safe status language. It must not imply that a static “My Applications”
screen is implemented until its identity, ownership, recovery, and privacy
contract is tested.

### M3-G8 — Candidate communication timeline

Provide a vacancy/application-centered timeline for internal notes, activities,
candidate communications, attachments, delivery state, and audit events. Keep
internal and external visibility explicit, permission-checked, tenant-scoped,
and distinguishable in the UI. Preserve message history and prevent accidental
disclosure of internal notes.
Support candidate/application context, activity type, sender/recipient,
visibility, delivery state, attachments, retry/failure state, and audit links.
The communication center must not be a visual-only inbox with fabricated
messages or delivery claims.

## M3 acceptance gate

- Vacancy opens directly into its pipeline.
- Pipeline stages are server-configured.
- Large datasets do not depend on loading 100 records only.
- Rejection and withdrawal reasons are captured.
- Server transition rules cannot be bypassed by the frontend.
- Candidate/vacancy/application context remains visible.
- Interview, offer, and hiring actions preserve audit and approval behavior.
- Candidate self-service shows only the candidate's permitted records.
- Communication visibility distinguishes internal notes from external messages.
- Keyboard users have a non-drag alternative.

## M3 verification prompt

```text
Review M3 in D:\Projects\Recruitment Workflow System.

Inspect vacancy, requisition, application, pipeline, interview, offer, hiring,
workflow-template, API, Prisma, permission, and audit changes.

Execute these authorized and unauthorized journeys:

1. Create vacancy request.
2. Approve or reject it with the correct role.
3. Open the resulting vacancy.
4. Open its applicant pipeline directly.
5. Add a candidate from the vacancy context.
6. Move an application using drag and keyboard alternatives.
7. Attempt an invalid server transition directly through the API.
8. Move to rejected and confirm a required rejection reason.
9. Verify history and audit entries.
10. Filter and paginate a dataset larger than one page.
11. Open candidate preview without losing vacancy context.
12. Schedule an interview and verify timezone/conflict behavior.
13. Progress an offer through approval without bypassing authorization.
14. Verify pre-hire and joining blockers.

Check that raw IDs are not shown to users, hardcoded stages are gone, and
publication/channel labels represent actual data.

Test light/dark, all required widths, keyboard behavior, and unauthorized
access. Report whether M3 is approved.
```

---

# M4 — Talent Pool foundation

## Objective

Deliver a complete operational Talent Pool before semantic matching.

## Goals

### M4-G1 — Pool lifecycle

Create, edit, archive, restore, search, filter, paginate, and view pool detail.
Support pool owner, purpose, tags, status, and activity.

### M4-G2 — Membership operations

Add, remove, bulk add, bulk remove, restore, and inspect candidate membership
history. Prevent duplicate membership records.

### M4-G3 — Consent and eligibility

Show and enforce consent status, consent expiry, eligibility, cooling-off,
freshness, last-contacted date, next action, and source.

### M4-G4 — Human-controlled actions

Support authorized actions to add a candidate to a vacancy, create an
application, shortlist, remove membership, and archive membership. Every action
must be explicit, auditable, permission-checked, and tenant-safe.

### M4-G5 — Pool health and audit

Add views for recently added, consent expiring, consent missing, eligible,
ineligible, no activity, and available candidates. Record membership and pool
audit history.

## M4 acceptance gate

- Talent Pools operate without database intervention.
- Membership history and ownership are visible.
- Consent and eligibility are enforced.
- Filters and pagination work.
- Vacancy/application actions preserve context.
- Cross-tenant and duplicate membership tests pass.
- No semantic matching is introduced before this gate.

## M4 verification prompt

```text
Review M4 in D:\Projects\Recruitment Workflow System.

Verify pool create, edit, archive, restore, detail, search, filtering,
pagination, ownership, purpose, tags, and status.

Verify candidate membership add/remove/bulk operations, duplicate prevention,
membership history, consent expiry, eligibility, cooling-off, freshness,
last-contacted, and next-action behavior.

Execute tests for:

1. Authorized pool creation.
2. Unauthorized pool access.
3. Cross-tenant candidate addition.
4. Duplicate membership.
5. Consent-expired candidate.
6. Ineligible candidate.
7. Remove and restore membership.
8. Audit history.
9. Add-to-vacancy and create-application actions.
10. Pagination with a multi-page pool.

Confirm there is no semantic AI matching or automatic candidate decision in M4.
Test light/dark, mobile, keyboard, and error states. Report approval status.
```

---

# M5 — Structured CV, sourcing, and Excel bulk import

## Objective

Create trustworthy structured candidate data and reliable Excel-based data
operations.

## Goals

### M5-G1 — Structured candidate profile

Support structured education, employment history, skills, certifications,
licenses, languages, location, availability, title, company, experience,
source, medium, campaign, referral, consent, and provenance.

Provenance should identify CV extraction, recruiter entry, Excel import, public
application, integration, or manual correction where possible.

### M5-G2 — CV Intake review flow

Implement Upload → Scan → Parse → Review → Duplicate Resolution → Confirm.
Show parsing progress, confidence, warnings, retry, partial failure, consent,
retention, and audit.
CV Bank is the operational talent database, not merely a document list. It
must show candidate/profile linkage, consent and eligibility, freshness,
duplicate state, parse/scan state, provenance, retention/archive state, and
authorized actions. Keep metadata XLSX export visibly separate from binary CV
backup and restore.

### M5-G3 — Excel templates and inspection

Provide XLSX templates and support candidate, vacancy, vacancy-request, and
approved Master Data datasets. Inspect workbook sheets, headers, row counts,
formats, and limits before mutation.

### M5-G4 — Mapping and validation

Support column mapping, required-field validation, enumeration validation,
foreign-key validation, email/phone/date validation, duplicate detection, and
row-level actionable errors.

### M5-G5 — Staging and confirmation

Stage rows before commit. Show creates, updates, duplicates, rejects, and
conflicts. Never overwrite silently. Require explicit decisions for updates and
duplicates.

### M5-G6 — Codes, idempotency, audit, and export

Generate missing codes safely, reject duplicate codes, make retries idempotent,
preserve tenant scope, record audit events, and provide XLSX error reports.

User-facing data and report exports must be Excel workbook files only.
Exports must be generated from the authorized filtered dataset, identify the
applied scope and as-of time where appropriate, and never expose private CV
binary content or storage keys. Error workbooks must remain safe to download
and must preserve row-level remediation details.

## M5 acceptance gate

- Structured CV fields are traceable.
- CV parsing has a review/confirmation step.
- XLSX templates, inspection, mapping, validation, staging, confirmation, and
  error reporting work.
- No silent overwrite or unsafe partial mutation occurs.
- Automatic codes remain unique.
- Retry is idempotent.
- User-facing exports are XLSX only.

## M5 verification prompt

```text
Review M5 in D:\Projects\Recruitment Workflow System.

Inspect candidate schema, CV parser, document pipeline, import controllers,
services, validation, staging, commit logic, code generation, audit, and XLSX
export code.

Run isolated tests and browser journeys for:

1. Download each XLSX template.
2. Upload a valid candidate workbook.
3. Inspect sheet/header/row metadata.
4. Map renamed columns.
5. Validate invalid email, phone, date, enum, foreign key, and required fields.
6. Detect duplicate rows and existing-record conflicts.
7. Preview creates, updates, rejects, and skipped rows.
8. Confirm only explicitly accepted rows.
9. Retry the same import and verify idempotency.
10. Generate and download an XLSX error report.
11. Import vacancy data and verify labels/codes.
12. Verify concurrent code generation cannot duplicate.
13. Upload and parse a CV, review extracted fields, resolve a duplicate, and
    confirm the candidate.
14. Verify tenant, permission, audit, file-size, formula, and row-limit rules.

Confirm no user-facing CSV export remains where the requirement is Excel-only.
Test light/dark, responsive, keyboard, and accessible upload/error states.
```

---

# M6 — Deterministic eligibility and explainable matching

## Objective

Build human-controlled, versioned, explainable candidate-to-position
evaluation.

## Goals

### M6-G1 — Structured position requirements

Support mandatory/preferred skills, minimum experience, education,
certifications, licenses, languages, location, availability, and
title/seniority requirements.

### M6-G2 — Deterministic hard gates

Classify candidates as Eligible, Ineligible, Needs Review, or Insufficient Data.
Never hide missing information.

### M6-G3 — Versioned score calculation

Store score version, requirement snapshot, weights, gate results, evidence,
missing requirements, timestamp, and evaluator/model version where applicable.

### M6-G4 — Explainable evidence

Show matched and missing skills, experience comparison, education,
certifications, licenses, languages, seniority, source of evidence, and
uncertainty.
The Compare Candidates workspace must show the same requirement snapshot and
score version for every candidate, deterministic gate results, evidence links,
missing data, uncertainty, and manual overrides. It must not present a score as
an automatic hiring decision.

### M6-G5 — Human review actions

Allow authorized recruiters to shortlist, add to pool, create an application,
dismiss with reason, request review, and compare candidates. Require explicit
confirmation and audit every consequential action.
Actions must be vacancy/position-contextual, permission-checked server-side,
explainable in the confirmation UI, and reversible where the business rule
allows. No automatic rejection, advancement, contact, shortlist, or application
creation may be introduced to make the comparison faster.

### M6-G6 — Fairness controls

Do not use or infer protected characteristics. Log scoring versions, preserve
manual overrides with reasons, and monitor outcomes only under approved lawful
controls.

## M6 acceptance gate

- Deterministic eligibility works before recommendations.
- Scores are reproducible and versioned.
- Every recommendation has evidence and missing-requirement explanations.
- Recruiters control final actions.
- Protected characteristics are not used or inferred.
- No automatic rejection, advancement, contact, shortlisting, or application
  creation occurs.

## M6 verification prompt

```text
Review M6 in D:\Projects\Recruitment Workflow System.

Inspect requirement models, eligibility gates, scoring logic, versioning,
evidence, missing-data handling, recruiter actions, audit, and fairness code.

Verify with deterministic fixtures:

1. Fully eligible candidate.
2. Missing mandatory skill.
3. Insufficient experience.
4. Missing education or license.
5. Preferred skill missing but hard gates passing.
6. Missing candidate data.
7. Different requirement versions.
8. Repeated calculation reproducibility.
9. Manual override with required reason.
10. Unauthorized shortlist/application action.
11. Cross-tenant candidate/position comparison.
12. Attempted automatic decision path.

Confirm the UI displays evidence, missing requirements, score version,
uncertainty, and human action controls. Confirm no protected attribute is used
or inferred. Test light/dark, mobile, keyboard, and screen-reader labels.
```

---

# M7 — Integrations and asynchronous operations

## Objective

Make imports, parsing, reports, files, email, notifications, queues, and
external integrations production-safe.

## Goals

### M7-G1 — Async job architecture

Move slow or large work to the existing worker/queue architecture:

- Excel import
- CV parsing
- File scanning
- CV backup
- Report generation
- Email
- Notifications
- Calendar sync
- Job-board publishing
- Webhooks
- HRIS handoff
- Bulk candidate operations

Job-board and career-site publishing is included only as a controlled
operation: approved vacancies may be previewed, published, scheduled,
unpublished, or retried per configured channel. A static channel badge is not
evidence of publication.

### M7-G2 — Job visibility and recovery

Expose job ID, status, progress, timestamps, retry count, failure reason, safe
retry, result summary, partial failure details, tenant, and audit event.
For publishing and integrations also expose provider/channel, last attempted
and last successful sync, current remote status when available, failure
classification, and safe disable/retry controls.

### M7-G3 — File and CV storage

Complete private object storage, MIME/size validation, malware scanning,
hashing, encryption, retention, archive, restore, binary backup, verification,
restore rehearsal, and audit.

Clearly separate XLSX metadata export from binary CV backup and restore.

### M7-G4 — Integration reliability

Implement provider status, secret references, connection test, sync status,
webhook validation, retry queue, failure logs, last successful sync, and safe
disable/enable behavior.
The career-site publishing surface must clearly distinguish configured,
connected, queued, published, unpublished, failed, and unavailable channels;
it must never claim LinkedIn, Bayt, Indeed, or another provider is active
without a real configured integration and evidence.

### M7-G5 — Inbound recruitment email

Support an authenticated inbound email path where approved. Match messages to
an organization, vacancy, candidate, or application using explicit rules;
quarantine unsafe attachments; deduplicate retries; preserve original
metadata safely; and expose processing status and failures to authorized
administrators. Do not accept arbitrary unauthenticated SMTP input directly
into the application database.

## M7 acceptance gate

- Large operations do not block HTTP requests.
- Progress and failure information is visible.
- Retries are safe and idempotent.
- CV binary storage, backup, and restore are real and tested.
- Integrations have logs, validation, and retry behavior.
- Inbound email and attachments are authenticated, scanned, idempotent, and
  auditable where enabled.
- Security-sensitive operations fail closed.

## M7 verification prompt

```text
Review M7 in D:\Projects\Recruitment Workflow System.

Inspect workers, queues, job status APIs, import/parser jobs, email,
notifications, storage, scanning, backups, restore, integrations, webhooks,
retry logic, idempotency keys, and audit events.

Verify:

1. Large import returns a job and does not block the request.
2. Progress is visible and accurate.
3. Worker failure creates a safe retryable state.
4. Duplicate job submission does not duplicate records.
5. Stale jobs are recovered safely.
6. Partial failures identify exact rows/files.
7. CV download is authorized and tenant-scoped.
8. Malicious/invalid files are rejected or quarantined.
9. Binary backup is distinguishable from XLSX metadata export.
10. Backup integrity is checked and restore is rehearsed in isolation.
11. Webhooks are authenticated and replay-safe.
12. Integration failures are visible to administrators.

Run worker, API, database, security, and browser tests. Report release risks.
```

---

# M8 — Analytics, administration, and commercial ATS controls

## Objective

Complete decision-oriented reporting, administration, audit, workflow
configuration, and ATS-focused commercial controls.

## Goals

### M8-G1 — Decision-oriented reports

Implement application, source/medium/campaign, funnel, velocity, aging,
vacancy performance, time-to-fill, offer acceptance, recruiter workload, team
performance, hiring progress, consent/data quality, Talent Pool health, import
quality, and matching-outcome reports.
Include an operational hiring-plan view that connects approved demand,
headcount, vacancies, pipeline progress, aging, blockers, and joining outcomes
to drill-through records.

### M8-G2 — Report usability and Excel output

Every report must show metric definitions, date basis, timezone, filters, role
scope, refresh time, no-data explanation, drill-through, saved view where
supported, and XLSX export.
Charts require an accessible tabular/data description. XLSX is the only
user-facing export format for report data; exports must honor the same tenant,
role, date, and filter scope as the screen and must not silently fall back to
CSV.

### M8-G3 — Users and Roles

Support invitation, edit, deactivation, resend invitation, role assignment,
branch/department scope, effective permission explanation, permission matrix,
last login, and security/session visibility.

### M8-G4 — Complete Master Data administration

For legal entities, branches, positions, departments, employment types, sources,
rejection reasons, interview types, certifications, and approved reference
data, support add, edit, archive, restore, search, filters, usage counts,
reference protection, history, automatic codes, safe import, XLSX export, and
permissions.

### M8-G5 — Workflow and Pipeline Settings

Support template edit, stage edit/archive/reorder, SLAs, entry/exit gates,
required scorecards/fields, email templates, task automation, rejection
reasons, template versioning, impact warnings, and preview/simulation mode.

### M8-G6 — Audit Log and commercial controls

Add actor/action/entity/result/timestamp, before-after values, correlation ID,
redaction, filters, deep links, and XLSX export. Add ATS-focused organization,
tenant, entitlement, storage, import, retention, integration, and usage
controls without expanding into payroll or HRMS.

## M8 acceptance gate

- Reports are actionable and drill through to records.
- XLSX exports respect filters, scope, and permissions.
- Master Data can be corrected safely through edit/archive.
- Workflow templates can be corrected without corrupting active applications.
- Effective permissions are understandable.
- Audit history is searchable and exportable.
- Commercial controls remain within ATS scope.

## M8 verification prompt

```text
Review M8 in D:\Projects\Recruitment Workflow System.

Inspect reports, XLSX export, user/role administration, Master Data,
Pipeline Settings, audit log, tenant settings, entitlement, storage, and usage
controls.

Verify:

1. Application, source, velocity, team, vacancy, offer, hiring, and quality
   reports calculate from the correct persisted events.
2. Filters affect both visible data and XLSX output.
3. Drill-through records obey permissions and tenant scope.
4. No-data states explain the cause and next action.
5. Master Data edit/archive/reference protection works.
6. Automatic codes remain stable and unique.
7. Workflow edit/archive warns about active application impact.
8. Users can understand effective permissions.
9. Audit before/after values are accurate and sensitive fields are redacted.
10. User-facing exports are XLSX only.
11. No payroll, attendance, leave, benefit, or unrelated HRMS scope was added.

Test administrator, recruiter, manager, interviewer, and unauthorized users.
Test light/dark, responsive, keyboard, and screen-reader behavior.
```

---

# M9 — Production hardening

## Objective

Harden security, data integrity, performance, accessibility, observability,
backup, and operational reliability.

## Goals

### M9-G1 — Security review

Review authentication, authorization, IDOR, tenant isolation, row-level scope,
file uploads, MIME validation, XSS, injection, CSRF/session behavior, CORS,
headers, secret exposure, error leakage, rate limiting, audit completeness,
webhook authentication, and download authorization.

### M9-G2 — Database and migration hardening

Rehearse migrations, recovery/rollback procedures, indexes, uniqueness,
foreign keys, nullability, transactions, concurrency, backup, and restore.

### M9-G3 — Performance and bundle budgets

Review pagination, query count, N+1 queries, large candidate/application data,
Excel imports, parser throughput, lazy route loading, page splitting,
virtualization, and unnecessary “load everything” behavior.

### M9-G4 — Accessibility hardening

Test keyboard-only workflows, dialogs/drawers, tables, form errors, charts,
contrast, reduced motion, mobile targets, labels, screen-reader announcements,
RTL/LTR behavior where supported, and responsive layouts.

### M9-G5 — Reliability and observability

Add or verify structured logs, correlation IDs, health checks, worker/queue/
database health, integration failure visibility, alertable errors, retry/dead-
letter monitoring, and graceful degraded states.

## M9 acceptance gate

- No unresolved critical security issue.
- Tenant and row-level isolation tests pass.
- Migration and restore rehearsals pass.
- Performance budgets pass.
- Critical accessibility journeys pass.
- Worker and integration failures are observable.
- Large datasets do not rely on unbounded frontend loading.

## M9 verification prompt

```text
Review M9 in D:\Projects\Recruitment Workflow System.

Perform an authorized pre-production security and reliability review. Inspect
all relevant code, configuration, migrations, tests, logs, and deployment
files.

Verify:

1. Authentication and authorization cannot be bypassed.
2. IDOR and cross-tenant access attempts fail.
3. Branch/recruiter row-scope attempts fail where unauthorized.
4. File upload/download/restore checks are enforced.
5. Secrets and development credentials are absent from production artifacts.
6. Security headers, CORS, session, rate limits, and safe errors are correct.
7. Migration upgrade and recovery rehearsal pass.
8. Backup and restore pass in isolation.
9. API queries are bounded and indexed where required.
10. Bundle and runtime budgets pass.
11. Workers, queues, integrations, and database health are observable.
12. Critical keyboard, mobile, dark-mode, and accessibility journeys pass.

Report every finding with severity, evidence, exploitability/impact, fix,
verification, and release-blocking status.
```

---

# M10 — Release certification and go/no-go

## Objective

Certify the actual release using complete evidence and document a go/no-go
decision.

## Goals

### M10-G1 — Static and build certification

Run exact-source static validation, dependency audit, typecheck, lint, tests,
design tokens, production build, bundle budgets, and deployment artifact checks.

### M10-G2 — Database and operational certification

Run migration upgrade, recovery, backup, restore, deployment, rollback, worker,
queue, storage, and integration rehearsals.

### M10-G3 — Permission and tenant certification

Verify roles, permissions, organization isolation, branch/recruiter row scope,
reports, exports, imports, search, audit, and file access.

### M10-G4 — Critical mutation E2E certification

Verify login/logout, vacancy request approval, vacancy pipeline, candidate
creation, CV Intake, CV Bank, Excel imports, Talent Pool, stage movement,
interviews, calendar, approvals, offers, pre-hire, joining, notifications,
reports, administration, Master Data, Pipeline Settings, and dialog/drawer
keyboard behavior.

### M10-G5 — Experience matrix certification

Verify loaded pages in light and dark themes at 1440, 1280, 1024, 768, 430,
and 375px. Include accessibility evidence and reduced-motion verification.

### M10-G6 — UAT, soak, and go/no-go

Complete dedicated-tenant UAT, staging soak, incident/recovery checks, and a
documented go/no-go decision.

## M10 acceptance gate

- All release gates have evidence.
- Critical mutation workflows pass.
- Permission and tenant-isolation tests pass.
- Responsive, light, dark, and accessibility verification pass.
- Migration, backup, restore, deployment, and rollback rehearsals pass.
- Dedicated-tenant UAT and staging soak pass.
- Go/no-go decision is documented.

## M10 verification prompt

```text
Review M10 in D:\Projects\Recruitment Workflow System.

Do not accept feature claims without evidence. Inspect the complete release
certification pack and reproduce representative checks.

Verify:

1. Exact-source static validation.
2. Clean production build.
3. Dependency/security audit.
4. Migration upgrade and recovery.
5. Backup and restore rehearsal.
6. Permission, tenant, and row-level scope tests.
7. Critical mutation E2E workflows.
8. Candidate, vacancy, pipeline, interview, offer, hiring, Talent Pool, CV,
   Excel import, report, Master Data, and Workflow Settings journeys.
9. Light/dark verification on loaded pages.
10. 1440, 1280, 1024, 768, 430, and 375px checks.
11. Keyboard and accessibility checks.
12. Bundle and performance budgets.
13. Deployment and rollback rehearsal.
14. Dedicated-tenant UAT and staging soak.

For every failure, verify that the report includes the exact command/journey,
environment, pre-existing/new classification, resolution, remaining impact,
and release-blocking status.

Return one decision:

- GO
- GO WITH DOCUMENTED NON-BLOCKING RISKS
- NO-GO

The decision must be evidence-based and must not use screenshots or route
smoke tests as the only proof.
```

---

# 5. Recommended delegation sequence

Use this exact sequence:

1. Delegate M0 implementation/baseline.
2. Send Gemini's M0 report and diff for review.
3. Fix all M0 remediation items.
4. Approve M0 only after evidence passes.
5. Delegate M1.
6. Repeat the same implementation → evidence → independent review cycle.
7. Never delegate M2–M10 as one combined request.
8. Never start M6 matching before M4 and M5 deterministic foundations pass.
9. Never start M10 release certification while M9 has unresolved critical risks.

## Immediate next action

Delegate only M0 using the M0 implementation prompt from this document. After
Gemini returns its baseline report, provide that report to the reviewer with:

- The exact changed-file list
- Test output
- Browser output
- Current worktree status
- Updated planning files

The reviewer should then issue an M0 approval or remediation list before M1.
