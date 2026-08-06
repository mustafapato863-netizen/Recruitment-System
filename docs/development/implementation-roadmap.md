# RecruitFlow End-to-End Implementation Roadmap

This document is the delivery contract for the full RecruitFlow product. It is written for any engineer joining the project and is the source of truth for phase boundaries, review gates, and acceptance criteria.

The engineer must implement only the active phase. New features, architecture changes, new dependencies, or scope expansion require approval before implementation.

## Current baseline

- Phase 0 (repository/bootstrap foundation) is complete.
- Database migration, idempotent seed, generated Prisma client, and the Prisma adapter are working locally.
- Vacancy Core has a working MVP: create request, submit, approve/request changes/reject, convert to vacancy, and idempotent conversion.
- The frontend currently contains the dashboard shell and the Vacancy Core workflow.
- Authentication, authorization, actor context, audit behavior, and the remaining recruitment modules are not production-complete.

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

## Definition of Done for every phase

- Database schema and migration reviewed; existing data preserved.
- API DTOs/contracts, validation, authorization, error responses, and audit behavior implemented.
- Frontend states include loading, empty, success, validation error, permission denied, server error, and responsive behavior.
- Unit or service tests cover business rules; integration tests cover database/API behavior; E2E coverage is added for user-critical flows.
- Seed/fixture data is repeatable and does not delete or overwrite unrelated data.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, relevant database checks, and relevant tests pass.
- API README and phase notes are updated.
- Pull request includes scope, screenshots or API examples, migration notes, test evidence, and known limitations.

## Phase 0 — Repository and engineering foundation

Status: **Complete**

Delivered:

- pnpm monorepo with `apps/web`, `apps/api`, `apps/worker`, shared packages, and `database`.
- Reference pack organized under `docs/reference/`.
- Shared contracts, validation, design tokens, environment template, Prisma schema, migration, and local seed.
- Lint, typecheck, build, documentation indexes, and local development commands.

Exit gate:

- A clean checkout can install, generate Prisma, validate the schema, run the seed, build all workspaces, and start the applications.

## Phase 1 — Identity, access, organization, and master data

Status: **Not production-complete; required before expanding the product**

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

Status: **MVP complete; production hardening is the current active business phase**

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

Status: **Not started**

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

Status: **Not started**

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

Status: **Not started**

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

Status: **Not started**

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

Status: **Not started**

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

Status: **Not started**

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

Status: **Not started**

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

Status: **Not started**

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
Phase 0 complete
      |
      v
Phase 1 Identity / Access / Master Data
      |
      v
Phase 2 Vacancy Core hardening
      |
      v
Phase 3 Candidate + Application foundation
      |
      +--> Phase 4 Documents / Screening / Interviews
      |          |
      |          v
      +------> Phase 5 Offers
                     |
                     v
                 Phase 6 Hiring / Joining

Phase 7 Talent / Import can start after Phase 3.
Phase 8 Reports / Admin can start incrementally after the relevant data modules.
Phase 9 UI completeness runs continuously but is formally gated here.
Phase 10 Release hardening starts early and closes last.
```

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

The next approved implementation target is **Phase 1: Identity, access, organization, and master data**. Phase 3 must not start until Phase 1 and the Phase 2 production-hardening gate are approved.
