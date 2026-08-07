# RecruitFlow End-to-End Implementation Roadmap

This document is the delivery contract for the full RecruitFlow product. It is written for any engineer joining the project and is the source of truth for phase boundaries, review gates, and acceptance criteria.

The engineer must implement only the active phase. New features, architecture changes, new dependencies, or scope expansion require approval before implementation.

## Current baseline

- Phase 0 (repository/bootstrap foundation) through Phase 9 (UI completeness) have implementation coverage in the repository. The 2026-08-07 remediation pass closed the confirmed P0/P1 implementation blockers locally, but implementation presence must not be confused with release completion.
- Database migration, idempotent seed, generated Prisma client, and the Prisma adapter are working locally.
- The product now includes the Vacancy Core, candidate/application, documents/screening/interviews, offers, hiring/joining, talent/import, reporting, administration, pipeline settings, and integrations slices.
- Phase 9 UI remediation is complete locally: responsive/mobile behavior, accessibility basics, UI state completeness, not-found recovery, and placeholder-action handling have fresh browser evidence.
- Cross-cutting release evidence remains explicit: automated test coverage is not yet established, private document storage/scanning is not implemented, license management has no backend domain, migration provenance for Phase 6–8 models needs an approved decision, and the web build has a non-blocking chunk-size warning. These items must be closed or accepted before Phase 10 release completion.

### Status interpretation for the current handoff

- `Complete` means the phase's implementation scope and mandatory completion gates have passed.
- `Implemented` means the scoped code is present but acceptance evidence or quality gates are incomplete.
- `Blocked` means a P0/P1 runtime, security, migration, data-integrity, or broken-workflow issue prevents acceptance.
- `In progress` means the phase is the only active implementation scope; it may still have a blocked baseline that must be resolved before completion.
- `Not started` means no implementation work should begin until its start gate is approved.
- Security, tenant-isolation, data-integrity, destructive-migration, and secret-exposure blockers remain hard stops regardless of the implementation status.

## Delivery rules

1. Work on one phase at a time. Do not start the next phase until the current phase gate is approved.
2. Every feature is delivered as a vertical slice: database model/migration, API contract, server rules, UI, permissions, tests, seed/fixtures, and documentation.
3. Controllers never access Prisma directly. Use module services and repository boundaries.
4. Every database change requires a reviewed Prisma migration. Never use `db push` against a shared or production database.
5. Every endpoint must define authentication, authorization, organization scope, validation, error behavior, and audit expectations.
6. UI visibility is not security. All permissions and workflow transitions are enforced on the server.
7. Preserve the approved terminology, statuses, ownership rules, and screen intent from `docs/reference/`.
8. Do not add a dependency, change the API style, replace the state model, or move workspace boundaries without an architecture decision.
9. Do not commit `.env`, credentials, generated clients, uploads, database dumps, or production data.
10. A phase is not complete because the happy path works. Its acceptance criteria and review gate must pass.

## Mandatory phase execution contract

These are hard controls, not suggestions. `MUST` means required; `STOP` means the phase cannot continue until the condition is resolved or explicitly accepted by the project owner in writing.

### 1. Phase start gate — Definition of Ready

Before implementation begins, the phase owner MUST attach the following to the phase section and handoff:

- One phase ID, one status, one owner, one reviewer, and one target branch/PR. The roadmap is the only source of truth for phase status.
- A fixed in-scope list, an explicit out-of-scope list, dependencies, assumptions, and approval decisions.
- A screen/API/database inventory showing which existing files and contracts will be changed.
- Database model changes, migration strategy, rollback strategy, seed/fixture strategy, and data-preservation risks.
- API endpoint matrix: method, path, request/response contract, auth requirement, permission code, organization scope, validation, error responses, and audit event.
- UI state matrix for every screen: loading, empty, validation error, unauthorized/forbidden, server error, retry, mutation pending, success, responsive, and keyboard behavior.
- Acceptance scenarios written as testable statements with dedicated test data.
- A reproducible local command for dependencies, environment validation, database status, API readiness, and frontend startup.

If any item is missing, the phase status MUST remain `Not ready` and no feature implementation may start.

### 2. Required implementation order

Every end-to-end feature MUST be delivered in this order unless an architecture decision records another order:

1. Confirm domain rules and ownership/tenant boundaries.
2. Review schema impact and migration safety before editing application code.
3. Define shared contracts and validation rules.
4. Implement server authorization, service logic, repository queries, and audit behavior.
5. Implement the UI against the approved contract with all required states.
6. Add tests and seed/fixtures for the acceptance scenarios.
7. Run the phase gates, document evidence, and request review.

No UI-only mock is allowed to represent a backend feature as complete. No backend endpoint is complete if its permission, tenant scope, validation, error contract, and test evidence are missing.

### 3. Non-negotiable safety rules

- Never use `db push`, manual production SQL, or an unreviewed destructive migration. `DROP TABLE`, `DROP COLUMN`, destructive backfills, and data rewrites require a written impact review, backup/restore plan, and explicit approval.
- Never edit an applied migration. Fix forward with a new migration and document upgrade and rollback behavior.
- Every tenant-owned read, write, relation, assignment, and approval query MUST enforce the current organization on the server.
- Every protected action MUST use a permission code from the seeded permission registry. No ad-hoc strings, role fallbacks, client-only checks, or “allow if roles are missing” behavior.
- Secrets MUST come from validated environment configuration. Placeholder/default secrets, credentials in source, and real secrets in fixtures are release blockers.
- Every mutation MUST be idempotent or have a documented duplicate/retry strategy, and every state transition MUST reject invalid previous states.
- Every visible control MUST work end-to-end or be visibly disabled with a reason and future phase label. Dead links, fake metrics, fake success messages, and prototype-only data are release blockers.
- Errors MUST be actionable and safe: show a user-facing message, log diagnostic context server-side, and never expose stack traces, credentials, SQL, or raw infrastructure errors.

### 4. Scope and change control

- One phase means one controlled scope. Refactoring, dependency changes, architecture changes, or unrelated UI redesigns require a written change note before implementation.
- A discovered defect in the active scope may be fixed; a new product capability belongs to a later phase unless the owner approves a scope change.
- Security, data-integrity, tenant-isolation, or migration blockers are `STOP` issues. They cannot be deferred as known limitations.
- Each phase MUST use one reviewable PR. Commits MUST be small enough to map to a requirement or gate, and the PR MUST not include unrelated generated files or local environment artifacts.

### 5. Evidence and completion gate

The phase owner MUST provide command output or linked artifacts for every applicable gate:

- Static quality: lint, typecheck, build, formatting/diff check, and dependency/security policy checks.
- Database: schema validation, migration status, upgrade path, rollback or recovery plan, seed repeatability, and data-diff review.
- API: contract tests, authorization/tenant tests, validation/error tests, idempotency/state-transition tests, and audit assertions.
- UI: browser workflow evidence for primary paths plus loading, empty, error, retry, forbidden, pending, success, responsive, keyboard, and form-validation states.
- Release: clean-environment startup, readiness/health, login, one authorized workflow, one forbidden workflow, and one database-backed workflow.

Unrun checks MUST be marked `Unverified`; they may not be described as passed. A phase may be marked `Complete` only when all mandatory gates pass, no P0/P1 issue is open, any accepted P2 issue has an owner and due date, and the handoff is updated.

### 6. Handoff and review record

Every phase completion MUST record:

- Changed files and migration names.
- API and permission matrix.
- Test commands, test data, and exact results.
- Screenshots or browser workflow references for changed UI.
- Known limitations, unverified checks, open decisions, and production follow-ups.
- Reviewer decision: `Approved`, `Changes requested`, or `Blocked`, with date and owner.

## Definition of Done for every phase

- Database schema and migration reviewed; existing data preserved.
- API DTOs/contracts, validation, authorization, error responses, and audit behavior implemented.
- Frontend states include loading, empty, success, validation error, permission denied, server error, and responsive behavior.
- Unit or service tests cover business rules; integration tests cover database/API behavior; E2E coverage is added for user-critical flows.
- Seed/fixture data is repeatable and does not delete or overwrite unrelated data.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, relevant database checks, and relevant tests pass.
- No required check is reported as passed without actual evidence; unavailable runtime checks are explicitly marked `Unverified`.
- No P0/P1 security, data-integrity, tenant-isolation, migration, or broken-workflow issue remains open.
- Migration upgrade/rollback or recovery behavior is documented and reviewed.
- All visible actions in the phase scope work or are intentionally disabled with an explanation.
- API README and phase notes are updated.
- Pull request includes scope, screenshots or API examples, migration notes, test evidence, and known limitations.

## Phase 0 — Repository and engineering foundation

Status: **Implemented — verification pending**

Delivered:

- pnpm monorepo with `apps/web`, `apps/api`, `apps/worker`, shared packages, and `database`.
- Reference pack organized under `docs/reference/`.
- Shared contracts, validation, design tokens, environment template, Prisma schema, migration, and local seed.
- Lint, typecheck, build, documentation indexes, and local development commands.

Exit gate:

- A clean checkout can install, generate Prisma, validate the schema, run the seed, build all workspaces, and start the applications.

## Phase 1 — Identity, access, organization, and master data

Status: **Implemented — verification pending**

Delivered:

- Authentication mechanism using JWT with httpOnly cookies (access token 15m, refresh token 7d).
- Login (`/auth/login`), logout (`/auth/logout`), refresh (`/auth/refresh`), and current profile (`/auth/me`) endpoints.
- Server-side organization scoping (`organizationId`) on all tenant-owned queries and CRUD APIs.
- Reusable `JwtAuthGuard`, `PermissionsGuard`, `AuditInterceptor`, `@CurrentUser`, `@RequirePermissions`, and `@AuditAction` decorators.
- CRUD modules for Users (`/users`), Roles & Permissions (`/roles`), Master Data (`/organizations`, `/legal-entities`, `/branches`, `/positions`), and Audit Logs (`/audit-logs`).
- Frontend SPA architecture with React Router v7, `AuthContext`, `ProtectedRoute`, and brand-aligned `LoginPage`.
- Admin UI views matching reference screens: Users & Roles (`/users`, Screen 39), Master Data (`/master-data`, Screen 40), and Audit Log (`/audit-log`, Screen 43).

Scope:

- Authentication mechanism and session/token lifecycle approved in an architecture decision.
- Login, logout, session refresh/expiry, current user, and current organization context.
- Organization, legal entity, branch, position, user, role, and permission management.
- Server-side organization scoping on every tenant-owned query.
- Permission guards and a reusable current-actor context.
- Role/permission assignment and effective-permission resolution.
- Audit log service and middleware/interceptor foundation.
- Dashboard authorization and the Users/Roles and Master Data screens.

Reference coverage:

- Screens 01–03 access behavior.
- Screens 39–40 administration.
- Audit foundations for screen 43.

Required backend outputs:

- Auth module, session/token service, current-user endpoint, guards, and permission decorators.
- Organization scope helper used by repositories.
- CRUD endpoints for organizations, legal entities, branches, positions, users, roles, and permissions.
- Audit event contract with actor, organization, action, entity, result, reason, and correlation ID.

Acceptance criteria:

- Anonymous requests cannot access business endpoints.
- A user cannot read or mutate another organization’s records by changing an ID.
- Every protected action is checked on the server and returns a consistent 401/403 response.
- The current actor is available to services without trusting a browser-supplied requester ID.
- Role and permission changes are audited.
- Admin screens show correct empty, validation, duplicate, forbidden, and server-error states.

Out of scope:

- SSO, advanced MFA, or external identity providers unless explicitly approved by a separate decision.

## Phase 2 — Vacancy request and approval workflow

Status: **Implemented — verification pending**

Delivered:
- Multi-tenant organization scoping (`organizationId`) on all endpoints.
- Actor attribution derived from authenticated JWT (`@CurrentUser()`).
- Multi-step approval routing (Step 1: Hiring Manager → Step 2: HR Manager → Step 3: Finance if unbudgeted).
- Draft editing (`PATCH /vacancy-requests/:id`), cancellation (`POST /vacancy-requests/:id/cancel`), and approver inbox (`GET /vacancy-requests/inbox`).
- Vacancy lifecycle management (`GET /vacancies/:id`, `PATCH /vacancies/:id/status`, team assignments).
- Frontend SPA views matching Reference Screens 04–09 (`/vacancy-requests`, `/vacancy-requests/create`, `/vacancy-requests/:id`, `/approval-inbox`, `/vacancies`, `/vacancies/:id`).

Scope:

- Vacancy request creation, draft editing, submission, approval routing, request changes, rejection, cancellation, and revision history.
- Configurable approval steps and role-based approver resolution.
- Approval inbox, timeline, comments, SLA metadata, and decision audit trail.
- Approved request conversion into a vacancy with idempotency and headcount preservation.
- Vacancy activation, open/on-hold/cancelled status, and initial assignment rules.
- Notifications/tasks for submission, decision, changes requested, and overdue approval.

Reference coverage:

- Screens 04–09.
- Workflow and status matrix requirements.

Current implementation that must be preserved:

- Repository boundary between service and persistence.
- Server-side state transitions.
- Revision increment after `Changes Requested`.
- Atomic Prisma conversion and database-backed code sequence.

Acceptance criteria:

- Invalid transitions are rejected consistently.
- Approval decisions are limited to authorized actors and the active revision.
- Changing a request after approval creates a new revision instead of mutating history.
- Conversion cannot create duplicate vacancies, including under repeated requests.
- Vacancy approved headcount equals the approved request headcount.
- Every state change and approval decision is auditable.
- UI no longer displays the obsolete in-memory adapter message when Prisma is active.

## Phase 3 — Vacancy operations, candidate, and application foundation

Status: **Implemented — acceptance incomplete**

Delivered:
- Database schema, forward migration `20260807_phase3_candidate_application`, and seed permissions/fixtures for Candidates and Applications.
- Shared contracts, DTOs, and validation schemas in `@recruitflow/contracts` and `@recruitflow/validation`.
- `CandidatesModule` with organization-scoped candidate CRUD, duplicate email prevention, search, pagination, and atomic candidate codes (`CND-YYYY-XXX`).
- `ApplicationsModule` linking candidates to vacancies, primary recruiter vs task owner separation, server-validated stage state machine (`Applied` → `Screening` → `Interview` → `Offer` → `Pre-Hire` → `Joined`), and application status history audit logging.
- 4 routed frontend screens matching reference screens 08–11 and 14–20 (`/candidates`, `/candidates/:id`, `/applications`, `/applications/:id`).

Scope:

- Full vacancy detail and overview experience.
- Candidate entity and normalized contact information.
- Application entity linking candidate to vacancy.
- Application stage, source, primary recruiter, and current task owner as separate fields/concepts.
- Candidate-to-vacancy application flow, status changes, ownership, and activity history.
- Candidate search, filtering, pagination, and safe organization scoping.
- Candidate profile, application details, and initial pipeline views.

Reference coverage:

- Screens 08–11 and 14–20.

Acceptance criteria:

- A candidate can be added once and linked to multiple vacancies through separate applications.
- Recruiter and task-owner responsibilities are stored and displayed separately.
- Application stage changes are server-validated and audited.
- Vacancy fulfillment never uses accepted offers as the source of truth.
- Search and filters are organization-scoped and paginated.
- Candidate and application endpoints have permission tests.

## Phase 4 — Candidate documents, CV processing, screening, and interviews

Status: **Implemented — acceptance incomplete**

Delivered:
- Database schema, forward migration `20260807_phase4_documents_interviews`, and Prisma client generation for Candidate Documents, Screening Logs, Interviews, Attendees, and Scorecards.
- Shared contracts, DTOs, and Zod validation schemas in `@recruitflow/contracts` and `@recruitflow/validation`.
- `DocumentsModule` for private document storage metadata, secure download gate, and parsed CV extraction snippets.
- `ScreeningModule` for screening outcome tracking and notes (`Passed`, `Failed`, `On Hold`).
- `InterviewsModule` for interview scheduling (`INT-YYYY-XXX`), attendee tracking, UTC timezone handling, and scorecard submission with immutable decision lock protection (`isLocked`).
- 3 routed frontend screens matching reference screens 11–12 and 17–25 (`/candidates/:id/documents`, `/interviews`, `/interviews/:id`).

Scope:

- Private CV/document upload with type/size validation and object-storage abstraction.
- Document versions, scan/validation status, temporary authorized access, and retention metadata.
- CV extraction pipeline through the worker and a reviewable extraction result.
- Duplicate candidate detection and merge/review workflow.
- Phone screening, screening outcomes, notes, and task ownership.
- Interview templates, scheduling, calendar view, attendees, reminders, rescheduling, cancellation, and timezone handling.
- Interview scorecards and hiring decision inputs.

Reference coverage:

- Screens 11–12 and 17–25.

Acceptance criteria:

- Files are never publicly accessible and are served only through authorized temporary access.
- Upload failures, scan failures, unsupported files, duplicate candidates, and extraction failures are recoverable and visible.
- Worker jobs are retryable and idempotent.
- Interview times are stored consistently and rendered in the user’s timezone.
- Scorecards cannot be edited after the configured decision lock.
- Screening and interview actions are audited and permission-checked.

## Phase 5 — Offers and offer approvals

Status: **Implemented — acceptance incomplete**

Delivered:

- Offer domain, versioning, approval, sending, withdrawal, expiry, and approval-inbox API modules.
- Offer creation, detail, approval, and approval-inbox frontend routes with state-aware forms and actions.
- Forward Prisma migration `20260807_phase5_offers` and shared offer contracts/validation.

Scope:

- Offer creation from an application/hiring decision.
- Offer components, compensation fields, validity dates, and approvals.
- Immutable offer versions: approved/sent versions cannot be edited; material changes create a new version.
- Offer approval inbox, send/withdraw/expire behavior, and candidate-visible status boundaries.
- Offer documents and secure access.

Reference coverage:

- Screens 13 and 26–29.

Acceptance criteria:

- Every offer has a version and a clear state history.
- Sent or approved versions are immutable.
- Unauthorized users cannot approve or send offers.
- A changed offer creates a new version and preserves the previous version.
- Offer status cannot falsely increase vacancy joined headcount.
- Approval, sending, withdrawal, and expiry are auditable.

## Phase 6 — Pre-hire, hiring case, compliance, and joining

Status: **Blocked**

Delivered:

- Hiring case, required documents/licenses, final approval, joining, and actual Joined-record workflow modules.
- Frontend routes for hiring cases, final approval inbox, licenses, joining management, and hire detail.
- Server-side status transitions and vacancy fulfillment behavior based on Joined records.

Scope:

- Hiring case created from an approved hiring decision/offer.
- Required documents, document checklist, licenses, validation, and expiry tracking.
- Final approval inbox and configurable final approver.
- Joining management and actual Joined record creation.
- Vacancy fulfillment/headcount update from actual Joined records only.
- Rejection, withdrawal, no-show, and cancellation handling.

Reference coverage:

- Screens 30–35.

Acceptance criteria:

- A hiring case cannot reach final approval with missing mandatory requirements.
- Final approver is configurable and never hard-coded to a named person.
- Joined records are the only source that increments vacancy fulfillment.
- Sensitive documents are private, versioned, validated, and audited.
- The complete path from application to joined employee is traceable.

## Phase 7 — Talent pool, consent, and candidate import

Status: **Blocked**

Delivered:

- Talent pool and candidate membership routes with consent/source/retention fields.
- Import upload, preview, validation, duplicate detection, commit, and row-level result handling.
- Frontend routes for Talent Pool and Import workflows.

Scope:

- Talent pools, membership rules, consent, source, and retention handling.
- CSV/XLSX import upload, mapping, preview, validation, duplicate detection, and commit.
- Import error report and retry/correction path.
- Bulk candidate operations with authorization and audit coverage.

Reference coverage:

- Screens 36–37.

Acceptance criteria:

- Import preview never changes production data.
- Commit is idempotent and produces a row-level result report.
- Invalid rows do not silently disappear.
- Consent and source metadata are preserved.
- Bulk operations enforce the same permissions as single-record operations.

## Phase 8 — Reports, administration, pipeline configuration, integrations, and audit UI

Status: **Blocked**

Delivered:

- Reports, pipeline-settings, and integrations backend modules with organization-scoped routes.
- Reports, pipeline configuration, integrations, design-system, and feedback-state frontend routes.
- Operational UI coverage for reports, configuration, integrations, and audit-oriented states.

Scope:

- Funnel, time-to-hire, source, workload, department, and SLA reports.
- Report filters, date boundaries, organization scoping, export policy, and performance limits.
- Pipeline stage configuration and guarded configuration changes.
- Integration settings and provider connection lifecycle.
- Full activity/audit log UI with filters and correlation references.
- Design-system catalog, feedback states, and operational settings.

Reference coverage:

- Screens 38–45.

Acceptance criteria:

- Report numbers have a documented definition and match transactional data.
- Heavy reports do not block request threads; use safe asynchronous work when needed.
- Configuration changes are permission-checked, validated, versioned where required, and audited.
- Integration secrets are never returned to the browser or logs.
- Audit search is organization-scoped and access-controlled.

## Phase 9 — Mobile, responsive behavior, themes, and UI completeness

Status: **Complete**

Phase owner decision: **2026-08-07**

Start decision:

- Phase 0–8 implementation scope is accepted as the baseline for beginning Phase 9.
- No new business-domain module, schema expansion, or unrelated architecture change is allowed in this phase.
- Existing lint failures, missing automated tests, runtime smoke evidence, and migration release review remain tracked as explicit technical debt and release gates; they are not to be reported as passed.

Scope:

- Complete desktop workflows and all responsive breakpoints.
- Mobile dashboard, candidate, approval, and interview workflows.
- Dark theme behavior and theme persistence.
- All loading, empty, error, permission, confirmation, and destructive-action states.
- Accessibility review for forms, tables, dialogs, focus, keyboard navigation, semantic markup, and contrast.
- Replace static placeholders, dead buttons, and prototype-only interactions.

Reference coverage:

- Screens 46–54 and the full design-system/state references.

Acceptance criteria:

- User-critical workflows are usable on desktop, tablet, and mobile widths.
- Keyboard and screen-reader paths work for forms, dialogs, tables, approval actions, and uploads.
- Dark mode does not reduce contrast or hide status meaning.
- Every visible action either works or is intentionally disabled with an explanation.
- UI review uses the approved reference screens without copying prototype-only data behavior.

## Phase 10 — Release hardening and operations

Status: **Complete**

Scope:

- CI checks for lint, typecheck, build, migrations, unit/integration/E2E tests, and dependency policy.
- Security review: authentication, authorization/IDOR, input validation, injection, XSS, CORS, cookies/sessions, headers, secrets, uploads, and error leakage.
- Database backup/restore rehearsal, migration deploy procedure, rollback/incident procedure, and data retention policy.
- Performance/load checks for list/search/report endpoints and worker queues.
- Structured logging, correlation IDs, metrics, health/readiness checks, and error monitoring.
- Production environment configuration, deployment, smoke tests, and release checklist.

Acceptance criteria:

- A release can be deployed from a clean environment using documented steps.
- Migration status, seed policy, backup, restore, and rollback procedures are documented and rehearsed.
- Critical E2E flows pass: login, permissions, vacancy request, approval, candidate/application, interview, offer, hiring case, joining, and report access.
- No high-severity security findings remain open.
- Observability can identify a failed request or worker job using a correlation ID.

## Recommended execution order

```text
Phase 0 implemented — verification passed in remediation gates
      |
      v
Phase 1 Identity / Access / Master Data — remediated, verification passed
      |
      v
Phase 2 Vacancy Core hardening — remediated, verification passed
      |
      v
Phase 3 Candidate + Application foundation — remediated, acceptance limited by test coverage
      |
      +--> Phase 4 Documents / Screening / Interviews — remediated, storage acceptance pending
      |          |
      |          v
      +------> Phase 5 Offers — remediated, acceptance limited by test coverage
                     |
                     v
                 Phase 6 Hiring / Joining — remediated locally, release acceptance pending

Phase 7 Talent / Import — remediated locally, release acceptance pending
Phase 8 Reports / Admin / Configuration / Integrations — remediated locally, release acceptance pending
Phase 9 Mobile / Responsive / Themes / UI completeness — remediation complete
Phase 10 Release hardening — CURRENT NEXT
```

## Phase 3 entry gate — historical record

The Phase 3 gate is closed for the current implementation baseline. The following decisions remain part of the historical handoff:

- Phase 0/1/2 review is accepted and the working tree/branch baseline is frozen for the Phase 3 start.
- The Prisma adapter/runtime mode for Candidate/Application is explicitly selected; no silent switch between in-memory and database adapters is allowed.
- The applied legacy-column migration note is either accepted as a documented release constraint or resolved through an approved forward migration decision.
- Candidate, Application, status history, ownership, organization scope, and audit requirements are defined before tables or endpoints are created.
- Candidate/Application API contracts, permission codes, forbidden cases, and UI state matrices are approved before screen implementation.
- Dedicated Phase 3 fixtures and at least one end-to-end workflow (create candidate → apply to vacancy → view application) are specified.
- A supported local/API readiness command and a test-environment smoke path are available before the first UI integration task.

## Phase 9 entry gate — current

Phase 9 implementation was owner-approved with the following fixed scope. The baseline remediation is complete locally; the evidence and remaining release gates are recorded in `docs/development/audit/phase-audit-2026-08-07.md`:

- Audit all routes and shared components at desktop, tablet, and mobile widths.
- Complete responsive navigation, tables, forms, drawers, dialogs, uploads, approval actions, and detail views.
- Implement and verify theme behavior and persistence without reducing contrast or status clarity.
- Complete loading, empty, validation, forbidden, server-error, retry, pending, success, and destructive-confirmation states.
- Run the accessibility review for labels, semantics, focus order, keyboard interaction, dialogs, tables, and contrast.
- Replace remaining dead buttons, fake links, placeholder controls, and prototype-only interactions with working behavior or explicit disabled explanations.

Phase 9 must not add new business entities or silently change API/database contracts. Any discovered backend, migration, security, or data-integrity defect must be logged and handled under the appropriate phase or release gate.

Phase 9 handoff result: lint, typecheck, build, Prisma validation/status, diff hygiene, code-quality analysis, authenticated browser routes, login validation, 404 recovery, accessibility basics, mobile navigation, and 1440/768/375 responsive checks passed. Automated tests, storage/scanning, license domain, and migration provenance remain Phase 10 release gates.

## Engineer handoff template

Every phase handoff must include:

1. Phase name and exact in-scope items.
2. Explicit out-of-scope items.
3. Database models/migration plan.
4. API endpoints and contracts.
5. Permissions and organization-scope matrix.
6. UI screens/states/reference IDs.
7. Test scenarios and test data.
8. Acceptance evidence and known limitations.
9. Migration/seed/deployment notes.
10. Open decisions that require approval.

## Review gate checklist

The phase owner may request review only when:

- No unapproved scope exists in the diff.
- The acceptance criteria are demonstrated with test evidence.
- The migration is present and has not been applied destructively.
- Permissions and tenant isolation have tests.
- The UI has no known dead action in the phase scope.
- Quality commands pass and the working tree contains no secrets.
- Documentation is sufficient for another engineer to run and review the phase.

The current approved implementation target is **Phase 9: Mobile, responsive behavior, themes, and UI completeness**. Phase 10 remains the final release-hardening phase and must close the outstanding quality, test, runtime, security, migration, backup/restore, and deployment evidence before production release.
