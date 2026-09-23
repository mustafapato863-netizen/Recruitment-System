# Findings

## Initial repository state
- Existing local edits from prior work are present in `CandidateFitScorecard.tsx`, `ComparisonMatrixCard.tsx`, and `CandidateComparisonPage.tsx`; keep them intact.
- Reports page exists at `apps/web/src/pages/ReportsPage.tsx` with a corresponding test file.
- No repository `CONTEXT.md` or `AGENTS.md` files were found in the initial tracked-file search.

## Investigation
- Reports page calls `/reports/overview` and renders a useful high-level dashboard, but it also has hard-coded default KPI values (85%, 92%, etc.) that can look like real metrics when live fields are absent.
- The page currently has no recruiter-by-recruiter performance view.
- The time-to-hire trend is an empty array, and application trend comparison is currently fabricated as `applications * 0.82`.
- Existing frontend tests mock a user with `REPORTS_VIEW`; the user reports that their Administrator cannot see/open the page, so route-level permission and Administrator permission seeding need inspection.
- Backend reports endpoints include overview, KPI, funnel, hiring-by-department, recruiter-workload, and Excel export methods. Need inspect controller/service and permission source before deciding whether existing recruiter workload can be surfaced or needs expansion.
- Both the frontend `/reports` route and every reports API route currently require `APPLICATION_VIEW`. The Reports entry in the shared navigation catalogue also requires `APPLICATION_VIEW`; this permission coupling may explain Admin seeing the settings row but failing the page/API gate.
- `getOverview` already returns `recruiterWorkload`, and a dedicated `/reports/recruiter-workload` API exists, but the current page has no visible recruiter activity section.
- A search included the nonexistent `apps/api/prisma` path and returned an expected path-not-found diagnostic; schema location still needs discovery.
- `ReportsService.getOverview` already returns workload per active user with assigned vacancies, primary applications, and overdue tasks. However, the user query includes every active organization user, not only recruiters, and the workload is not currently shown in ReportsPage.
- Existing Reports tests include static default KPI expectations; the fallback values are actual hard-coded demo figures, so they must be removed or replaced with explicit unavailable/zero-data state rather than reported as real performance.
- `getOverview` computes `timeToFill` from joined cases and period trend from real application/interview/offer/join events, but the frontend still substitutes a synthetic previous-period application series and renders no time-to-hire trend.
- The shared `PermissionGate` delegates to `usePermissions().canAccess`; a role visibility toggle does not create a sidebar link or grant route/API permission by itself.
- The reports test fixture labels its mocked role `ADMIN` while production's administrator checks use code `ADMINISTRATOR`; this mismatch may mask the exact admin path in tests.
- Need inspect `PermissionsGuard`, `usePermissions`, role seeding/permission links, and Prisma relations to determine whether admin access is missing `APPLICATION_VIEW` or the user has an alternate admin code.
- Permission checks are literal in both layers: the frontend checks only `user.permissions`, and backend `PermissionsGuard` checks only linked role permissions; neither has the Administrator bypass that the sidebar visibility screen promises.
- The seed gives `ADMINISTRATOR` every currently seeded permission, so a stale/incomplete permission link in the deployed database can hide Reports and reject its API despite Administrator role visibility.
- Better fix is a narrow, explicit Administrator permission bypass shared across frontend route checks and backend guard, rather than weakening all reports endpoints or requiring users to reconfigure role visibility.
- AuditLog records actor, action, entity, result, and timestamp; coverage of recruitment operations still needs inspection. Existing report workload remains assigned vacancies/applications/overdue tasks.
- AuditInterceptor logs successful recruitment mutations with actor and timestamp for applications, screening, interviews, offers, and hiring, so reliable period activity counts can be grouped by recruiter without adding database schema.
- The current `timeToHireData` is permanently empty, and the page renders its chart container anyway; another overall-report accuracy gap.
- Need preserve tenant and user visibility when exposing audit aggregates; only administrators should receive organization-wide recruiter action counts unless existing team-scope rules authorize a broader audience.
- Seed role code is exactly `RECRUITER`; `TALENT_MANAGER`, `HR_MANAGER`, and `PERFORMANCE_ADMIN` are managerial/reporting roles.
- Current overall trend is derived from real created applications/interviews/offers/joinings, but UI fills previous-period datapoints with `82%` of the current count; that line is fabricated and will be removed.
- `RecruitmentKpiItem` quality-of-hire KPI is inferred from hires older than 90 days and assumes all eligible hires passed probation, which is not recorded by the current schema. It must not be presented as an observed performance result.
- Reports backend already knows the current date range and filters application/interview/offer/hire data. Use successful audit actions within that same range for recruiter-attributed work, grouped into application, screening, interview, offer, and hiring action counts.
- For data visibility, organization-wide recruiter activity is appropriate for Administrator, Talent Manager, HR Manager, and Performance Admin. Other report viewers should receive their own recruiter activity row only.
- Direct root cause of the missing menu item: `/reports` and its catalog metadata existed, but `AppShell` rendered a fixed navigation list with no Reports `NavigationItem` at all.
- Admin access is now explicitly guaranteed in the frontend permission hook and backend `PermissionsGuard`; backend checks authenticated active user and tenant scope before the Administrator bypass.
- Recruiter activity is grouped from successful `AuditLog` actions within the requested dates, by actor and into applications, screening, interviews, offers, and hiring. Workload fields remain current open assignments and overdue tasks, and non-manager report viewers are scoped to their own activity.
- Removed demo KPI fallbacks and inferred probation success, stopped showing an invented previous-period series, changed the empty time-to-fill chart to an honest average metric, and relabeled headcount/filled counts as hiring progress by position.
- Overview CSV and Excel exports now include recruiter activity/workload with flattened action counts.
- Interview attendance is measured only across completed and no-show interview records, avoiding future/cancelled interviews in the denominator. Time-to-fill exposes a sample count so zero-day joins remain distinguishable from missing data.
- Cancelled requisitions are excluded from headcount targets used by the reports; completed, open, pending, on-hold, and filled requests remain visible as organizational hiring targets.
