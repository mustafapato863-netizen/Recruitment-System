# RecruitFlow UI/UX Full Phases Plan

**Branch baseline:** `comfort-desk-review` @ `fc3cce2`  
**Document date:** 2026-10-28  
**Design reference:** Mixed system (Odoo next-actions + Linear density/speed + Notion/Ashby cards + consistent glass surfaces)

This document expands the complete audit into a single source of truth. It covers every identified issue by page and role, provides reference-backed improvement suggestions, and defines detailed implementation phases with acceptance criteria, file targets, and verification steps.

All changes must preserve compliance gates, RBAC, ownership rules, and audit behavior.

---

## 1. Role Overview

### Employee / Recruiter
- Home: `/my-work`
- Primary surfaces: My Work, Open Jobs (own + team), Pipeline, Application File (owner mode)
- Restrictions: Own jobs only for full access; recruiter-only blocked from requisitions

### Manager
- Home: `/my-work` (shared)
- Primary surfaces: Team Work, approvals, reassign, offer decisions, reports
- Can access vacancy requests

### Interviewer
- Limited to My Work, My Interviews, scorecard drawers
- Cannot open full Application File without `APPLICATION_VIEW`

### Special Roles
- Final Hiring Approver → classic `/hires/approvals/inbox`
- License Specialist → `/licenses`
- Context loss still occurs when leaving v2 for classic pages

---

## 2. Complete Problem Inventory

### 2.1 My Work (all roles that land here)

**Issue 2.1.1 — Unequal count cards (Overdue / Today / Waiting)**  
- **Severity:** High  
- **Location:** `.rf2-mywork__filters` in `apps/web/src/v2/pages/my-work.css`  
- **Current behavior:** Grid `repeat(3, minmax(0, 1fr)) auto`. Cards render with inconsistent widths. “All tasks” button misaligns.  
- **Impact:** Slower scanning, broken visual balance.  
- **Root cause:** Insufficient `width: 100%` + `min-width: 0` enforcement on filter buttons; parent flex constraints.  
- **Reference-backed suggestion:** Linear-style equal KPI cards with instant scanability. Force equal columns and lock the All tasks control inside the grid.

**Issue 2.1.2 — Excessive vertical space under short lists**  
- **Severity:** Medium  
- **Location:** `.rf2-mywork__surface`, empty states  
- **Current behavior:** Surfaces expand even with zero or one row.  
- **Impact:** Unnecessary scrolling, sparse feel.  
- **Suggestion:** Linear compact empty states. Set `min-height: 0` and content-driven height.

**Issue 2.1.3 — Toolbar wrapping (768–1535 px)**  
- **Severity:** Medium  
- **Suggestion:** Clean stack: full-width tabs, day controls underneath.

**Issue 2.1.4 — Weak primary action on some waiting rows**  
- **Severity:** Low  
- **Suggestion:** Odoo principle — first enabled action always primary in its context.

### 2.2 Open Jobs

**Issue 2.2.1 — Oversized empty state**  
- **Severity:** High  
- **Location:** `OpenJobsV2.tsx` + empty state component  
- **Current behavior:** Large “No jobs assigned to you yet” even when team jobs exist below.  
- **Impact:** Important content pushed down.  
- **Suggestion:** Linear compact empty. Collapse or hide when content exists below.

**Issue 2.2.2 — Inconsistent Cards view**  
- **Severity:** High  
- **Current behavior:** Owned cards have primary button; read-only cards have eye + badge and no action.  
- **Impact:** Broken hierarchy, slower distinction between actionable and read-only.  
- **Suggestion:** Ashby/Notion unified card structure. Same skeleton for every card. Owned → primary button. Read-only → clear badge/secondary text.

**Issue 2.2.3 — List view icon and alignment inconsistency**  
- **Severity:** Medium  
- **Suggestion:** Standardize read-only icon and column alignment.

**Issue 2.2.4 — Crowded filter bar**  
- **Severity:** Medium  
- **Suggestion:** Cleaner wrap, more space for search, prominent view toggle.

### 2.3 Job Pipeline (Kanban)

**Issue 2.3.1 — Fixed 5-column board not responsive**  
- **Severity:** Medium  
- **Location:** `.rf2-board` in `jobs.css`  
- **Current behavior:** `repeat(5, minmax(0, 1fr))` with no lower-breakpoint handling.  
- **Impact:** Cramped columns below ~1280 px.  
- **Suggestion:** Ashby-style responsive board. Keep 5 columns on wide screens; horizontal scroll or controlled wrap below 1280 px.

**Issue 2.3.2 — Card density and weak next-action prominence**  
- **Severity:** Medium  
- **Suggestion:** Odoo + Linear — larger, higher-contrast primary next-action button; tighter internal padding.

**Issue 2.3.3 — Gate blockers lack contrast**  
- **Severity:** Medium  
- **Suggestion:** Higher-contrast, higher-weight chips for all blockers.

### 2.4 Application File

**Issue 2.4.1 — Primary action not strongly positioned**  
- **Severity:** Medium  
- **Suggestion:** Odoo smart action bar. Persistent top bar with same visual weight as My Work primary buttons.

**Issue 2.4.2 — Excess empty space when drawers are closed**  
- **Severity:** Medium  
- **Suggestion:** Tighten header and stage rail. Denser or collapsible activity section.

### 2.5 Team Work (Manager)

**Issue 2.5.1 — Unpredictable card grid**  
- **Severity:** Medium  
- **Location:** `.rf2-team__grid`  
- **Suggestion:** Predictable breakpoint columns.

**Issue 2.5.2 — Waiting rows wrap poorly**  
- **Severity:** Medium  
- **Suggestion:** Controlled wrap so actions stay aligned.

### 2.6 Notification Center

**Issue 2.6.1 — List items not aligned with My Work task rows**  
- **Severity:** Medium  
- **Suggestion:** Match padding, unread indicator, and spacing.

**Issue 2.6.2 — Empty state still tall**  
- **Severity:** Medium  
- **Suggestion:** Compact empty state consistent with other desks.

### 2.7 Shell / Cross-desk Consistency

**Issue 2.7.1 — Inconsistent max-width and horizontal padding**  
- **Severity:** Low  
- **Current:** My Work 1440 px, Open Jobs 1560 px.  
- **Suggestion:** Standardize all desks to `max-width: min(100%, 1440px)` with identical padding.

**Issue 2.7.2 — Minor glass surface differences**  
- **Severity:** Low  
- **Suggestion:** Unify border-radius, shadow, and background treatment.

### 2.8 Role-Specific Context Loss

**Issue 2.8.1 — Classic page jumps**  
- **Severity:** Medium-High  
- **Roles affected:** Employee (joining confirmation), Final Approver, License Specialist  
- **Impact:** Breaks single-workspace principle.  
- **Suggestion:** Odoo-style — keep as many flows as possible inside Application File drawers.

---

## 3. Detailed Implementation Phases

### Phase 0 — Documentation & Baseline (this PR)
- Capture full inventory and plan.
- Acceptance: Document reviewed and accepted as source of truth.

### Phase 1 — My Work + Open Jobs Polish (Highest Impact)
**Goal:** Fix daily entry points.  
**Files:**  
- `apps/web/src/v2/pages/my-work.css`  
- `apps/web/src/v2/pages/MyWorkV2.tsx`  
- `apps/web/src/v2/pages/OpenJobsV2.tsx`  
- `apps/web/src/v2/pages/jobs.css`  

**Tasks:**  
1. Equalize three count cards + lock All tasks.  
2. Compact empty states on both pages.  
3. Unify Open Jobs card structure (Cards + List).  
4. Clean filter bar wrap.  

**Acceptance criteria:**  
- Cards equal width at 1024 / 1280 / 1440.  
- Empty states do not push content when data exists below.  
- Owned vs read-only distinction is instantly clear.  
- No change to data, permissions, or gates.

**Verification:** Visual regression on key breakpoints. Role smoke test (employee ownership, manager view).

### Phase 2 — Pipeline + Application File
**Goal:** Stronger next-action visibility and responsive board.  
**Files:**  
- `apps/web/src/v2/pages/JobPipelineV2.tsx`  
- `apps/web/src/v2/pages/jobs.css`  
- `apps/web/src/v2/pages/ApplicationFileV2.tsx`  
- `apps/web/src/v2/pages/application-file.css`  

**Tasks:**  
1. Responsive pipeline board (5 cols → scroll/wrap below 1280 px).  
2. Stronger primary next-action buttons and gate chips.  
3. Persistent Smart Action Bar on Application File.  
4. Tighten header/stage rail.  

**Acceptance criteria:**  
- Board usable on 1280 px and below without crushing cards.  
- Next action is the strongest element on every candidate card and file.  
- Drawers still open correctly; gates unchanged.

### Phase 3 — Team Work + Notifications + Shell Consistency
**Goal:** Visual language alignment.  
**Files:**  
- `apps/web/src/v2/pages/team.css`  
- `apps/web/src/v2/pages/TeamWorkV2.tsx`  
- Notification Center CSS/TSX  
- Shared tokens / shell layout  

**Tasks:**  
1. Predictable Team Work grid.  
2. Align waiting row wrap.  
3. Match Notification Center rows and empty states to My Work.  
4. Standardize max-width (1440 px) and glass surfaces across all desks.  

**Acceptance criteria:**  
- Switching between desks feels like the same product.  
- No large empty gaps on short lists.

### Phase 4 — Role Context Loss Reduction
**Goal:** Reduce jumps to classic pages where feasible.  
**Scope:** Joining confirmation, certain approval paths.  
**Constraint:** Must not weaken compliance gates or audit.  

**Acceptance criteria:**  
- Documented reduction in classic redirects for employee joining and manager approval flows.  
- Full regression on special roles (Final Approver, License Specialist).

### Phase 5 — Final Polish & Verification
- Cross-role click-path testing.  
- Accessibility and focus-ring check.  
- Performance sanity on lists and boards.  
- Update click-path matrix if needed.

---

## 4. Constraints (Must Not Change)

- All server-side gates (screen note, scorecard, offer accepted, joining checks).  
- RBAC and seat redirects (`destinations.ts`).  
- Ownership redaction rules.  
- Audit logging.  
- `primaryFor()` logic and drawer system behavior.

---

## 5. Success Metrics

- Users can identify the next action in < 2 seconds on My Work, Pipeline, and Application File.  
- Empty states no longer dominate short-content pages.  
- Visual consistency score (manual review) across desks ≥ 90 %.  
- Zero regressions on compliance or permission tests.

---

## 6. Next Step

Start Phase 1 on a new implementation branch from `comfort-desk-review` once this plan is accepted.

**Document owner:** UI/UX + Frontend team  
**Status:** Ready for review
