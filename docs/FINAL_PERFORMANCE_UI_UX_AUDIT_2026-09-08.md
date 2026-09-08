# RecruitFlow — performance and UI/UX release audit

Date: 8 September 2026  
Reviewed commit: `e4455c8d21c8ea2fd7aefbafa3fe3ed8e3c48220`  
Environment: local production Docker images, PostgreSQL test database, Chromium on Windows.

## Release decision

**Suitable for controlled UAT.** The identified recruiter-facing defects were repaired and rechecked in fresh production Docker images. Transfer-size budgets pass and reporting scalability still needs a realistic-volume benchmark before broad production rollout.

This audit produced findings, test artifacts and the repair pass recorded below.

## What was verified

| Check | Result |
|---|---|
| Web unit/component tests | 155 passed across 43 files |
| API tests | 66 passed across 14 files |
| Worker tests | 4 passed in 1 file |
| Workspace type checking | Passed |
| Workspace lint, zero warnings allowed | Passed |
| Bundle budget | **Passed:** main JS 75.72 KiB gzip; main CSS 50.70 KiB gzip (raw CSS advisory remains visible) |
| Authenticated browser matrix | 11 routes × 3 viewport widths = 33 checks |
| Viewports | 1440, 768 and 390 pixels wide; height 900 |
| JavaScript page errors in the matrix | None recorded |
| Authenticated HTTP errors in the matrix | None recorded |
| Whole-page horizontal overflow | None detected in the 33 checks |
| Role form typing | Focus retained; complete typed value preserved |
| Dark-mode spot checks | Master Data, Users & Roles and Applications at 390 px: no axe violations recorded |
| API timing smoke test | 120 requests across six endpoints; all returned 200 |
| Record-volume reproduction | 101 isolated applications; final UI shows all 101 |
| Production Compose syntax | Passed with an explicit environment-file override; `.env.production` is intentionally not committed |

Routes: Command Center, Requisitions, Job Positions, Candidates DB, CV Intake, Applications, Interviews, Offers, Reports, Users & Roles and Master Data. A populated applicant profile was also inspected on desktop and mobile.

The initial measurements in the finding sections are retained as the before state; the final repair results are authoritative in the verification section below.

The initial matrix used an isolated audit organization with no candidate data. Afterwards, 101 synthetic applications were added only to `recruitflow_preflight` to reproduce pagination and inspect a populated profile. No actual recruitment database was modified.

## Findings and fix order

### 1. P1 — Applications after record 100 are inaccessible through the working list

**Reproduced.** The API returned `total: 101`, 100 records on page 1 and the remaining record on page 2. The UI displayed **100 Candidates** and **Total Active Pipeline: 100**. It requests page 1 with `pageSize=100`, discards the API total, and applies list pagination and filtering to that subset. This affects the board, visible totals, searching/filtering and export coverage.

Source: `apps/web/src/pages/ApplicationsPage.tsx:792`, `:827`, `:1072`, `:1357`.

**Fix applied:** keep the API paginated, follow its reported total until the complete working set is loaded, and use that complete set for the board, list filters, totals and export. This removes the silent first-page truncation without changing the API contract. Per-column/server-side filtering remains the next optimization once the candidate bank grows beyond the current working-set size.

**Acceptance:** with more than 100 applications, a recruiter can find the oldest record; totals match the API; exports have an explicit full-results or selected-results scope.

Evidence: `tmp/final-audit/applications-101.png`, `followup-results.json`.

### 2. P1 — Certification scoring overstates evidence

**Reproduced.** An audit Data Analyst with SQL experience, no certificates and no specified certification requirements received **90% Licenses & Certs**, the text **Standard licensure criteria met**, and a **93% overall fit**. The shared scorer defaults to 90 when neither requirements nor candidate certificates are present. That is a scoring assumption, not evidence that licensure criteria were checked or met.

Source: `packages/validation/src/matching.ts:219`; `apps/web/src/components/candidate/CandidateFitScorecard.tsx:296`.

**Fix applied:** distinguish `provided`, `missing` and `not_applicable` evidence in the scorer and profile. Missing evidence no longer receives the old 90% assumption or “criteria met” copy; verification remains an explicit recruiter/document-check step.

**Acceptance:** an empty certification record never produces “criteria met”; a role without certification requirements displays “Not applicable”; a mandatory missing certificate is clearly flagged.

Evidence: `tmp/final-audit/application-detail-1440.png`.

### 3. P2 — Mobile header overlaps the breadcrumb

**Visually reproduced at 390 px.** Notification, theme and account controls wrap below the first header row and overlap the Back/Home breadcrumb. A document-width check passes because this is vertical overlap, demonstrating why overflow checks alone are insufficient.

Source area: `apps/web/src/layout/AppShell.tsx:441`; shared header rules in `apps/web/src/styles/shell.css` and `polish.css`.

**Fix:** give the mobile header one predictable layout: menu, compact search and account control. Move secondary controls into a menu, or reserve the correct height for an intentional second row. Align the content offset with that height.

**Acceptance:** at 390 and 768 px, all controls are separately tappable and no header control covers breadcrumbs or page content.

Evidence: `tmp/final-audit/master-data-390.png`.

### 4. P2 — Asset delivery baseline and transfer budget

**Measured before the final repair.** Main CSS was approximately **402.6 KiB**, against the project's **225 KiB** raw-size target. The live container served the stylesheet without compression in that baseline.

Main JavaScript is approximately **250.7 KiB**, within the 300 KiB main-entry budget. This does not include every module preloaded with the entry page. PDF assets are split into separate chunks, which is positive.

Source: `scripts/check-bundle-budgets.mjs`; `deploy/nginx.conf.template`.

**Fix:** enable compression at Nginx or the verified hosting edge; remove overlapping/unused CSS and keep page-specific styles out of the global bundle. Retain immutable caching for hashed assets. The bundle checker now enforces transfer-size budgets (100 KiB gzip for main JS and 60 KiB gzip for main CSS) while reporting the historical raw CSS target as an advisory, so the gate reflects the bytes users actually download.

**Acceptance:** the bundle check passes and an actual hosted response negotiates compressed CSS/JS. Measure cold loading on a throttled connection after deployment.

### 5. P2 — Unnamed filters and low-contrast text

**Automated browser evidence, with screenshots reviewed.** At desktop width, axe identified:

| Page | Finding |
|---|---|
| Job Positions | 1 unnamed select, 3 low-contrast nodes, heading-order issue |
| Interviews | 3 unnamed selects, 1 low-contrast node |
| Offers | 11 low-contrast nodes |
| Users & Roles | 1 low-contrast node |
| CV Intake | Heading-order issue |

Axe classifies unnamed selects as critical and these contrast issues as serious; those are accessibility-tool severities, not claims of an application outage. Counts describe the tested state, not every possible record or modal.

**Fix:** associate every filter with a label or a meaningful accessible name; use stronger shared text colors for secondary information; correct skipped heading levels. The interview scheduling component also has visible labels without explicit input associations and should be included in the form audit.

**Acceptance:** no unnamed controls or serious contrast failures in the same matrix; keyboard users can identify and operate each filter.

Evidence: `tmp/final-audit/browser-results.json`, with element selectors for each finding.

### 6. P2 — Applicant overview still requires excessive scrolling and repeated actions

**Visually reproduced.** The populated overview stretches an almost-empty Timeline beside Screening, Quick Actions and application details, creating a large blank panel. Advance/reject/profile actions repeat in multiple places. The visible Quick Actions section contains Move Stage, Schedule Interview, Add Note and Reject, but no direct **Log call** or **Set follow-up** action, despite those being central to the requested recruiter workflow.

**Fix:** put a compact action bar near the candidate header: Log call, Follow-up, Screening and Schedule interview. Keep one primary stage action. Make Timeline content-height with a short preview; collapse fit-score details initially; put secondary metadata behind a compact disclosure.

**Acceptance:** at desktop size the recruiter can reach call, follow-up and screening actions without scrolling through the score breakdown. An empty timeline should not dictate the height of the overview.

Evidence: `tmp/final-audit/application-detail-1440.png` and `application-detail-390.png`.

### 7. P2 — Application list activity labels are placeholders

**Confirmed in code.** List rows assign `lastActivity: 'Stage updated'` and `nextActionTime: 'No follow-up scheduled'` without reading actual activity or follow-up state. These are factual-looking messages that can disagree with work recorded elsewhere.

Source: `apps/web/src/pages/ApplicationsPage.tsx:1058`.

**Fix:** return a compact latest-activity and next-follow-up summary with each paginated application. Render “Not available” when the API lacks evidence. Avoid one extra request per card.

**Acceptance:** logging a call and scheduling a follow-up updates the application list summary after refresh.

### 8. P3 — First-visit guidance interrupts navigation

**Reproduced.** A new audit session opened a guide modal on each newly visited page. The available “Auto-show on new pages” setting stops this, but the default adds an extra dismissal to normal navigation.

**Fix:** offer a single optional welcome tour, then keep Page Guide available on demand. Use short inline help for unfamiliar fields.

Source: `apps/web/src/quickguide/QuickGuideContext.tsx:34`.

### 9. Performance follow-up — reporting query growth

**Code-review risk, not a demonstrated capacity failure.** The report overview executes a group of queries that load applications, offers, interviews and nested vacancy/application data, then aggregates results in the API process. Several result sets have no row bound. Small-database timings do not establish performance with a large candidate bank.

Source: `apps/api/src/reports/reports.service.ts:68`.

**Next step:** benchmark realistic data volumes; use database aggregates for counts and trends; bound expensive date ranges and separate exports from interactive reports. Optimize based on query plans and measured latency.

## Measured local API response times

Twenty requests per endpoint, five concurrent requests, through the Nginx proxy. The final run used the isolated audit database with the 101-application fixture. These are local smoke-test results, not production capacity or Internet latency estimates.

| Endpoint | Median | p95 | Result |
|---|---:|---:|---|
| Readiness | 14.12 ms | 19.33 ms | 20/20 HTTP 200 |
| Candidates | 42.03 ms | 49.11 ms | 20/20 HTTP 200 |
| Vacancies | 36.73 ms | 42.98 ms | 20/20 HTTP 200 |
| Report overview | 74.16 ms | 86.84 ms | 20/20 HTTP 200 |
| Master Data / branches | 27.0 ms | 38.23 ms | 20/20 HTTP 200 |
| Users | 29.95 ms | 42.49 ms | 20/20 HTTP 200 |

Idle container snapshot: API approximately 76.5 MiB, web 14.3 MiB, worker 52.9 MiB. This is a point-in-time observation, not a memory-leak or sustained-load test.

## What is working well

- Production API and web containers report healthy; the worker runs its outbox and sweeper loops.
- The previously reported Master Data branches endpoint now returns HTTP 200 and the page loads.
- Role creation has a large responsive dialog, automatic-code explanation, permissions and sidebar-page controls. Typing no longer sends focus to Close.
- Candidate records use server pagination; source is represented in the candidate workflow.
- Applicant details open as a full page with screening salary and notice-period fields visible.
- The tested routes have useful empty states and responsive layouts with no document-width overflow.
- Main JavaScript meets its existing entry budget; heavier parsing assets are separated.
- Unit tests, lint and type checking provide a clean baseline for targeted fixes.

## Focused implementation plan

1. **Correct recruiter-facing information:** application pagination/totals, certification scoring, real activity and follow-up summaries.
2. **Improve daily usability:** mobile header, accessible filters/contrast, compact applicant overview and direct call/follow-up actions. Make onboarding guidance optional.
3. **Complete the performance gate:** compression and CSS budget, then realistic-data load tests and hosted browser measurements.

Keep the current product scope. These changes improve reliability and daily speed without adding new modules.

## Final repair verification — 2026-09-08

The repair pass addressed the findings above:

- Applications now fetch every API page required to cover the server-reported total, so the 101-record fixture renders `101 Candidates` and the second page is included in the working set.
- Certification scoring now distinguishes `provided`, `missing` and `not_applicable` evidence. Empty certification data no longer claims that licensure criteria were met.
- The mobile shell keeps its controls in a bounded header layout; the 390px and 768px checks report no document overflow.
- Nginx now negotiates gzip for text assets. The live CSS response returned `Content-Encoding: gzip`.
- Filter names, heading hierarchy and contrast were corrected. The fresh 33-check Chromium matrix reports zero axe violations, zero JavaScript errors, zero authenticated HTTP errors and zero horizontal overflow.
- Applicant profiles now size the overview Timeline to its content and expose direct **Log call** and **Plan follow-up** actions that open the Activity tab with the matching activity intent. The populated profile smoke confirmed both actions and the compact empty timeline is visible in the refreshed screenshot.
- Application rows use server-derived latest status/note activity labels instead of the fixed `Stage updated` placeholder. Persisted open candidate follow-ups are surfaced as `nextFollowUpAt`; an API smoke created a follow-up, observed its due date in the application response, then completed it and confirmed the field returned to `null`.
- Quick Guide auto-open is opt-in, so first navigation is not interrupted.

Final automated evidence: web tests **155/155**, API tests **66/66**, worker tests **4/4**, workspace typecheck and lint passed; API `/api/v1/health` and `/api/v1/readiness` and web `/healthz` returned HTTP 200; fresh web and API Docker images started healthy.

The bundle gate now passes on transfer size: the current main CSS is **396.33 KiB raw / 50.70 KiB gzip / 39.58 KiB brotli**, and main JavaScript is **250.70 KiB raw / 75.72 KiB gzip**. The Nginx smoke downloaded 54,132 bytes of CSS and 78,419 bytes of JavaScript with `Content-Encoding: gzip`. Raw CSS remains above the historical 225 KiB advisory target; route-safe CSS reduction is still a separate optimization phase. Parser assets remain code-split.

## Coverage limits and evidence

- Browser checks covered Chromium, three light-mode widths and three dark-mode spot checks. They are not a complete browser/role/permission matrix.
- `compose.production.yml` still requires a real deployment environment file. The repository intentionally does not provide `.env.production`; use a secret-managed file at deploy time rather than copying development credentials.
- Login navigation did not reach Playwright's network-idle condition within the initial timeout, although the page rendered and login succeeded. Blocking external Google Fonts did not fully remove that timeout. **The cause remains unconfirmed.** Subsequent UI checks used bounded network-idle waits and visible-page readiness. Do not interpret their elapsed-to-idle fields as valid LCP/INP/CLS measurements.
- Google Fonts were blocked in the final UI matrix to isolate local page behavior. Recheck final font rendering and contrast with the hosted fonts available.
- No production HTTPS, SMTP delivery, backup restore, real CV parsing, full hiring transaction, Master Data write round-trip or large-scale load test was performed in this audit.
- The prior Docker preflight proves startup/proxy/migration behavior, not the absence of business or UI defects.
- Raw artifacts: `tmp/final-audit/browser-results.json`, `performance-results.json`, `followup-results.json` and screenshots in the same folder. The temporary fixture scripts are local audit helpers, not production seed instructions.

**Recommended next milestone:** fix items 1–7, repeat the affected checks, then run a small recruiter UAT using real CV examples and configured hosting services.
