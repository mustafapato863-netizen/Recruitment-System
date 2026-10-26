# RecruitFlow Odoo-Style Redesign & Issue Detection Plan

**Date:** 26 October 2026  
**Status:** Draft for review  
**Baseline:** Current `main` of `mustafapato863-netizen/Recruitment-System` (v2 shell is present; user notes local v2 enhancements may not yet be fully merged). Live Vercel deploys from `main`.

Comprehensive detection of workflow friction + detailed target architecture to achieve Odoo-like ease of use while preserving compliance, RBAC, and audit.

---

## Part 1: Comprehensive Issue Detection

The following issues were confirmed by code inspection of `apps/web/src/v2/destinations.ts`, `apps/web/src/App.tsx`, `apps/web/src/v2/pages/MyWorkV2.tsx`, `apps/web/src/v2/pages/JobPipelineV2.tsx`, `apps/web/src/v2/pages/ApplicationFileV2.tsx`, `apps/web/src/layout/V2Shell.tsx`, and the existing Odoo benchmark report + simplification plan in `docs/`. v2 improvements (My Work, Pipeline kanban, Application File drawers) have not eliminated the core friction.

### 1. Dual UI / Classic Remnants (Highest Priority)

- Classic pages remain fully routed and PermissionGate’d in `App.tsx`: `/hires`, `/licenses`, `/joinings`, `/interviews`, `/offers`, `/cv-bank`, `/access-control`, `/classic/*`, etc.
- `destinations.ts` maintains a large `CLASSIC_PATHS` list, `PARAM_EQUIVALENT` redirects, `EQUIVALENT` fallbacks, `specialHome()` for `FINAL_HIRING_APPROVER` and `LICENSE_SPECIALIST`, and seat-specific `SEAT_DESTINATIONS`.
- Result: Users (and code) constantly decide “is this v2 or classic?”. Navigation is unpredictable. Special roles land on classic pages. Odoo has one consistent experience.
- Additional detail: Recruiter-only users are blocked from requisitions; interviewer-only users are heavily restricted to `/my-interviews`. Redirects fire on many legacy URLs.

### 2. Siloed Screens & Context Loss

- Work is split across My Work → Job Pipeline (kanban) → Application File (large dossier page) → classic pages for certain steps (hiring case, licenses, calendar).
- Leaving the file or pipeline to schedule, score, offer, or confirm joining forces re-finding the record. The existing Odoo benchmark report (`docs/RecruitFlow_Candidate_Journey_Odoo_Benchmark_Report.html`) explicitly calls this “Siloed Fragmented Screens”.
- Return navigation (`fileReturnTo`) exists but is limited and fragile.

### 3. Rigid Stage Gates & Waiting States

- Hard gates: Screen note required before Interview, Scorecard before Offer, Offer accepted before Pre-hire, joining checks before Joined. Enforced both in UI (`moveCheck`, `GATE_BADGE`) and API.
- My Work surfaces many “Waiting on approver / interviewer / candidate” rows with disabled actions and reasons. Primary actions on Application File open drawers that often leave the user in a waiting state.
- Correct for healthcare compliance, but multiplies steps and feels blocked rather than fluid. Odoo uses stage progression that can open the next action contextually without as many hard locks.

### 4. Seat & Permission Complexity

- Three seats (employee / manager / admin) + special roles. `MyWorkRoute` renders `TeamWorkV2` for managers. Destinations, homes, and visible actions change by seat.
- Ownership restrictions on pipelines (only owner + manager). Redacted jobs. Many `canOpenRoute` gates.
- Predictability suffers: “Where do I go for this action?” depends on role, ownership, and whether the URL is classic or v2.

### 5. Application File Heaviness

- `ApplicationFileV2.tsx` is a large dossier: `primaryFor()` stage logic, multiple drawers (screen, schedule, offer, scorecard, prehire, reject, waiting…), modes (owner/manager/approver), tabs (overview/activity/documents), history, evidence, pay visibility rules, return destinations.
- Powerful but not “easy”. Users must understand the stage machine and which drawer to open. Odoo prefers a compact card with a smart-button bar + chatter + stage rail.

### 6. My Work Limitations

- Good activity feed (overdue / today / waiting, interviews, joining) but actions mostly link away or open external pages. Not a true workspace.
- Filters and chips add density. Disabled actions with tooltips are informative but slow the flow.

### 7. Additional Detected Issues

- Horizontal-scroll pipeline (5 stages) is less usable than a vertical or responsive kanban on smaller screens.
- Job ownership + redaction creates “I can see the job but not the files” friction.
- Follow-up dates, SLA chips, and reminder worker health add complexity without always being actionable inline.
- Public careers + candidate portal are separate; staff-to-candidate handoff (self-schedule, portal) works but is not tightly integrated into the staff workspace.
- Existing simplification plan phases are marked done, yet dual UI and gate-heavy flow remain. Recent v2 commits focused on parity/polish (phone shell, user site display, audit evidence, joining blockers) rather than core flow simplification.
- User note: “v2 is only in my local” — any local-only enhancements are not yet the production baseline.

---

## Part 2: Detailed Odoo-Style Redesign Plan

**Recommendation:** Yes — an Odoo-style redesign is the best path. Odoo’s strength is a single record-centric workspace with smart buttons, stage rail, chatter, and contextual next actions. We can achieve the same while keeping RecruitFlow’s superior compliance gates, RBAC, and immutable audit.

### Core Design Principles

1. One primary workspace: Job Pipeline (kanban) is the main hiring desk. Application/Candidate File is the record view opened from the card.
2. Smart Action Bar on every file/card: Next recommended action is always the prominent primary button. Secondary actions (schedule, scorecard, offer, note, documents) are one click away without leaving the page.
3. Stage Rail + contextual progression: Moving a card (or clicking next stage) opens the required action drawer/modal inline when a gate is needed. Gates stay enforced server-side.
4. Chatter / Activity stream at the bottom of the file: notes, screening, scorecards, offer versions, stage changes, and messages in one chronological place.
5. My Work remains the “today” inbox but deep-links into the exact pipeline card or file with the drawer already open.
6. Eliminate classic pages: all remaining classic routes redirect to their v2 equivalents or are removed after data migration of any unique views.
7. Seat simplification: most users stay in the same navigation. Special roles get a focused home but can still open permitted files.

### Target User Flow (Recruiter)

1. Open My Work → see overdue / today actions → click “Log screen” or “Schedule interview” → lands on Application File with the correct drawer already open.
2. Or open Open Jobs → click a job → see Pipeline kanban. Drag or use “Move to” → if gate missing, the required drawer opens immediately.
3. On the File: Smart bar shows “Next: Schedule interview” (or whatever is pending). Chatter shows everything that happened. Documents and evidence are tabs or collapsible sections.
4. Offer / Pre-hire / Joining actions stay on the same file. Confirm joining is the final primary action once checks pass.
5. Managers see Team Work (same pattern). Admins stay in their console but can open any file.

### Key Page Redesigns

#### Job Pipeline (Primary Workspace)

- Responsive vertical or wrapped columns on smaller screens; keep horizontal on desktop.
- Each card shows: name, stage, next action chip, gate blocker if any, last activity, follow-up.
- Primary button on card = next recommended action (opens file with drawer). Secondary = Move to menu.
- Drag-and-drop still works; blocked moves show the exact missing gate and offer “Open file to complete”.
- Suggest from bank and Import CVs remain as quick actions on the job header.

#### Application / Candidate File (Record View)

- Compact header: candidate name, job, stage rail (clickable stages), owner, seats progress.
- Smart Action Bar (top): one large primary “Next action” button + icon buttons for Note, Documents, Schedule, Scorecard, Offer, Pre-hire, Reject.
- Stage move or primary button opens the relevant drawer/modal without full page navigation.
- Chatter section (bottom or right panel on wide screens): chronological activity + internal notes + quick “Log note / Follow-up”.
- Documents and evidence as collapsible or tabbed; pay visible only to permitted roles.
- Modes (owner/manager/approver) become permission-driven visibility rather than separate page modes.

#### My Work / Team Work

- Keep the overdue / today / waiting structure but make every row deep-link to the exact file + open drawer.
- Interviews and Joining tabs stay, but actions are “Open file” with context.
- Reduce disabled-action noise by showing the blocker and the one thing the user can do (or “Waiting on X — notify”).

### Navigation & Classic Cleanup

- Phase out `CLASSIC_PATHS`. Every classic URL redirects to the v2 equivalent (or My Work / Pipeline / File).
- Sidebar becomes: My Work, Open Jobs, Candidates, Requisitions (if permitted), Reports, Admin (users, roles, master data, audit, templates, integrations).
- Special homes (final approver, license specialist) remain as focused entry points but open into the same file view.
- Remove or hide `/classic/*` routes after verification.

### Phased Implementation

| Phase | Scope | Success Criteria |
|-------|-------|------------------|
| **0 – Baseline** | Sync local v2 with main. Inventory every classic page still used. Map every primary action to its drawer. | Documented click-path matrix for full hiring cycle. |
| **1 – File Smart Bar** | Add Smart Action Bar + Stage Rail to Application File. Primary button always visible. Chatter section. | Recruiter can complete next action without leaving the file. |
| **2 – Pipeline as Desk** | Cards show next action. Drag/move opens required drawer. Responsive layout. | 80% of daily work happens on the pipeline or one click into the file. |
| **3 – My Work Deep Links** | Every My Work row opens the file with the correct drawer pre-opened. | My Work → action → done without extra navigation. |
| **4 – Classic Retirement** | Redirect all classic routes. Remove unused classic pages. Simplify `destinations.ts`. | No more dual UI. All users stay in v2 shell. |
| **5 – Polish & UAT** | Mobile, keyboard, theme, audit, permission matrix, full hiring cycle UAT. | Users report the flow feels as easy as Odoo. |

### API & Data Implications

- Gates remain server-side (no relaxation of compliance). UI only becomes better at presenting the next required action.
- Existing endpoints for stage move, screen, scorecard, offer, joining are reused. New lightweight “nextAction” or “recommendedAction” field on application responses can power the smart bar.
- Chatter can be built from existing history, notes, screening, scorecards, and offer versions (already loaded in Application File).
- No schema changes required for the first three phases.

### Risks & Mitigations

- Compliance gates must stay strict — mitigate by making the UI explain the gate and open the exact form, never by bypassing the API.
- Permission matrix is complex — keep all existing gates; only change navigation and presentation.
- Local-only v2 work — first step is to merge and baseline against main.
- User training — the new flow is simpler, but a short walkthrough for recruiters and managers is recommended.

### Immediate Next Steps

1. Confirm local v2 delta vs main and merge or rebase.
2. Produce a detailed click-path matrix and wireframe descriptions for the Smart Action Bar + Pipeline cards.
3. Start Phase 1 on a feature branch: Smart Action Bar on `ApplicationFileV2`.
4. Schedule a short review of this plan and adjust priorities (e.g. classic retirement earlier or later).

---

*Prepared for RecruitFlow (`mustafapato863-netizen/Recruitment-System`). Ready to expand any section, produce wireframes, or begin implementation.*
