# RecruitFlow Product, UX, Workflow, and Delivery Blueprint

**Date:** 2026-08-31

**Status:** Execution blueprint; it does not certify any milestone as complete.
**Authority:** Read together with `AGENTS.md` and `docs/development/RECRUITFLOW_PRODUCTION_MASTER_PLAN_2026-08-23.md`. The production master plan remains the release authority when documents differ.

## 1. Product decision

RecruitFlow is a secure, multi-tenant Recruitment Operations / ATS product. It combines:

- **Odoo's operational simplicity:** a short route from requisition to hire, few destinations, visible ownership, and action-led list/detail screens.
- **SAP Fiori's enterprise clarity:** role-aware homes, object pages, progressive disclosure, consistent status and audit evidence.
- **RecruitFlow's safeguards:** enforced tenant boundaries, human-controlled recruitment decisions, structured CV evidence, and XLSX-based bulk operations.

This blueprint sets the target information architecture, page contracts, permissions, workflow, and delivery order. It is deliberately frontend-first **but never frontend-only**: every production screen binds to an explicit authenticated API contract, server validation, authorization, and audit behavior.

Historical reports that claim a goal is complete are context only. M1 must be independently verified against the exact current source and its actual test evidence before M2 work is accepted.

## 2. Scope lock

### In scope

- Public careers: job discovery, job details, applications, and lawful consent.
- Internal requisition-to-hire workflow: vacancy request, approval, vacancy ownership, candidate/CV, pipeline, interview, offer, and joining.
- Talent Pool, CV Bank, structured import/export, explainable matching, reports, administration, audit, and operational notifications.
- Three internal roles only: Employee / Requester, Manager / Hiring Manager, Administrator / Recruitment Operations.

### Explicit non-goals

- No payroll, attendance, leave, benefits, or general HRMS modules.
- No LinkedIn, Bayt, Indeed, social media, or job-board publishing/account connection workflows.
- No WhatsApp or SMS workflows.
- No required drag-and-drop interaction. Pipeline movement must always have an accessible explicit control.
- No automatic candidate creation, contact, rejection, shortlisting, application creation, or stage movement from AI or scoring.
- No browser-only authorization, mock production data, embedded provider secrets, or silent API fallback.

## 3. Canonical recruitment lifecycle

```text
Master Data
  -> Vacancy Request
  -> Manager Approval
  -> Vacancy
  -> Assignment + Target
  -> Candidate / CV Bank / Talent Pool
  -> Application + Stage History
  -> Interview + Scorecard
  -> Offer + Approval
  -> Joining / Hire
  -> Reports, Notifications, Audit
```

Each arrow represents a server-owned state transition. It must have validation, tenant scope, an authorized actor, timestamps, and audit evidence. A UI may improve the path but may not invent a bypass.

## 4. Internal roles and effective scope

| Capability | Employee / Requester | Manager / Hiring Manager | Administrator / Recruitment Operations |
|---|---|---|---|
| Submit vacancy request | Own requests | Scoped team/department requests | Any tenant request |
| Approve requests | No | Scoped approval authority only | Tenant policy authority |
| View vacancies/applications | Explicitly assigned work only | Scoped branch, department, team, or vacancy | Entire tenant |
| Assign/reassign vacancy work | No | Scoped employees only | Any tenant employee |
| Set vacancy and employee targets | No | Scoped vacancies only | Any tenant vacancy |
| Candidate/CV Bank search | Assigned candidate work only | Scoped hiring work | Entire tenant |
| Move application stage | Assigned action and allowed transition only | Scoped transition authority | Tenant policy authority |
| Interview scorecards | Assigned scorecards only | Scoped review | Tenant administration |
| Offers and joining | Assigned action only | Scoped approval/review | Tenant administration |
| Reports | Personal assigned work | Scoped team/vacancy reports | Tenant reports and export |
| Settings, roles, master data, audit | No | No | Tenant administration only |

The UI hides irrelevant actions for clarity; API and database policy must enforce the table. Direct URL access, search, export, mutation, download, and nested resource lookup must use the same policy. A safe non-disclosure response is required for out-of-scope records.

## 5. Simple internal navigation

The sidebar remains intentionally short. It is expanded by default, collapsible with labelled icon tooltips, and replaced with a usable mobile drawer.

```text
Command Center
  Dashboard

My Work
  My Work

Hiring
  Vacancy Requests
  Jobs & Vacancies
  Applications
  Interviews & Calendar
  Offers & Joining

Talent
  Candidates
  CV Bank & Import
  Talent Pool

Insights
  Reports

Administration
  Settings
```

Rules:

- Preserve existing deep links; aliases may redirect only after contract review.
- Notifications, quick create, global search, theme, and account controls live in the top bar, not as extra sidebar destinations.
- `Settings` is a contextual workspace for Users, Master Data, Pipeline, Integrations, and Audit Log. Existing dedicated routes remain valid and route into the correct tab/context.
- Public careers uses a separate header: Home, Jobs, About, Contact, Sign in.
- Navigation visibility follows effective scope. Hidden navigation is never the authorization mechanism.

## 6. Application shell and design rules

- Compact top bar: breadcrumb, tenant-safe global search, supported Quick Create actions, notifications, theme control, account menu.
- Use the existing Lucide icon system and existing design-system architecture. Do not introduce a parallel component library without review.
- Every page has a purposeful hierarchy: title, one-line operational context, primary action, filter/state area, main work surface, and clear empty/loading/error states. Do not force every page into a card grid.
- Tables are the default for operational comparison; object pages are the default for a single record; dashboard cards exist only for actionable signals.
- All dialogs/drawers are portalled, within viewport, focus-trapped, Escape-dismissible when safe, focus-restoring, and internally scrollable.
- Respect reduced motion; provide visible focus indicators; meet WCAG 2.1 AA contrast and keyboard expectations; preserve light and dark parity.
- Verify affected flows at 1440, 1280, 1024, 768, 430, and 375 px. At narrow widths, filters collapse into a labelled control and row actions move to an accessible menu.

## 7. Primary page catalogue

| Destination | Primary user question | Main work surface | Main actions |
|---|---|---|---|
| Dashboard | What requires action now? | Role-specific action queue and evidence cards | Navigate, refresh, create allowed item |
| My Work | What am I accountable for? | Tasks, assigned vacancies, due actions, target progress | Complete, acknowledge, open record |
| Vacancy Requests | What hiring demand needs decision? | Filtered table and approval queue | Create, edit draft, submit, approve/reject where allowed |
| Jobs & Vacancies | Which approved roles are being hired? | Vacancy table with health, owner, target, fill progress | Create from approved request, assign, set target, open detail |
| Applications | Where is each applicant in the process? | Accessible board/list with filters and explicit movement control | Open, move stage, record decision, assign action |
| Interviews & Calendar | What interviews need planning or feedback? | Agenda/calendar plus schedule list | Schedule, reschedule, complete scorecard |
| Offers & Joining | What approvals and readiness remain? | Offer and joining work queues | Review/approve, issue, confirm readiness |
| Candidates | Who is in the searchable candidate directory? | Candidate table with governed filters | Create, open Candidate 360, add to pool where allowed |
| CV Bank & Import | What CV assets and import batches are available? | CV index plus import batch status | Upload, review, import XLSX, download/export where allowed |
| Talent Pool | Which opted-in candidates are reusable? | Pool list and membership work surface | Create pool, add/remove member, review eligibility |
| Reports | What verified outcome is occurring? | Filters, KPI evidence, accessible tables | Apply filters, export XLSX where allowed |
| Settings | What tenant configuration is valid? | Scoped contextual administration tabs | Manage allowed configuration with audit |

## 8. Contextual object workspaces

These are not sidebar items; they are deep-linkable record workspaces.

| Workspace | Required structure and actions |
|---|---|
| Vacancy Request detail | Request summary, headcount/business case, approvals/timeline, validation messages, draft/edit/submit/decision actions by role. |
| Vacancy detail | Summary, ownership, targets, applications, activity, requirements, audit timeline. It is the primary manager assignment and target workspace. |
| Candidate 360 | Identity/contact, consent, structured CV, skills/experience, applications, pools, interviews, documents, activity/audit. Sensitive fields respect scope. |
| Application detail | Candidate plus vacancy context, current stage, permitted stage actions, screening, notes, scorecards, decision history, audit. |
| Interview detail | Schedule, participants, calendar metadata, scorecard state, feedback status, and cancellation/reschedule reason. |
| Offer detail | Proposed terms, approvals, decision timeline, issuance/acceptance state, and controlled transition to joining. |
| Talent Pool detail | Ownership, purpose, eligibility and consent, members, freshness, filters, actions, and audit history. |
| Import batch review | Workbook metadata, mapping, staged rows, row errors, duplicate resolution, confirmation result, and downloadable error workbook. |

## 9. Manager ownership, reassignment, and targets

This is a core operational capability, not an optional dashboard widget.

### 9.1 Vacancy ownership

Each vacancy has:

- one **primary employee owner** accountable for the operational work;
- zero or more **supporting employees** with explicit responsibilities;
- an effective **manager owner** derived from the employee's permitted organizational scope;
- immutable ownership history.

Only the scoped Manager or Administrator may assign or reassign. A reassignment requires the new owner, effective date, and a human-entered reason. It must retain prior ownership and may create a notification/task; it must never silently alter candidate outcomes.

### 9.2 Targets

Targets are explicit, versioned, scoped, and evidence-backed:

| Level | Examples | Source of actuals |
|---|---|---|
| Vacancy outcome | Approved headcount, target fill date, target SLA, criticality | Vacancy, hire, and workflow events |
| Vacancy workflow | Sourced, screened, interviews, offers per period | Persisted application/stage/interview/offer events |
| Employee assignment | Assigned follow-up, screening, shortlist, interview coordination target | Explicit task and recruitment events |

Every target has period, unit, target value, effective dates, status, owner, source event definition, and audit history. Dashboards display `actual / target`, as-of date, scope, and source evidence. Missing data is shown as unavailable, not fabricated. Targets never cause automatic outreach or candidate-stage changes.

### 9.3 Contract and persistence shape

Inspect the current Prisma schema before any change. If the concepts are absent, introduce an auditable, tenant-scoped equivalent of:

```text
VacancyAssignment: vacancyId, employeeId, role(primary|supporting), responsibility,
                   effectiveFrom, effectiveTo, reassignmentReason, organizationId
VacancyTarget: vacancyId, assignmentId?, metric, periodStart, periodEnd, unit,
               targetValue, effectiveFrom, effectiveTo, status, organizationId
```

Use foreign keys, tenant indexes, uniqueness rules appropriate to the chosen model, server transactions for assignment changes, and audit events containing `organizationId`. Do not create schema changes solely to decorate a screen.

## 10. Canonical data and contract rules

### 10.1 Data relationships

```text
Organization
 ├─ Users (one of Employee, Manager, Administrator)
 ├─ Master Data (branch, department, position, legal entity, source, etc.)
 ├─ Vacancy Requests -> Vacancies -> Assignments -> Targets
 ├─ Candidates -> Consents -> CV Documents -> Structured CV Profile
 ├─ Vacancies + Candidates -> Applications -> Stage History
 ├─ Applications -> Interviews -> Scorecards -> Offers -> Joining
 ├─ Talent Pools -> Pool Memberships
 ├─ Import Batches -> Staged Rows -> Resolution / Confirmation Result
 └─ Notifications and Audit Events
```

Tenant identity is not client-supplied business data. It comes from the authenticated context and is enforced in guards, service queries, parent-resource constraints, exports, file access, background jobs, and audit logging.

### 10.2 Frontend-first, contract-first delivery

For each screen slice:

1. Inspect the real route, controller/service, DTO/schema, permission policy, and tests.
2. Write or confirm the request/response, error, pagination, filter, and empty-state contract in the repository's existing shared-contract location.
3. Build the page against a typed view model with loading, empty, forbidden/not-found, validation, and recoverable-error states.
4. Bind it to the real authenticated API before the goal is closed.
5. Use fixture adapters only in local development/test when explicitly identified. They must not be a production fallback.
6. Cover a permitted and a forbidden actor, direct navigation, and mutation audit behavior.

No screen may display invented metrics, hard-coded success values, or fake integration status as a substitute for unavailable server data.

## 11. Candidate, CV Bank, and privacy rules

- Candidate identity, contact data, consent, eligibility, sources, documents, structured profile, applications, pool memberships, and activity form one governed Candidate 360 record.
- CV Bank is a secure, searchable document/index capability, not merely a file upload page. It provides controlled upload, review, parsing status, document version/history, consent/retention visibility, safe download, and backup/export evidence according to policy.
- Parse results are editable review data. The parser never decides candidate suitability or creates recruitment records automatically.
- File storage requires tenant-bound authorization for upload, metadata, preview, download, and deletion/retention. Do not expose object storage URLs without authorization.
- Personal-data export must be permissioned, audited, tenant-scoped, limited to XLSX, and never leak CV/document access outside the caller's scope.

## 12. XLSX import/export and generated codes

### 12.1 Import Center

Support candidate database and vacancy request workbooks with a stable contract:

1. Download an XLSX template containing required fields, definitions, examples, and sheet protection only where it supports data quality.
2. Upload XLSX or CSV within configured size/row limits.
3. Inspect worksheet and map columns deterministically.
4. Validate required values, formats, master-data references, duplicate candidates/vacancies, consent, and row-level authorization.
5. Show row errors with actionable fixes; allow correction/re-upload or download an error workbook.
6. Confirm the staged batch in a transaction; create normal workflow records and audit events.

Vacancy imports create draft requests and enter the existing approval workflow. Imports never bypass approval or generate silent applications.

### 12.2 Export policy

- XLSX is the only product-facing spreadsheet export format unless an approved technical integration requires another internal format.
- Use server-side data, permission-scoped filters, UTC-safe dates, safe cell handling, an exported-at timestamp, and an audit entry.
- The UI must not label a CSV export as Excel. Any legacy CSV endpoint is retained only when contract compatibility requires it and is documented as legacy.

### 12.3 Master Data identifiers

Human-readable codes must be generated server-side from the last valid sequence in the tenant/record type, guarded by uniqueness constraints and retry-safe transaction logic. The user never types an ID merely to avoid duplicates. Deactivation is preferred to deletion when records are referenced; destructive changes require dependency checks and audit evidence.

## 13. Talent Pool and explainable matching boundaries

Talent Pool is an operational capability with create/edit/detail, owner, membership, consent/eligibility/freshness, search/filter/pagination, and audit history. It must not become an ungoverned duplicate candidate list.

Matching begins only after structured CV and sourcing requirements are present and tested. It uses deterministic hard eligibility gates first, then versioned explainable scoring. It shows matched evidence, missing requirements, scoring version, fit tier, and uncertainty. Recruiters can review, shortlist, add to pool, or create an application only through explicit human actions with reason/audit. Fairness controls and outcome monitoring are required. No score triggers an automated recruitment action.

## 14. Approved integration foundation

Later phases may support only these foundations unless a new product decision is approved:

- email delivery with durable delivery/failed status;
- calendar invitations and ICS-compatible scheduling;
- secure CV/document storage and backup/restore workflows;
- XLSX import/export;
- internal event/webhook infrastructure where secured and audited.

Configuration pages must expose status, last verification, scoped error, and disconnect/retry action only when supported by the real backend. Credentials are server-side secrets; they never appear in source, client state, URLs, browser logs, exports, or audit event payloads.

## 15. Reports, audit, and data truth

Reports are operational decision tools, not decorative charts. Each KPI must define its scope, period, filter set, source event, formula, denominator, data freshness, and unavailable condition. Provide the underlying accessible table for visualizations and XLSX-only export where permitted.

The minimum report set is vacancy health/fill progress, time-to-fill, pipeline conversion and aging, interview/offer outcomes, source quality, recruiter/employee workload against targets, and manager team progress. Results are tenant and effective-scope constrained.

Audit records need actor, tenant, timestamp, action, affected resource, before/after or controlled diff, outcome, and correlation/reference ID where available. Audit views must be queryable, filterable, permissioned, export controlled, and resilient to absent optional data.

## 16. External design references

These references inform patterns; they do not override RecruitFlow security, existing contracts, or accessibility requirements.

- Odoo Recruitment Flow: <https://www.odoo.com/documentation/18.0/applications/hr/recruitment/recruitment-flow.html>
- Odoo Job Positions: <https://www.odoo.com/documentation/18.0/applications/hr/recruitment/new_job.html>
- SAP Fiori Object Page: <https://experience.sap.com/fiori-design-web/object-page/>
- SAP Fiori Overview Page: <https://experience.sap.com/fiori-design-web/v1-48/overview-page/>
- Radix Dialog accessibility pattern: <https://www.radix-ui.com/primitives/docs/components/dialog>
- Radix Tooltip accessibility pattern: <https://www.radix-ui.com/primitives/docs/components/tooltip>
- Tailwind responsive behavior: <https://tailwindcss.com/docs/responsive-design>
- Tailwind dark mode: <https://tailwindcss.com/docs/dark-mode>

## 17. Delivery roadmap and goal prompt map

Work remains sequential. A goal may be split only when its dependencies, contract, and acceptance gates are preserved. Do not begin a later milestone when an earlier P0 dependency is unresolved.

| Master phase | Product outcome | Agent prompt |
|---|---|---|
| M1 | Verified authentication, public journey, error, tenant-scope, and master-data baseline | `prompts/00_M1_ENTRY_GATE_REVIEW.md` |
| M2-G1 | Simple shell, six navigation groups, top bar, role-aware discovery | `prompts/01_M2_G1_SHELL_NAVIGATION.md` |
| M2-G2 | Shared pages, tables, filters, forms, overlays, theme and responsive/accessibility behavior | `prompts/02_M2_G2_SHARED_PAGE_PATTERNS.md` |
| M3-G1 | Role home and My Work | `prompts/03_M3_G1_ROLE_HOME_MY_WORK.md` |
| M3-G2 | Vacancy request and approval workflow | `prompts/04_M3_G2_VACANCY_REQUESTS.md` |
| M3-G3 | Vacancy ownership, reassignment, and targets | `prompts/05_M3_G3_VACANCY_OWNERSHIP_TARGETS.md` |
| M3-G4 | Jobs, vacancies, applications, and explicit pipeline transitions | `prompts/06_M3_G4_JOBS_APPLICATION_PIPELINE.md` |
| M3-G5 | Candidate directory and Candidate 360 | `prompts/07_M3_G5_CANDIDATE_360.md` |
| M3-G6 | Interviews, calendar, offers, and joining | `prompts/08_M3_G6_INTERVIEWS_OFFERS_JOINING.md` |
| M4 | Governed Talent Pool | `prompts/09_M4_TALENT_POOL.md` |
| M5-G1 | Structured CV Bank/profile and parsing review | `prompts/10_M5_CV_BANK_STRUCTURED_PROFILE.md` |
| M5-G2 | XLSX import/export and master-data code integrity | `prompts/11_M5_XLSX_IMPORT_EXPORT.md` |
| M6 | Explainable human-controlled matching | `prompts/12_M6_EXPLAINABLE_MATCHING.md` |
| M7 | Approved asynchronous operations and integrations | `prompts/13_M7_APPROVED_INTEGRATIONS.md` |
| M8 | Verified reports, settings, roles, and audit | `prompts/14_M8_REPORTS_SETTINGS_AUDIT.md` |
| M9-M10 | Hardening, rehearsal, release certification | `prompts/15_M9_M10_HARDENING_RELEASE.md` |

Run `prompts/REVIEW_PHASE.md` after every implementation goal and before calling it closed.

## 18. Universal execution standard

Every agent must:

1. Read `AGENTS.md`, the master plan, this blueprint, the assigned prompt, current `task_plan.md`, `findings.md`, `progress.md`, and all source/contracts/tests/configuration relevant to its goal.
2. Inspect the dirty worktree and preserve all unrelated user work. No reset, checkout, clean, or destructive operation.
3. Reconcile document claims with the exact source. Implement only what is missing or defective.
4. Preserve routes, deep links, query parameters, API contracts, workflow rules, authentication, authorization, validation, tenant isolation, and audit behavior unless an approved contract change is necessary.
5. Use existing capabilities before adding dependencies. Record any proposed dependency, migration, data contract, or user-visible behavior change.
6. Use isolated local/test/staging data only. Never run destructive operations against production.
7. Test the role allowed to act and a role/tenant that is forbidden; test direct URLs as well as visible controls.
8. Verify light/dark themes, relevant responsive widths, keyboard paths, focus behavior, accessible names, errors, and loading/empty states for changed UI.
9. Run the repository commands actually available for the change. Never claim a pass without command evidence; investigate failures and distinguish pre-existing failures from regressions.
10. Update `task_plan.md`, `findings.md`, and `progress.md` with exact scope, evidence, commands, failures, risks, rollback notes, and the next gate.

## 19. Independent reviewer standard

A reviewer is not a documentation editor. The reviewer must inspect the diff and relevant source, replay key user flows with controlled data, verify contract/security boundaries, run proportionate checks, and report findings by severity. A goal is closed only if all required acceptance criteria and release gates pass with evidence. Visual screenshots alone are never sufficient.

## 20. Definition of a coherent RecruitFlow experience

RecruitFlow is coherent when a user can understand where to start, what is assigned, what decision is needed, who owns each vacancy, whether targets are being met, and why a candidate is being considered—without navigating a dense admin menu or trusting unexplained metrics. The same record remains truthful across its list, detail page, activity timeline, notifications, reports, exports, permissions, and audit trail.
