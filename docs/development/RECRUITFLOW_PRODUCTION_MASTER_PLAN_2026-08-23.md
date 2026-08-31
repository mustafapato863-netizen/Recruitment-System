# RecruitFlow — Perfect Production Version Master Plan

Date: 2026-08-23  
Status: Ready for review and phased execution  
Product boundary: Enterprise Recruitment Operations / Applicant Tracking System (ATS)  
Repository: `D:\Projects\Recruitment Workflow System`

## 1. Purpose

This is the authoritative execution plan for turning the current RecruitFlow source into a coherent, secure, supportable, production-ready, and commercially sellable Recruitment Operations platform.

It does not authorize a rewrite, a second demo application, a static prototype, a ZIP-based replacement, or uncontrolled changes to business logic. It coordinates the existing React, NestJS, Prisma/PostgreSQL, Redis/BullMQ, shared-contract, test, and CI assets into one production program.

## 2. Target outcome

RecruitFlow must support one complete, traceable hiring lifecycle:

`Demand → Vacancy Request → Approval → Opening → Candidate Intake/Talent Match → Application → Screening → Interview → Decision → Offer → Pre-Hire → Joining → Analytics/Audit`

The product is ready for paid pilots only when this lifecycle works for every authorized role, in both themes and all supported viewport sizes, with current-version deployment evidence, no fabricated product data, no workflow dead ends, and no unresolved P0 release risk.

## 3. Product positioning

### In scope

- Multi-tenant recruitment operations.
- Requisition and approval governance.
- Vacancy/opening management.
- Candidate identity, CV intake, applications, and talent pools.
- Explainable recruiter-assist matching.
- Pipeline, interviews, scorecards, offers, pre-hire, and joining.
- Tasks, notifications, reports, administration, and audit.
- Calendar, email, HRIS handoff, job-board, and webhook integrations after their contracts are approved.
- Commercial tenant onboarding, user invitations, recovery, licensing, privacy controls, support, and production operations.

### Out of scope unless separately authorized

- Payroll.
- Attendance and shifts.
- Leave management.
- Benefits administration.
- Full employee self-service/manager self-service.
- Performance management.
- Regional statutory payroll processing.
- A full ZenHR replacement.

RecruitFlow should integrate with a customer's HRIS/payroll system and compete as the recruitment layer first.

## 4. Current exact-source position

The repository already contains substantial implementation work:

- React 19 + Vite 8 frontend with route-level lazy loading.
- NestJS 11 API with organization-scoped services and RBAC guards.
- Prisma 6/PostgreSQL data layer and forward migrations.
- Shared contracts and validation packages.
- Light/dark semantic token system and protected UI Components Showcase.
- Candidate, applications, vacancies, interviews, offers, hiring, joining, tasks, notifications, reports, audit, administration, Talent Pool, and CV intake routes.
- Talent Pool list/detail routing, create pool, add candidate, remove candidate, and candidate navigation.
- Candidate fields for skills, experience years, and location.
- Redis/BullMQ worker package, currently a runtime skeleton rather than a production job system.
- CI gates for PostgreSQL, migrations, seed, design tokens, lint, typecheck, build, bundle budgets, dependency audit, database/security checks, and browser/accessibility matrix.

Historical P0 and visual work must be preserved. Historical pass claims are evidence pointers, not proof of the exact source used for a future release candidate.

## 5. Non-negotiable implementation rules

1. Preserve user-owned dirty-worktree changes.
2. Do not reset, replace, or broadly reformat the repository.
3. Contract changes require an explicit shared-contract update, validation update, API update, frontend update, migration decision, compatibility note, and tests.
4. Schema changes require forward-only migration design, data preservation, indexing review, upgrade verification, recovery/rollback planning, and tenant-integrity tests.
5. Server-side authorization is authoritative; hiding a frontend action is not permission enforcement.
6. No protected or sensitive demographic attribute may influence talent recommendations.
7. No recommendation may automatically reject, advance, contact, or create an application for a candidate.
8. No page is complete without loading, empty, error, retry, forbidden, not-found, and responsive behavior where applicable.
9. No phase is complete from screenshots alone.
10. No dependency is added without an ADR covering need, alternatives, security, maintenance, and bundle/runtime impact.
11. Light and Dark are release surfaces; both require functional, contrast, and responsive evidence.
12. The static UI reference remains a reference only and must not become a production runtime dependency.

## 6. Priority model

### P0 — Release blockers

- Broken authentication, authorization, tenant isolation, navigation, routes, API contracts, validation, or workflow transitions.
- Fabricated or substituted business data.
- Inaccessible critical journeys.
- Missing mobile access to required actions.
- Data-loss or migration risk.
- Secret exposure, unsafe upload, IDOR, high/critical dependency risk, or deployment version skew.
- No tested recovery path for production data.

### P1 — Sellable product requirements

- Complete core recruitment workflows.
- Consistent design system and information architecture.
- Talent Pool lifecycle and structured CV data.
- Explainable deterministic matching.
- Real integrations required by paid pilots.
- Commercial onboarding, invitations, recovery, support, audit, and operational readiness.

### P2 — Differentiation and polish

- Semantic matching and advanced recommendations.
- Localization/RTL.
- Candidate portal and advanced communications.
- Workload optimization, configurable SLAs, product analytics, and self-service billing.
- Secondary animations and non-critical visual refinement.

## 7. Definition of Ready

A work item may enter implementation only when it has:

- Named user and business outcome.
- Current route/API/schema evidence.
- Protected business rules and permissions.
- Input/output contract.
- Loading, empty, error, and permission state expectations.
- Responsive and accessibility expectations.
- Test plan and evidence path.
- Migration and rollback/recovery decision.
- Dependency decision.
- Explicit out-of-scope notes.

## 8. Definition of Done

A work item is done only when:

- Acceptance criteria are satisfied on the exact source.
- API, validation, permissions, tenant scope, and audit behavior are verified.
- Typecheck, lint, tests, build, and relevant targeted checks pass.
- Keyboard, focus, reduced motion, contrast, and responsive behavior are verified.
- Error, retry, duplicate-submit, and destructive-action behavior are verified.
- Documentation, contracts, migrations, and planning evidence are updated.
- Remaining risks and manual-test requirements are recorded.
- No unrelated user change is overwritten.

## 9. Target production architecture

```text
Browser / RecruitFlow Web
        |
        | HTTPS, secure cookies, correlation ID
        v
RecruitFlow NestJS API
        |
        +--> PostgreSQL / Prisma        (transactional truth, tenant-scoped data)
        +--> Redis / BullMQ             (jobs, retries, schedules, deduplication)
        +--> Private Object Storage     (CVs/documents, signed access, retention)
        +--> Provider Adapters          (email, calendar, HRIS, job boards, webhooks)
        +--> Audit / Observability      (logs, metrics, traces, alerts)
                    |
                    v
             RecruitFlow Worker
             parsing, sync, notifications, scheduled matching, retry/dead-letter
```

The API remains the permission and business-rule boundary. The worker executes asynchronous jobs using organization-scoped payloads and idempotency keys. Provider credentials never reach the frontend.

## 10. Master execution map

| Phase | Name | Priority | Depends on | Exit position |
|---|---|---:|---|---|
| M0 | Baseline truth and branch discipline | P0 | — | Reproducible candidate baseline |
| M1 | Functional integrity and trust | P0 | M0 | No broken or misleading sold workflow |
| M2 | Shell and design-system closure | P0/P1 | M1 | Coherent accessible UI foundation |
| M3 | Core recruitment workflow completion | P1 | M1–M2 | Full traceable hiring lifecycle |
| M4 | Talent Pool foundation | P1 | M1–M3 | Complete pool operations and consent controls |
| M5 | Structured CV and sourcing requirements | P1 | M4 | Reliable data for matching |
| M6 | Explainable talent matching | P1/P2 | M5 | Human-reviewed recommendations |
| M7 | Integrations and asynchronous operations | P1/P2 | M1, M3, M5 | Reliable provider and job operations |
| M8 | Analytics, administration, and commercial controls | P1 | M3–M7 | Operable paid-pilot product |
| M9 | Non-functional production hardening | P0/P1 | Continuous; closes after M8 | Secure, observable, recoverable runtime |
| M10 | Release certification and launch | P0 | M0–M9 | Approved pilot/GA release candidate |

---

# M0 — Baseline Truth and Release Discipline

## Objective

Create a protected, reproducible baseline before further cross-system changes.

## Work items

### M0.1 Worktree protection

- Record current branch, commit, modified files, untracked files, and running local services.
- Identify user-owned changes and overlapping files.
- Create an approved `codex/` implementation branch or equivalent safe checkpoint when authorized.
- Do not delete backup/reference/test artifacts until ownership and import status are proven.

### M0.2 Source-of-truth map

- Inventory every production route, permission gate, API endpoint, DTO, shared contract, service, Prisma model, migration, worker entry, test command, and CI gate.
- Mark every capability as Implemented, Partial, Placeholder, Reference-only, or Deferred.
- Replace contradictory completion claims with one current-state matrix.

### M0.3 Reproducible baseline

- Install from lockfile.
- Validate Prisma and generated client.
- Run lint, typecheck, tests, build, dependency audit, bundle budget, database/security suites, and browser matrix.
- Record exact commands, environment, commit, results, and evidence paths.
- Diagnose the observed Node/Vitest memory exhaustion if it reproduces; do not hide it by claiming a pass from an earlier run.

### M0.4 Environment contract

- Separate Local, Test, Staging, and Production configuration.
- Validate required variables at startup.
- Define safe defaults only for local development.
- Document secrets ownership, rotation, and emergency revocation.

## Exit criteria

- One exact-source baseline report.
- One active roadmap.
- All failures classified by priority and owner.
- No production implementation begins with an unknown or unreproducible baseline.

---

# M1 — Functional Integrity and Product Trust

## Objective

Eliminate broken, misleading, unauthorized, or operationally unsafe behavior.

## Work items

### M1.1 Authentication and sessions

- Login, logout, refresh, expiry, lockout, password visibility, and safe errors.
- Password reset and email verification contracts.
- User invitation acceptance.
- Session revocation and password-change invalidation decision.
- Production cookie, CORS, CSRF, proxy, JWT expiry, and secret requirements.

### M1.2 Authorization and tenant isolation

- Route/action permission matrix for Recruiter, Hiring Manager, Interviewer, Approver, HR Manager, Administrator, and restricted/read-only roles.
- Enforce organization scope in repositories/services.
- Verify 401/403/404 safe-disclosure behavior.
- Test IDOR for every detail and mutation endpoint.

### M1.3 Contract integrity

- Reconcile shared contracts with frontend interfaces and API responses.
- Remove page-local duplicate types where a shared contract exists.
- Standardize pagination, dates, nullable fields, error envelopes, and list metadata.
- Preserve route names, deep links, request payloads, and workflow rules unless a reviewed versioned change is required.

### M1.4 Product truth

- Remove fabricated values, fallback counts, static trends, implied integrations, and unsupported security/compliance claims.
- Display real zero, unavailable, not configured, metadata-only, or demo-labeled states.
- Ensure every metric names its time range and source.

### M1.5 Error and mutation safety

- Safe error mapper; never expose raw backend/database messages.
- Loading and duplicate-submit guards.
- Recoverable retry behavior.
- Confirmations for delete, reject, archive, cancel hiring, remove candidate, and destructive workflow transitions.
- Unsaved-change protection for long forms.

### M1.6 Route/action integrity

- Verify every sidebar, breadcrumb, tab, card, row, notification, quick-create, and empty-state action resolves to a real authorized destination.
- Hide or complete inert actions such as an unimplemented Edit Pool button.
- Verify refresh/deep-link/browser-back behavior.

## Exit criteria

- No fake data or unsupported claim on sold routes.
- No inert primary/secondary action.
- All API/frontend contracts compile from shared types where appropriate.
- Auth, tenant, RBAC, IDOR, and critical mutation checks pass.
- Every route has valid unauthorized, forbidden, not-found, and failure behavior.

---

# M2 — Product Shell and Design-System Closure

## Objective

Finish one coherent, premium, accessible enterprise interface without changing business behavior.

## Work items

### M2.1 Token authority

- Consolidate colors, surfaces, text, borders, shadows, radius, typography, spacing, focus, motion, z-index, and responsive conventions.
- Reduce legacy hard-coded utilities within the design-token budget to an approved target, then make the stricter target a CI gate.
- Document Light/Dark component surface hierarchy.

### M2.2 Shell and navigation

- Sidebar: compact enterprise width, six clear groups, distinct icons, visible active indicator, balanced density, collapsed tooltips, keyboard navigation, and a complete mobile drawer.
- Top bar: breadcrumbs, workspace search, permission-aware Quick Create, notification access, theme control, and account context without duplicating page actions.
- Six groups: Command Center, My Work, Hiring, Talent, Insights, Administration.
- Distinct Lucide icons; no mixed icon libraries.
- Strong active, hover, focus, collapsed, tooltip, and mobile-drawer states.
- Make Interview Calendar clearly discoverable.
- Account menu owns Profile, Settings, theme, and sign-out.
- Search and Quick Create expose only real authorized actions.

### M2.2a Theme, canvas, and login experience

- Persist Light/Dark/System preference through the approved preference mechanism.
- Light uses calm neutral surfaces, restrained blue atmosphere, subtle static waves/geometry, and low-opacity decoration that never competes with data.
- Dark uses dedicated midnight/navy surfaces, restrained indigo/blue atmosphere, readable tables, quiet borders, and no neon treatment or pure-black inversion.
- Support controlled Standard Workspace, Dashboard/Analytics, Detail, and Empty/Landing background variants.
- Decorative layers are non-interactive, ignored by assistive technology, static by default, and reduced/removed under reduced motion.
- Login uses the premium two-column experience on desktop and a simplified focused form on smaller screens.
- Login security copy must match real authentication behavior; development account helpers remain development-only.
- Verify password visibility, pending, invalid-credential, locked, expired-session, and environment-safe development states.

### M2.3 Shared components

- PageFrame/PageHeader.
- Button/IconButton.
- Input/Select/Textarea/Checkbox/Radio/FormField/FormSection.
- DataToolbar/FilterChips/DataTable/ResponsiveDataView/Pagination.
- StatusBadge/PriorityChip/MetricCard/PersonCell.
- Modal/Drawer/ConfirmDialog/Popover/Menu/Tabs.
- PageState/Skeleton/Alert/Toast.
- DetailSummary/ActivityTimeline/PipelineBoard/Scorecard.

### M2.4 Overlay correctness

- Keep shared Modal rendered through a document-level portal.
- Verify focus trap, focus restoration, Escape, outside click, scroll locking, nested overlay policy, and mobile long-form actions.
- Replace browser-native confirmation where richer consequence and focus behavior are required.

### M2.5 Motion policy

- 120–280ms functional motion only.
- ClickSpark only on approved Login/Notification surfaces and the explicit design-system demonstration.
- Disable non-essential effects for reduced motion and mobile where needed.
- No continuous decorative animation on operational pages.

### M2.6 Responsive and accessibility system

- Required widths: 375, 430, 768, 1024, 1280, 1440.
- Keyboard navigation, semantic headings, landmarks, labels, ARIA, focus order, focus traps, error announcements, contrast, touch targets, table headers, tabs, menus, and reduced motion.
- Mobile filters move to drawers; required functionality is not hidden.
- Kanban scrolls horizontally; profiles stack; tables use compact records or controlled horizontal scroll.

### M2.7 UI Components Showcase

- Every approved component, state, size, theme, responsive pattern, usage rule, and accessibility note.
- Showcase examples must use semantic tokens and source-owned components.
- Showcase is protected/admin-only and never a customer workflow dependency.

## Exit criteria

- Design tokens and component tests pass.
- Shell and component showcase pass both themes and six widths.
- No critical/serious accessibility violation in shell/shared primitives.
- No modal, drawer, menu, or collapsed-navigation positioning/focus defect.

---

# M3 — Core Recruitment Workflow Completion

## Objective

Complete the real hiring lifecycle without dead ends or repeated generic layouts.

## Route-family workstream

| Workspace | Production goal | Required completion evidence |
|---|---|---|
| Login | Fast, credible, environment-safe authentication | Auth states, mobile, dark, keyboard, no production dev credentials |
| Command Center | Decision support and action prioritization | Real metrics, funnel, trend, attention, headcount, drilldowns |
| My Tasks | Personal action queue | Search/filter, priority, due/overdue, ownership, related-record navigation |
| Notifications | Cross-system event center | Real unread count, filters, mark read/all, deep links, failures |
| Approval Inbox | Evidence-based decisions | Vacancy/offer/final-hire queues, SLA, context, approve/reject/comments/audit |
| Vacancy Requests | Governed demand intake | Create/edit/draft/submit, validation, approval timeline, pagination |
| Openings/Vacancies | Headcount and sourcing control | Manager, department/position, filled/remaining, SLA, hold/close/open |
| Candidates | Discovery and identity management | Filters/views/columns, Add Candidate, import, permissions, bulk rules |
| Candidate Profile | Context and timeline | Identity, experience, documents, applications, activity, notes, assessments |
| Applications/Pipeline | Controlled workflow movement | Valid transitions, age/SLA, owner, evidence, mobile Kanban |
| Interviews/Calendar | Scheduling and feedback | Agenda/calendar, timezone, interviewer, feedback status, overdue scorecards |
| Offers | Approval and acceptance tracking | Version truth, permissions, expiry/risk, approval, acceptance |
| Pre-Hire/Hiring Cases | Readiness governance | Checklists, documents, owners, final approval, blockers |
| Joining | Confirmed start and handoff | Joining date, readiness, outcome, outstanding work, HRIS handoff state |
| Reports | Decision-grade analytics | Filters/date range/export decision, drilldowns, source truth, permissions |
| Administration | Configuration and traceability | Users/roles, master data, workflows, integrations, audit, validation |

## Cross-workflow requirements

- Every transition records actor, time, reason/comment where required, before/after state, and correlation ID.
- Every approval shows evidence and current revision/version.
- Candidate identity remains separate from application-specific workflow data.
- Offer versions are immutable after submission/approval boundaries.
- Final hiring approval and joining are blocked by explicit missing requirements.
- Notifications and tasks link to the exact related record and action.
- Reports derive from persisted records and expose source drilldowns where feasible.

## Critical E2E journeys

1. Request create → submit → approve → vacancy created/opened.
2. Candidate create/import → application create → pipeline transitions.
3. Interview schedule → reschedule → scorecard submit → hiring decision.
4. Offer create/version → approval → send → accept/decline/expire.
5. Hiring case readiness → final approval → joining outcome.
6. Rejection/request-changes paths at each approval boundary.
7. Duplicate prevention and forbidden-role attempts.

## Exit criteria

- All critical journeys pass through UI and API with dedicated test data.
- No route-family P0 defect.
- No workflow transition bypasses server rules or audit.
- Six-width/two-theme browser checks pass for every major route family.

---

# M4 — Talent Pool Foundation

## Objective

Turn the current pool list/detail implementation into a complete operational talent workspace before recommendation logic is introduced.

## Work items

### M4.1 Contract consolidation

- Use shared `TalentPoolItem`, candidate item, health, detail, pagination, create/update, membership, and filter contracts.
- Remove page-local mismatched interfaces.
- Standardize `updatedAt`, candidate name, pool name, health percentage, pagination, and nullability.

### M4.2 Pool lifecycle

- Create, view, edit, archive/reactivate, and permission-aware delete decision.
- Name, description, tags, owner, status, purpose, and optional vacancy/sourcing-requirement association.
- Audit every lifecycle mutation.

### M4.3 Membership operations

- Add/remove candidates with accessible confirmation.
- Paginated candidate table/records.
- Search, eligibility, consent, source, freshness, location, experience, and skill filters.
- Bulk add/remove only with explicit permission and consequence review.
- Prevent duplicate membership.

### M4.4 Consent and readiness

- Consent status and expiry.
- Cooling-off eligibility.
- Profile freshness and explicit last-contact data; do not infer contact from profile update time once real contact events exist.
- Communication eligibility and retention state.
- Renewal/expiry tasks and notifications.

### M4.5 Saved views and ownership

- Pool owner/maintainer.
- Saved filters/views where operationally valuable.
- Recent additions and recent activity.
- Pool health calculations backed by real data definitions.

## Exit criteria

- Pool list/detail/create/edit/archive/add/remove/search/filter/pagination work for authorized roles.
- Consent and eligibility rules are server-enforced and audited.
- No inert Edit Pool or native-confirm-only destructive action remains.
- Contracts, API tests, UI tests, and browser mutation journeys pass.

---

# M5 — Structured CV and Sourcing Requirements

## Objective

Create reliable, editable, evidence-backed data for candidate matching.

## Work items

### M5.1 Candidate profile model

- Normalize skills and aliases.
- Skill proficiency/years, last used, evidence source, and confidence.
- Employment history with title, company, dates, responsibilities, and calculated duration.
- Education, certifications, languages, location, work authorization where legally appropriate, work model, availability, and compensation preference permissions.
- Preserve the current summary fields for compatibility while introducing structured records safely.

### M5.2 Document and parsing pipeline

- Private object storage.
- File type/size validation and malware scanning.
- Signed upload/download access.
- Queue CV extraction through the worker.
- Parser status, progress, retry, failure, parser version, raw text, extracted evidence, and confidence.
- Human review and correction before data becomes authoritative.
- Retention, consent, deletion, and audit.

### M5.3 Sourcing requirement model

- Link to a vacancy or create an authorized standalone sourcing brief.
- Position, seniority, must-have skills, preferred skills, experience range, location/work model, languages, certifications, availability, and optional permission-controlled compensation range.
- Requirement type: hard gate, weighted preference, or informational.
- Weight validation and version history.
- Owner, status, created/updated actor, and audit.

### M5.4 Data quality

- Duplicate skill aliases and title taxonomy.
- Required evidence for critical extracted fields.
- Freshness and confidence indicators.
- Manual correction history.
- Reparse behavior when parser versions change.

## Migration strategy

- Additive models/columns first.
- Backfill from existing candidate skills/experience/location without deleting old fields.
- Dual-read/compare during transition.
- Cut over only after parity and tenant-integrity checks.
- Remove deprecated fields only in a separately approved future migration.

## Exit criteria

- Structured candidate and requirement data can be created, edited, audited, and queried.
- CV processing runs asynchronously with visible status and safe retries.
- Parser errors never create silently authoritative data.
- Storage, scanning, access, retention, and tenant isolation pass security review.

---

# M6 — Explainable Talent Matching

## Objective

Recommend relevant candidates without making autonomous hiring decisions.

## Matching sequence

`Requirement → Hard eligibility gates → Deterministic weighted score → Evidence/gap explanation → Recruiter review → Shortlist/Application`

## Hard gates

- Same organization.
- Active candidate and eligible pool membership.
- Valid consent/retention state.
- Cooling-off rules.
- Existing application duplicate prevention.
- Required certification/work authorization/location constraint only when lawfully collected and explicitly configured.
- Availability constraint when marked mandatory.

## Initial deterministic score

Weights are configurable and versioned. A safe initial policy may include:

- Must-have skill coverage.
- Preferred skill coverage.
- Relevant experience duration.
- Position/title/seniority relationship.
- Location/work-model compatibility.
- Language/certification match.
- Availability.
- Profile freshness and evidence confidence as confidence modifiers, not protected-attribute proxies.

The product must show the formula version and must not present the score as an objective hiring decision.

## Persisted matching records

- Match run ID and organization.
- Requirement/vacancy version.
- Candidate profile version/freshness.
- Engine and policy version.
- Eligibility result and reasons.
- Component scores.
- Total score and confidence.
- Matched evidence and missing requirements.
- Generated time.
- Recruiter action, override/dismiss reason, and eventual outcome.

## User experience

- “Find Talent for Vacancy” primary action.
- Requirement summary and editable filters.
- Ranked candidates with Strong Match, Good Match, Potential Match, and Ineligible/Not Evaluated states.
- Explain “why matched” and “what is missing.”
- Show consent, freshness, availability, source, relevant experience, and evidence.
- Actions: Open Candidate, Shortlist, Add to Pool, Create Application, Save, Dismiss with reason.
- Never create an application without confirmation.

## AI/semantic phase

Only after deterministic matching is stable:

- Semantic skill/title similarity.
- Resume evidence summarization.
- Synonym and related-skill discovery.
- Explanation assistance.

AI output is advisory, versioned, reviewable, and never the sole basis for rejection or advancement.

## Fairness and governance

- Exclude age, gender, nationality, religion, marital status, disability, photo, and other protected/sensitive attributes from scoring.
- Evaluate proxy risk.
- Maintain model/policy cards.
- Monitor score distribution, recruiter acceptance, false positives/negatives, and override reasons.
- Provide administrative configuration and kill switch.

## Exit criteria

- Deterministic results are reproducible for the same input/version.
- Every score has evidence and gaps.
- All automated recommendations require human action.
- Tenant, permission, fairness, audit, and regression tests pass.
- Pilot users accept recommendation clarity in UAT.

---

# M7 — Integrations and Asynchronous Operations

## Objective

Implement reliable provider integrations and turn the worker skeleton into an operational job platform.

## Worker foundation

- Named queues and typed job payloads.
- Organization ID and actor/correlation context.
- Idempotency keys and deduplication.
- Retry policy with exponential backoff.
- Dead-letter handling and operator replay.
- Scheduled jobs and concurrency limits.
- Graceful shutdown and health/readiness.
- Metrics, logs, alerts, and job admin visibility.

## Initial job families

- CV extraction and indexing.
- Email delivery.
- Calendar synchronization.
- Notification fan-out.
- Consent/freshness/SLA reminders.
- Integration sync and webhook processing.
- Scheduled talent rematching after profile/requirement changes.

## Provider order

1. Transactional email.
2. Microsoft 365 or Google Calendar, based on pilot demand.
3. HRIS employee/joining handoff.
4. Job board/career portal.
5. Webhook/API integrations.
6. Background check and e-signature where approved.

## Integration controls

- Encrypted server-side credentials.
- Provider connection/test/revoke.
- Webhook signature verification and replay protection.
- Mapping/version configuration.
- Last sync, next sync, failure reason, retry, and audit.
- No UI claim of “Connected” unless a real verified connection exists.

## Exit criteria

- Worker survives restart and resumes/retries safely.
- Duplicate webhook/job delivery does not duplicate business mutations.
- Provider outage has visible recoverable behavior.
- Secrets, audit, tenant isolation, and operational alerts pass review.

---

# M8 — Analytics, Administration, and Commercial Controls

## Objective

Make RecruitFlow operable by customers and supportable by the vendor.

## Decision analytics

- Hiring volume and stage conversion.
- Time to fill and time in stage.
- Offer acceptance and expiry risk.
- Interview no-show and scorecard completion.
- Source quality and hires by source.
- Recruiter workload and approval SLA.
- Talent Pool rediscovery, recommendation acceptance, hires from pool, and match-to-shortlist conversion.
- Every metric has date range, filters, data definition, permission, and drilldown or documented limitation.

## Administration

- Organization settings.
- Users, invitations, roles, permissions, and access review.
- Master data and controlled deletion/deactivation.
- Pipeline/workflow configuration with versioning and guardrails.
- Integration administration.
- Retention, consent, and privacy settings.
- Audit search/export permission.

## Commercial operations

- Organization provisioning and administrator onboarding.
- Environment-safe demo tenant and deterministic seed.
- Password recovery and invitation lifecycle.
- License/plan enforcement and feature entitlements.
- Trial/billing integration only if self-service SaaS is approved; otherwise contract-managed licensing.
- Support contact, tenant support access policy, and audited support impersonation decision.
- Privacy notice, terms, DPA, retention/deletion requests, and data export process.
- Product help, admin guide, API/integration guide, release notes, known limitations, and support runbooks.

## Exit criteria

- A new pilot tenant can be provisioned without manual database editing.
- Users can be invited, recover access, and receive correct permissions.
- License/entitlement behavior is enforced server-side.
- Support and privacy operations are documented, permissioned, and auditable.
- Reports are truthful and traceable.

---

# M9 — Non-Functional Production Hardening

## Objective

Meet security, reliability, accessibility, performance, and operations requirements for production.

## Security gate

- Threat model and data-flow review.
- Authentication/session/CSRF/CORS/cookie/security-header review.
- IDOR and broken access-control review.
- Tenant isolation and repository-scope enforcement.
- Validation, injection, XSS, upload, SSRF, webhook, and error-leakage review.
- Secrets scanning and dependency/SBOM review.
- Database and object-storage encryption.
- Least-privilege production identities.
- Audit integrity and retention.
- Incident response and credential rotation.

## Reliability gate

- Liveness, readiness, version, migration, database, Redis, storage, and provider health signals.
- Structured logs with correlation IDs and organization-safe context.
- Metrics for request rate, errors, latency, queue depth, failed jobs, provider failures, DB pool, and auth lockouts.
- Alerting with severity, owner, runbook, and escalation.
- Timeouts, retries, circuit-breaker decisions, and graceful degradation.
- Backup schedule, retention, encryption, restore rehearsal, RPO, and RTO.
- Deployment and migration rollback/recovery rehearsals.

## Performance gate

- Bundle budgets and route-level chunk review.
- Remove normal-route loading of PDF/CV parser modules.
- API latency percentiles and slow-query logging.
- Pagination and indexes for every unbounded list.
- Avoid request waterfalls and duplicate polling.
- Table/kanban DOM limits and virtualization decision based on measured data.
- Image/document optimization and signed access.
- Load test critical read and mutation paths with tenant-safe fixtures.

## Accessibility gate

- WCAG 2.1 AA minimum.
- Automated Axe as a guard, not the full audit.
- Keyboard-only critical journeys.
- Screen-reader checks for login, navigation, forms, dialogs, tables, tabs, errors, status, Kanban alternatives, and approvals.
- Contrast in both themes.
- Reduced motion.
- 375/430 mobile touch targets and zoom/reflow.

## Deployment gate

- Immutable build artifacts.
- Staging and production environment parity.
- Managed database, Redis, object storage, TLS/DNS, secrets, and monitoring.
- Migration preflight and deployment sequencing.
- Current-version health endpoint and release metadata.
- Post-deploy smoke tests and automated rollback criteria.
- No stale API can report ready for a frontend requiring newer routes/contracts.

## Exit criteria

- Authorized security review has no open P0/high risk.
- Restore and rollback/recovery rehearsals pass.
- Performance budgets and load targets pass.
- Full accessibility evidence is accepted.
- Monitoring and alert runbooks are exercised in staging.

---

# M10 — Release Certification and Launch

## Objective

Produce an evidence-backed go/no-go decision for paid pilot and later general availability.

## Automated release gates

- Frozen-lockfile install.
- Prisma format/validate/generate.
- Migration deploy/status against an ephemeral database.
- Seed and integrity audit.
- Lint with zero warnings.
- Workspace typecheck.
- Unit and component tests.
- API integration tests.
- Tenant isolation, RBAC, safe disclosure, auth, and IDOR suites.
- Workflow mutation journeys.
- Production build.
- Design-token and bundle budgets.
- Dependency audit and SBOM/secret scan.
- Browser/accessibility matrix.

## Required browser matrix

- Widths: 375, 430, 768, 1024, 1280, 1440.
- Themes: Light and Dark.
- Roles: Recruiter, Hiring Manager, Interviewer, Approver/HR Manager, Administrator, restricted/read-only.
- Routes: Login, Dashboard, Tasks, Notifications, Approval Inbox, Vacancy Requests/Create/Detail, Vacancies/Detail, Candidates/Add/Profile/Documents, CV Intake/Import Review, Talent Pool/List/Detail/Match, Applications/Pipeline/Detail, Interviews/Calendar/Detail/Scorecard, Offers/Create/Detail/Approval, Hiring/Case/Final Approval/Joining, Reports, Users/Roles, Master Data, Pipeline Settings, Integrations, Audit, Profile, modal, drawer, and 404/403/session-expired behavior.

## Required mutation journeys

- Create/submit/approve/reject/request-changes vacancy request.
- Activate/hold/close vacancy.
- Create/import/deduplicate/update candidate.
- Add/remove pool membership and manage consent.
- Create application and valid/invalid stage transitions.
- Schedule/reschedule/cancel interview and submit/lock scorecard.
- Create/version/approve/reject/send/respond to offer.
- Complete/deny final approval and record joining outcome.
- Verify duplicate prevention and forbidden-role attempts.
- Create requirement, run match, inspect explanation, shortlist, and create application with confirmation.

## UAT

- Dedicated pilot organization and users.
- Agreed scenarios and expected outcomes.
- No shared mutable demo fixtures.
- Business-owner sign-off by module.
- Accessibility and support acceptance.
- Known limitations and deferred items approved.
- No unresolved P0 defects.

## Launch sequence

1. Release candidate frozen.
2. Full CI and independent evidence review.
3. Migration and restore rehearsal.
4. Staging deployment and soak.
5. UAT sign-off.
6. Production change approval.
7. Backup and migration preflight.
8. Production deployment.
9. Automated smoke and health/version checks.
10. Monitored stabilization window.
11. Release notes and support handoff.

## Pilot exit criteria

- At least one complete customer hiring cycle succeeds.
- No P0 defect or data-integrity incident.
- Support response and incident processes are exercised.
- Monitoring and backup evidence remain healthy.
- Customer acceptance is recorded.

## General availability exit criteria

- Two successful monitored pilot cycles or an approved equivalent evidence threshold.
- No unresolved high security or reliability risk.
- Capacity, recovery, privacy, support, and upgrade procedures are proven.
- Commercial claims exactly match implemented capabilities.

---

# 11. Test and Evidence Matrix

| Layer | Minimum evidence | Stored evidence |
|---|---|---|
| Static | lint, typecheck, design tokens, diff integrity | CI logs + dated release report |
| Build | web/API/worker production builds, bundle budgets | immutable artifact metadata |
| Database | validate, migration deploy/status, integrity, tenant tests | ephemeral DB logs + migration report |
| Unit/component | business utilities and shared interactive components | test report |
| API integration | success, validation, forbidden, wrong-org, conflict, idempotency | API test report |
| Security | auth, RBAC, IDOR, isolation, secrets, dependencies, upload boundary | security report |
| Browser mutation | critical create/approve/move/schedule/offer/join/match flows | Playwright report/traces |
| Accessibility | Axe, keyboard, screen reader, contrast, reduced motion, reflow | accessibility report |
| Responsive visual | six widths, two themes, route-family captures | dated artifact directory |
| Performance | bundle, Web Vitals, API latency, DB/query, queue/load | performance baseline/report |
| Operations | deploy, health/version, alert, backup/restore, rollback | runbook evidence |
| UAT | role/scenario owner acceptance | signed UAT record |

# 12. Risk Register

| Risk | Priority | Control |
|---|---:|---|
| Extensive dirty worktree causes accidental overwrite | P0 | Baseline manifest, protected branch/checkpoint, narrow patches, no reset |
| Historical pass claims are stale | P0 | Fresh exact-source gates and dated evidence only |
| API/UI contract drift | P0 | Shared contracts, contract tests, pagination/error standards |
| Tenant leakage/IDOR | P0 | Repository scoping, permission tests, independent security review |
| Migration/data loss | P0 | Additive migrations, backup, backfill verification, restore rehearsal |
| Worker/provider duplicates | P0 | Idempotency keys, deduplication, transactions, replay tests |
| CV upload malware/data exposure | P0 | Private storage, scanning, signed access, retention, audit |
| Matching bias or opaque decisions | P0/P1 | Protected-attribute exclusion, explanations, versions, human review, monitoring |
| UI override layers regress design | P1 | Token authority, strict-file migration, visual/component gates |
| Test runner memory instability | P1 | Reproduce, isolate worker/pool configuration, memory baseline, CI monitoring |
| Oversized parser/document bundles | P1 | Worker/server parsing, dynamic import, route budgets |
| Stale service version in deployment | P0 | Versioned readiness, contract compatibility, immutable deployment |
| Unsupported commercial claim | P0 | Capability registry, truthful UI, release/commercial review |

# 13. Execution Protocol

Each implementation turn should take one bounded slice:

1. Read `task_plan.md`, `findings.md`, `progress.md`, and this master plan.
2. Identify one ready item and its dependencies.
3. Inspect exact current source and dirty overlap.
4. Record assumptions and protected behavior.
5. Implement the smallest complete vertical slice.
6. Run targeted checks first.
7. Run required phase gates.
8. Review diff for unrelated changes and contract drift.
9. Update planning files with files changed, commands, evidence, risks, and next item.
10. Mark complete only when acceptance evidence exists.

Parallel work is allowed only for independent files/systems with explicit ownership. Schema/contracts and their consumers are sequenced, not edited concurrently without coordination.

# 14. First Ready Execution Wave

The first implementation wave after plan approval is:

## Wave A — Exact-source baseline and plan reconciliation

- M0.1 through M0.4.
- Produce one current route/API/schema/test/deployment matrix.
- Rerun all baseline commands.
- Reproduce or clear the Vitest memory issue.
- Establish the protected implementation branch/checkpoint.

## Wave B — Remaining P0 integrity defects

- Audit inert actions and route/action failures.
- Reconcile contracts with special focus on Talent Pool and broad selectors.
- Complete mutation confirmation/duplicate-submit/error behavior.
- Add missing mutation E2E coverage.

## Wave C — Talent Pool completion

- Complete M4 before M5/M6.
- Integrate Edit/Archive, pagination, filters, consent/readiness, audit, and browser mutation tests.

No semantic AI matching or new provider integration begins before Waves A–C satisfy their gates.

# 15. Final Product Destination

After M0–M3, RecruitFlow is a controlled UAT recruitment platform with coherent workflows and UI.  
After M4–M8, it is a sellable premium ATS/Recruitment Operations product for paid pilots.  
After M9–M10 and successful pilots, it is ready for general availability within the approved recruitment scope.  
Broader HRMS expansion remains a separate product program.

# 16. Required Phase and Final Deliverables

Every completed phase handoff must provide:

1. Exact objective and acceptance status.
2. Files changed, created, removed, or migrated.
3. Shared contracts/components/tokens changed.
4. API, database, worker, integration, and permission impact.
5. Major UX and workflow changes.
6. Light-mode, dark-mode, login, background, and shell impact where relevant.
7. Responsive and accessibility evidence.
8. Performance and bundle impact.
9. Motion and reduced-motion impact.
10. Dependencies added/removed with rationale and measured impact.
11. Migrations and data backfills with recovery/rollback notes.
12. Commands required for local/staging operation.
13. Tests actually executed and their exact results.
14. Build, bundle, migration, security, browser, and accessibility results.
15. Evidence/artifact paths.
16. Remaining improvements and deferred scope.
17. Risks requiring manual or pilot testing.
18. Next ready work item.

The project remains source-first; no ZIP deliverable is required unless the user explicitly requests one later.
