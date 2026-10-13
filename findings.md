# Findings

## 2026-10-12 — mode and icon correction
- Palette restoration alone left a visible mismatch: v2 navigation stayed dark navy even in light mode, and navigation icons were small and unboxed.
- The earlier SGH sidebar reference uses a light surface, rounded icon tiles, and a cyan active marker. Shared v2 navigation now follows that structure and adapts surfaces/text and cyan/emerald accents to both modes.
- Original SVG logo colours include dark blue/forest stops; a white backing preserves visibility in dark mode without changing the emblem.
- PR #37 is merged and deployed. Production styles and live theme tokens were verified; preview images use labelled sample content from the real shared shell.

## Current task — simpler workspace and release (2026-10-11)
- Final production release confirmed: PR #36 merged and Vercel deployed e8ec1879aa087db4fee5e53c89fa65f702eb11ff. The stable URL serves the new shell tools and canonical SGH theme, and the browser confirms dark persistence. Final CI: 822 frontend and 384 browser checks pass.
- Admin tool search for "templates" returns Templates and Advanced pipeline templates; configuration groups are first. Browser snapshots and screenshots confirm the revised navigation in light and dark layouts.
- Existing TeamWork tests combine multiple form interactions and axe. Reassignment success toast can render before router navigation commits drawer removal; waiting for dialog absence verifies the complete result without dropping the assertion.
- PR #36 contains the SGH brand/theme restoration. The user now explicitly authorized improvements, merging and deployment.
- The employee primary menu is already three work areas, but an always-expanded classic list adds up to 17 destinations and duplicates Jobs, Candidates, Pipeline and access settings.
- The administrator primary menu displays eight configuration screens, followed by all classic links. Configuration can be grouped without removing routes or permissions.
- Licence specialists and final approvers land on dedicated classic queues; their queues must stay directly reachable rather than hidden in optional tools.
- Existing plan files contain completed September work; preserve that history and append this task.
- PR #36 rules-pack and Vercel preview passed; the full CI run was still in progress at initial inspection.
- Plan: employee daily navigation remains My Work, Jobs and Candidates; manager remains Team work, Requisitions and Results. Admin retains Users and Reports with configuration collected into a searchable Settings dialog. Optional hiring/data/configuration tools open in a searchable dialog instead of an always-expanded sidebar.
- Essential specialist queues will be pinned directly; the tools directory will continue to use existing permission-filtered items and route guards.
- An attempted read of `components/ui/Modal.tsx` found no file; discover the shared v2 dialog before implementation.
- Implemented a tools drawer using the existing focus-trapping DrawerV2. Search, role-filtered grouping, active-page labels, empty search feedback, Escape and return-focus use existing controls.
- Main admin menu now has Users and Reports plus Settings & tools. Daily employee/manager menus remain small. Licences and Final approvals are pinned for specialist-only roles; interviewer-only users no longer see an Open jobs link that redirects away from their permitted area.
- Tools are filtered against both the navigation catalog and route permission rules. Existing URLs and backend authorization remain unchanged.
- Local browser review shows three recruiter destinations and one Workspace tools trigger; the former long classic sidebar is gone. Opening the tools drawer focuses its search field and groups the existing links under Hiring operations and Candidates & imports.
- Browser tool search for "licence" leaves only Licences, and Escape returns focus to Workspace tools while preserving the current workflow. Theme switching remains available in the account menu.
- Dark tools panel fits the 375px viewport without document overflow; the search field retains initial focus and all groups remain scrollable. Saved a mobile dark-tools screenshot.
- Admin review confirmed only Users, Reports and Settings & tools are visible in the sidebar. Prioritized People & access and Workspace settings at the top of the admin drawer so configuration is immediately visible.

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

## 2026-10-12 — old production restored; v2 local only
Production is pinned to classic commit e2ef442 / deployment dpl_4CWQRx6YHvJ6p9CHvminiiqEiFg5. Vercel autoAssignCustomDomains=false; do not release v2 until the user approves after local testing. Latest v2 source stays on local main 16e26b3. Local web 127.0.0.1:5173 and API 127.0.0.1:3000 run against isolated Recruitment_V2_Local_20261012; original Recruitment_DB remains unchanged. Login and Users screen verified locally; full workflow acceptance testing is pending. Evidence and restart instructions: artifacts/rollback-review/verification.md.

# 2026-10-13 — Approved Figma workflow gaps

Component discovery: no Code Connect files found in the workspace (rg exit 1 means no matches). Existing screens expose Button, Select/Input and Badge instances linked to local component masters; reuse those instance properties. IBM Plex Sans is the verified current product font. SGH v4 colour variables and eight Glass Neo effect styles are present. No content images are required; decorative glows stay editable vectors. No component masters or mobile frames will be modified.

Initial audit: all current desktop text stays IBM Plex Sans; no raster UI images; new destinations resolve. Found action gaps in inherited pipeline/import/hold buttons, a non-interactive decline choice, missing post-save pending checklist state and overly broad duplicate-label wiring in rejection/reassignment. Some updated Admin Roles and Manager post-approval content need height stabilization. Exact-bottom content is valid and will not be treated as overflow. Existing unrelated Admin table widths are pre-existing and will be kept outside this scope. New form/state screenshots are being checked.

Final structural audit across six v4 pages: all affected frames have zero layout/button/invalid-destination issues; every new scenario is reachable from workspace/assignment/canvas entry points. Fonts are IBM Plex Sans throughout. 1,286 navigation reactions resolve (422 each Employee, 120 each Manager, 101 each Admin). No raster UI fills. Pending joining has opacity 0.55 and no reaction; complete two-check joining navigates to confirmed Joined. Declined answer routes to decline state. Revised v2 has only Close/Send reminder while awaiting approval, preserving its new start date. Pre-existing unrelated Admin Reporting Tree/Templates row width warnings remain outside this change.

The six accepted improvements are design-only. Existing v4 has three Employee nav destinations and three Manager nav destinations. Preserve them. Existing target repeats requisition seats/due/owner. HRIS pre-hire incorrectly requires SCFHS. Pipeline template explicitly has no gate into Pre-hire. Counter-offer is a decline reason. Held jobs disappear from My Work, hiding existing commitments. Manager scorecard, offer approval, import and joining lack completed prototype outcomes. Lina Activity omits submitted-offer event. Add Interviews/Joining within My Work, not sidebar pages; specialist views expose only assigned CV/scorecard or licence records.

# 2026-10-13 — Integration assessment

Local HEAD is 16e26b3 (includes v2 UI and latest licence permission changes). Current navigation catalogue includes 24 tools. Services exist for sourcing/matching, target assignment, manager offer decisions, reassignment, hiring/final approval, documents, self-scheduling, communications/outbox and imports. New design should group those capabilities, not delete them. A broad route search referenced a nonexistent local web catalogue path; narrowed subsequent reads to App.tsx and the actual shared/API catalogues.

Initial current-code inventory includes CV Bank, Talent Pool, bulk import, public jobs/apply, candidate self-scheduling and document portal, interview calendar, licence management, hiring cases, final approval, joining and user/role settings. The new Figma has simpler Employee/Manager hubs and assigned specialist views. Need map these existing capabilities without treating each old route as a required new main navigation page. Local main and pinned classic public deployment are different baselines.

# Integration assessment conclusions — 2026-10-13

Confirmed live Figma/source mismatches: joining gates require SCFHS for all hires in code but job-specific checks in design; final hiring approval is implemented in hiring service but absent from inspected ready-to-join and Manager offer-decision design states; My Work excludes held-job offer commitments while the design keeps them. Existing candidate banks/pools/matching/imports, public apply/self-schedule, reports, audit and permissions need mapped destinations, not removal. Preserve separate pay permissions and existing approval/checklist history. Full evidence and proposed local sequence: artifacts/figma-upgrade/current-system-integration-map.md.

# Business-complete design — confirmed policy

User explicitly confirmed final hiring approval is required for every hire. Preserve existing capabilities and history; three workspace types are presentation over granular permissions. The approved new design keeps job-specific licence checks and paused-job commitments, despite current source differences; these require implementation alignment later. Desktop/Figma only. Existing main navigation and design language remain.
# Live business design audit

Inspected current Employee My Work/Candidates/document hub/ready/joining/held states; Manager team/requisition/reassign/results; Admin master data/reports/integrations/audit/templates. Main journeys exist, but final hiring approval and contextual preservation of pools/bank/import review, communication failures, requisition approval history and administrative organization/target settings need explicit scenarios. Existing document hub preserves replacement history; preserve it while adding request/version views. Current integration sample marks mail connected and WhatsApp pending; design must show independent unavailable/error outcomes rather than assume all providers work. Current results deliberately use raw counts and small samples, not recruiter ranking; preserve that policy.

Code Connect lookup: no matching .figma.ts/.tsx/.js under apps/web or packages; existing screen instances/local component masters are the dependency source. Existing design typography is IBM Plex Sans; no source image capture needed because this is an existing Figma design update using editable vectors and existing components.
Confirmed joining authority: user explicitly wants the responsible Recruiter to record actual joining after final hiring approval. Current hiring/joining controller requires FINAL_HIRING_APPROVAL, which must be aligned during implementation without granting the Recruiter final approval authority. Record a separate joining-confirmation capability and an owner check; gate remains accepted offer + configured verified checks + final approval + available seat + actual start date.

Additional source parity: legacy recruiter targets store daily/monthly calls, screenings, interviews, offers, hires and CV-sourced values; preserve them separately from new outcome reports, rather than silently dropping historical fields. The current cancellation service rejects open applications with the system reason Requisition cancelled; update the design impact summary to describe that exact effect.
External desktop prototypes added separately from staff navigation: public job/apply, unavailable job, candidate self-scheduling/conflict, own-application portal, scoped document upload, expired invitation and staff sign-in/reset/invitation/session cases. They preserve candidate identity scope. This is design coverage only; portal/doc-request integration and authentication behaviors still need source alignment and implementation checks. Candidate privacy consent and expired-link paths need explicit guarded reactions in the final semantic pass.
Semantic audit found and corrected a proposed licence-specialist outcome shortcut that would expose the full checklist. Specialist outcomes must remain inside their assignment, while the responsible recruiter receives the result separately. Assigned interviewer prototype identity must differ from the application owner. Outcome lists must remove the completed decision only, not unrelated pending cases; imports/pool additions and mail retries need updated record views rather than returning to their pre-action snapshot.
Contrast check found bright SGH emerald under white 14px primary labels is below 4.5:1, while the dark green semantic success token passes. Primary gradients now use darker SGH green with white labels in Light, and brighter SGH green with dark labels in Dark. Brand logo colours remain; only active desktop primary controls are adjusted. Disabled controls are excluded from this text-contrast check. This is token/gradient-endpoint evidence, not a full rendered WCAG audit.
Final checks explicitly cover: final approval mandatory for technical and clinical hires; recruiter actual joining only after approval; licence validity on actual start; no duplicate application from pool/import; retained document and communication-attempt history; consent before public apply; no expired-link path to candidate data; scoped final-approver navigation; cancellation blocked until commitments are resolved; no seat decrease below completed hires. Loading and provider-test states need a designed terminal outcome rather than leaving the prototype stalled.
Final scoped audit: all 252 business prototype frames (126 per theme) are reachable, use IBM Plex Sans, have valid destinations and pass content/row/form geometry checks. Selected Candidate bank tabs intentionally have no navigation action. Licence/interviewer assignment reachability stays entirely within their allowed role frames; pending approval and consent guards are disabled without reactions. A broader inherited Admin check found nine reporting-tree rows 26px too wide and an overflowing template variable-chip row in each theme; both are now corrected through consistent column widths and wrapping chips.

Final rendered-image review found external Content containers fixed at 48px and clipping their children; corrected all 24 external/access Business frames per theme to hug content. Extended the structural audit to detect clipping by the content container. Fixed inherited reporting-table text widths and drawer/scrim bounds in both themes. Candidate portal now represents its outstanding contract as required-document pending, before final approval. Six final screenshots inspected; no scoped audit failures remain. Actual primary-fill endpoint measurement: 344 enabled instances, minimum 5.440:1 Light and 5.905:1 Dark. Full business handoff and source-alignment gaps saved in artifacts/figma-upgrade/business-design-readiness.md; evidence in business-design-verification.json.

Local replacement plan: App.tsx currently uses V2Shell and v2 routes plus retained More (classic) feature routes. Implement the new design incrementally in that existing app; retire classic shortcuts only after equivalent features and compatible links are verified. The same local URL becomes the default new experience at final cutover. First complete hiring trial follows phase 5. Existing checks are declared for types/lint/design tokens/web/API/worker/database/browser; their isolated database/provider configuration must be validated before execution. Prior local sessions and database counts are historical evidence, not newly confirmed service health.

# Phases 1–3 findings — 2026-10-13

Implementation of phases 1–3 is in the working tree on `codex/local-desktop-upgrade` at `16e26b3`. It is uncommitted. Phases 4–9 are untouched.

Isolation: `.env` still names `Recruitment_DB`. `artifacts/rollback-review/start-local-v2-api.ps1` points the process at `Recruitment_V2_Local_20261012` and sets `MAIL_DELIVERY_ENABLED=false` and `MAIL_TRANSPORT=console` without editing `.env`. `scripts/dev.mjs` and `start.ps1` must not be used for this preview. A read-only check of `Recruitment_DB` still showed 42 finished migrations and no joining-policy columns.

Recovery: custom dump `artifacts/local-desktop-upgrade/backups/Recruitment_V2_Local_20261012-phase1.dump` (210762 bytes, SHA256 `6864CCF77B7EC302D163AC98AB77FE40ADD3FB92E8765C2FB728F694331ED74A`) was taken before migration `20261013_joining_policy`. Restoring it to disposable database `recruitment_v2_phase3_recover_20261013` matched pre-migration counts (users 15, candidates 28, vacancies 8, applications 18, documents 26, hiring cases 0, 60 finished migrations). After `migrate deploy` on that copy only: 61 migrations, the five new columns, the same row counts, and two role grants for `RECORD_ACTUAL_JOINING`. The copy was dropped. The live isolated database then received the same migration. The pre-migration dump is kept.

Documents: 26 `candidate_documents` rows exist and 26 storage keys are missing from local document directories. There were no bytes to preserve. Keys and file names are not copied into reports.

Joining: a stored requirement snapshot wins. An explicit `requirementProfile` or `joiningProfile` of `technical` or `clinical` is next. Anything else stays the historical ID + contract + SCFHS rule, so unconfigured cases and existing three-check expectations are unchanged. New cases store that resolution. Technical is ID and contract. Clinical adds a valid SCFHS licence. Final hiring approval, offer approval, offer acceptance and actual joining stay separate. `RECORD_ACTUAL_JOINING` is granted to Recruiter and Administrator only. A material compliance change while a case is Awaiting Joining invalidates the current approval. Both the application-stage Joined path and hiring confirm-joining call the same decision.

Access: interviewer responses without `APPLICATION_VIEW` return the assigned evaluation and that interviewer's scorecard. Licence specialists without application view stay on assigned licence rows. A final-approval-only hiring-case payload omits salary, offer pay and the application file. The existing B1 behavior still lets a pending final approver GET the application file and CV for the case they are approving. `OFFER_PAY_VIEW` stays independent of `VIEW_CURRENT_SALARY`.

Navigation: Employee and Manager each have three destinations, plus My interviews only for interviewer-capable users. Admin has eight destinations. More (classic) still holds unfinished feature routes. Seeded final approver and licence specialist roles also have `VACANCY_VIEW`, so Open jobs appears beside their special home.

Figma: MCP authentication failed. Visual review used the existing SGH glass tokens, IBM Plex Sans, and rendered local screenshots. Do not treat that as verified Figma parity.

Checks that were not used as completion evidence: `pnpm test:db` and `pnpm test:browser` were not run, because the database script talks to the live API on port 3000. Database-backed specs skipped unless a dedicated `B*_TEST_DATABASE_URL` is set. Root `pnpm typecheck` through the RTK wrapper printed the TypeScript help text; the three package typechecks are the type evidence. One worker-thread document extractor test timed out once under load and passed when rerun alone.

# Phase 4 findings — 2026-10-13

Phase 4 is in the working tree on `codex/local-desktop-upgrade` at `16e26b3`. It is uncommitted. Phases 5–9 are not started. The phases 1–3 findings above stay as written.

Target contract: `UpdateRequisitionTargetDto` accepts `seats`, `dueDate` and `reason`. The first walkthrough posted `requestedHeadcount` and the API rejected it with “property requestedHeadcount should not exist”. The client now sends `seats`. Draft create and update still use `requestedHeadcount`. Live proof is the 2 → 1 save on VR-2026-011, which persisted as approved headcount 1. Zero seats is blocked in the form with “At least 1 seat.” `SEATS_BELOW_JOINED` is unit-tested and was not exercised live because this job has joined 0.

Assignment: the isolated database was missing the `seedDecisionDemo` manager links, so Hassan’s assignable list was empty. SQL on `Recruitment_V2_Local_20261012` only set Mona to report to Hassan and set lady@, sarah.ahmed@, sindu@ and zenah@recruitflow.local to report to Mona. Hassan’s manager stayed Ahmed. The full seed was not rerun. `Recruitment_DB` was not written. Assignable then returned those five people, and Sarah could be selected.

Cancellation: a Screening-only file does not block close. Hassan’s impact read after the sample file existed was HTTP 200, `canClose` true, one active application, zero joined, zero commitments. The job was left Open. A scan of two other converted requisitions found none blocked. Sarah receives 403 on requisition reads. The unresolved-commitment 409 is covered by unit tests and was not forced live.

Deep links: an in-scope `?req=` opened VR-2026-011. An unknown id showed “That requisition is not in your team or organization.” The application link opened the Screening file. Hassan’s own activation does not notify him, so a notification was not clicked. `notificationHref` is unit-tested.

Held jobs stay on My Work for interviews, offers, scorecards and Awaiting Joining, and they are not hire targets. That behavior is unit-tested. This walkthrough job was not placed On Hold.

“Screen note missing” / “Gate blocked 1” on the Screening card is the existing next-stage gate, not a failed move. Screenshot `07-sarah-my-work-1440.png` predates the Screening move. The stage evidence is screenshots 09, 11 and 12 plus the GET that still returns Screening.

Checks: package typechecks for api, web and worker exited 0 before the one-line web rename. Web typecheck and RequisitionsV2 (27 tests) exited 0 after it. Project eslint exited 0 with the same 13 warnings. `pnpm check:design-tokens` exited 0. A bare `pnpm lint` was rewritten by the shell to `rtk lint` and is not the project result. Not run: `pnpm test:db`, `pnpm test:browser`, root typecheck, root build, and the full test suites. No new migration. Joining policy was not edited. Live Figma was not verified.

# Phase 5 findings — 2026-10-13

Phase 5 is in the working tree on `codex/local-desktop-upgrade` at `16e26b3`. It is uncommitted. Phases 6–9 are not started. Earlier findings stay as written.

The first complete trial passed the hire rules and failed three evidence reads. The decline reason was stored and written to history, but the application payload omitted `rejectionReason`. My Work returns open targets with `vacancyId` and `filled`, and a Filled job is not a target. After Aya decided the clinical case, `GET` returned `403 FILE_NOT_OWNED`. The reason is now on the application. The other two results were rechecked and accepted: the clinical target is “1 of 2”, the technical vacancy is Filled and absent from open targets, and the decided case stays unreadable so it has no salary payload.

`confirmJoining` returns `FINAL_APPROVAL_REQUIRED` when the case is not Awaiting Joining, before the joining checks run. The stage move still reaches the check gate. Unverifying a check after approval therefore looks different on the two endpoints, and both block the hire. The old approval row stays.

The isolated database had no grade band. One Grade 6 AED band for Head Office was created for the sample offers. Omar had no manager, so the existing assignment rule refused him. His manager is now Mona, on this database only, and Mona assigned him to the clinical vacancy. Do not reseed and do not undo that link.

The file header did not wrap, so a phone-width file with Reject and Pre-hire actions scrolled sideways. The name and those actions now wrap. A licence-only case was rendering “Invalid Date” and a disabled joining button because the narrow payload has no case dates. That sidebar and button are hidden for a licence-only reader.

Not run: `pnpm test:db`, `pnpm test:browser`, root typecheck, root build. No new migration. Live Figma was not verified. The worker was not started. `Recruitment_DB` was not written.

# Phase 6 findings — 2026-10-13

Phase 6 is in the working tree on `codex/local-desktop-upgrade` at `16e26b3`. It is uncommitted. Phases 7–9 are not started. Earlier findings stay as written.

Message attempts are audit rows on the application (`MESSAGE_ATTEMPT`), not a new table. A send while mail delivery is off is Failed and writes no file. Retry is allowed only from Failed, inserts a new Sent row, and leaves the failed row. The local file is written with `node:path` named `resolve` and `join`. A default `import path from 'node:path'` compiled to `path.default` and the first retry returned 500 before any Sent row existed.

The retry control’s visible label is “Retry”. Its accessible name still includes the template. The long template name was widening the phone-width file by about 60px. After the shorter label, that page is 2px over 390, which was already a recorded limit.

Workbook review and CV upload stay separate. A ZIP of CVs is not an intake format. The confirmed batch had one valid row, one invalid row, and one duplicate decided as Skip, so the duplicate did not update the existing person. `/talent-pools` opens the existing sourcing bench, and the imported person is listed there.

Not run: `pnpm test:db`, `pnpm test:browser`, root typecheck, root build. No new migration. Live Figma was not verified. The worker was not started. `Recruitment_DB` was not written. The 26 storage-key-only documents were not given bytes.

# Phase 7 findings — 2026-10-13

Phase 7 is in the working tree on `codex/local-desktop-upgrade` at `16e26b3`. It is uncommitted. Phases 8–9 are not started. Earlier findings stay as written.

There is no organization-settings table. Position-level activity quotas are active `master_data_values` rows in category `position-level-targets`. The audit row is written by the service, with `afterData`, because the audit interceptor does not store that JSON. Seat counts and salary fields are not in that document. The page still shows a previously saved browser matrix only when the server has not persisted one, and a successful save removes only `recruitflow_position_level_targets`.

A workflow apply on a position that holds `VAC-2026-009`, `VAC-2026-010`, or `VAC-2026-011` returns 409 `WORKFLOW_RULE_PREVIEW_ONLY` and writes nothing. The pipeline page has preview only. Hassan’s team result is his direct report. His classic recruiter-workload export is the existing recruiter query, which does not list him and does not list Sarah. Ahmed’s admin report and workbook do.

Deactivation is still a status change. The disposable user’s monthly recruiter target still names that inactive user. Invitations with mail delivery off create the invited user and an auth token, and they do not insert an outbox row.

Sarah’s grade-band response includes the band and omits the amount fields. Her application file does not render the Salary section. The Settings capability line “Set salary and allowances” has no amount.

Not run: `pnpm test:db`, `pnpm test:browser`, root typecheck, root build. No new migration. Live Figma was not verified. The worker was not started. `Recruitment_DB` was not written. The application file at 390px is still 2px over.

# Phase 8 findings — 2026-10-13

Phase 8 is in the working tree on `codex/local-desktop-upgrade` at `16e26b3`. It is uncommitted. Phase 9 has not been started. Earlier findings stay as written.

`/portal`, `/portal/applications/:token`, and `/my-applications` are public routes. The staff redirect leaves those paths alone, so a candidate is not sent to My Work. Staff sign-in through `/` still opens the seat home. A staff session that opens `/portal` sees the candidate entry.

Portal links are signed receipts stored with the candidate, not staff invitation tokens. A bad, expired, or revoked link is rejected before another person’s file is read. A reference number does not open an application. The contact form accepts a name and a message only.

Public apply still requires consent. The button stays disabled until the box is checked, and the API rejects `consentAccepted: false` before a row is created. The receipt is the screen, plus a portal path. Mail delivery stayed off, so no phase 8 outbox row was written.

A candidate upload of a requested document is stored as `AwaitingVerification` even when the signature scan is clean. It does not write a joining check or a compliance row. Public CV intake was left as it was. The older storage-key-only documents were not backfilled. ZIP uploads stay rejected.

An occupied interview slot and a held job both stop scheduling before a second interview is created. The held sample is `VAC-2026-P8H`, not a phase 5 job. The self-schedule page was not restyled.

An in-progress public draft is kept in session storage under a per-tab owner. A different owner does not see it.

# Phase 9 findings — 2026-10-13

Phase 9 is in the working tree on `codex/local-desktop-upgrade` at `16e26b3`. It is uncommitted. The public release has not been started. Earlier findings stay as written.

Removing More (classic) does not redirect classic URLs. Those URLs stay behind the same permission gate. Sending them through the seat-home map would hide Targets and Workflow settings from a recruiter who can open them today. The shell instead lists, as Retained work, only the classic pages that person’s permissions already allow. Interviewer-only users get an empty list. Final approvals and Licences stay pinned for those seats.

The live counts are higher than the phase-1 dump because phases 4–8 added sample rows. That dump is the rollback copy, not a reset of the walkthrough. Hire counts, consent, the awaiting-verification file, L4-TECH at 17, the grade band, and the phase 7 invitation were unchanged after the desktop walk. No Arabic language switch exists, so RTL was not added.

Not run: `pnpm test:db`, `pnpm test:browser`, root typecheck, root build. No new migration. Live Figma was not verified. The worker was not started. `Recruitment_DB` was not written. The application file at 390px is still 2px over. Staff My Work at 390 measured 297px over; that page was not changed.
