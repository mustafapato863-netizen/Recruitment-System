# RecruitFlow Session Task Tracker

This file is the short-lived execution pointer. The full plan and small-model instructions live in:

- [Canonical V1 execution plan](docs/development/PROJECT_EXECUTION_PLAN.md)
- [AI execution playbook](docs/development/AI_EXECUTION_PLAYBOOK.md)

## Current state

- Product scope: `V1 Light mode only`.
- Completed: `P0` plan reset and scope freeze.
- Completed: `P1` product contracts and workflow story.
- Reference complete: `P2` design system, shell, grid, component states, loader, and responsive reference.
- Completed: plan consolidation; retired duplicate active roadmaps and aligned product/design documents to the canonical plan.
- Completed: button matrix accessibility hardening and state contract verification.
- Completed: `UI-REF-COMP-01` — ported the accepted missing component recipes into the canonical light laboratory.
- Completed: `UI-REF-COMP-02` through `UI-REF-COMP-05` — semantic controls, tokens, responsive styling, regeneration, and verification.
- Completed: `SPINNER-01` — replaced the shared SVG/text-wave loaders with the tokenized dual-ring dotted spinner in live and reference surfaces.
- Next approved implementation slice: `P3.1` — confirm the authentication, session, organization scope, and access-control contract.
- Dark mode: `DEFERRED`, not part of V1 acceptance.
- Completed: `APP-CLEANUP-01` — live product-only routing, header notification popover, confirmed orphan removal, and plan/playbook rewrite.
- Completed: `UI-REF-POLISH-02` - compacted controls, modernized the reference/live steppers, and replaced notification dots with semantic bell icons and badges.
- Completed: `UI-REF-POLISH-03` - reduced desktop button/icon density to 36px while preserving 44px touch targets.
- Completed: `UI-REF-POLISH-04` - added a stable, non-looping 45-degree sheen hover to reference and live buttons.
- Completed: `UI-REF-POLISH-05` - fixed notification badge clipping caused by the button sheen overflow layer.
- Completed: `UI-REF-COMP-06` - added the critical recruiting reference recipes and explicit mobile stepper variant.

## Active task

`APP-CLEANUP-01` is complete: the live application surface was cleaned, reference/laboratory routes were removed from the product shell, notifications moved to a header popover, confirmed orphan files were removed, and the canonical execution guidance was rewritten. The static reference under `docs/reference/ui-ux` remained read-only for this task.

### APP-CLEANUP-01 phases

1. `AUDIT`: map live routes/navigation and classify reference-only vs product pages.
2. `SHELL`: remove reference routes/nav entries and add an accessible notification popover from the header bell.
3. `CLEANUP`: remove only confirmed orphaned reference/demo files and stale style imports; preserve operational pages and user data code.
4. `DOCS`: rewrite the canonical execution plan and small-model playbook with strict page visibility, route ownership, notification, cleanup, and verification rules.
5. `VERIFY`: build, diff-check, route/static scans, and targeted browser verification where available.

The previous reference-only scope is complete and closed; it is not an instruction to modify `docs/reference/ui-ux` during this task.

`UI-REF-DESIGN-01` is now the active scope: refine and verify the static reference Design System only. Work is limited to `docs/reference/ui-ux`; do not modify `apps/web` during this task.

Reference source of truth: `docs/reference/ui-ux/generate.py`, `docs/reference/ui-ux/app/styles.css`, and regenerated `app/pages/44_design_system.html`. The live React Design System route and real product routes are separate future workstreams.

`DS-LIVE-02` — Migrate the first operational route group to the live design system and establish the reusable page-frame contract.

### DS-LIVE-01 acceptance gates

- [x] One V1 light semantic token contract is the source of truth; legacy aliases resolve without undefined CSS variables.
- [x] Shared live primitives cover buttons, icon actions, fields, alerts, cards, and loading states with default/hover/focus/pressed/disabled/loading/error behavior.
- [x] App shell, login, and Design System showcase use the shared primitives; no new page-level one-off button or field variants are introduced.
- [x] All primitive controls expose keyboard focus, accessible names, semantic states, and 44px touch targets where applicable.
- [ ] Desktop, tablet, and mobile layouts remain within the approved grid; reduced motion is respected.
- [ ] Build and targeted browser verification pass before the next live migration slice.

### DS-LIVE-02 acceptance gates

- [ ] Dashboard, My Tasks, Notifications, and Approval Inbox use the shared page frame, buttons, alerts, filters, metrics, and status treatments.
- [ ] Loading, error, empty, retry, pagination, and async action states preserve layout and accessible semantics.
- [ ] No new inline visual rules are introduced in the migrated route group.
- [ ] Responsive grid behavior is defined for 375px, 768px, 1024px, and 1440px.
- [ ] Build, diff check, and targeted route verification pass before DS-LIVE-03.

### DS-LIVE-01 implementation slices

1. Token contract and compatibility aliases.
2. Shared primitives and state CSS.
3. Shell/login/showcase migration.
4. Verification and handoff.

### Next live slices

- `DS-LIVE-02`: migrate shared page frame, metrics, tables, filters, and statuses across Dashboard, My Tasks, Notifications, and approvals.
- `DS-LIVE-03`: migrate request/opening and candidate/intake route groups.
- `DS-LIVE-04`: migrate pipeline, interviews, scorecards, offers, hiring, and joining.
- `DS-LIVE-05`: migrate administration, reports, integrations, audit, and trust states.
- `DS-LIVE-06`: final browser/accessibility/performance parity gate.

### UI audit P0 checklist

- [x] Filled destructive action in the reject confirmation modal.
- [x] Error icon and non-color-only validation message.
- [x] Restricted Workflow Settings treatment with lock affordance, not disabled opacity.
- [x] Explicit row-selection checkboxes or remove the selected-count claim; retain the selection contract with checkboxes.
- [x] Regenerate, verify semantics/responsive behavior, and record evidence.

### Critical component slice checklist

- [x] Explicit mobile stepper variant with compact progress semantics.
- [x] Drawer / slide-out panel with width variants, scrollable body, and sticky footer.
- [x] Date and time picker with date, range, time slots, timezone, past-date, and conflict states.
- [x] Bulk actions toolbar with selection count, hierarchy, and clear-selection action.
- [x] Dropdown menu with menu semantics and keyboard-oriented states.
- [x] Candidate pipeline / Kanban board with WIP limits, draggable cards, drop zone, and neon focus card.
- [x] Interview scorecard with category validation and recommendation decision.
- [x] Comments and mentions thread with reply, attachment, and accessible composer.
- [x] Regenerate, verify semantics/responsive behavior, and record evidence.

## Component expansion phases

- `UI-REF-COMP-01` — `DONE`: freeze the accepted component list and semantic rules.
- `UI-REF-COMP-02` — `DONE`: fields, validation, pills, avatars, presence, and assignee stacks.
- `UI-REF-COMP-03` — `DONE`: data table, tabs, segmented control, modal/dialog anatomy.
- `UI-REF-COMP-04` — `DONE`: toasts, alerts, tooltip, upload, filters, saved views, timeline, and stepper.
- `UI-REF-COMP-05` — `DONE`: regenerate, responsive/accessibility verification, documentation handoff.

Do not move these recipes to the live React frontend until the reference gate and `P2-LIVE-01` contract are approved.

## APP-CLEANUP-01 handoff

Status: `DONE`.

- Changed live shell/router: removed Notifications from the sidebar, removed Design System/States Feedback/Maintenance routes, and added a typed header notification popover with full-list handoff.
- Removed confirmed orphan/demo files: `apps/web/src/pages/DesignSystemPage.tsx`, `apps/web/src/pages/StatesFeedbackPage.tsx`, `apps/web/src/pages/MaintenancePage.tsx`, `apps/web/src/styles/design-system.css`, and `apps/web/src/layout/MobileBottomNav.tsx`.
- Rewrote `PROJECT_EXECUTION_PLAN.md` and `AI_EXECUTION_PLAYBOOK.md` with live/reference separation, route visibility, notification, cleanup, and verification rules.
- Checks: live build passed; removed-route scan passed; targeted `git diff --check` passed; desktop and mobile Playwright interaction checks passed; test frontend process stopped.
- Remaining risks: the broad diff check still reports pre-existing EOF blank lines in three untouched pages; they were intentionally preserved. Local API calls returned `401` during browser verification, so successful notification data loading needs a backend-session follow-up. Static reference validation was not rerun because the reference was out of scope.
- Next task: `P3.1`.

## Errors encountered

| Error | Attempt | Resolution |
|---|---|---|
| `apply_patch` context mismatch | Initial insertion against a long Unicode-heavy generator line | Inserted at the stable Design System write boundary; no project files were changed by the failed attempts. |
| Hidden Vite launch rejected | Tried to start the live dev server for browser screenshot verification | Environment policy rejected the wrapper launch; no project files were affected. Keep live browser verification as the next gate instead of claiming it passed. |
| PowerShell search syntax error | Used POSIX `||` fallback in a PowerShell command while scanning removed routes | Re-ran the scan with `$LASTEXITCODE`; no files were changed. |
| Playwright strict locator | `get_by_label("Password")` matched both the password input and its visibility button | Re-run with the stable `#login-email` and `#login-password` field IDs; no application files were changed. |
| Playwright login navigation timeout | Local login did not reach `/` within 15 seconds during the interactive check | Inspect the resulting URL and rendered error/API state before changing application code; no application files were changed. |
| Broad diff check | Existing blank lines at EOF were reported in untouched `CandidatesPage.tsx`, `VacancyRequestsPage.tsx`, and `VacantListPage.tsx`; Git also reported normal LF/CRLF warnings | Leave unrelated files unchanged and run a targeted diff check on this task's files. |
| Python stdout encoding | A diagnostic `repr` command could not print a Unicode arrow through the default `cp1252` stdout | Re-ran with task-scoped `PYTHONIOENCODING=utf-8`; no files were changed. |
| Transient plan write failure | First attempt to append the local API `401` risk to `task_plan.md` failed at file write | Confirmed the file was writable and applied the same update with a narrower stable context. |

## Task rules

- One task at a time.
- Read the canonical plan and playbook before implementation.
- Do not start the next task from memory; update this file and `progress.md` at handoff.
- Record blockers in `findings.md`; never guess missing contracts.
