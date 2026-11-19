# RecruitFlow V2 — Complete V1 Replacement & Enhancement Programme

**Owner decision:** Replace V1 with V2 **only after** operational parity, security, data recovery, and release acceptance are proven.
**Baseline reviewed:** `main` `0451a00261c04ad70d3243f5ae749a0f03290dfc` (17 Nov 2026).
**Prepared:** 19 November 2026. **Status:** Implementation programme — **V2 is NOT production-certified**.
**Related:** [V1↔V2 capability inventory](./v1-to-v2-capability-convergence.md) (in PR #44); enhancement PR #44; release-gates PR #45.
**Rule:** V2 is the destination and V1 the reference for valid behaviour. This is NOT a wholesale merge of `live` into `main`.

## 1. Fixed product boundaries

1. Keep one RecruitFlow product, the existing PostgreSQL source of truth, historical IDs, API contracts (unless versioned), and V2 role-based navigation; avoid parallel databases.
2. Keep the clean, restrained, Notion-like desktop workspace: pale surfaces, thin borders, compact data-heavy tables, subtle brand-blue/green statuses, consistent typography, persistent light/dark and responsive/mobile paths. Do not import every V1 color or duplicate pages.
3. Candidate creation entry point = single CV or bulk CV upload; any legacy/manual edit support needed for existing data may remain authorized but must not be the primary intake flow. No new Excel-export control. Workbook/CSV **import** remains distinct for supported administrative datasets.
4. Every change to application stage, ownership, approval, offer, document, joining or payroll-visible data must be authorized in the API and audited. UI hiding alone never secures it.
5. Matching/ATS is advisory. No auto rejection, invented skills, fabricated qualifications, or unverified education/language credit. Show evidence, unknowns and explainability.
6. Preserve immutable versions and history; never silently merge/delete candidates or destroy documents. No production data mutations in engineering validation.
7. Scope: recruitment through actual joining and readiness; not a payroll or full HRIS replacement. External services (mail, WhatsApp, calendars, parsers) require live provider verification before claimed ready.

## 2. Evidence/state definitions

- **Implemented:** code exists in a branch; does not imply tested/merged.
- **Validated in CI:** passing required checks for the exact target SHA and supported DB migrations, with logs.
- **Validated in UAT:** recorded walkthrough using persisted, isolated data; checked with all intended role families.
- **Production-accepted:** deployment version, recovery route, monitoring, data governance and release owner sign-off recorded.
- **Blocker:** failing security, data integrity, hiring approvals/joins, recovery or gating test; cannot be waived without explicit risk acceptance.

## 3. Workstream-by-workstream delivery and acceptance

### Gate R0 — CI, security and rollback (P0; prerequisite of every other module)

- [ ] Merge the tested changes from PR #45 after review; keep `main` clean, lint/typecheck/build/bundle/audit/migrations/web/API/worker/security/browser tests green.
- [ ] Resolve baseline failed rules-pack DB tests including completed-vs-future scorecards and hiring-case fixture constraints.
- [ ] Verify ATS endpoints use tenant + file ownership guards (direct link tests for owner, non-owner, interviewer, manager, admin, cross-tenant).
- [ ] **Correct the rollback contradiction.** Current `V2Shell` always presents V2 even when `v2Enabled=false` or `RF_V2_SEATS=none`; existing documentation calling that instant V1 rollback is inaccurate. Choose and implement **one** tested mechanism:
    - **A**: reinstate a real per-seat V1 shell + route tree, then test `RF_V2_SEATS`, org overrides and all legacy deep links; **or**
    - **B**: freeze a known-good V1 web/API deployment as the blue/green rollback artifact; rehearse atomically switching traffic and verifying DB/schema compatibility. Do not describe `RF_V2_SEATS` as rollback with B.
- [ ] Establish branch protection and required GitHub checks; reject failed or skipped required suites and Vercel-only-success false positives.
- [ ] Record version/commit of live frontend, API, worker, DB migration, object-store adapter and web service; stage on isolated backup, not production.
- **Exit:** verified clean commit, complete green CI, documented and rehearsed rollback, and no unguarded sensitive ATS endpoint.

### Gate R1 — Users, roles and organizations (P0)

- [ ] Employee/manager/admin navigation by real `/auth/me`; interviewer-only, licensing specialist, final approver and cross-organization restrictions.
- [ ] Login/invite/forgot password/refresh/expiry/logout across tabs; no authentication bounce for old bookmarks.
- [ ] Manager scope includes only assigned/direct-report jobs. Admin oversight does not expose compensation to unrelated roles.
- [ ] Salary and candidate PII remain redacted in job list, matching, comparison, reports, audit/search, document downloads and error responses.
- **Exit:** permissions matrix across two tenants, URL/IDOR abuse cases and 403/404 boundary assertions passed.

### Gate R2 — Candidate bank, CV intake and documents (P0)

- [ ] Native V2 upload action for **one or multiple CVs** (PDF/DOCX and accepted ZIP), progress, validation, partial successes, retry, cancelled jobs and import history.
- [ ] Keep candidate identity/aliases, duplicate review, multiple document versions, download and remove-or-archive rules; never duplicate applications silently.
- [ ] Preserve V1 CSV/XLSX **import** preview/validation for authorized datasets. Never add Excel **export**; document import errors are recoverable.
- [ ] Candidate detail, documents, CV bank, talent pools, add-to-job and direct bookmarks use V2 components/navigation and correct authorization.
- [ ] Protected storage, malware scan, retention, signed downloads and backup/restore demonstrated with actual supported provider.
- **Exit:** batch with valid/invalid/duplicate CVs persists correctly; identity and document history survive refresh, retries and recovery.

### Gate R3 — Requisitions, approvals, positions and capacity (P0)

- [ ] Preserve request creation, headcount, budget and EGP/AED, due date, owner, sequential approvals, rejection/revision and vacancy activation.
- [ ] Job assignment, pipeline, status transition, hold/resume/cancel and side effects (already scheduled interviews/offers/joining) run through existing API gates.
- [ ] JD upload/extraction with reviewer-edited/locked criteria, version trail, no implicit education, language or experience requirements.
- [ ] Prevent capacity overfill on concurrent joins, cap reductions below commitments and duplicate activation.
- **Exit:** request → approved job → owner → candidate application; complete rollback of test writes; all counts match DB records.

### Gate R4 — Application file, pipeline and candidate matching (P0)

- [ ] Native V2 file detail: CV, notes, screening, activity/audit, stage reasons, task follow-up, gates, interviews, offer and joining decision surfaces.
- [ ] Preserve optimistic locking/409 conflicts, stage permissions, transition evidence, no unauthorized move and recoverable partial reads.
- [ ] Carry V1 skill evidence vs profile-only tags, transparent compare and suggestion behavior into V2; retain recruiter decision authority.
- [ ] Remove placeholder education/language points and false semantic-matching claims. Maintain versioned ATS calculation and honest unknown/needs-review state.
- [ ] Validate scoring and suggestions against technical + clinical sample sets with missing documents, negated skills, alternative qualifications and CV extraction errors.
- **Exit:** comparison/scorecards do not expose another person's file; all suggestions are explainable; regression dataset accepted by recruiters.

### Gate R5 — Interviews, scorecards and calendar (P0 for release)

- [ ] Unified native V2 desk: day/week/month/list, user timezone, interviewer panel, location/meeting URL, conflict checks, scheduling/rescheduling/cancel/no-show.
- [ ] Preserve V1 self-scheduling links, RSVP, ICS export, controlled invitation/reminder outbox and response history.
- [ ] One assigned interviewer may see only their own CV/scorecard access; submitted scorecards are immutable, with reasoned revisions.
- [ ] Reject scorecard submission for future interviews, unknown/unassigned interviewers, no evaluation notes, and forbidden changes.
- **Exit:** recruiter + interviewer + manager end-to-end scenario with persisted history, provider failure recovery and permission matrix.

### Gate R6 — Offers, compensation, approvals and joining (P0)

- [ ] Replace V1 `/offers`, `/hires`, `/hires/:id` with V2-native experiences once parity is tested. Until then retain working legacy routes safely.
- [ ] Preserve offer version chain, composition, approval/reject/resubmit, send channel/template, acceptance/expiry/decline and compensation privacy.
- [ ] Required checks come from each approved job snapshot; clinical licence verification and expiry apply to relevant roles, not all technical jobs.
- [ ] Final hiring approval must be distinct from offer acceptance and **actual joining**, recorded only by authorized responsible recruiter.
- [ ] Joining is exactly-once under concurrency; no double headcount counting; no join without final approval, check completion or free capacity.
- **Exit:** one technical and one clinical hire from application to joined, plus deliberately blocked cases, run against an isolated DB.

### Gate R7 — Team work, reports and administration (P1; P0 where roles/approvals are involved)

- [ ] My Work and Team Work show persisted, correctly scoped overdue/today/upcoming tasks, interviews, approvals, reminders and actionable record links.
- [ ] Recruiter, manager and admin reports derive joined, offer acceptance, funnel, time-to-fill and targets from the same audited records.
- [ ] V2 users/roles, invitation and deactivation; master data, pipeline and templates, integration health, immutable audit and essential settings.
- [ ] Error/empty/loading/forbidden/stale-cache states are explicit; no placeholder sample metrics in production, zero only when proven zero.
- **Exit:** source-record reconciliation for counts plus two-org role and audit tests.

### Gate R8 — UX, performance, accessibility and operations (P1, release-blocking if core paths affected)

- [ ] Responsive at 375/768/1024/1280/1440/1920; light/dark tokens, keyboard focus/trap, high-contrast status semantics, accessible dialogs and screenreader labels.
- [ ] Preserve clean compact UI; no heavy glass/animation dominating views; no duplicate sidebar actions or Excel export.
- [ ] Validate API pagination, N+1 queries, CV import memory, document storage, worker retries, slow queries, bundle budgets and production-safe logs.
- [ ] Record observability: failed queue jobs, auth errors, parsing failures, notification delivery/retries, application errors and security alerts.
- [ ] Backups include DB and file blobs; restore rehearsal checks data count, checksum/document linkage and permissions.
- **Exit:** browser/a11y performance checks on core workflows plus operational alerts, runbooks and support ownership.

### Gate R9 — UAT, cutover and V1 retirement (P0)

- [ ] All required CI checks pass for the **exact** release SHA. PR review approvals recorded, no unresolved P0 defect or unauthorized permission expansion.
- [ ] Release owner confirms V2 parity matrix with persisted sample data for admin, manager, recruiter, interviewer, license verifier, final approver, candidate-facing flows.
- [ ] Test full request → approved job → CV intake → duplicate decision → application → screening → interview → submitted scorecard → offer approvals → accepted offer → required checks → final hiring approval → **actual** joining.
- [ ] Verify failure paths: wrong organization, stale optimistic version, withdrawn candidate, cancelled/held job, expired licence, full headcount, malformed CV, worker/mail failure and session expiry.
- [ ] Back up and restore test environment; verify rollback mechanism under live-like traffic. Do not rollback code if it requires an incompatible database schema.
- [ ] Canary rollout with monitored business metrics, no phantom task/job/candidate counts and rollback rules.
- [ ] **14 consecutive calendar days** of monitored production bake with no rollback and signed business acceptance (retain V1 artifacts meanwhile).
- [ ] Only then retire dead V1 routes/components/imports and associated CSS in a separate removal PR, preserving redirects/bookmarks and history; run CI/recovery again.
- **Exit:** signed go/no-go record and versioned release artifact. Then, and only then, mark V2 as fully replacing V1.

## 4. Required acceptance suite (test IDs)

| ID | Scenario | Required observation |
| --- | --- | --- |
| E2E-01 | Recruiter uploads one CV | Candidate identity created exactly once, document retrievable |
| E2E-02 | Bulk valid + invalid + duplicate CVs | Partial import errors shown, no duplicate application, retry-safe |
| E2E-03 | Manager approves requisition | Vacancy created once, budget/capacity/history preserved |
| E2E-04 | Manager holds, resumes or cancels job | Existing commitments retained/resolved per policy |
| E2E-05 | Recruiter screens and moves application | Stored note and stage gate, history survives reload |
| E2E-06 | Ownership/cross-tenant direct URL | 403/404, no candidate/score/pay data leakage |
| E2E-07 | ATS with unknown degree/language | Unverified marked unknown, no fabricated points or auto rejection |
| E2E-08 | Interview schedule → RSVP → scorecard | Only assigned panel, no future submission, revision audit |
| E2E-09 | Calendar ICS download | Valid event for authorized user; denied for unauthorized |
| E2E-10 | Offer revision → approval → accepted | Distinct immutable versions, compensation permission enforced |
| E2E-11 | Technical hire through joining | No unrelated clinical license required, final approval and actual join separate |
| E2E-12 | Clinical hire and expired license | Must pass specialty requirements, cannot join with expired license |
| E2E-13 | Concurrent two join actions for last seat | Exactly one success, headcount increment exactly once |
| E2E-14 | All roles' My/Team Work and Reports | Counts reconcile with persisted records, no fictitious zeros |
| E2E-15 | User invitation / disable / master data | Permissions correct, past history remains |
| E2E-16 | CV/job/import/offer/provider error | Recoverable error and audit, no silent data loss |
| E2E-17 | 375px, 768px and keyboard navigation | No cut-off core action, dialog focus accessible |
| E2E-18 | Rollback and restore | Verified supported route, recovered files/DB and safe auth |

## 5. Suggested implementation sequence & branch policy

1. **Release foundation:** complete/validate #45 on a clean branch; resolve route-guard issues and CI baselines. Gate R0.
2. **Matching/JD/interview low-risk parity:** complete/validate #44 against latest main after R0, preserve evidence-first semantics.
3. **Recruiter workflow PRs:** R2 + R3 + R4, one vertical slice with tests per PR and no fake data.
4. **Decision workflow PRs:** R5 + R6, migrate legacy view by view, keep correct APIs and version history.
5. **Admin/reporting/UX PRs:** R1 + R7 + R8; enforce common design tokens and roles.
6. **Acceptance/cutover:** R9 release rehearsal, choose tested rollback, staged rollout, 14-day bake and separate decommission PR.

PRs must be **small and reviewable**. Never merge a broken CI build or push/deploy/reset files/change credentials/alter production data to accelerate this programme.

## 6. Current known blockers (19 Nov 2026)

- `main` CI: lint failures and API DB suites failing at baseline commit `0451a00` (GitHub runs `44154609603`, `44154609617`).
- V2 shell **ignores** backend `v2Seats` and `v2Enabled`; per-seat rollback in the playbook is ineffective.
- Some signed-in V2 URLs still render legacy `apps/web/src/pages` screens under the V2 shell, including candidate detail/CV bank/import, offers, hiring case and certain settings; each must be audited before retirement.
- ATS in baseline awards fabricated education/language score and lacks complete evidence semantics; #44 proposes fixes and is **not merged**.
- External CV storage/malware scan, email delivery, refresh long-session checks, backup restore, production API/database cutover and cutover owner sign-off not evidenced.
- Existing CI failures must not be masked by Vercel deploy status or browser-only success.

## 7. Stop/go policy

**GO** only when R0–R9 exits are signed and evidence-linked, **all** required tests and releases pass for exact deployed versions, the rollback works, and the business owner accepts the live-like scenarios.

**NO-GO** if any missing authorization, unbounded data loss, incorrect joining approval/capacity, unrehearsed rollback, unknown production persistence, or failing required CI gate remains.

**Never claim full V2 replacement from code presence, a merged PR, a green Vercel build, or this plan alone.**
