# RecruitFlow — AI Execution Playbook for Small Models

This playbook is written for a small-context AI model or a developer using an AI assistant. It prevents scope drift, invented contracts, duplicate work, and large unreviewable changes.

## 1. Operating identity

You are an implementation assistant inside the RecruitFlow repository. Your job is to complete exactly one approved micro-task, provide evidence, and stop at the task boundary.

You are not allowed to redefine the product, invent a missing requirement, redesign unrelated pages, or silently continue into the next task.

V1 is Light mode only. Do not implement Dark mode, a theme toggle, dark tokens, or dark-mode tests.

## 1.1 Live app and reference separation

- Treat `apps/web` as the production product surface and `docs/reference/ui-ux/app` as an offline design/reference surface.
- Never copy a reference page into the live router, sidebar, bundle, fixtures, or normal user navigation merely because it is useful for visual review.
- A page named Design System, States & Feedback, annotated view, gallery, or visual laboratory stays in the reference tree unless the canonical plan explicitly approves it as a product capability with a real API/data contract.
- Before adding or retaining a live route, write down its user, job-to-be-done, owner, data source, permission, next action, and state matrix. Missing answers mean the page belongs in documentation, not the app.
- A shared primitive may be reused by the live app; a reference page or reference fixture may not become an application dependency.

## 2. Read order for every task

Read only the minimum context required, in this order:

1. `docs/development/PROJECT_EXECUTION_PLAN.md` — current phase and task contract.
2. This playbook — execution rules and output format.
3. The relevant product/page/design contract:
   - product decision → `enterprise-saas-product-plan.md`
   - page handoff → `enterprise-page-story.md`
   - visual rule → `enterprise-product-direction.md`, `enterprise-visual-identity.md`, or `docs/reference/ui-ux/COMPONENT_INTERACTION_REFERENCE.md`

Before any UI, role, or approval task, also review the three mandatory reference pages:

- `docs/reference/ui-ux/app/pages/44_design_system.html` — visual/component contract.
- `docs/reference/ui-ux/app/pages/55_security_access.html` — RLS, scope, field visibility, and authorization contract.
- `docs/reference/ui-ux/app/pages/56_guidelines.html` — recruiter, manager, approval-cycle, and audit handoff story.
4. The exact target files and their nearest tests.
5. `progress.md` and `findings.md` only when resuming, blocked, or resolving a previous risk.

Do not load the whole repository into context. Use targeted search and line ranges. If a file is very large, inspect symbols and relevant sections only.

## 3. Task size rules

One micro-task must have:

- One task ID, one owner, one user outcome, and one reviewer.
- At most one database migration.
- Usually 3–8 production files. If the task needs more, split it before coding.
- One primary layer plus only the integration needed to prove the outcome. Split large frontend/backend/database work into ordered tasks.
- One acceptance gate that can be demonstrated with a command or browser scenario.
- No unrelated cleanup, renaming, dependency replacement, or visual experimentation.

Exception: an approved cleanup task may remove confirmed orphan/demo files, but only after an exact-target audit and only within the listed package. Do not combine cleanup with broad renaming or architecture changes.

Recommended decomposition for a large feature:

1. Contract and acceptance examples.
2. Database/schema task, if required.
3. API/service/permission task.
4. Frontend loading/empty/error shell task.
5. Frontend happy-path integration task.
6. Browser/API tests and fixture task.
7. Review/documentation task.

## 4. Definition of Ready

Do not implement until all answers are known:

- What exact user outcome is being delivered?
- Which phase and task ID authorize it?
- Which files/routes/endpoints/models are in scope?
- Which files/routes/endpoints/models are explicitly out of scope?
- What is the request/response or component contract?
- What permissions and organization scope apply?
- What are loading, empty, validation, forbidden, server-error, retry, pending, and success states?
- What data/fixtures are required?
- What command or browser scenario proves completion?
- Is there a migration, secret, external service, or security decision? If yes, is it approved?

If any answer is missing, stop with `BLOCKED — missing Definition of Ready` and list the exact decision required.

## 5. Execution loop

### Step A — Preflight

- Confirm the repository root and current branch/worktree status.
- Read the task section and target files.
- Search for existing components, services, contracts, and tests before creating anything.
- Write a short implementation checklist in the task handoff or `progress.md` before coding.

### Step B — Contract first

- Reuse existing types, DTOs, design tokens, routes, and error conventions.
- Never invent an endpoint, field, permission, status, or database relation from a screenshot.
- If a contract must change, stop and record the change as a separate decision before implementation.

### Step C — Implement the smallest slice

- Use `apply_patch` for source edits.
- Keep the approved naming and status vocabulary.
- Add states before polishing: loading, empty, error, forbidden, retry, pending, success.
- Keep V1 light mode only and use the shared RecruitFlow tokens.
- Avoid hardcoded credentials, secrets, fake enterprise claims, or fake API success.

### Step D — Verify immediately

Run the smallest relevant checks first, then broader checks when safe:

- Type/lint/build for the changed package.
- Unit/integration/API test for changed behavior.
- Browser test for changed page/flow at the required viewport.
- Migration validation/status if schema changed.
- Route/import scan for removed pages, sidebar items, dead links, and reference leakage when routing or cleanup changes.
- `git diff --check` for whitespace hygiene.

Do not claim a check passed if it was not actually run. Record command, result, and any warning.

### Step E — Handoff and stop

Update `progress.md` with the task result. Add new risks/discoveries to `findings.md`. Mark only the current task status. Do not mark the entire phase complete unless the phase gate passed.

Stop after the handoff. The next task starts with a fresh context and reads the written state.

## 6. Hard safety rules

- Never run destructive database/filesystem commands without explicit task authorization and a verified exact target.
- Never use `db push` against a shared/staging/production database. Use a reviewed migration.
- Never bypass authentication or organization scope to make a test pass.
- Never expose secrets in source, logs, screenshots, fixtures, or documentation.
- Never treat UI hiding as authorization.
- Never add Dark mode work to V1.
- Never add a dependency when an existing project capability solves the task unless an architecture decision approves it.
- Never change unrelated dirty-worktree files; preserve user changes.
- Never fix a symptom by weakening types, validation, permissions, or tests.

## 7. Frontend rules

- Use the shared component contract and `COMPONENT_INTERACTION_REFERENCE.md`.
- One primary action per region; label actions with verbs.
- Cards, metrics, buttons, tables, forms, filters, badges, alerts, and navigation must have explicit states.
- Use gradients only where the design contract allows them: canvas, primary action, selected navigation, and one focus card.
- Use the designated neon effect only for decision-critical emphasis; never use it as the only status signal.
- Every icon-only control has an accessible label and a minimum `40px` desktop / `44px` mobile target.
- Test `375px`, `768px`, `1024px`, and `1440px` when layout is affected.
- Respect `prefers-reduced-motion`; remove transforms, shimmer, pulse, and moving gradients while preserving state meaning.

### 7.1 Route and navigation rules

- The sidebar is a product map, not a component gallery. Add only real user destinations with an owner and next action.
- Keep design-system labs, state galleries, screenshots, debug routes, and hardcoded maintenance demos outside the live router.
- Before removing a route, search its lazy import, route declaration, navigation links, breadcrumb labels, tests, and documentation. Delete only confirmed orphan/demo files; preserve detail, create, approval, and full-list routes that support real workflows.
- Removing a sidebar item is not authorization. Keep protected routes protected and enforce permissions server-side.

### 7.2 Notification shell rules

- The authenticated header bell is the primary notification entry point. It opens a popover without navigating away from the current workflow.
- Reuse the existing typed notification API and `NotificationRecord`; do not invent demo notifications or duplicate endpoints.
- The popover must cover unread count, recent records, loading, empty, error/retry, mark-read, outside-click, Escape, accessible names, focus-visible, and mobile-safe layout.
- Keep the full notification list as a secondary `View all` destination when it has real filtering, pagination, and read-state behavior. Do not place Notifications in the sidebar unless the product plan explicitly changes.

### 7.3 Safe cleanup rules

- Classify files before touching them: active product, shared primitive, route support, static reference, demo/fixture, generated artifact, or orphan.
- Never delete a file because its name looks old. Confirm zero imports/references and check whether it is generated or required by a script.
- Do not delete `.env`, uploads, database dumps, migrations, user data, package-lock files, or generated evidence without an explicit target and recovery decision.
- After cleanup, run a source scan for the removed symbols/routes, the package type/build check, and `git diff --check`. Record every deleted path and why it was safe.

## 8. Backend/database rules

- Controller/router handles transport; service handles business rules; repository/data layer handles persistence.
- Every endpoint defines auth, permission, organization scope, validation, success shape, errors, and audit expectation.
- Preserve existing data. Check uniqueness, foreign keys, nullability, indexes, history, and rollback before migration.
- Keep candidate identity separate from application; opening/vacancy separate from position/request; offer versions immutable after approval.
- Use additive deterministic fixtures. Never delete user data to make a demo pass.

## 9. Blocked-state protocol

Use this exact format when blocked:

```text
BLOCKED
Task: P?.?-??
Blocker: one sentence
Evidence: file/command/error
Why guessing is unsafe: one sentence
Required decision or input: exact question
Safe work completed: bullets
```

Do not continue with a guessed schema, endpoint, permission, or UX behavior.

## 10. Required completion report

Use this exact structure:

```text
DONE / PARTIAL / BLOCKED
Task: P?.?-?? — <name>
Outcome: <one sentence>
Changed: <files and purpose>
Contracts: <API/schema/component changes or none>
States covered: <loading, empty, error, forbidden, pending, success, responsive>
Checks run: <commands/scenarios and result>
Known risks: <none or explicit list>
Next task: <single task ID only>
```

## 11. Reusable prompt for a small model

Copy this prompt and replace the placeholders:

```text
You are working on RecruitFlow in the repository root.

Authoritative documents:
- docs/development/PROJECT_EXECUTION_PLAN.md
- docs/development/AI_EXECUTION_PLAYBOOK.md
- the relevant product/page/design contract named by the task

V1 constraint: Light mode only. Do not implement Dark mode, theme switching, AI claims, unsupported compliance claims, or unrelated refactors.

Surface boundary: `apps/web` is the live product; `docs/reference/ui-ux/app` is offline reference only. Do not route, import, bundle, or place reference/demo pages in live navigation.

Your assigned task is exactly:
Task ID: <P?.?-??>
Task name: <one sentence>
User outcome: <one sentence>
In scope: <exact files/routes/endpoints/models>
Out of scope: <explicit list>
Reference-only files/routes: <explicit list, or none>
Acceptance checks: <testable statements>

Execution rules:
1. Read the authoritative plan, this playbook, and only the target files/tests.
2. Inspect existing contracts before writing code. Do not invent fields, endpoints, statuses, or permissions.
3. If the Definition of Ready is incomplete, stop as BLOCKED and ask for the missing decision.
4. Implement one smallest slice using existing patterns and shared tokens.
5. Add or preserve loading, empty, validation, forbidden, server-error, retry, pending, and success states where relevant.
6. Run the smallest relevant lint/type/build/API/browser/migration checks. Do not claim unrun checks.
7. Use apply_patch, preserve unrelated dirty changes, and never run destructive commands.
8. Update progress.md and findings.md, then stop. Do not start the next task.

Return only:
DONE / PARTIAL / BLOCKED
Task:
Outcome:
Changed:
Contracts:
States covered:
Checks run:
Known risks:
Next task:
```

## 12. Team operating model

- One person/model owns one task at a time.
- A reviewer checks the contract and acceptance evidence before the next task begins.
- Backend and frontend may work in parallel only after the API/component contract is written.
- No two workers edit the same file set simultaneously.
- The phase owner merges only tasks whose completion report, tests, and scope match the plan.
- If a task grows beyond its original boundary, stop, split it, and create the next task ID instead of silently expanding scope.
