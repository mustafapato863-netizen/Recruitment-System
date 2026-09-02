# RecruitFlow UI/UX Runtime Audit

Date: 2026-09-01  
Status: REWORK REQUIRED  
Audited user: authenticated recruiter  
Scope: current web application at `http://127.0.0.1:5173`

## Verdict

The frontend compiles and its primary routes load, but it is not ready to close the UI/UX work. Five confirmed findings remain: four P1 workflow/navigation/data-trust issues and one P2 readability/target-size issue.

This report replaces no architecture or product authority. It is current runtime evidence for the focused recruiter UX rework and the existing audit/rework loop.

## Evidence collected

- Recruiter shell checked at 1440, 1280, 1024, 768, 430, and 375px in Light and Dark: 12/12 cases completed.
- No horizontal document overflow was measured in those 12 shell cases.
- At 1440px, these routes loaded after login with no new console/API errors or visible error/not-found state: `/`, `/vacancies`, `/applications`, `/candidates`, `/interviews`, `/offers`, `/reports`, and `/settings`.
- Recruiter journey succeeded in three primary navigations: Home -> Jobs -> Applicants pipeline. A candidate action was visible in the pipeline.
- At 375px, the mobile drawer opened with the seven destination labels and Escape restored focus to “Open navigation menu”.
- App checks passed: `tsc -p tsconfig.app.json --noEmit`, production build, design-token check, 52/52 Vitest tests, and `git diff --check`.
- Initial unauthenticated bootstrap calls returned 401 for `auth/me` and `auth/refresh`; these occurred before login. No new route errors were recorded after login, so they are not findings in this audit.

Artifacts:

- `tests/artifacts/browser/frontend-ux-audit/frontend-ux-audit.json`
- `tests/artifacts/browser/frontend-ux-audit/focus-probe.json`
- `tests/artifacts/browser/frontend-ux-audit/shell-1440-light.png`
- `tests/artifacts/browser/frontend-ux-audit/shell-375-light.png`
- `tests/artifacts/browser/frontend-ux-audit/focus-1024-dark.png`
- `tests/artifacts/browser/frontend-ux-audit/recruiter-journey-applicants.png`

## Confirmed findings

| ID | Severity | Area | Evidence | Required correction |
|---|---|---|---|---|
| FUX-001 | P1 | Navigation at 1024px | At 1024px the sidebar measured 244px wide but was translated to x=-244; the “Open navigation menu” control measured 0x0 with `display: none`; all nine sidebar links remained off-screen and `aria-hidden` was absent. This makes navigation unavailable to mouse users and leaves off-screen focusable links. Source boundary conflict: `shell.css` hides the sidebar at `max-width: 1024px`, while the menu uses Tailwind `lg:hidden` in `AppShell.tsx`. | Use one breakpoint source for the drawer and menu trigger. At every width where the sidebar is off-canvas, show a reachable menu trigger and make the closed drawer inert/aria-hidden. Test the exact 1024px boundary and resize behavior. |
| FUX-002 | P1 | Dark-theme readability | In the 1024px Dark dashboard, the primary KPI value rendered as `rgb(16, 24, 40)` on `rgb(17, 24, 39)`: calculated contrast 1.00:1. The KPI values, job names, and quick-action labels are visually lost in the captured screen. `ManagerDashboard.tsx` uses `text-gray-*`, while the dark compatibility bridge in `polish.css` only remaps selected `text-slate-*` utilities. | Replace page-local gray utilities with semantic token classes or expand the dark mapping deliberately. Verify all primary text, action labels, states, chart labels, and cards in both themes with computed contrast evidence. |
| FUX-003 | P2 | Navigation readability and hit areas | Across all 12 shell cases, every primary nav row measured 38px high and 10.5px text. The collapse control is 32x32px. This fails the active plan’s 44px interactive-target rule and makes expanded navigation harder to scan. Current overrides are in `v2-parity.css`. | Establish semantic operational typography: 14-15px nav labels, 12px minimum meaningful secondary text, and 44px minimum interactive targets. Preserve consistent active-state alignment and verify zoom/reflow. |
| FUX-004 | P1 | Data trust | The dashboard uses static chart values (`128`, `214`, `96`, `24`, `18`) and hardcoded percentage changes even while the live KPI counts in the screenshot are zero. The Jobs route contains `mockPublishJobs`, and even API-backed rows receive fabricated views, application counts, and publish dates. This violates the active plan’s ban on fake production data and can misdirect recruiter decisions. | Remove or isolate mock/demo data from production surfaces. Render API-backed metrics only; when unavailable, show a truthful loading, empty, or unavailable state with no fabricated success/trend. |
| FUX-005 | P1 | Recruiter workflow clarity | “Jobs” opens “Career Site / Job Publishing Management”, emphasizing syndication and preview rather than the recruiter’s job-position queue. The applicant board exposes implementation labels (“Stage 1” through “Stage 4”), displays minimal candidate context, and gives an icon-only advance button. The tested board does not show the required owner, last activity, SLA, and a clearly named allowed next action per applicant. | Make Jobs job-position-first: status, owner, applicant count needing action, SLA/blocker, and one next step. In the board, replace internal stage labels with product language and give each candidate a visible, permission-aware next action while retaining job context. |

## Source locations

- FUX-001: `apps/web/src/styles/shell.css:754`, `apps/web/src/layout/AppShell.tsx:249`, `apps/web/src/layout/AppShell.tsx:340`.
- FUX-002: `apps/web/src/pages/ManagerDashboard.tsx:128`, `apps/web/src/pages/ManagerDashboard.tsx:183`, `apps/web/src/styles/polish.css:899`.
- FUX-003: `apps/web/src/styles/v2-parity.css:707`, `apps/web/src/styles/v2-parity.css:714`, `apps/web/src/styles/v2-parity.css:652`.
- FUX-004: `apps/web/src/pages/ManagerDashboard.tsx:31`, `apps/web/src/pages/ManagerDashboard.tsx:133`, `apps/web/src/pages/ManagerDashboard.tsx:218`, `apps/web/src/pages/ManagerDashboard.tsx:228`, `apps/web/src/pages/VacantListPage.tsx:19`, `apps/web/src/pages/VacantListPage.tsx:130`.
- FUX-005: `apps/web/src/pages/VacantListPage.tsx:165`, `apps/web/src/pages/ApplicationsPage.tsx:186`, `apps/web/src/pages/ApplicationsPage.tsx:211`, `apps/web/src/pages/ApplicationsPage.tsx:248`.

## Closure conditions

Run `FRONTEND_RECRUITER_WORKFLOW_UX_REWORK.md`, then the full `FRONTEND_SIMPLE_SYSTEM_AUDIT.md` and `FRONTEND_SIMPLE_SYSTEM_REWORK_LOOP.md`.

Do not mark the UI/UX work CLOSED until:

1. FUX-001 through FUX-005 are fixed and reverified.
2. The recruiter journey is re-tested on desktop, 1024px, 768px, 430px, and 375px in both themes.
3. No critical content has contrast below the approved threshold and no navigation/action target is below 44px.
4. Dashboard, Jobs, and applicant board show only truthful contract-backed data and actions.
5. Build, TypeScript, token, unit, browser, and final diff checks pass with current evidence.

## Audit limits

This run tested recruiter shell/routes and the main journey. It did not independently execute every mutation, export, role, screen-reader, or full assistive-technology scenario. Those remain required in the full audit before closure.
