# Progress

## 2026-10-12 — correct remaining mode and icon mismatch
- Selected ui-ux-pro-max for visual review and ui-design-system for reusable brand/theme/icon consistency. Preserved prior local documentation and user ZIP.
- Found the prior fix deliberately kept a navy sidebar in both modes and retained 16px unboxed icons. Restored theme surfaces, 32px rounded icon tiles, 20px glyphs, cyan selection markers and cyan/emerald primary actions. Added a white plate behind the fixed-colour SGH emblem in both modes.
- Passed 57 focused existing tests, TypeScript, lint, design-token, production build and bundle checks. Local browser review passed light/dark styles, 375px and 768px overflow checks and tools focus return. Temporary fixtures removed and local server stopped.
- PR #37 merged as 16e26b3dbb21c12d7c69bead86b35e188b56aceb after all four checks passed: 822 frontend tests, 117 security cases, tenant/RBAC gates and all 384 Chromium browser/accessibility checks.
- Production deployment succeeded. Stable URL assets passed all new style checks; live tokens resolve sidebar/text to #fff / #334155 light and #0f1a2e / #e2e8f0 dark. Original light preference restored. Main fast-forwarded; release evidence and labelled shell previews saved in artifacts/theme-icons-review.

## 2026-10-11 — workspace simplification and release
- COMPLETE: PR #36 merged at 12:39 UTC as e8ec1879aa087db4fee5e53c89fa65f702eb11ff, with all four PR checks passing. Local main fast-forwarded to the merged commit.
- Final CI passed 100 frontend files / 822 tests, 117 P3.6 security cases, cross-tenant isolation and RBAC scenarios, and 384/384 Chromium browser/accessibility checks. Build, lint, typecheck, schema/migration validation, dependency audit and budgets passed.
- Production deployment succeeded for the merged SHA. Live entry index-D62Xx0V7.js loads AppShellV2-CcutHF9w.js containing Workspace tools, Settings & tools, tool search and SGH branding, without the former expanded More (classic) menu.
- Live browser light theme resolves SGH cyan #00a3e0 and emerald #00a859; dark theme resolves card #0f1a2e and native colour scheme dark, persisting after refresh. Restored the original light preference and saved production screenshots. Authenticated role workflows were verified in CI and local fixtures; production review used the login page and deployed assets, without altering recruitment records.
- TeamWork isolated rerun passed all 13 tests. The three other focused files passed all 126 tests in the preceding run; final CI will verify the full suite on the final head.
- Browser review passed recruiter/admin navigation, template search, light/dark switch, Escape and return focus, and a 375px phone layout. Temporary fixture files were removed; review screenshots remain under artifacts.
- Full frontend run: 820/821 passed, with a timeout in the existing reassignment workflow test. A focused run exposed its immediate drawer assertion racing router completion; changed that assertion to wait for the actual close and gave this multi-step workflow plus axe check a 10-second limit. Subsequent focused run passed reassignment but hit a different existing 5-second TeamWork test under local load; rerunning TeamWork alone without simultaneous build checks.
- Latest frontend TypeScript build passed; lint passed with 12 existing hook warnings and no errors. No business data, permissions or API changes.
- Read selected skills and inspected navigation, route permissions and specialist homes.
- Confirmed explicit user authorization to improve, merge and deploy.
- Started tracking this task while preserving prior planning notes.
- Shared dialog discovery: neither `components/ui/Modal.tsx` nor `components/v2/Modal.tsx` exists. Located existing `components/v2/Drawer.tsx` and `components/Modal.tsx`; use the verified shared dialog rather than inventing paths.
- Implemented grouped tools discovery and plain task names; removed the always-expanded classic section.
- Added verification for search/no-results, admin grouping, routing, focus restoration, specialist queues and interviewer-only navigation. Local checks are running.
- Broader checks caught routing test fixtures that mount the real shell without the ThemeProvider required by the restored switch. Original PR CI also failed on those fixtures; fixing them before release and running the full frontend suite.
- New drawer accessibility check found the shared drawer header was exposed as a second page banner. Explicit presentation semantics remove that duplicate landmark. Corrected invalid Testing Library `exact` role options found by the type checker.

## 2026-09-23
- Started diagnosis of Administrator access to Reports and requested recruiter/overall performance reporting.
- Read `planning-with-files`, `senior-fullstack`, and `code-reviewer` skill guidance.
- Recorded prior uncommitted candidate comparison UI/logic edits to preserve.
- One PowerShell search command failed due to unsupported `2>$null` parsing; reran as separate commands successfully.
- First report-page inspection found fallback hard-coded KPI figures, a fabricated prior-period trend, an empty time-to-hire series, and no recruiter leaderboard/activity section.
- Confirmed Reports route, shared navigation metadata, and backend report APIs all use `APPLICATION_VIEW`; confirmed recruiter workload data is already computed on the server but is not displayed on ReportsPage.
- Service review confirms existing recruiter workload counts are basic workload, not audited actions. Confirmed AuditLog records successful actions for key recruiter workflows (application create/note/move, screening, interview schedule/update/scorecard, offer create/status, and hiring changes).
- Identified menu defect: `AppShell` had no Reports `NavigationItem`. Added Reports item to Governance.
- Added explicit Administrator full-access check in frontend `usePermissions` and backend `PermissionsGuard` after active-user and tenant validation.
- Added date-filtered recruiter action aggregates from successful audit records, scoped to manager/admin roles for team-wide reporting and to self for other report viewers. Added a recruiter table and included the activity breakdown in CSV and Excel exports.
- Removed fabricated KPI fallbacks, inferred probation pass rates, and synthetic prior-period chart data. The empty time-to-fill chart is now a measured average tile; headcount by position now shows approved target, joined hires, and fill rate.
- Committed Reports improvements as `1818f64 fix(reports): restore admin access and show recruiter performance`.
- Implemented unified responsive `VacancyCard` component (`VacancyCard.tsx`, `VacancyCard.test.ts`) across `RecruitmentCommandCenter.tsx` and `VacantListPage.tsx`.
- Committed unified vacancy cards as `b249d9f feat(web): unify responsive vacancy cards`.
- Candidate Comparison Matrix and Fit Scorecard Refinements:
  - Updated `CandidateFitScorecard.tsx` to introduce a `compact` size variant (`size="compact"`, `h-9 w-9`) with scaled typography to prevent overflow in dense multi-column comparison cards.
  - Refactored `ComparisonMatrixCard.tsx` with compact match score badge, awaiting-position state, and streamlined responsive card padding.
  - Enhanced `CandidateComparisonPage.tsx` to preserve user's comparison set when selecting or switching positions (instead of wiping with vacancy applicants), dynamic fit recalculation against the selected position, and real-time synchronization of candidate `ids` in URL search parameters (`syncComparisonCandidateIds`).
- Verification completed:
  - Monorepo full typecheck (`pnpm -r typecheck`): 8 of 8 projects compiled cleanly with 0 errors (`apps/worker`, `apps/api`, `apps/web`, and packages).
  - Web linter check (`pnpm lint:web`): 0 errors, 23 warnings within allowable project threshold.
  - Web unit tests executed and passed (`skillTags.test.ts`, `VacancyCard.test.ts`).
  - System-Wide 10% Visual Compaction & 8px Card Padding (/goal):
  - Achieved ~10% proportional visual compaction at 100% browser zoom without using CSS `zoom` or `transform: scale()`.
  - Updated root typography token `html { font-size: 12px; }` in `tokens.css` for natural ~7.7% proportional shrink across all rem-based Tailwind utilities.
  - Scaled layout tokens: `--sidebar: 208px`, `--sidebar-collapsed: 72px`, `--header: 48px`, `--page-gutter: 20px`, `--control-height: 32px`, `--control-height-compact: 28px`, `--control-height-touch: 40px`.
  - Scaled UI primitives and components: `PageFrame`, `Button`, `Input`, `Card`, `Badge`, `DataTable`, `MetricCard`, `BreadcrumbsBar`, `Modal`, `AlertDialog`, `AppShell`, `VacancyCard`, `CandidateFitScorecard`, `ComparisonMatrixCard`, `InterviewAgendaCard`, and `MyTargetsWidget`.
  - Set card padding to 8px from all sides (`--space-card: 8px;`, `--rf-space-card: 8px;`, `p-[8px]`) across cards, metric cards, vacancy cards, kanban cards, and reports cards.
  - Verification results:
    - `pnpm --dir apps/web check:design-tokens`: 0 violations across 93 strict boundary files.
    - `pnpm -r typecheck`: 8 of 8 projects compiled with 0 errors.
    - User visual confirmation in Chrome DevTools showing vacancy cards with 8px padding and sleek high-density layout.
  - Brand Button Color Alignment:
    - Configured `--color-blue-600: oklch(0.51 0.14 249.51);`, `--color-blue-700: oklch(0.44 0.14 249.51);`, and `--color-blue-500: oklch(0.58 0.14 249.51);` in `index.css` under `@theme inline` and global CSS utilities.
    - Updated `--color-action` and related tokens in `tokens.css` to match `oklch(0.51 0.14 249.51)`.
    - Resolved `PageFrame.tsx` responsive fragment unwrapping in `flattenChildren` helper so actions wrapped in Fragments cleanly separate primary and overflow menus.
    - Monorepo full typecheck (`pnpm -r typecheck`): 8 of 8 projects compiled cleanly with 0 errors.
    - Design tokens check (`pnpm --dir apps/web check:design-tokens`): Passed (97 strict files; 0 violations).
    - Full Web test suite (`pnpm --dir apps/web test`): 69 test files passed (287/287 tests passed, 0 failures).

## 2026-10-12 — old production restored; v2 local only
Production is pinned to classic commit e2ef442 / deployment dpl_4CWQRx6YHvJ6p9CHvminiiqEiFg5. Vercel autoAssignCustomDomains=false; do not release v2 until the user approves after local testing. Latest v2 source stays on local main 16e26b3. Local web 127.0.0.1:5173 and API 127.0.0.1:3000 run against isolated Recruitment_V2_Local_20261012; original Recruitment_DB remains unchanged. Login and Users screen verified locally; full workflow acceptance testing is pending. Evidence and restart instructions: artifacts/rollback-review/verification.md.

# 2026-10-13 — Figma workflow implementation

User approved all six recommendations. Skills loaded, scope and findings recorded. Existing implementation helpers and current frame IDs recovered. No production/code/mobile mutations authorized or planned.

Discovery complete: local component keys/properties, IBM Plex Sans styles, current theme colour tokens and Glass Neo effects verified. Only legacy FLOAT tokens exist (radii 6/8/12); approved v4 geometry is 12/16 and will be preserved from live controls rather than resetting to older tokens. Existing workflow states are arranged in five-column grids. New states will form an additional grid below current desktop frames, with Light/Dark parity.

Employee Light/Dark: added Interviews/Joining tabs, reschedule/no-show/attendance, assignment-only evaluation/licence review, two-check technical joining and three-check clinical readiness, revised/expired/declined offers, held-job commitments and outcomes for import/send/join/reopen. Manager Light/Dark: unified requisition/goal form, edit-existing-plan, validation and activation outcomes, own scorecard completion and decisions with outcomes. Admin rule and permission views are updated. All changes committed in Figma; structural/visual verification and targeted corrections are next.

Targeted corrections committed: proper task/calendar/check tab icons; connected original HRIS pipeline/import/hold paths; distinct single vs bulk import results with accurate Applied/Screening/Interview counts; removed joined Lina from active offers; pending checklist save outcome; distinct manager vs candidate offer changes; sent/approved/reminder states; correct Salma rejection and separate Nourhan no-show closure; restricted specialist header/sidebar; canvas scenario entry guides. Joining screenshot visually passes. Manager activation now has an active plan state and reassignment only commits from the actual drawer footer.

Completed verification: every updated desktop frame passes layout/button/destination checks; 1,286 existing/new prototype navigation actions resolve; all new scenarios reachable through workspace or role-scoped canvas entry points. Required checklist and approval guards verified. Input growth was corrected after screenshots revealed inherited centered-value positioning; 166 field geometries now pass. Final representative screenshots pass with the approved IBM Plex Sans, glass-neumorphism, SGH colours and Light/Dark modes. Bulk/single candidate names and initials match CV source records. Evidence saved to workflow-six-points-verification.json. Application, mobile and public deployment remain untouched.

# 2026-10-13 — Integration assessment

Selected planning-with-files, code-reviewer and figma-use. Route/file discovery begun. This turn is analysis only; preserve app code and public classic deployment.

# Integration assessment completed — 2026-10-13

Read local routes, classic App at the pinned reference, backend gates, My Work filters, capability controllers/schema and nine live Figma frames across Employee/Manager/Admin. Saved evidence-backed preservation map and local integration order. No app/Figma writes, production changes or runtime tests. Only assessment and planning artifacts changed.

Search errors: several inferred directory names did not exist; corrected using rg file inventory (import, email and public-interviews paths). One file-inventory pipeline failed because the outer shell expanded $input; replaced it with direct rg globs. No state mutations resulted.

# Business-complete design started — 2026-10-13

User confirmed final hiring approval for every hire. Inspected three role pages and existing dependencies. Components/input/select/badge property keys, SGH variable collection/modes and Light/Dark Glass Neo styles verified; IBM Plex Sans font styles available. No Code Connect mappings found; local masters provide all required dependencies. Planned contextual states preserve main navigation and avoid replacement of granular permissions.

Error: UX recommendation command hit Windows cp1252 UnicodeEncodeError. Retried with Python UTF-8 mode; keep the approved product font/palette rather than switching to generic recommendations.
Discovery recovery: a read-only icon lookup encountered a missing legacy icon ID; safeToRetryWithoutCanvasRead=true. Replaced direct dereference with current instance/main-component inspection. One source-controller search used a non-existent inferred filename; source evidence from verified hiring/interview controllers remains valid. No design mutation occurred in either failure.
Employee Light/Dark business states added and initial layout/font checks pass: final approval pending/approved/declined, capacity block, bank/pools/import review, document versions/requests, correspondence failures, follow-ups, access changes and stale/loading states. Existing joining-ready action now submits for final approval rather than bypassing it. Manager Light final hiring and requisition decisions added; initial structure checks pass. New controls are contextual; main navigation stays unchanged. Detailed visual and semantic audit is next.
Manager and Admin Light/Dark composition completed with initial structure/font checks passing. A final-approval screenshot passes typography, card alignment and field geometry. User confirmed responsible Recruiter records actual joining after final approval; recorded the required backend permission alignment. Source inspection clarified cancellation rejects all live applications; design copy and impact guards are being aligned. Remaining work: external candidate/auth journeys, targeted semantic fixes, permission guards, complete reachability and final screenshots.
Final layout pass fixed badge widths and centered input values, and added semantic action icons. Candidate forms are grouped at a readable desktop width and require consent before submission. An expired candidate invitation no longer has a path into a named person’s portal. Specialist/interviewer outcomes remain in their assigned scope. Error: both Manager guard updates rolled back because changing instance text invalidated cached child node references (safeToRetryWithoutCanvasRead=true). Replaced cached text nodes with string snapshots and fresh instance-child discovery before each update; retrying the corrected batch.
Scoped layout/reachability audit passed all Employee/Admin business frames and found two small Manager width issues, both corrected. Main navigation stays at 3 Employee / 3 Manager / 8 Admin destinations; the extra frames represent prototype states. Token contrast checks showed Light primary white text on brand emerald at 3.11:1; adjusted Light gradients to semantic SGH dark green (minimum 5.44:1) and Dark gradients to SGH emerald/bright green with dark text (minimum 5.91:1). The font remains IBM Plex Sans. Final semantic cases include expired licence at actual joining and invalid/expired staff access.
Business scenario entries are connected from the original START HERE guides, including separate candidate journeys. Loading and provider-test prototypes now have timed terminal outcomes. Final case guards: pending final approval and clinical approval cannot join; candidate privacy consent is required; cancellation waits for resolved commitments; the dedicated final approver has isolated approve/decline/outcome paths. Main navigation remains unchanged.

Business design completed: all 252 new Business states pass the final six-page scoped audit, with valid destinations and reachability, IBM Plex Sans, aligned fields and no scoped row/content-clipping issues. Narrow approver/licence/interviewer paths remain isolated. Screenshot review exposed external content clipping missed by the original audit; fixed 48 external/access frames and strengthened the containment check. Also corrected Admin variable-chip wrapping, table columns/headers and drawer bounds. Six final screenshots reviewed. Primary endpoint contrast measured on 344 enabled controls: minimum 5.440:1 Light and 5.905:1 Dark. Saved business-design-readiness.md with decisions, lifecycle/ownership, capability parity, exceptions, code gaps and 26 local acceptance scenarios; business-design-verification.json retains audit and mutation evidence. No app code, mobile, database, deployment or Git mutation.

Local implementation planning requested. Verified HEAD 16e26b3 and existing scripts for web/API/worker type checking, lint, unit, database and browser checks. Read design handoff and isolated preview restart record. No application tests or services started in this planning turn. Search error: an inferred features/seat directory does not exist; App.tsx results remain valid. Corrected discovery to rg file inventory rather than assuming a feature path.

Saved docs/local-v2-replacement-plan.md with nine staged deliveries, entry/exit conditions, complete hiring trial after phase 5, preserved features/history, explicit permission and joining rules, safe local restore and final same-address cutover. Updated task_plan.md with future implementation checklist. Plan-only task complete; source files, services, database, Figma, mobile and deployment unchanged.

User requested English. Converted the complete saved local replacement plan to English, preserving phase order, acceptance criteria, approved rules and local-only scope. Implementation remains unstarted.

# Phases 1–3 implementation — 2026-10-13

Continued the local replacement on branch `codex/local-desktop-upgrade` at `16e26b3`. No commit, no production change, and no write to `Recruitment_DB`. Stopped after phase 3.

Preserved the pre-change stash `pre-phase1 local-desktop-upgrade snapshot 16e26b3` (object `bb5633aa901fdb7bb0d866d4596126d680899571`). Recovery remains `git stash apply stash^{/pre-phase1 local-desktop-upgrade snapshot 16e26b3}`. Older stashes were left in place.

Verified the isolated API start script, applied `20261013_joining_policy` only to `Recruitment_V2_Local_20261012` and to a disposable restore of the phase-1 dump, then dropped that restore. Tagged Registered Nurse as clinical and Senior Software Engineer as technical. Added local user `v2.interviewer@recruitflow.local` with the INTERVIEWER role. Scenario logins for admin, recruiter, manager, final approver, licence specialist and interviewer returned the expected roles. Mail stayed in the start script's console mode. Document bytes for the 26 stored keys are not on disk.

Shared desktop work: IBM Plex Sans on the token stack and dev fixtures, seat navigation shows every permitted destination, More (classic) stays the classic drawer, and TabsV2 covers loading, empty, error and disabled samples. Playwright reviewed 1280, 1440 and 1920 in both themes. Horizontal overflow was 0. Escape closed More (classic) and returned focus to that button. ArrowRight moved the fixture tab to Approval.

Joining foundation: `joining-policy.ts`, shared contract codes, additive Prisma columns, seed and migration grants, both Joined write paths, stale-approval invalidation, and narrowed hiring-case, licence and interview payloads. Unit tests cover missing approval, wrong owner, wrong organization, incomplete checks, expired licence, stale approval and preserved snapshots. Database specs that need a dedicated test URL were updated and still skip when that URL is unset.

AppShell assertion was corrected so Templates stays in the admin sidebar. The application-stage Joined path now also marks the hiring case Joined. The rules-pack allow-list includes `getInterview`. The master-data round-trip spec no longer constructs Prisma when its test URL is unset.

Package typechecks, lint, design-token check, web unit tests and worker unit tests passed. The API unit run passed after two spec fixes; one extractor timeout passed on an isolated retry. Package builds then passed: `pnpm --dir apps/api build` (nest build, exit 0), `pnpm --dir apps/web build` (tsc -b && vite build, exit 0), and `pnpm --dir apps/worker build` (tsc, exit 0). Root `pnpm build` was not used because that script is `pnpm -r build` and would re-enter the root script. `pnpm test:db` and `pnpm test:browser` were not run. Full command results, screenshots and restore evidence are in artifacts/local-desktop-upgrade/phases-1-3-report.md.

# Phase 4 implementation — 2026-10-13

Continued the local replacement on branch `codex/local-desktop-upgrade` at `16e26b3`. No commit, no production change, and no write to `Recruitment_DB`. Stopped after phase 4. Phases 5–9 are not started.

The web server already on `127.0.0.1:5173` and the API started with `artifacts/rollback-review/start-local-v2-api.ps1` were left running. Mail stayed in console mode. The outbox worker stayed stopped. No new migration. The phase 1 dump was not restored again.

Aligned the isolated reporting tree to the existing seed rules so Hassan could assign Sarah. Reduced VR-2026-011 from 2 seats to 1 after fixing the target body to send `seats`. Added obviously sample candidate Phase4 Sample and moved the application to Screening. Counts on My Work, Open jobs and Candidates come from those rows and survived refresh. Cancel impact allowed close and the job was left Open. More (classic) still opens and Escape closes it. Narrow overflow on the requisition drawer and the pipeline was 0.

Web typecheck and the requisition unit file were re-run after the seats rename and passed. Earlier api, web and worker typechecks, project eslint and the design-token check had already passed. `pnpm test:db` and `pnpm test:browser` were not run.

Walkthrough evidence, screenshots and the command list are in artifacts/local-desktop-upgrade/phase-4-report.md. Completed machine record: artifacts/local-desktop-upgrade/phase-4-walkthrough/evidence-continue.json.

# Phase 5 implementation — 2026-10-13

Continued the local replacement on branch `codex/local-desktop-upgrade` at `16e26b3`. No commit, no production change, and no write to `Recruitment_DB`. Stopped after phase 5. Phases 6–9 are not started.

Reused Vite on `127.0.0.1:5173`. Rebuilt the API with `artifacts/rollback-review/start-local-v2-api.ps1` after the application payload gained `rejectionReason`. Mail stayed in console mode. The worker stayed stopped. No new migration.

Ran one technical hire on `VAC-2026-010` and one clinical hire on `VAC-2026-011`. Each joining counted once. Final approval, a declined approval, the last seat, and an expired licence did not count a hire. The interviewer, licence specialist, administrator, and final approver were checked against those records. Phase 4’s Screening file is still Screening.

Package typechecks, project eslint (13 warnings), the design-token check, and the phase unit tests passed. The read-only recheck passed again after the browser clicked the blocked joining actions. Evidence is in artifacts/local-desktop-upgrade/phase-5-report.md.

# Phase 6 implementation — 2026-10-13

Continued the local replacement on branch `codex/local-desktop-upgrade` at `16e26b3`. No commit, no production change, and no write to `Recruitment_DB`. Stopped after phase 6. Phases 7–9 are not started.

Reused Vite on `127.0.0.1:5173`. Rebuilt the API with `artifacts/rollback-review/start-local-v2-api.ps1` after the local-message path import was fixed. Mail stayed in console mode. The worker stayed stopped. No new migration.

Sarah reviewed one candidate workbook (1 valid, 1 invalid, 1 duplicate skipped) and confirmed it. One bank identity stayed one person and was added once to `VAC-2026-011`. A small PDF is in that file’s document history. The failed acknowledgement attempt stayed when retry wrote a Sent attempt to the local test destination. Ahmed’s mail test stayed unverified. Phase 5 joined counts stayed 1 of 1 and 1 of 2. Phase 4’s Screening file is still Screening.

Package typechecks, project eslint (13 warnings), the design-token check, and the phase unit tests passed. Browser checks covered 1440 and 390 in light and dark. Evidence is in artifacts/local-desktop-upgrade/phase-6-report.md.

# Phase 7 implementation — 2026-10-13

Continued the local replacement on branch `codex/local-desktop-upgrade` at `16e26b3`. No commit, no production change, and no write to `Recruitment_DB`. Stopped after phase 7. Phases 8–9 are not started.

Reused Vite on `127.0.0.1:5173`. Rebuilt the API with `artifacts/rollback-review/start-local-v2-api.ps1` after the position-level target was saved, then read 17 back. Mail stayed in console mode. The worker stayed stopped. No new migration.

Ahmed saved the organization activity matrix, previewed a protected joining profile without applying it, deactivated one disposable user, changed that user’s reporting line, and recorded one local invitation. Hassan’s team result listed Mona only. Ahmed’s report and export covered the wider team. Sarah opened configuration and her application file without an individual salary. Phase 5 joined counts stayed 1 of 1 and 1 of 2. Phase 4’s Screening file is still Screening. Phase 6’s sample file is still Applied.

Package typechecks, project eslint (13 warnings), the design-token check, and the phase unit tests passed. Browser checks covered 1440 and 390 in light and dark. Evidence is in artifacts/local-desktop-upgrade/phase-7-report.md.

# Phase 8 implementation — 2026-10-13

Continued the local replacement on branch `codex/local-desktop-upgrade` at `16e26b3`. No commit, no production change, and no write to `Recruitment_DB`. Stopped after phase 8. Phase 9 has not been started.

Reused Vite on `127.0.0.1:5173`. Rebuilt the API with `artifacts/rollback-review/start-local-v2-api.ps1` before the walkthrough. Mail stayed in console mode. The worker stayed stopped. No new migration.

Two public applications were created on a new open sample job, `VAC-2026-P8`. `APP-2026-023` is `7a768adc-c9e1-49e1-8829-82cacdd73497`. `APP-2026-024` is `1c55dcca-939f-47e9-9620-ceadbf62e982`. Each portal showed only its own reference. A missing consent post was rejected and created no candidate. The requested PDF stayed `AwaitingVerification` with no joining check and no compliance row. A revoked link returned no file bytes. A held sample job refused scheduling, and an occupied slot refused a second booking. Sarah’s sign-in still opened My Work, and `/portal` stayed the candidate entry. Phase 5 joined counts, the phase 4 Screening file, the phase 6 Applied file, L4-TECH at 17, and the phase 7 users were left as they were.

Package typechecks, project eslint (13 warnings), the design-token check, and the phase unit tests passed. Browser checks covered 1440 and 390 in light and dark. Evidence is in artifacts/local-desktop-upgrade/phase-8-report.md.

# Phase 9 implementation — 2026-10-13

Continued the local replacement on branch `codex/local-desktop-upgrade` at `16e26b3`. No commit, no production change, and no write to `Recruitment_DB`. Stopped after phase 9. The public release has not been started.

Reused Vite on `127.0.0.1:5173` and the isolated API already on port 3000. Mail stayed off. The worker stayed stopped. No new migration. More (classic) was removed from the sidebar after each classic capability still had a gated home. Sarah’s login opens My Work and stays there on refresh. `/settings/targets` still opens Targets. Ahmed opened the advanced pipeline page and did not apply a rule. Anonymous document reads return 401. Desktop widths 1280, 1440, and 1920 were checked in light and dark, including Chrome and Edge for the classic URL. The phase-1 dump restored onto `recruitment_v2_phase9_recover_20261013` (15 users, 28 candidates, 8 vacancies, 18 applications) and that database was dropped. Protected walkthrough rows were unchanged afterward.

Package typechecks, project eslint (13 warnings), the design-token check, and the navigation unit tests passed. `pnpm test:db` and `pnpm test:browser` were skipped. Evidence is in artifacts/local-desktop-upgrade/phase-9-report.md.
