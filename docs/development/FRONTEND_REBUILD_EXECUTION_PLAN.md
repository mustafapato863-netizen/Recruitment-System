# RecruitFlow Frontend Enhancement and Rebuild Execution Plan

**Created:** 2026-08-31  
**Status:** Planning baseline — implementation starts after M1-G5 independent approval  
**North star:** the approved RecruitFlow/Odoo-inspired compositions in `docs/App Deisgn`, reconciled with `DESIGN_WORKFLOW_REVIEW_2026-08-30.md`  
**Plan size:** 12 frontend stages

## Executive decision

The frontend will be rebuilt incrementally around one coherent product system,
not rewritten as a disconnected visual clone. Existing API contracts,
tenant/RBAC rules, consent, audit, document security, human-controlled
decisions, and deep links remain authoritative. The supplied design images are
the visual and workflow north star only; their sample data and desktop-only
behavior must not be copied into production.

The first confirmed visual defect is scale inflation on Login: a 760px minimum
card, 48px desktop heading, 52px controls, 32px radius, and oversized spacing
stack. Stage 1 therefore includes a scale reset before page-by-page migration.

## Stage map

| Stage | Name | Mode | Primary result |
|---|---|---|---|
| F0 | Evidence baseline and inventory | Audit | Complete route/component/state/scale map |
| F1 | Visual foundation and scale reset | Rebuild | Tokens, typography, density, Login/public baseline |
| F2 | Application shell and navigation | Rebuild | Stable desktop/mobile shell and information architecture |
| F3 | Shared operational components | Rebuild | One reusable system for list/form/kanban/detail/calendar states |
| F4 | Home and command center | Enhance + rebuild | Truthful role-aware dashboard and responsive home |
| F5 | Search, Quick Create, and contextual actions | Enhance | Cross-entity search and context-preserving creation |
| F6 | Jobs and recruitment pipeline | Rebuild | Vacancy-centered requisition, pipeline, and application workspaces |
| F7 | Candidate 360 and interview/offer continuity | Rebuild | Candidate workbench through joining handoff |
| F8 | Talent, CV, import, and sourcing | Enhance + rebuild | Secure CV Bank, intake, imports, pools, and provenance states |
| F9 | Settings and governance | Enhance + rebuild | Users, roles, master data, pipeline settings, audit |
| F10 | Reports, notifications, and public surfaces | Enhance + rebuild | Decision-oriented reports, notification center, career journeys |
| F11 | Accessibility, responsive, performance, and release | Verification | Full matrix, regression, UAT, and rollout evidence |

Each stage is closed independently. A stage is not complete from screenshots
alone: it needs API-backed behavior, permission checks, state coverage, theme
coverage, responsive evidence, keyboard/accessibility evidence, and quality
gates.

## Product-wide design rules

### Big-picture direction

- Calm, compact, operational SaaS interface; use the reference hierarchy and
  workflow sequence without reproducing its static cards or sample values.
- The operational sequence remains vacancy → pipeline → candidate → interview
  → offer → joining.
- Use purposeful List, Form, Kanban, Detail, Calendar, Approval, and Report
  layouts. Do not convert every screen into a card grid.
- Prefer information density that supports recruiter work: clear hierarchy,
  short labels, compact rows, visible status, and predictable actions.
- Use Lucide icons and the existing semantic token system; do not introduce a
  second icon library or design system.

### Scale reset contract

- Establish a compact type scale with readable body text; no global upscaling.
- Login and public pages use content-driven height, not oversized fixed panels.
- Desktop headings generally target 36–42px for page heroes and 24–32px for
  operational page headings; mobile headings reduce proportionally.
- Default controls target 40–48px depending on touch context; 44px remains the
  minimum touch target.
- Use 4/8px spacing increments, with 16–32px page/card padding in ordinary
  operational surfaces.
- Reserve large display typography and generous whitespace for intentional
  marketing/public moments only.
- Define a maximum content width and apply it consistently across pages.

### Truth and state rules

Every page and shared component must handle loading, empty, unavailable, error,
retry, forbidden, not-found, stale, and partial-success states as applicable.
Numbers and charts must identify source event set, definition, date range,
timezone, scope, and refresh/as-of time. No fabricated records, sample counts,
or invented provider states.

### Security and workflow rules

- UI visibility is never the authorization boundary; server authorization stays
  authoritative.
- Preserve tenant and relationship-aware scope on lists, details, search,
  exports, mutations, and downloads.
- Cross-tenant resources use safe 404 behavior; same-tenant forbidden actions
  use stable 403 contracts.
- Vacancy is the context root for its pipeline, interviews, offers, activity,
  and vacancy reports.
- Every consequential transition remains permission-checked, reasoned where
  required, and audited.

## Stage F0 — Evidence baseline and inventory

**Purpose:** establish a reliable starting point before redesigning anything.

Work:

- Inventory all routes, layouts, page families, shared components, tokens,
  local color classes, hardcoded role checks, and duplicated patterns.
- Capture loaded, empty, error, forbidden, modal/drawer, light/dark, and mobile
  examples for Login, Dashboard, Candidates, Vacancies, Applications, CV Bank,
  Reports, Master Data, and shell navigation.
- Measure actual rendered typography, control heights, spacing, card radii,
  content widths, overflow, and cumulative layout shift at all six widths.
- Map every screen to its API source, permission, tenant scope, and expected
  state matrix.
- Record which routes are real, missing, or only represented by static cards.

Exit evidence:

- Route/component/state inventory committed to the planning docs.
- Scale defect list with before screenshots and measured values.
- No source behavior changed in this audit stage.

## Stage F1 — Visual foundation and scale reset

**Purpose:** create the visual language that every later page consumes.

Work:

- Normalize semantic color, typography, spacing, radius, border, shadow,
  motion, z-index, and breakpoint tokens.
- Remove page-local light-only colors and arbitrary size overrides where the
  token can express the intended meaning.
- Define compact display, heading, body, label, table, and metadata typography.
- Define control density variants: compact, default, and touch.
- Rebuild Login using content-driven layout, reduced scale, clear form hierarchy,
  correct focus/error states, and a restrained public-brand treatment.
- Align public job listing/detail/apply surfaces to the same foundation without
  leaking authenticated shell controls.

Exit evidence:

- Token reference and component usage rules.
- Login/public screenshots at six widths and both themes.
- Keyboard and Axe evidence for authentication errors and form states.
- Bundle/design-token/typecheck gates pass.

## Stage F2 — Application shell and navigation

**Purpose:** make movement through the product predictable for every role.

Work:

- Build the six-group information architecture: Command Center, My Work, Jobs
  & Pipeline, Talent & Sourcing, Insights & Performance, Settings & Governance.
- Implement permission-driven navigation, active states, deep-link preservation,
  collapsed desktop rail, mobile drawer, breadcrumbs, top bar, notifications,
  theme control, account controls, and Quick Create entry points.
- Make Interview Calendar directly discoverable.
- Preserve existing route URLs and query parameters unless a migration plan is
  documented.
- Add consistent page title, context, actions, and responsive shell behavior.

Exit evidence:

- Four representative personas verified against the permission matrix.
- Navigation, mobile drawer, keyboard focus, Escape, and deep-link journeys pass.
- No role-name conditionals remain where permission checks are required.

## Stage F3 — Shared operational components

**Purpose:** prevent every page from inventing a different UI pattern.

Standardize and document:

- `PageFrame`, `PageState`, loading/skeleton, empty, unavailable, error, retry,
  forbidden, not-found, stale, and partial-success states.
- `DataToolbar`, filter bar, search input, pagination, table/list,
  `ResponsiveDataView`, Kanban board, detail sections, timeline, status chip,
  SLA badge, metric card, chart alternative, and XLSX export control.
- Modal, drawer, confirmation, unsaved-change, file-upload, toast, and
  `aria-live` feedback patterns.
- Focus trap, initial focus, return focus, Escape handling, internal scrolling,
  reduced motion, and mobile touch target behavior.

Exit evidence:

- Component contract documentation with examples and forbidden usage patterns.
- Existing pages migrated without duplicate primitives.
- Unit tests for state transitions and keyboard behavior.

## Stage F4 — Home and command center

**Purpose:** turn the landing experience into a truthful operational command center.

Work:

- Consolidate `/` and `/dashboard` while preserving deep links and query state.
- Implement role/scope-aware metrics from persisted API data.
- Add definitions, source, date range, timezone, scope, and as-of/refresh detail
  to every metric and chart.
- Show explicit permission/unavailable states with safe retry or next action.
- Provide quick actions tied to the user’s permissions and current work.
- Keep desktop density compact and make mobile priority/order intentional.

Exit evidence:

- Admin, recruiter, manager, and restricted-persona dashboard journeys.
- Loaded, no-data, error, forbidden, and stale states tested.
- Metric calculations reconciled with API/database fixtures.

## Stage F5 — Search, Quick Create, and contextual actions

**Purpose:** reduce navigation friction while preserving context and scope.

Work:

- Expand search to candidates, vacancies, applications, interviews, offers,
  approvals, tasks, notifications, CV records, Talent Pools, and Master Data
  where supported.
- Apply permission and tenant filtering server-side and in result rendering.
- Add keyboard-first search invocation, grouped results, empty/error/loading
  states, and safe deep links.
- Make Quick Create context-aware: creating a candidate from a vacancy retains
  vacancy context; creating an interview from an application retains candidate,
  vacancy, and application context.
- Add unsaved-change and duplicate prevention behavior.

Exit evidence:

- Search fixture matrix by persona and resource family.
- Context-preservation tests for at least vacancy→candidate, application→interview,
  and vacancy→requisition actions.

## Stage F6 — Jobs and recruitment pipeline

**Purpose:** rebuild the core recruiter workflow around vacancy context.

Work:

- Vacancy overview: purpose, status, owner, dates, approvals, publication,
  aging, counts, and next actions with real API state.
- Requisition list/form/detail with approval timeline, current approver, SLA,
  and publication readiness.
- Application pipeline with server-configured stages, filters, pagination,
  keyboard list alternative, drag/action safety, transition reasons, and audit.
- Candidate-in-pipeline actions retain vacancy/application context and respect
  permissions.
- Include clear loading, empty, unavailable, forbidden, and partial-success
  states for each surface.

Exit evidence:

- Vacancy→pipeline→application critical mutation journeys.
- Stage transition, rejection reason, audit, and cross-tenant tests.
- Kanban, list, and mobile alternatives verified.

## Stage F7 — Candidate 360 and interview/offer continuity

**Purpose:** keep the full candidate journey coherent from review to joining.

Work:

- Candidate 360 workspace with identity, applications, vacancy context, CV
  provenance, consent, documents, history, communication, tasks, and blockers.
- Compare-candidate entry points remain human-controlled and evidence-backed.
- Interview calendar/detail with timezone, conflicts, participants, scorecards,
  reminders, and failure/retry states.
- Offer detail/approval with authorized actions, expiry/status, controlled
  communication, and audit.
- Hiring and joining surfaces show readiness and outstanding requirements.

Exit evidence:

- Candidate→interview→offer→hiring/joining journey.
- Permission, consent, document-download, approval, and audit checks.
- Calendar, detail, approval, and mobile layouts tested.

## Stage F8 — Talent, CV, import, and sourcing

**Purpose:** make sourcing operations safe, explainable, and usable.

Work:

- CV Intake review, parser state, provenance, duplicate handling, and retry.
- CV Bank list/detail with consent, freshness, scan/parser/archive state,
  protected downloads, backup-readiness status, and metadata-only XLSX export.
- Bulk Import Center with dataset tabs, templates, inspection, staging,
  validation, duplicate decisions, progress, and downloadable XLSX errors.
- Talent Pool lifecycle, membership, consent, eligibility, health, and audit.
- Keep deterministic eligibility separate from future semantic matching.

Exit evidence:

- Upload/import/review/confirm and protected-download journeys.
- Large-file/error/retry/duplicate/permission states.
- No binary CV content in metadata exports.

## Stage F9 — Settings and governance

**Purpose:** give administrators safe, transparent control without breaking data.

Work:

- Users/Roles: effective permission explanation, scoped visibility, safe role
  mutations, invitation/recovery states, and audit.
- Master Data: list/form, generated codes, edit/archive/restore, reference
  protection, import/export, history, concurrency feedback, and tenant scope.
- Pipeline Settings: server stages, ordering, activation/archive, transition
  requirements, and impact warnings.
- Audit Log: searchable actor/action/entity/result/timestamp/correlation data,
  safe before/after, tenant scope, and XLSX export.

Exit evidence:

- Administrator and restricted-persona mutation journeys.
- Reference-protection, role-scope, audit, and cross-tenant tests.

## Stage F10 — Reports, notifications, and public surfaces

**Purpose:** finish the surrounding product surfaces using the same system.

Work:

- Reports with event-backed definitions, date/timezone/scope/as-of context,
  drill-through, no-data/error states, accessible chart alternatives, and XLSX
  export only.
- Notifications/tasks with unread/read, recipient scope, deep links, retry and
  failure state, and keyboard behavior.
- Public career site/job publishing: approved vacancy workflow, preview,
  publish/schedule/unpublish, channel status, failure/retry, and audit.
- Candidate public apply and authenticated My Applications journeys with safe
  identity, consent, and permitted status/document visibility.

Exit evidence:

- Report accuracy reconciliation and export inspection.
- Notification delivery/state journeys.
- Public/private boundary and candidate self-service tests.

## Stage F11 — Accessibility, responsive, performance, and release

**Purpose:** certify the rebuilt frontend as a product, not a collection of screenshots.

Work:

- Run loaded, empty, unavailable, error, retry, forbidden, not-found, stale,
  partial-success, modal, drawer, and upload states on representative routes.
- Run Light/Dark at 1440, 1280, 1024, 768, 430, and 375px.
- Verify keyboard order, visible focus, headings, labels, ARIA/live regions,
  dialogs, Escape, reduced motion, chart alternatives, color-independent
  status, touch targets, and no horizontal overflow.
- Run typecheck, lint, unit/integration tests, browser matrix, Axe, bundle and
  design-token budgets, and source-quality checks.
- Perform UAT with real role personas and document known deferred items.

Exit evidence:

- Full frontend release matrix with assertion counts and artifacts.
- No open P0/P1 UX, security, tenant, accessibility, or data-truth defects.
- Rollout/rollback note and explicit list of deferred M8+ enhancements.

## Implementation protocol for every stage

1. Audit the current implementation and API contract.
2. Define the affected route, state, permission, responsive, and accessibility
   matrix before editing.
3. Implement shared foundation first; migrate one vertical slice at a time.
4. Verify real API data and failure states before visual polish.
5. Test Light/Dark and the six widths for the affected slice.
6. Run static, unit, browser, security, and bundle checks appropriate to scope.
7. Write a stage report with exact commands, assertion counts, screenshots,
   known risks, and rollback notes.
8. Conduct independent review. Rework failures before advancing.

## Approval and model checkpoints

- M1-G5 independent approval is the prerequisite for F0/F1 implementation.
- Use the high-reasoning model before F1 architecture decisions and again before
  F6–F7, where the core workflow redesign is largest.
- Do not call M2 complete until F0–F5 are approved.
- Do not call the full frontend redesign complete until F6–F11 are approved.

