# RecruitFlow Frontend Simple System Plan

Created: 2026-09-01
Status: ACTIVE frontend redesign authority
Scope: `apps/web`, `packages/design-system`, and frontend-facing contracts only

This document replaces the retired frontend rebuild plan, UX workflow blueprint, phase execution plan, design workflow review, generated UI prototype pack, and uploaded design-image folder. Keep the repository focused on this plan plus the product, architecture, security, and data authorities.

## 1. Goal

Build a simple Odoo-inspired recruiting operations frontend that is easy for employees, managers, recruiters, and administrators to use every day.

The frontend must make the hiring lifecycle obvious:

Request -> Approval -> Job -> Applicants -> Interviews -> Offer -> Joining

Use Odoo as a workflow reference, not as a source-code or visual clone. RecruitFlow remains stricter on tenant scope, role permissions, consent, audit evidence, and human decision control.

Official workflow references:

- Odoo 19 Recruitment overview: https://www.odoo.com/documentation/19.0/applications/hr/recruitment.html
- Odoo 19 job positions: https://www.odoo.com/documentation/19.0/applications/hr/recruitment/new_job.html
- Odoo 19 applicants: https://www.odoo.com/documentation/19.0/applications/hr/recruitment/add_applicants.html
- Odoo 19 interviews: https://www.odoo.com/documentation/19.0/applications/hr/recruitment/schedule_interviews.html
- Odoo 19 offers: https://www.odoo.com/documentation/19.0/applications/hr/recruitment/offer_job_positions.html
- Odoo 19 reporting: https://www.odoo.com/documentation/19.0/applications/hr/recruitment/application_analysis.html

## 2. Authority Order

When documents disagree, use this order:

1. `docs/development/PROJECT_EXECUTION_PLAN.md`
2. `docs/development/PROJECT_MILESTONES.md`
3. `docs/development/AI_EXECUTION_PLAYBOOK.md`
4. This plan
5. `docs/design-system/enterprise-product-direction.md`
6. `docs/design-system/enterprise-visual-identity.md`
7. `docs/reference/planning/README.md` and the five supplied planning documents
8. Current source code and typed API/contracts

Historical frontend reports may be used as evidence only. They are not active planning authority.

## 3. Non-Goals

- Do not build payroll, full HRMS, ERP, job-board integrations, WhatsApp/SMS, or autonomous AI screening.
- Do not create design labs, screenshot galleries, prototype HTML pages, fake maintenance pages, or demo-only routes.
- Do not add new visual systems, component libraries, animation libraries, or theme families.
- Do not hardcode tenant names, workspace names, candidates, interviews, offers, or report values in production surfaces.
- Do not move a candidate or applicant stage from the browser only. Workflow transitions must use approved server/API rules.
- Do not claim compliance, RLS, AI, storage, or document security unless the implementation and evidence exist.

## 4. Navigation Model

Use one small product sidebar. Deep detail and create pages remain routable, but they should not become top-level sidebar items.

Primary destinations:

| Sidebar item | Route intent | Main users |
|---|---|---|
| Home | Dashboard, My Work, assigned actions, SLA risks | All authenticated users |
| Jobs | Vacancy requests, approvals, open jobs, applicants by job | Employee, Manager, Admin |
| Candidates | Candidate directory, candidate 360, CV bank/import, talent pools | Admin, Recruiter |
| Interviews | Interview list, calendar, scorecards, feedback | Manager, Admin, Interviewer |
| Offers & Joining | Offer preparation, approvals, signed offers, joining readiness | Manager, Admin |
| Reports | Hiring funnel, source, velocity, SLA, workload | Admin, authorized managers |
| Settings | Master data, stages, users/roles, integrations, audit | Admin |

Topbar responsibilities:

- Global search
- Quick create for allowed actions only
- Notifications
- Theme toggle
- Help or documentation entry when approved
- Account and organization switcher from real auth/session data

Remove hardcoded workspace labels from the shell. Display organization, role, and environment only from the authenticated session or typed config.

## 5. Page Contracts

Each product page must answer five questions without requiring another document:

- Who owns this page?
- What object is being worked?
- What is the current status?
- What is the next allowed action?
- What evidence or history explains the decision?

Required page shape:

| Page | Required structure |
|---|---|
| Home | Assigned work queue, urgent approvals, upcoming interviews, open hiring risks, compact KPI strip |
| Jobs | Job-position-first list with status, owner, department, SLA, applicant count, next action |
| Job detail | Tabs: Overview, Applicants, Interviews, Offers, Activity |
| Applications | Table or board grouped by real stage, with explicit allowed transition controls |
| Candidates | Directory with filters, consent/document indicators, source, duplicate warning, last activity |
| Candidate 360 | Identity header, application history, CV/doc metadata, interviews, offers, timeline, notes |
| Interviews | Calendar/list switch, timezone, participants, scorecard status, conflict recovery |
| Offers & Joining | Offer status, approvals, signed/declined terminal state, joining checklist |
| Reports | Question-led filters, graph plus table fallback, export rules, no fake metrics |
| Settings | Versioned configuration, impact preview, validation, audit trail |

## 6. UI Rules

- Use compact operational SaaS layouts: lists, tables, tabs, split detail panels, drawers, and workflow rails.
- Cards are allowed for metrics, repeated summaries, and decisions. Do not turn every section into a card wall.
- Use the shared design system first: `Button`, `Input`, `Badge`, `Card`, `DataTable`, shell primitives, tokens, and existing icon wrapper.
- Use only approved icon names. If an icon does not exist in `IconName`, map it in the icon contract before using it.
- Keep primary action blue. Status colors must include text/icons, not color alone.
- Support Light and Dark only.
- Respect the 8px spacing grid, 6-8px control/card radius, visible focus rings, and 44px minimum interactive targets.
- Design for 1440, 1280, 1024, 768, 430, and 375px.
- Every route needs loading, empty, error, forbidden, stale, validation, pending, success, and retry behavior where applicable.

## 7. Security and Data Rules

- Browser visibility is not authorization. Backend/API enforcement remains required.
- Every request uses tenant/org scope from the authenticated session.
- Role-specific UI must match route/API permissions.
- Candidate documents are metadata-first until reviewed private storage, malware scanning, retention, and access logging exist.
- Consent and audit events must remain visible in candidate, application, offer, and joining workflows.
- AI can assist only after approved product/security decisions. It must not auto-rank, auto-reject, or hide decision criteria.

## 8. Delivery Plan

### Phase 0: Stabilize and Reconcile

Output:

- Current frontend build compiles.
- `typecheck` script checks the real app project, not only the empty root reference file.
- API contracts, page props, enum values, icon names, and imports are aligned before more visual work.

Required checks:

- `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit`
- `pnpm --dir apps/web build`
- `pnpm --dir apps/web check:design-tokens`

Exit gate:

- No TypeScript build errors.
- No hardcoded production sample data in shell/page chrome.
- No new routes without owner, permission, data contract, and state matrix.

### Phase 1: Shell and Navigation

Output:

- One sidebar using the seven primary destinations in this plan.
- Role-aware visibility from the auth/session contract.
- Topbar search, quick create, notifications, theme, and account controls.
- Mobile drawer and collapsed rail use the same navigation source.

Exit gate:

- Sidebar items map only to real product routes.
- Hidden items remain protected by router/API permissions.
- Keyboard, focus restoration, reduced motion, and responsive behavior are verified.

### Phase 2: Jobs to Applicants Vertical Slice

Output:

- Vacancy request, approval, job list, job detail, and applicants flow work as one story.
- Job detail owns the hiring pipeline context.
- Application stage movement uses server-approved transitions.

Exit gate:

- Employee can request a vacancy.
- Manager can approve/request changes/reject with evidence.
- Admin/recruiter can open the job, review applicants, and advance/refuse through allowed stages.

### Phase 3: Candidate to Interview to Offer

Output:

- Candidate 360, interview scheduling, scorecard capture, offer preparation, offer approval, and joining readiness are connected.
- The user can always see owner, SLA, status, decision evidence, and next action.

Exit gate:

- Interview and offer pages do not invent fields outside typed contracts.
- Offer decisions are auditable.
- Joining is shown only after the signed/approved state.

### Phase 4: Advanced Operations

Output:

- CV bank/import, duplicate review, talent pool, reports, settings, audit, integrations, and public candidate portal are implemented or explicitly deferred.

Exit gate:

- Advanced pages are contract-backed.
- Reports have real filters and table alternatives.
- Settings show draft/published configuration and audit trail.

## 9. Acceptance Checklist

Before marking a frontend task done:

- Build and app-level TypeScript checks pass.
- Design-token check passes.
- No stale imports, dead routes, or duplicate navigation entries remain.
- Page has owner, object, status, next action, and evidence.
- Page supports loading, empty, error, forbidden, retry, pending, and success states where applicable.
- Light, Dark, desktop, tablet, and mobile behavior were checked.
- Permission behavior is verified at route and action level.
- No retired reference/prototype files are used as implementation input.

## 10. Documentation Policy

This is the only active frontend redesign plan. Keep old screenshots, generated prototype pages, retired frontend roadmaps, and one-off enhancement notes out of the active documentation tree.

Preserve:

- Product execution plan
- Milestones
- AI execution playbook
- Architecture docs
- Design-system text docs
- Supplied planning pack
- Audit/evidence reports that are clearly historical

Do not preserve duplicate visual north-star documents when their useful decisions have been folded into this plan.
