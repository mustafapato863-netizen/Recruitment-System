# RecruitFlow Frontend Simple System - Implementation Prompt

Status: ACTIVE execution prompt  
Authority: `docs/development/FRONTEND_SIMPLE_SYSTEM_PLAN.md`  
Scope: `apps/web`, `packages/design-system`, and frontend-facing contracts only

## Copy/paste prompt

You are the senior frontend engineer responsible for implementing the active RecruitFlow frontend plan in the current repository.

Implement the plan in the existing codebase. Do not only describe the work. Work phase by phase, inspect the exact source before editing, and do not report success until the real application checks pass. “Zero issues and errors” means zero unresolved TypeScript/build/test/design-token errors and no knowingly broken route, permission, loading state, API integration, or responsive behavior. If a true external blocker prevents that result, stop at the blocker and report the exact command, file, error, and reason; never hide the error or claim completion.

### 1. Required context and authority

Read these files before changing code:

1. Available project instructions and `RTK.md`.
2. `docs/development/PROJECT_EXECUTION_PLAN.md`.
3. `docs/development/PROJECT_MILESTONES.md`.
4. `docs/development/AI_EXECUTION_PLAYBOOK.md`.
5. `docs/development/FRONTEND_SIMPLE_SYSTEM_PLAN.md`.
6. `docs/design-system/enterprise-product-direction.md`.
7. `docs/design-system/enterprise-visual-identity.md`.
8. `docs/reference/planning/README.md` and only the supplied planning documents relevant to the current phase.
9. The exact current route tree, auth/session model, permission model, API contracts, validation schemas, shared UI components, tests, and package scripts.
10. `task_plan.md`, `findings.md`, and `progress.md` when this is a tracked continuation of the current implementation run.

When sources disagree, follow the authority order in `FRONTEND_SIMPLE_SYSTEM_PLAN.md`. Historical reports are evidence only; they are not permission to copy an old implementation or to mark a phase complete without reproducing its checks.

### 2. Terminal and worktree rules

- Prefix every terminal command with `rtk` as required by the repository environment. For example: `rtk pnpm --dir apps/web build`.
- Start with a read-only inspection of branch, status, package scripts, TypeScript configs, routes, and changed files.
- The worktree may contain user-owned changes. Preserve them. Never use `git reset --hard`, `git checkout --`, `git clean`, broad deletion, or an overwrite that is not required by this task.
- Do not discard, reformat, or rewrite unrelated changes.
- Before editing a file with existing changes, inspect its diff and keep the unrelated work intact.
- Use the repository's existing package manager, components, tokens, API clients, validation utilities, test setup, and route conventions.
- Do not install a new library, create a parallel state system, replace the router, or replace the design system unless the existing architecture is proven unusable and the change is explicitly required by an existing project authority.
- Use patch-based edits for source and documentation changes. Keep each logical change reviewable.
- Do not commit, push, or create a branch unless explicitly requested.

### 3. Product outcome

Build one simple Odoo-inspired recruiting operations frontend. Odoo is a workflow reference, not a visual or source-code clone. The visible lifecycle must remain clear:

`Request -> Approval -> Job -> Applicants -> Interviews -> Offer -> Joining`

The seven primary destinations are:

- Home
- Jobs
- Candidates
- Interviews
- Offers & Joining
- Reports
- Settings

Use real authenticated organization/session data. Do not hardcode tenant names, user roles, candidate names, jobs, interviews, offers, KPI values, or other production-looking sample data.

### 4. Explicit non-goals

Do not add payroll, a full HRMS, ERP modules, job-board integrations, WhatsApp/SMS, autonomous AI screening, a new visual system, a new component library, a screenshot gallery, prototype-only pages, demo routes, or fake maintenance routes.

Do not weaken or bypass backend authorization, tenant isolation, RLS, validation, audit logging, consent rules, document controls, or API error contracts. A hidden button is not authorization. Every protected route and mutation must remain protected by the server/API boundary.

Do not use browser-only stage changes, fabricated API fallbacks, fake metrics, fake documents, or placeholder success responses in production surfaces. If a backend capability is missing, use the existing typed error/empty state and record the exact integration blocker instead of inventing data.

### 5. Phase 0 - stabilize before redesign

Complete this phase before adding visual polish or new page behavior.

1. Inspect the current dirty worktree and identify which changes belong to this task.
2. Inspect `apps/web/package.json`, all relevant `tsconfig` files, Vite configuration, route definitions, auth/session types, contracts, validation schemas, and design-token checks.
3. Run the real app-level baseline commands:

   ```text
   rtk pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit
   rtk pnpm --dir apps/web build
   rtk pnpm --dir apps/web check:design-tokens
   rtk pnpm --dir apps/web test
   ```

4. If the existing `typecheck` script checks the wrong TypeScript project or can pass while the app has errors, correct the script/configuration and prove the corrected command fails on a real error and passes after the error is fixed.
5. Fix errors in dependency order:

   - invalid imports and unused imports/locals;
   - incorrect icon names and shared-component props;
   - contract, DTO, enum, API-client, and validation mismatches;
   - route loader/page prop mismatches;
   - state and event-handler type errors;
   - test failures and runtime warnings.

6. Do not silence errors with `any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error`, disabled checks, or dead-code tricks. Use the actual contract or update the shared contract and all consumers together when a contract change is genuinely required.
7. Remove dead imports, dead routes, duplicate navigation entries, and unreachable branches encountered in the touched area.

Phase 0 is complete only when all applicable baseline commands exit with code 0 and the app-level TypeScript command is known to check the real application.

### 6. Phase 1 - shell and navigation

Implement one shared shell from a single navigation source.

Required shell behavior:

- Sidebar destinations are exactly Home, Jobs, Candidates, Interviews, Offers & Joining, Reports, and Settings.
- Sidebar visibility is derived from the real auth/session permission contract.
- The top bar provides global search, allowed quick-create actions, notifications, theme toggle, help/documentation entry when available, and account/organization context from real session data.
- Desktop expanded sidebar, collapsed rail, tablet layout, and mobile drawer use the same navigation model.
- Deep detail/create routes remain routable without becoming additional top-level sidebar items.
- Active route, breadcrumb/context title, back navigation, keyboard navigation, focus restoration, and reduced-motion behavior are correct.
- Light and Dark themes use the existing token system. Do not add another theme family.
- No shell label or account value is hardcoded as a real organization/user value.

For every shell action, verify both UI visibility and route/API authorization. Test signed-out, forbidden, permitted, loading, and failed-session states where the existing auth architecture supports them.

### 7. Phase 2 - Jobs to Applicants vertical slice

Implement this as one connected story, using real typed contracts and existing API patterns:

1. Vacancy request creation and validation.
2. Manager approval, request-for-change, and rejection with evidence.
3. Job-position list with status, owner, department, SLA, applicant count, and next action.
4. Job detail with Overview, Applicants, Interviews, Offers, and Activity tabs.
5. Applications table or board grouped by real server stages.
6. Applicant review and allowed stage transitions through approved server/API mutations.

Each page must make the object, owner, current status, next allowed action, and decision evidence clear. Stage controls must be disabled or hidden from the UI when the user lacks permission, while the server remains authoritative. Show typed API errors, optimistic/pending state only when safe, retry behavior, stale-data handling, and post-mutation refresh/invalidation using the existing data pattern.

Required phase gate:

- An employee can submit a valid vacancy request.
- A manager can approve, request changes, or reject with the required evidence.
- An authorized recruiter/admin can open the resulting job, review real applicants, and perform only allowed transitions.
- Unauthorized users cannot reach or mutate protected data by changing a URL or replaying a client action.

### 8. Phase 3 - Candidate to Interview to Offer

Connect the next operational story:

1. Candidate directory with filters, source, consent/document indicators, duplicate warning, and last activity.
2. Candidate 360 with identity header, application history, document metadata, interviews, offers, timeline, notes, owner, and next action.
3. Interview list/calendar with timezone, participants, scorecard status, conflict handling, and clear scheduling errors.
4. Scorecard capture with validation, draft/pending/saved/error states, and permission-aware access.
5. Offer preparation, approval, signed/declined terminal states, and joining-readiness checklist.

Candidate PII and documents must follow the existing permission, consent, storage, audit, and tenant contracts. Keep document surfaces metadata-first unless the existing secure private-storage path is already available and proven. Never expose salary, contact, identity, document, or interview data merely because a UI component can render it.

Joining must not appear as ready before the approved/signed state defined by the real contract. Offer actions must be auditable and must show the reason/evidence required by the product rules.

### 9. Phase 4 - advanced operations only when contract-backed

Implement or explicitly defer CV import/bank, duplicate review, talent pools, reports, settings, audit, integrations, and candidate portal only when their routes, permissions, API contracts, validation, and state behavior exist.

For reports, use real filters, clear date/timezone semantics, table fallbacks, empty states, and export authorization. Never fill missing metrics with hardcoded values.

For settings, show draft/published state, validation, impact preview, permission checks, and audit trail. Do not make a setting appear live if the server has not persisted or published it.

### 10. UI and component rules

- Use existing shared primitives first: `Button`, `Input`, `Badge`, `Card`, `DataTable`, shell primitives, tokens, and the existing icon wrapper.
- Use only icon names accepted by the repository's `IconName` contract. If an icon is missing, extend the contract deliberately and update its consumers; do not guess a name.
- Use the established typography, color, spacing, radius, shadow, and theme tokens. Do not add random hex values or one-off CSS values to bypass the system.
- Keep the primary action blue and status meaning available through text/icon as well as color.
- Use compact operational layouts: lists, tables, tabs, split details, drawers, workflow rails, and focused forms. Avoid turning every section into a decorative card wall.
- Meet a 44px minimum interactive target, visible focus state, keyboard access, semantic labels, and readable contrast.
- Verify 1440, 1280, 1024, 768, 430, and 375px widths.
- Check Light and Dark themes on every changed route.
- Do not add motion that blocks work; respect reduced-motion preferences.

### 11. State matrix required on every changed route

Before calling a page complete, define and implement the applicable behavior for:

- initial loading;
- empty collection or first-use state;
- recoverable API error;
- forbidden/unauthorized state;
- stale or out-of-date data;
- field validation error;
- pending mutation/submission;
- successful mutation or save;
- retry and recovery;
- network/offline failure where supported by the existing app architecture.

States must be reachable through real code paths or deterministic test fixtures. Do not create a state that only exists in a screenshot or unreachable demo branch.

### 12. Testing and verification loop

After each phase, run the smallest relevant checks, then run the full gate before moving to the next phase. Inspect command exit codes and actual output.

Required final checks:

```text
rtk pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit
rtk pnpm --dir apps/web build
rtk pnpm --dir apps/web check:design-tokens
rtk pnpm --dir apps/web test
rtk git diff --check
```

Also inspect the repository's existing browser/Playwright test setup and run the available checks for:

- login/session boundary;
- each permitted role's shell and primary route access;
- mobile drawer and keyboard navigation;
- vacancy request to approval;
- job to applicant review and allowed stage movement;
- candidate to interview to offer;
- forbidden direct URL and mutation attempts;
- loading, empty, error, retry, and success states;
- Light and Dark themes at desktop and mobile widths.

Do not invent a browser command. Discover the configured command from package scripts and test configuration. If a browser check cannot run because of environment limitations, record the exact limitation and do not call it passed.

### 13. Final review checklist

Before reporting completion, inspect the complete diff and confirm:

- no unrelated user change was deleted or overwritten;
- no stale import, duplicate route, duplicate sidebar item, dead page, or console error remains in the touched area;
- all changed routes have an owner, object, status, next action, permission behavior, data contract, and state matrix;
- all mutations use the approved API/server path;
- all sensitive data is tenant- and role-scoped;
- no hardcoded production-looking sample data was introduced;
- no new library or visual system was added without explicit authority;
- Light/Dark and all required viewport sizes were checked;
- all required commands exited with code 0;
- the final diff is understandable and limited to the current phase.

If any item fails, continue fixing it. If it cannot be fixed without a missing external dependency or product decision, stop and report it as a blocker with evidence.

### 14. Required delivery report

At the end of the implementation, provide a concise evidence-based report with:

1. Outcome: completed phases and exact routes/features delivered.
2. Files changed: grouped by shell, page, contract, test, and documentation.
3. Verification: every command run, its exit status, and important result.
4. Browser/accessibility matrix: routes, roles, themes, and viewports checked.
5. Deferred items: only genuine contract/product blockers, with owner and next action.
6. Worktree safety note: confirm unrelated user changes were preserved.

Never write “0 issues,” “complete,” “verified,” or “production-ready” unless the evidence above supports it.

Begin now with Phase 0 inspection and baseline verification. Do not skip directly to visual redesign.
