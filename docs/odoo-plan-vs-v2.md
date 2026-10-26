# Odoo-Style Redesign Plan vs Current Hiring V2

**Comparison date:** 26 October 2026  
**Baseline:** Hiring V2 on `main` at `e3602a1` (same as `origin/main`)  
**Source plan:** `docs/odoo-style-redesign-plan.md`  
**No code changed** in this comparison.

This document maps Part 1 issues 1–7 and Phases 0–5 of the Odoo-style redesign plan against the current V2 implementation on `main`.

---

## Part 1: Issues vs Current V2

| # | Issue | Current V2 Status | Notes |
|---|-------|-------------------|-------|
| 1 | Dual UI / Classic Remnants | **Present** | Classic routes still fully wired in `App.tsx` (`/hires`, `/licenses`, `/joinings`, `/interviews`, `/offers`, `/cv-bank`, `/access-control`, `/classic/*`). `destinations.ts` keeps `CLASSIC_PATHS`, seat destinations, special homes, and many redirects. V2 shell is default but dual system remains. |
| 2 | Siloed Screens & Context Loss | **Present** | Work still spans My Work → Job Pipeline → Application File → classic pages for some steps. Leaving context is common. Return navigation exists but is limited. Matches the gap called out in the existing Odoo benchmark report. |
| 3 | Rigid Stage Gates & Waiting States | **Present (enforced)** | Gates (`GATE_SCREEN_NOTE_MISSING`, `GATE_SCORECARD_NOT_SUBMITTED`, `GATE_OFFER_NOT_ACCEPTED`, `GATE_JOINING_CHECKS_INCOMPLETE`) are enforced in UI (`moveCheck`, `GATE_BADGE`, `primaryFor`) and API. My Work shows many waiting/disabled actions. Compliance is correct; fluidity is low. |
| 4 | Seat & Permission Complexity | **Present** | Employee / Manager / Admin seats, special homes (final approver, license specialist), interviewer-only and recruiter-only restrictions, ownership/redaction on pipelines. Navigation and visible actions change by seat. |
| 5 | Application File Heaviness | **Present** | `ApplicationFileV2.tsx` is a large dossier with `primaryFor()`, many drawers, modes (owner/manager/approver), tabs, history, evidence, and return logic. No compact Smart Action Bar + Stage Rail + unified Chatter as described in the plan. |
| 6 | My Work Limitations | **Present** | Good activity feed (overdue/today/waiting, interviews, joining) but actions mostly navigate away. Not a true in-context workspace. Deep links to the exact drawer are incomplete. |
| 7 | Additional Detected Issues | **Present** | Horizontal pipeline scroll, ownership/redaction friction, follow-up/SLA density, staff-to-candidate handoff not tightly integrated, recent work focused on parity/polish rather than flow simplification. Local-only V2 delta still needs baseline. |

**Summary:** All seven issues remain present on current V2. Gates, RBAC, and audit are correctly enforced and must stay in force.

---

## Phases 0–5 vs Current V2

| Phase | Plan Goal | Current V2 Status | Gap |
|-------|-----------|-------------------|-----|
| **0 – Baseline** | Sync local V2, inventory classic pages, map every primary action to its drawer, produce hiring click-path matrix | **Partial** | Plan document exists. Full click-path matrix for the hiring cycle does not yet exist in the repo. Classic inventory is implicit in code. |
| **1 – File Smart Bar** | Smart Action Bar + Stage Rail + Chatter on Application File; primary button always visible | **Partial** | `primaryFor()` exists and opens the correct drawer for the current stage/gate. No dedicated Smart Action Bar, no Stage Rail, no unified Chatter section. Activity is tabbed/historical rather than a live chatter. |
| **2 – Pipeline as Desk** | Cards show next action; drag/move opens required drawer; responsive layout; 80% of work on pipeline or one click into file | **Absent** | Pipeline is a kanban with DnD and gate checks. Cards do not show a primary next-action button that opens the file with the drawer. Horizontal scroll only. |
| **3 – My Work Deep Links** | Every My Work row opens the file with the correct drawer pre-opened | **Partial** | My Work rows link to the file or related pages. Pre-opening the exact drawer (`?drawer=`) is not consistently applied. |
| **4 – Classic Retirement** | Redirect all classic routes; remove unused classic pages; simplify `destinations.ts` | **Absent** | Classic routes remain fully active and permission-gated. Dual UI is still live. |
| **5 – Polish & UAT** | Mobile, keyboard, theme, audit, permission matrix, full hiring cycle UAT | **Absent** | No dedicated polish/UAT pass for the Odoo-style flow has been done. |

**Summary:** Phases 2, 4, and 5 are absent. Phases 0, 1, and 3 are only partial. Compliance gates, RBAC, and audit remain in force and must not be relaxed.

---

## Recommendation

Begin implementation at **Phase 0**: write the hiring click-path matrix (this is the next deliverable). Use it to drive Phase 1 (Smart Action Bar) without changing gate, permission, or audit behavior.
