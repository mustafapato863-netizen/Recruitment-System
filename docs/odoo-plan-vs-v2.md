# Odoo-Style Redesign Plan vs Current Hiring V2

**Comparison date:** 26 October 2026  
**Baseline:** Hiring V2 on `main` at `e3602a1` (same as `origin/main`), plus the uncommitted Phases 0–5 working tree  
**Source plan:** `docs/odoo-style-redesign-plan.md`

This document maps Part 1 issues 1–7 and Phases 0–5 of the Odoo-style redesign plan against the current working tree.

---

## Part 1: Issues vs Current V2

| # | Issue | Current V2 Status | Notes |
|---|-------|-------------------|-------|
| 1 | Dual UI / Classic Remnants | **Redirected** | Classic route modules remain in `App.tsx`, and a signed-in visit no longer renders them. `v2Redirect` sends each inventoried staff URL to My Work, the job pipeline, the application file, Candidates, talent pools, vacancies, or the admin console. The recruiter sidebar lists My Work, Open jobs, and Candidates. |
| 2 | Siloed Screens & Context Loss | **Reduced** | A pipeline card’s next action and a My Work screen, schedule, scorecard, offer, send, answer, or pre-hire action open `/applications/:id` with that drawer. Joining readiness `licence_pending`, `ready`, `blocked`, and `review` open the pre-hire drawer. |
| 3 | Rigid Stage Gates & Waiting States | **Present (enforced)** | Gates (`GATE_SCREEN_NOTE_MISSING`, `GATE_SCORECARD_NOT_SUBMITTED`, `GATE_OFFER_NOT_ACCEPTED`, `GATE_JOINING_CHECKS_INCOMPLETE`) are enforced in UI (`moveCheck`, `GATE_BADGE`, `primaryFor`) and API. My Work shows many waiting/disabled actions. Compliance is correct; fluidity is low. |
| 4 | Seat & Permission Complexity | **Present** | Employee / Manager / Admin seats, special homes (final approver, license specialist), interviewer-only and recruiter-only restrictions, ownership/redaction on pipelines. Navigation and visible actions change by seat. |
| 5 | Application File Heaviness | **Addressed on the file** | Phase 1 added the stage rail, one primary next action, seven secondary controls, and chronological chatter. Owner, manager, and approver modes stay separate. Gates still open the existing drawers. |
| 6 | My Work Limitations | **Addressed for the named actions** | Overdue, today, and waiting stay. A waiting row names who it waits on. Screen, schedule, scorecard, offer, send, answer, and pre-hire open the matching file drawer. Interviewer-only interview rows stay on `/my-interviews`. |
| 7 | Additional Detected Issues | **Narrow board stacked** | Below 768px the pipeline columns stack and the page clips horizontal overflow. Ownership, redaction, and follow-up chips stay. Gates, RBAC, and audit are unchanged. |

**Summary:** Issues 3 and 4 stay in force: gates, RBAC, and audit are still enforced. Issues 1, 2, 5, 6, and 7 are addressed for the visit, the next action, and the narrow pipeline.

---

## Phases 0–5 vs Current V2

| Phase | Plan Goal | Current V2 Status | Gap |
|-------|-----------|-------------------|-----|
| **0 – Baseline** | Sync local V2, inventory classic pages, map every primary action to its drawer, produce hiring click-path matrix | **Present** | `docs/hiring-click-path-matrix.md` records the cycle, the classic staff routes from `apps/web/src/App.tsx`, and that hiring pages match `main` at `e3602a1` aside from the Phase 1 file chrome. |
| **1 – File Smart Bar** | Smart Action Bar + Stage Rail + Chatter on Application File; primary button always visible | **Present** | `ApplicationFileV2.tsx` shows the stage rail, one primary next action, secondary Note / Documents / Schedule / Scorecard / Offer / Pre-hire / Reject, and one chronological chatter. Gates still open the existing drawers on the same file. |
| **2 – Pipeline as Desk** | Cards show next action; drag/move opens required drawer; responsive layout; 80% of work on pipeline or one click into file | **Present** | Each open card shows its next action and any gate blocker. The next-action control opens `/applications/:id?drawer=`. A forward move the gate refuses does not patch the stage and opens that same path. Suggest from bank and Import CVs stay on the job header. Below 768px the five columns stack. |
| **3 – My Work Deep Links** | Every My Work row opens the file with the correct drawer pre-opened | **Present** | `fileActionHref` maps screen, schedule, scorecard, offer, send, answer, and pre-hire onto the file drawers. The four joining-readiness values use `?drawer=prehire`. Interviewer-only rows stay on `/my-interviews`. |
| **4 – Classic Retirement** | Redirect all classic routes; remove unused classic pages; simplify `destinations.ts` | **Present for visits** | Inventoried classic staff paths redirect to an existing v2 surface, except the two queues that still list work My Work cannot see. The final approver stays on `/hires/approvals/inbox`. The licence specialist stays on `/licenses`. A file they may open is `/applications/:id`, and a licence specialist opens it with `?drawer=prehire`. The sidebar no longer lists the classic labels. Seat items stay: recruiter My Work, Open jobs, Candidates; manager adds Requisitions and Team result; admin keeps the eight console items. A route the permission gate refuses still goes home. |
| **5 – Polish & UAT** | Mobile, keyboard, theme, audit, permission matrix, full hiring cycle UAT | **Present for the shipped checks** | Pipeline, My Work, destination, and application-file Vitest suites cover the new paths, including the refused move, interviewer-only rows, and a refused permission. Keyboard move and visible focus stay. No separate “as easy as Odoo” survey was run. |

**Summary:** Phases 0–5 are present on this working tree for the behaviors above. Compliance gates, RBAC, and audit remain in force and were not relaxed.

---

## Recommendation

Phases 0–5 of this plan are in the working tree. The click-path matrix is `docs/hiring-click-path-matrix.md`. The file keeps its stage rail and smart bar. Pipeline cards and My Work open the same drawers, and classic staff visits land on a v2 surface. Gates, permissions, and audit stay as they were.
