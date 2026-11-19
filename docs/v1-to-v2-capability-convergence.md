# RecruitFlow — V1 strengths to preserve in the V2 product

Status: active convergence checklist. Updated 19 November 2026.
Baseline: `main` at `0451a00261c04ad70d3243f5ae749a0f03290dfc`. V1 remains a business-behavior reference, **not** a branch to merge wholesale.

## Objective

Keep the V2 role-based shell, focused job/application desks, unified data model, and restrained design while preserving the strongest V1 recruitment workflows. **A V1 route rendering inside the V2 shell is not equivalent to a completed native V2 migration.** Business rules must remain enforced by the API; nothing in this document declares production acceptance.

## V1 → V2 parity and improvement matrix

| Workstream | V1 strength worth preserving | Current V2 reference / gap | Acceptance gate | Priority |
| --- | --- | --- | --- | --- |
| Identity, privacy, access | Cookie sessions, refresh, tenant/row permissions, limited interviewer and approver visibility | Existing guards and `V2Shell`; verify all V2 routes and ATS read endpoints are ownership/tenant scoped, including direct URLs | Cross-org, role, pay redaction, 403/404 browser + API tests | P0 |
| Requisitions / workforce planning | Sequential approvals, headcount, budget/currency, start/defer, request-to-vacancy conversion | `RequisitionsV2` / `/vacancy-requests`; preserve lifecycle controls and history | Approval/decline/change request and reload-preserved fields under employee/manager | P1 |
| Job positions | Owner assignment, hold/cancel commitments, available capacity, SLA/aging, skill requirements | `OpenJobsV2` + `JobPipelineV2`, JD drawer | Concurrent capacity, hold/resume/cancel commitments, ownership and deep links | P0 |
| Candidate identity and CV intake | One identity per person, duplicate review, multiple docs, CV bank, controlled import, linked job applications | `CandidatesV2`, `/cv-bank`, `/import`; some old detail/import pages inside V2 shell | Single/bulk CV uploads with progress and recoverable failures, no accidental duplicate or data loss | P0 |
| Application file / pipeline | Stage gates, screening evidence, notes, activity timeline, ownership, 409 optimistic conflicts | `ApplicationFileV2`, `JobPipelineV2` | Persisted start-to-end transitions, conflict retry, audit trail, partial-load recovery | P0 |
| Skills matching, comparison | Evidence vs self-reported tags, no fictional match claims; human-reviewed comparison | `matching/skill-evidence.ts`, `CompareV2`; V2 ATS was granting unverified education/language points | Evidence-based score, unknown shown as unknown, no automatic rejection, role-gated access | P0 |
| JD extraction | Manual reviewer owns final criteria; versioned records | `JdReviewDrawer`, `jd-parser.service.ts`; no assumed 3-year experience where JD silent | PDF/DOCX/TXT, explicit review, version/lock/reopen semantics, no invented must-haves | P0 |
| Interviews | Day/week/month calendar, candidate self-scheduling, time zones, ICS exports, reminders, assigned scorecards | `TeamInterviewsV2`; V1 fast scorecard and some legacy routes remain | Schedule/RSVP/rebook/no-show/ICS + scorecard submit/revision across restricted roles | P1 |
| Offers | Versioned compensation, approval/revision, expiry, SAR/AED/EGP details and salary privacy | `/offers` still a legacy page within V2 shell; application-file offer actions live | Offer draft → approval → candidate response, immutable history, pay-safe disclosures | P0 |
| Final hiring / joining | Clinical and nonclinical required checks, final approval distinct from joining, capacity increment exactly once | `JoiningV2`, `/hires` legacy flows, license desk | Two real-data rehearsals (technical + clinical), expired license and no-approval blockers, double-click safety | P0 |
| Tasks, reminders, workload | Today/overdue followups, action deadlines, interviewer reminders | `MyWorkV2`, `TeamWorkV2`, notification bell | No missing tasks, accurate counts, deep links, role/manager scope, retry after failures | P1 |
| Reporting | Funnel, stage aging, time-to-fill, recruiter KPIs, team allocation | `RecruiterReportsV2`, `TeamResultV2`, `AdminReportsV2`; verify source parity | Compare counts to persisted hiring, approval and capacity records | P1 |
| Administration | Users/roles, configurable master data/workflows, integrations, immutable audit | V2 admin screens, some legacy routes | Authorized create/edit/invite/disable, audit/search, workflow policy impact | P1 |
| UX / accessibility | Responsive modes, keyboard access, navigation/back links, readable failures | V2 shell + older pages in shell | Keyboard/tab/focus, light/dark, 375/768/1024/1440, mobile no overflow | P1 |
| Deployment/recovery | Existing CI, backup/restore, rehearsed rollback | V2 rollback docs contradict `V2Shell`, which ignores `v2Seats` | CI green + verified legacy/image rollback + database/document restore on staging | P0 |

## What is changed on this branch

1. **Evidence-first ATS parity:** no credit from a self-reported skill alone; score only evaluable skill/experience evidence; degree and language evidence not implemented must remain **unknown** and require authorized human verification. ATS does not auto-reject.
2. **Truthful JD defaults:** no silent three-year requirement or invented bachelor's/English prerequisites; explicit no-experience role records zero; unspecified experience remains null.
3. **Retain V1 ICS capability in V2:** an authorized `/interviews/:id/ics` download with busy/error feedback is available on the V2 interview desk in both list and calendar views.
4. Focused regression tests for JD unspecified/entry-level behavior, evidence-only ATS, and interview ICS success/permission errors.

These are *proposed branch changes pending CI and review*, not proof that all V1 workflows have been ported.

## Follow-up PR sequence — do not bulk merge

### Phase 0: Release safety and test baseline (P0)
- Fix existing lint failures and API DB failures before any rollout: main GitHub Actions `44154609603` and `44154609617` were red on 17 November.
- Decide between a true per-seat V1/V2 route switch and an explicitly tested previous-deployment rollback. `RF_V2_SEATS=none` currently does **not** route users back to V1 because `V2Shell` ignores it. Remove false rollback claims until repaired.
- Verify deployed frontend/API/database commit/version; `main` and `live` are different histories.
- Run DB migration, backup/restore, secure file lifecycle, worker and API health gates on isolated data.

### Phase 1: Recruiter core parity (P0)
- Map all V1 candidate/upload/document actions and direct links into V2, keeping candidate identity stable.
- Preserve complete application stage gates, screening evidence, recruiter ownership, no hard deletes, conflict recovery.
- Verify job hold/cancel, headcount cap and requisition approvals against stored records.

### Phase 2: Decision and hire parity (P0)
- Port native V2 offers/approval/compensation review without changing version chains.
- Move clinical license checks, final approval and actual joining into coherent V2 screens; keep authorization separate.
- Rehearse technical and clinical hiring with explicit failed-path test cases.

### Phase 3: Interview and team productivity (P1)
- Consolidate the V1 fast scorecard, attendance, self-scheduling, ICS, reminders and calendar modes into V2.
- Keep role-specific interview and scorecard access; do not put full candidate files into interviewer view.
- Preserve action queue follow-ups, deep links and notifications.

### Phase 4: Administration, reporting and UX parity (P1)
- Bring remaining legacy admin/offer/candidate/import screens up to the same V2 visual and interaction standards.
- Reconcile recruiter and manager KPIs to source records, not mock data.
- Apply light, restrained surfaces, subtle borders and sparse blue/green accents. Avoid gratuitous color, animation and duplicate navigation.
- Exercise all roles, light/dark, keyboard, 375/768/1024/1440 widths, loading/empty/error/denied states.

### Phase 5: Controlled acceptance (P0 for release)
- Full multi-role browser/API flows using isolated persisted data: request -> approve -> job -> upload CV -> screening -> interview/scorecard -> offer -> hiring approval -> actual joining.
- No P0 defects, tests pass, metrics and cross-org access checks match source of record.
- Conduct rollback/restore rehearsal, capture evidence, then cut over gradually; never decommission legacy code solely because a PR says "parity."

## Explicit exclusions

- No autonomous rejection, self-certifying AI matching, or invented candidate qualifications.
- No hard deletion or destructive data migration; no production candidate data used in tests.
- No blanket import of V1 routes/colors/gamification into V2, no new Excel export action.
- No merge, deployment, environment change or production data mutation from this planning/port branch.
