# RecruitFlow Full-System Fix and Enhancement Plan

**Prepared:** 2026-09-24  
**Scope:** API, web application, worker, database, deployment, security, performance, and browser verification.

## Current assessment

The current repository is in good shape for controlled UAT. The automated suites pass, the production build succeeds, and the repository is clean. Full production readiness still requires the fixes and verification work below.

Evidence from the current repository:

- Web tests: 287 passed across 69 files.
- API tests: 201 passed across 31 files.
- Worker tests: 6 passed across 2 files.
- Security matrix: 93 passed, with tenant-isolation and RBAC suites passing.
- Production workspace build, database schema validation, design-token checks, and dependency audit passed.
- ESLint reports 23 React hook warnings.
- Main CSS is approximately 414 KB raw, above the 225 KB advisory target.
- The root `pnpm typecheck` command fails because the root script recursively invokes itself. Package-level typechecks pass.
- Invalid UUID requests currently return HTTP 500 in the security test matrix where a 400 or 422 validation response is expected.
- A complete authenticated browser matrix was not run in this audit because the local API, worker, database, and web services were not running together.

## Priority 0 — release blockers

### 1. Fix the root typecheck command

**Problem:** `pnpm typecheck` recursively invokes the root script and exits with the TypeScript help output instead of running the workspace checks.

**Work:** Make the root command explicitly run the API, web, and worker typechecks once. Keep package-level scripts unchanged unless a package needs a project-specific fix.

**Acceptance criteria:**

- `pnpm typecheck` exits with code 0.
- API, web, and worker type errors fail the command.
- The command does not invoke itself recursively.

### 2. Return validation errors for malformed UUIDs

**Problem:** Invalid IDs on candidate, application, and vacancy-request routes produce HTTP 500 responses. The API should reject malformed UUIDs before database access with HTTP 400 or 422.

**Work:** Audit route parameter pipes and global exception normalization. Add regression coverage for every UUID route, including nested IDs and import job IDs.

**Acceptance criteria:**

- Malformed UUIDs return a stable validation envelope with status 400 or 422.
- No Prisma, SQL, stack, or table details are returned.
- Valid UUIDs preserve current 200, 201, 204, 403, and 404 behavior.

### 3. Run the authenticated browser release matrix

**Problem:** Unit and API tests do not prove that the complete web application works against the real backend.

**Work:** Run the browser matrix with PostgreSQL, API, worker, and Vite/web services together. Cover light and dark themes and the supported viewport widths.

**Required journeys:**

- Login, refresh, logout, and failed login.
- Dashboard, navigation, direct page reload, and permission gates.
- Vacancy request creation, approval, conversion, assignment, and status changes.
- Job description import and master-data import.
- Candidate intake, CV upload, parsing, duplicate resolution, and general talent pool selection.
- Candidate comparison after selecting a vacancy.
- Applications, stage transitions, interviews, scorecards, offers, approvals, hires, licenses, and joining.
- Reports filters, recruiter workload, export, and administrator visibility.
- User roles, reporting tree, master data, audit log, email templates, and WhatsApp templates.
- Private document upload, download, archive, restore, and access denial.

**Acceptance criteria:**

- No uncaught browser console errors.
- No unexpected HTTP 4xx or 5xx responses.
- No horizontal overflow at mobile, tablet, and desktop widths.
- Critical and serious Axe violations are zero on core pages.
- Screenshots and a machine-readable summary are saved as release evidence.

## Priority 1 — functional correctness and security

### 4. Verify reporting-line assignment rules end to end

The API now scopes assignable users to the reporting tree. Verify the complete rule in the UI and API:

- A user can assign work to themselves where the workflow allows it.
- A manager can assign to direct and indirect reports.
- Users outside the reporting line are rejected, including administrators where the policy requires the restriction.
- Cross-organization assignees are rejected without data leakage.
- Empty reporting lines show a useful setup message.

Add browser coverage for vacancy assignment, task assignment, and reassignment.

### 5. Verify reports permission and data scope

The Reports page is gated by `APPLICATION_VIEW`, and the API applies visibility rules. Confirm with real accounts that:

- Administrators see organization-wide data.
- managers see the intended team scope.
- recruiters see only their permitted data.
- filters update every chart and table consistently.
- exported XLSX data matches the visible report range and filters.
- empty states and date ranges are understandable.

### 6. Verify production runtime configuration

Before deployment, validate the actual environment values for database, JWT secrets, cookie settings, CORS, document storage, SMTP, worker heartbeat, and proxy trust. Run:

- `/api/v1/health` for process liveness.
- `/api/v1/readiness` for database and worker readiness.
- `/healthz` for the web container.
- a controlled login, invitation, email, document upload, and worker job.

Keep API liveness separate from dependency readiness so normal worker startup does not mark the API container unhealthy.

## Priority 2 — performance and reliability

### 7. Reduce React hook warnings

ESLint currently reports 23 hook dependency warnings in access policy, candidate, application, interview, reports, profile, talent pool, and vacancy request screens.

Review each warning individually:

- Add stable callback dependencies where required.
- Memoize derived values that are used by `useMemo`.
- Replace multi-state synchronization with `useReducer` where state transitions are coupled.
- Avoid adding dependencies blindly when that would create request loops.

**Acceptance criteria:** the application lint run has zero hook warnings, or each remaining warning has a documented and justified exception.

### 8. Benchmark and optimize reporting queries

`ReportsService` loads multiple application, offer, interview, hiring, vacancy, user, and audit datasets before calculating many metrics in memory.

Use a realistic dataset to measure:

- response time at 10k, 100k, and 1M application records;
- database query count and memory usage;
- export duration and memory usage;
- concurrent report requests.

Then add indexes or database aggregation where measurements show a bottleneck. Preserve tenant and role visibility in every query.

### 9. Reduce CSS and page bundle overhead

The main CSS bundle is approximately 414 KB raw. The transfer budget passes, but the raw size increases parse and style recalculation cost.

Work in this order:

1. Remove duplicate legacy utility rules.
2. Complete migration of grandfathered design-token violations.
3. Split route-specific styles where safe.
4. Verify that vacancy-card and navigation styles remain shared and consistent.

Keep the existing JavaScript code-splitting budget intact.

### 10. Split oversized page modules

Several page files exceed 70 KB, with application detail and application list pages above 100 KB. Extract cohesive feature sections, loaders, tables, dialogs, and data hooks while preserving route behavior and permissions.

Prioritize `ApplicationDetailPage`, `ApplicationsPage`, `VacancyOverviewPage`, `VacantListPage`, and `ManagerDashboard`.

## Priority 3 — maintainability and product quality

### 11. Complete shared UI standardization

Continue moving cards, tables, badges, buttons, loading states, and empty states to the shared design tokens and primitives. Keep the current brand language while removing page-specific visual overrides.

Validate:

- consistent card padding and borders;
- responsive grids at 90%, 100%, and 125% browser zoom;
- keyboard focus and visible disabled states;
- light and dark themes;
- readable empty, loading, conflict, and error states.

### 12. Strengthen integration and failure states

Exercise SMTP, calendar, resume parsing provider fallback, document storage, worker retries, and external integration health. Every failure should show a useful user message, preserve request IDs for support, and leave transactional data in a recoverable state.

### 13. Establish operational monitoring

Add release dashboards or alerts for:

- API liveness and readiness;
- worker heartbeat age;
- queue backlog and oldest pending job;
- failed email and document jobs;
- authentication refresh failures;
- report latency;
- storage failures;
- database connection and migration status.

## Deferred scope

The following should remain deferred until the core release gates are complete:

- payroll, ERP, and full HCM replacement;
- scheduled report delivery;
- broad integration management and additional external providers;
- production load testing and backup-restore drills;
- final monitoring and support sign-off.

## Definition of done

The system can be considered ready for the next controlled release when:

1. Priority 0 items are closed.
2. The authenticated browser matrix passes on the real local or staging stack.
3. Reports, imports, CV processing, assignment permissions, offers, joining, and document access are verified end to end.
4. Root typecheck, build, lint, unit tests, API security tests, and database validation all pass.
5. Performance measurements are recorded for reports and the largest user journeys.
6. Deployment health, backups, document storage, SMTP, worker processing, and rollback steps are verified in the target environment.

