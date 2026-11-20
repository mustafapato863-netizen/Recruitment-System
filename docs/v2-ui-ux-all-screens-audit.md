# RecruitFlow V2 — UI/UX and screen-coverage audit
**Date:** 19 November 2026  
**Branch:** `feat/v2-complete-ux-coverage-20261119`  
**Status:** proposed branch enhancement; **not a production UX certification**  
**Program:** [Full replacement gates](./v2-complete-replacement-programme.md) · [GitHub issue #47](https://github.com/mustafapato863-netizen/Recruitment-System/issues/47)

## What “all screens” means

The **source-of-truth list of all 64 registered routes** lives at
[`apps/web/src/v2/screenRegistry.ts`](../apps/web/src/v2/screenRegistry.ts).
`apps/web/src/v2/__tests__/route-coverage.test.ts` fails CI if a screen is
added/removed in `App.tsx` without an intentional update to this catalog,
or if a supported sidebar/admin destination has no declared route.

| Scope | Registered paths | State |
|---|---:|---|
| Public authentication, self-schedule, candidate portal and careers | 12 | Outside authenticated V2 shell; separate responsive and privacy validation required |
| Native V2 recruiter, manager, admin and hiring workflows | 30 | Native V2 primitives (`apps/web/src/v2/` & `components/v2/`) |
| Retained V1 components / old staff workflows | 9 | Routed via `apps/web/src/v2/pages/*V2.tsx` adapters inside V2 shell; full native UI rewrite pending |
| Supported aliases and catch-all | 13 | Redirects with intentional destination; no independent screen |
| **Total** | **64** | **100% route-level inventory, 13 classic routes retired to redirects** |

## Changes in this UI/UX enhancement branch

1. **Consistent visual language:** calm white/neutral surfaces, thin visible borders, compact tables, readable headers and status cues, brand blue/green reserved for primary actions/meaningful statuses; dark-theme equivalents use the canonical tokens.
2. **Keyboard accessibility:** replace the previous zero-width focus token with a visible 2px outline and focused field state, preserving focusable skip link; mark only keyboard focus, not pointer clicks.
3. **Cross-device layout:** horizontal table scrolling instead of cut-off data; wrap action bars; compact 2-column and 1-column summaries at tablet/mobile widths; 44px targets on coarse pointers; flexible filter tabs; safe overflow on retained pages.
4. **Workflow discoverability:** contextual, permission-filtered Quick access links in employee My Work and manager Team Work; do not fill the persistent sidebar with secondary links.
5. **Critical routing parity:** a normal authorized employee/manager can reach native `/offers`, `/hires`, `/hires/:id` and `/joinings`. These were rendered in `App.tsx` but previously the seat router sent them home. Restricted interviewer, final approver and licence roles retain their focused queues and their own file permissions.
6. **Regression guards:** route registry parity, navigation targets, signed-in stylesheet isolation, visible design tokens, and authorized/denied quick-access and route tests.

No candidate, offer, compliance or payroll records are changed by these UX changes.

**Native candidate document vault:** `/candidates/:id/documents` now uses V2 primitives, requires an actual PDF/DOC/DOCX binary for creation, shows only server-confirmed metadata, provides scan/consent/retention-gated downloads and reason-required audited archival. Phantom size/date, non-persistent privacy switches, and metadata-only document creation have been removed. Functional regression tests added; full business UAT remains pending.

## Coverage by product area

| Area | V2 / retained implementation | User tasks to verify before V1 retirement |
|---|---|---|
| My Work / Team Work / Approvals | Native V2 | Tasks, overdue/next actions, date filters, accessible shortcuts, correct owner scopes, empty/partial/forbidden and stale data |
| Open jobs / pipeline / requisitions | Native V2 | Jobs table/card/board, drag conflicts, JD review, bulk or single CV upload, job hold/resume/capacity, approval drawers |
| Candidates / comparison / Match Skills | Native list + comparison, retained candidate detail/Match Skills; native V2 document vault | Identity, CV extraction, duplicates, multiple documents, download/delete permissions, application links, evidence-only matching, zero invented scores |
| Interviews | Native team/calendar, retained My Interviews scorecard UI | Schedule/reschedule/RSVP/ICS, future-vs-completed scorecard, interviewer-only view, timezone, calendar keyboard access |
| Offers | Native V2 list + decision drawer; legacy APIs preserved | Version history, approvals, signatures/response, compensation visibility, expiry, recoverable API errors |
| Hires / joinings / final approvals / licenses | Native lists/inboxes, retained full hiring detail | Clinical vs nonclinical checks, final approval distinct from joining, concurrency/headcount, expiry and verification history |
| Reports and results | Native V2 for main seats, retained job analytics | Source-data reconciliation, honest zero/unknown, permission-safe KPI totals, CSV export not introduced |
| Administration | Native V2 users/roles/master data/pipeline/templates/audit/integrations | Create/edit/invite, role gates, two-tenant audits, accessibility, matching real stored data |
| Candidate portal / public jobs / account flows | Public pages, not V2 shell | Phone/desktop responsiveness, keyboard and screen reader, submit/retry, privacy and token expiry |
| Retained settings, CV bank, import and candidate profile | Still retained components | Full native UI redesign **pending**; existing APIs, history and rights must remain functional during migration |

## Exact UX acceptance matrix

For **every real rendered screen**, record evidence of the following (mark as unverified until checked):

- [ ] 375, 430, 768, 1024, 1280 and 1440px viewports; light and dark theme, no clipped dialogs/actions or body overflow
- [ ] Keyboard tab navigation, visible focus, Escape/return-focus for drawers, proper heading and form labels
- [ ] Screenreader/axe checks on critical flows, non-color-only statuses, reduced-motion preference
- [ ] Loading, empty, error, 403/404, retry and partial-success states show truthful outcomes
- [ ] Relevant internal links resolve to permitted destinations and preserve record IDs/return paths
- [ ] Data survives refresh; no fabricated counters, duplicate candidates, unverified ATS credits or stale offer versions
- [ ] Candidate PII and compensation are never accessible by an unauthorized role or tenant
- [ ] Single-CV and bulk-CV intake remain the candidate creation entry points; **no manual-entry creation form**
- [ ] No Excel-export action (including legacy candidate and vacancy views)
- [ ] Browser matrix + API integration + accessibility suites pass for the exact candidate commit, not just unit tests

## Priority completion order — *remaining*, not completed by this PR

**P0:** candidate profile; CV bank upload/dedup/retention; import center; clinical/technical hiring-case detail; protected history and signing; rollback/restore and E2E gates.  
**P1:** job analytics, full settings/targets and role-aware admin usability; polished candidate portal, interviewer's scorecard; reporting deep links.  
**P2:** optional density preference, advanced search shortcuts, explanatory microcopy and finer mobile touch interactions after P0/P1.

**No-go:** This audit proves route-level enumeration and a shared implementation change. It does **not** certify that every 64 route has passed UAT or that V1 can be removed. Follow the R0–R9 owner sign-off and documented rollback requirements before production cutover.


**Classic route retirement:** `/classic/candidates`, `/classic/vacancies`, `/access-control`, `/settings`, `/settings/targets`, `/classic/master-data`, and `/classic/pipeline-settings` now permission-gate then redirect to their functional V2 destinations (`/candidates`, `/vacancies`, `/roles`, `/master-data`, `/pipeline-settings`). Their Excel/CSV export buttons/handlers (including on `JobAnalyticsPage.tsx`) have been removed; the candidate V2 intake continues to create candidates only from CV uploads. Import templates and failed-import reports remain downloadable as workflow utilities.
