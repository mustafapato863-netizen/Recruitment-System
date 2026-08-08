# RecruitFlow Consolidated Findings

This file contains current decisions, evidence, and risks only. Retired planning narratives and detailed historical audit evidence are kept in `docs/development/audit/phase-audit-2026-08-07.md`.

## Product decisions

- RecruitFlow is a workflow-first recruiting operations platform for mid-market and multi-entity organizations.
- V1 is Light mode only. Dark mode is deferred and must not appear in V1 acceptance criteria, implementation tasks, or QA scope.
- Product promise: every opening has an owner, every candidate has a next action, every decision has evidence, and every metric drills to a source record.
- No unsupported AI, compliance, pricing, integration, or enterprise-readiness claim may appear as implemented behavior.
- Candidate identity is separate from application; position/request is separate from opening; offer versions are immutable after approval; current task owner is distinct from recruiter and approver.

## Current source hierarchy

1. `docs/development/PROJECT_EXECUTION_PLAN.md`
2. `docs/development/AI_EXECUTION_PLAYBOOK.md`
3. `docs/development/enterprise-saas-product-plan.md`
4. `docs/development/enterprise-page-story.md`
5. `docs/design-system/enterprise-product-direction.md`
6. `docs/design-system/enterprise-visual-identity.md`
7. `docs/reference/ui-ux/COMPONENT_INTERACTION_REFERENCE.md`

If sources disagree, stop and report the conflict. Do not resolve it by guessing.

## Reference application evidence

- `docs/reference/ui-ux/app` is a static offline visual reference, not the live React runtime.
- The catalog contains 54 screens with story-first chapters, a light shell, top sidebar collapse affordance, responsive grid recipes, component state matrix, gradients, controlled neon focus, and tokenized loader.
- Playwright validation passed for gallery count, link/image targets, hover/focus behavior, gradient selection, neon card glow, loader animation, reduced motion, and 375/768/1024/1440 layouts.
- Preview rendering is repeatable through the local generator and Playwright renderer. Annotated source images remain preserved to avoid recursive screenshots.
- Button matrix hardening is now part of the reference contract: shared focus ring, explicit state coverage, accessible loading status, 44px targets, selected contrast, filled Approve, outlined Reject, and quiet-action affordance.
- Approved reference additions from the reviewed external snapshot: field states, status/stage pills, avatar/presence stacks, data tables, tabs/segmented controls, dialog anatomy, toast/alert feedback, tooltip/upload, filters/saved views, activity timeline, and stepper progress.
- These additions are documentation recipes only until implemented with semantic controls, shared tokens, keyboard behavior, and verification; the pasted snapshot itself is not accepted as source code.
- The expanded laboratory now has 21 card sections. New controls are semantic and tokenized; the external snapshot was used only as a component inventory and visual input.
- The standard spinner is now a dual-ring dotted indicator: outer `--primary`/action color, inner `--cyan`/neon-cyan accent, component-sized rings, and reduced-motion safe. The old SVG arc and reference text-wave are retired from active loading surfaces.

## Scope correction — static reference first

- The current objective is to refine the static reference application under `docs/reference/ui-ux/app`, especially `app/pages/44_design_system.html`.
- Reference changes must be made in `docs/reference/ui-ux/generate.py` and/or `docs/reference/ui-ux/app/styles.css`, then regenerated and validated; generated HTML is not the primary source.
- The live `apps/web` migration is paused for this task. Its build and screenshots are not evidence for reference completion.
- The real product routes must remain separate from the Design System laboratory page.
- The reference source already had a generated header bell in some outputs, but its generator fallback was brittle because it depended on one exact text-dot string. The replacement now normalizes the complete notification link with a small pattern, so regeneration preserves the same bell SVG.
- The sidebar notification item still used a text glyph as its icon. The reference stylesheet now renders a compact CSS bell for `03_notifications.html`, including hover and selected-state inheritance, without changing the live app.
- Visual QA caught and fixed the selected-state contrast edge case: the active sidebar bell now uses white strokes on the blue selected tile, while hover uses the action blue on a neutral tile.
- Verification evidence: `python docs/reference/ui-ux/generate.py` generated 54 screens; `python docs/reference/ui-ux/render_playwright.py` rendered the reference gallery; `python docs/reference/ui-ux/verify_playwright.py` passed with `desktop_mobile_overflow=passed`.

## APP-CLEANUP-01 audit - live application scope

- The live shell currently exposes `Notifications` in the sidebar and routes the header bell to a full `/notifications` page. The requested product behavior is a header bell popover; the full page can remain available as a secondary “View all” destination unless the product contract later removes it.
- The live shell currently exposes `Design System` in the sidebar and routes both `/design-system` and `/states-feedback`; these are reference/laboratory surfaces and duplicate `docs/reference/ui-ux/app`, so they must not appear in the product navigation or normal production route table.
- `MaintenancePage` is a hardcoded demo with a fake 15-minute estimate and no backend maintenance contract. It is not a reference page, but it is not a valid user-facing product route either; it is a cleanup candidate and must be removed only after confirming no external route/redirect depends on it.
- `styles/design-system.css` is imported only by `DesignSystemPage`, making it a confirmed orphan once the live Design System route is removed. `DesignSystemPage.tsx` and `StatesFeedbackPage.tsx` are also confirmed reference/demo-only candidates.
- The notification domain is already implemented in `NotificationsPage` and the contracts package (`NotificationRecord`, `PaginatedResult`), so the popover should reuse the existing API and semantic record types rather than introduce duplicate fixtures or a new backend endpoint.
- Existing `apps/web` modifications are user work from earlier sessions and must be preserved. This task may edit the live shell/router and confirmed orphan files only; the static reference remains out of scope.
- Live implementation now removes the three demo/reference routes and five confirmed orphan/demo files: `DesignSystemPage.tsx`, `StatesFeedbackPage.tsx`, `MaintenancePage.tsx`, `styles/design-system.css`, and `layout/MobileBottomNav.tsx`.
- The header notification action now owns a typed recent-notifications popover. It keeps `/notifications` as a full list reached through `View all`, so no API or data-model duplication was introduced.
- `npm --prefix apps/web run build` passed after the route removal and popover implementation.
- Final browser evidence: authenticated local desktop flow opened the header popover without changing the Dashboard URL; Escape closed it; `View all` opened `/notifications`; mobile viewport `390x844` kept the popover inside the viewport at 356px width.
- The local browser run also observed `401 Unauthorized` responses from existing dashboard/notification API calls after the login redirect. The popover correctly exposed its error/retry state, but successful notification data loading remains dependent on resolving the local session/API auth state; this task did not weaken auth or change the backend.
- Final scope evidence: no removed route/page/style reference remains under `apps/web/src`; the test Vite process was stopped after browser verification.

## Known release risks

- Automated unit/integration/E2E coverage is not yet a complete release gate.
- Secure PDF/DOCX storage, scanning, retention, and real CV binary processing require an approved security/storage design.
- License management needs a complete backend domain and acceptance evidence.
- Migration provenance and rollback evidence for some historical workflow models require an explicit decision before production use.
- Web build chunk-size warning and production performance evidence remain to be reviewed.
- Integration health, audit evidence, tenant isolation, and role-scoped data access require dedicated release tests.

## Working-tree and safety notes

- Existing user changes are preserved; do not reset or overwrite unrelated files.
- Do not commit `.env`, credentials, uploads, dumps, generated secrets, or production data.
- Do not use destructive filesystem/database commands without an exact approved target.
- Historical phase documents are not active work instructions. Use the canonical plan and playbook only.

## Plan consolidation decision

- The only active execution source is `docs/development/PROJECT_EXECUTION_PLAN.md`.
- The only active small-model instruction source is `docs/development/AI_EXECUTION_PLAYBOOK.md`.
- The former implementation roadmap was deleted because it duplicated active phase lists. The historical audit remains intentionally preserved for traceability.
- Product strategy and visual identity remain as contracts; their capability/theme notes do not create parallel implementation queues.

## Error-handling rule

Every tool or test error must be recorded with the attempted command, root cause, resolution, and whether the task can continue. Repeating the same failed command is not an acceptable recovery strategy.

## Latest live design-system audit — DS-LIVE-01

- The approved reference is materially more consistent than the live React surface. The reference has one semantic light-token vocabulary, while the live app still mixes `--primary`, `--primary-soft`, `--surface-soft`, `--text-muted`, `--info`, `--success`, `--warning`, `--danger`, `--radius`, and `--background` without one shared definition.
- `apps/web/src/App.css` is the effective global stylesheet, but its first three lines are legacy/minified rules and its later rules are incremental overrides. This creates cascade risk: button, stepper, modal, admin, auth, and page-specific styles do not share one primitive contract.
- The live frontend contains many page-level inline colors, spacing, and status treatments. These are the largest source of visual drift from the approved reference and must be migrated by domain slice, not rewritten blindly in one pass.
- The live shell still exposes a theme toggle even though V1 is explicitly Light-only. The toggle is outside the V1 acceptance boundary and should be removed from the shell while the theme context remains a future-compatible implementation detail.
- The Design System route currently showcases undefined legacy token names and inline styles, so it is not a reliable live contract. It must become the first consumer of the shared primitives and token vocabulary.
- Initial working scorecard before DS-LIVE-01: reference `8.5/10` (validated static contract), live primitives `5.5/10`, token governance `5/10`, accessibility states `6.5/10`, page parity `5/10`. These are internal progress scores, not a market claim; the target is measurable acceptance gates rather than a visual opinion.
- Scope boundary: V1 remains light mode only; no new dependency, dark-mode implementation, or backend behavior is part of this task.

## Latest implementation findings — DS-LIVE-02

- The first operational route group was the highest-leverage migration because it is visible in the shell and exercises loading, retry, empty, filters, pagination, async actions, metrics, and statuses.
- `PageFrame`, `MetricCard`, and `PageState` now provide a common route-level contract without changing API behavior.
- Dashboard chart legend, aging bars, source layout, task cards, and notification cards now use shared semantic CSS classes rather than page-level style objects.
- Remaining route drift is still concentrated in request/opening, candidate/intake, pipeline/interviews, offers/hiring, and administration pages; these remain separate slices to avoid destructive rewrites.
- Build and browser verification are intentionally pending until this slice is compiled.

## Latest implementation resolution — DS-LIVE-01 foundation

- Added the semantic light token layer and compatibility aliases so existing route slices can migrate without undefined `--primary-soft`, `--surface-soft`, `--text-muted`, `--background`, or status aliases.
- Added reusable live primitives: `Button`, `IconButton`, `FormField`, `Alert`, and `Card`, with explicit state contracts and reduced-motion behavior.
- Migrated the shell, login page, and live Design System laboratory to the shared primitives. The shell now has a top collapse control, compact notification action, accessible search input, and a clearer account context.
- Converted `StatusBadge` to a semantic status component and replaced the inline-style `PipelineStepper` with tokenized desktop/mobile variants.
- Kept compatibility aliases for legacy page classes; full route migration remains staged so unrelated dirty page work is not overwritten.
- Removed the V1 theme toggle and forced the provider to Light-only. Dark mode remains deferred.
- Verification: `npm --prefix apps/web run build` passed twice after the final changes; `git diff --check` passed with normal line-ending warnings; CSS variable audit found only `--mc`/`--ms`, which are intentional page-level custom properties supplied by metric cards.
- Reference regression check: `python docs/reference/ui-ux/verify_playwright.py` passed with 54 gallery cards, 12 sample pages, and desktop/mobile overflow checks.
- Live browser screenshot verification is still pending. Attempting to start a hidden Vite process from the current PowerShell wrapper was rejected by the environment policy; no project files were affected and the exact failed launch was not repeated. The live build and static contract checks remain valid.

## Latest task error

- Attempt: run the UI/UX design-system search with the default PowerShell output encoding.
- Root cause: Python attempted to print a Unicode warning symbol through the Windows `cp1252` stdout codec.
- Resolution: reran with task-scoped `PYTHONIOENCODING=utf-8`; recommendations completed successfully.
- Impact: no project files were affected; implementation continued.

## Latest audit findings — P0 scope

- The supplied Design System audit identifies four P0 risks: destructive reject action is visually under-weighted, form errors rely on text/color without an icon, restricted Workflow Settings is presented as disabled, and the data table claims selected rows without showing row controls.
- Scope decision: implement these four P0 items in the canonical reference laboratory and the shared live UI contracts where the corresponding components exist; keep P1–P3 as documented backlog until the P0 gate passes.
- Preserve V1 Light mode boundary. Do not add dark-mode implementation as part of this audit pass.
- Existing shared tokens are sufficient: use `--danger-action` for filled destructive actions, the existing focus ring for new controls, and semantic `aria-*` attributes rather than color-only cues.

## Latest audit resolution — P0 complete

- Reference modal now uses `.danger-solid` only for the irreversible reject confirmation; the decision matrix keeps Reject outlined for the initial reversible-looking decision pair.
- Invalid salary feedback now has a visible circular error icon, explanatory text, `aria-invalid`, and `aria-describedby` in both the reference recipe and the live states page.
- Workflow Settings now communicates restriction with a lock, readable `Admin only` copy, title/accessible text, and full opacity; it is no longer styled as a disabled action.
- The table now has select-all and per-row checkboxes, `aria-selected` on the selected row, a sorted header, and keyboard-reachable row overflow actions. The selected-count summary is therefore truthful.
- Verification evidence: generator output 54 screens, Playwright reference validation passed, live frontend build passed, visual review completed, and `git diff --check` passed. P1–P3 items remain backlog for a later scoped task.

## Latest task tooling notes

- A first broad `apply_patch` against the long Unicode-heavy generator line did not match; the change was safely reapplied at the stable Design System write boundary.
- A first verification search used an invalid PowerShell/regex expression and returned no project result; targeted selectors were then checked directly in the generated HTML and Playwright suite.
- PowerShell policy rejected recursive cache removal; the exact generated `docs/reference/ui-ux/__pycache__` bytecode file was removed with an exact-path cleanup and the directory was confirmed absent.

## Latest component audit scope

- The new audit elevates the mobile stepper variant to P0 and identifies the following critical recruiting reference recipes: Drawer, Date/Time Picker, Pipeline Board, Interview Scorecard, Bulk Actions Toolbar, and Comments/Mentions Thread.
- The suggested Week 1 order also requires a generic Dropdown Menu because row actions, user menus, and view switching depend on it.
- Approved slice: implement these as semantic, tokenized static reference recipes plus verification first. Live business behavior, drag/drop persistence, scheduling conflicts, mention search, and API contracts remain explicitly deferred to the corresponding P2/P7 live implementation tasks.
- Dark mode remains V2/deferred and is excluded from this slice.

## Latest component slice resolution

- `UI-REF-COMP-06` is complete in the canonical reference. The mobile stepper is explicit and vertical; the pipeline board spans the desktop recipe width while retaining an internal horizontal region on mobile.
- New controls use semantic roles/labels: dialog, grid/gridcell, menu/menuitem, radiogroup/radio, region, textbox, toolbar, file input, draggable/focusable cards, selected/current states, and recovery copy.
- One verification assertion initially expected a single error icon. The new picker and scorecard correctly add more error states, so the check was narrowed to the original field and a minimum count for the expanded critical recipes. Validation then passed.
- No dark-mode tokens, new dependencies, live API claims, or production behavior were added.
