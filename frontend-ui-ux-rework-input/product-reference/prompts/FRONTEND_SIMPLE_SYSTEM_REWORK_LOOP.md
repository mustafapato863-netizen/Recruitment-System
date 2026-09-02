# RecruitFlow Frontend Simple System - Rework and Re-audit Loop Prompt

Status: ACTIVE rework prompt  
Authority: `docs/development/FRONTEND_SIMPLE_SYSTEM_PLAN.md`  
Input: `docs/development/FRONTEND_SIMPLE_SYSTEM_AUDIT_REPORT.md`

## Copy/paste prompt

You are the senior engineer responsible for closing every finding in the current RecruitFlow frontend audit. Read the rolling audit report, reproduce each finding, implement the smallest correct fix in the existing architecture, verify it, and then run a complete re-audit. Continue the loop until every applicable part is PASS and the audit verdict is `CLOSED`, or until a genuine external blocker is fully documented.

Do not only patch the first error. Do not declare completion after one successful build. Do not hide a finding with a type suppression, fake data, disabled check, conditional omission, or screenshot-only state. Every fix must preserve product behavior, server/API authorization, tenant scope, consent, audit evidence, and the active frontend plan.

### 1. Read first and establish the baseline

Read:

1. Available project instructions and `RTK.md`.
2. `docs/development/PROJECT_EXECUTION_PLAN.md`.
3. `docs/development/PROJECT_MILESTONES.md`.
4. `docs/development/AI_EXECUTION_PLAYBOOK.md`.
5. `docs/development/FRONTEND_SIMPLE_SYSTEM_PLAN.md`.
6. `docs/development/prompts/FRONTEND_SIMPLE_SYSTEM_IMPLEMENTATION.md`.
7. `docs/development/prompts/FRONTEND_SIMPLE_SYSTEM_AUDIT.md`.
8. `docs/development/FRONTEND_SIMPLE_SYSTEM_AUDIT_REPORT.md`.
9. The exact source, contracts, permissions, API clients, validation schemas, tests, package scripts, and current worktree diff.

Prefix every terminal command with `rtk`. Start with:

```text
rtk git status --short
rtk pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit
```

Record the starting state. Preserve user-owned dirty changes. Never use reset, checkout, clean, broad deletion, or unrelated formatting.

### 2. Build the rework queue

Read every row in the rolling audit report. Convert every `FAIL`, `NOT PROVEN`, failed required command, unverified role/route, and newly reproduced regression into a rework item. Do not silently remove or rewrite a finding to make the count smaller.

Use this order:

1. P0 security, tenant isolation, authorization, data integrity, secrets, or broken build.
2. P1 lifecycle, API contract, route, mutation, role, or release-blocking defects.
3. P2 state, responsive, accessibility, design-system, test, and maintainability defects.
4. P3 polish and consistency defects.

Group findings only when they have the same root cause and the same acceptance test. Keep separate acceptance tests for separate user-visible behavior.

For each item, write an internal work record before editing:

`Finding ID | root cause hypothesis | files in scope | smallest safe fix | regression test | verification command/browser journey`

If the report has no findings but a required baseline command fails, create a new P0/P1 finding and fix it. A clean-looking report never overrides failed evidence.

### 3. Rework rules

- Inspect the exact code and contract before editing.
- Fix the root cause, not only the visible symptom.
- Use existing components, tokens, router, API client, validation, auth, and state patterns.
- Keep contracts exact. If a contract truly must change, update the shared contract, server behavior, all consumers, and tests together with evidence.
- Never use `any`, unsafe double casts, `@ts-ignore`, `@ts-expect-error`, disabled TypeScript checks, fake API fallbacks, hardcoded production values, or unreachable demo branches to bypass a finding.
- Do not add a dependency or new state library for a local defect.
- Do not create a second shell, navigation source, theme system, component family, or page contract.
- Every mutation must use the approved server/API path.
- Every changed page must retain or add owner, object, status, next action, permission, evidence, and applicable state behavior.
- Every sensitive value must remain tenant- and role-scoped.
- Add or update focused tests for the fixed behavior before moving to the next item.
- Keep the diff limited to the finding and its necessary consumers.

### 4. Fix in short verified batches

Process one finding or one shared-root-cause batch at a time:

1. Reproduce the finding using the audit evidence.
2. Record the actual root cause and affected path.
3. Implement the smallest architecture-consistent fix.
4. Run the focused typecheck/test/browser check.
5. Inspect the diff and confirm unrelated changes were preserved.
6. Run the relevant security/permission/state checks.
7. Mark the finding as `FIXED - PENDING RE-AUDIT`; never mark it CLOSED yet.
8. Continue to the next highest-priority item.

Use dependency order when several findings are related:

1. contracts and types;
2. auth/permissions/tenant scope;
3. data loading and mutation behavior;
4. routing and page composition;
5. shared components and tokens;
6. responsive/accessibility behavior;
7. tests and documentation.

### 5. Mandatory re-audit after every batch

After each logical batch, re-audit the changed area and all consumers. Re-run the applicable checks and update the rolling audit report with:

- changed files;
- finding IDs addressed;
- focused verification evidence;
- new regressions or findings;
- remaining status.

After all planned fixes in the queue, run the complete audit again using every section of `FRONTEND_SIMPLE_SYSTEM_AUDIT.md`, not only TypeScript. The complete audit must include current source, route behavior, permissions, contracts, lifecycle flows, states, themes, viewport sizes, accessibility, tests, and final diff inspection.

The loop is:

```text
AUDIT
  -> prioritize findings
  -> REWORK one safe batch
  -> focused verification
  -> FULL RE-AUDIT
  -> fix new or remaining findings
  -> FULL RE-AUDIT again
  -> repeat until every category is PASS
```

If re-audit discovers a regression, create a new finding with a new ID and return it to the queue. A finding is closed only after the original acceptance test and the complete re-audit pass.

### 6. Required final gates

Before requesting closure, run and record:

```text
rtk pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit
rtk pnpm --dir apps/web build
rtk pnpm --dir apps/web check:design-tokens
rtk pnpm --dir apps/web test
rtk git diff --check
```

Inspect the configured browser/Playwright/a11y setup and run the available checks for:

- signed-out, forbidden, permitted, and expired-session access;
- each role's shell and primary route permissions;
- vacancy request to approval;
- job to applicant review and allowed stage movement;
- candidate to interview to offer to joining;
- validation, loading, empty, stale, error, retry, pending, and success states;
- Light and Dark themes;
- 1440, 1280, 1024, 768, 430, and 375px widths;
- keyboard navigation, focus restoration, dialogs/drawers, and reduced motion;
- direct URL and mutation authorization.

Do not invent a browser command. Discover the configured command from package scripts and test configuration. If an environment limitation remains, mark the relevant category BLOCKED with exact evidence and the owner/unblock action.

### 7. Closure criteria for every part

The work is not closed until the rolling audit report has zero open findings and each applicable category has current evidence:

- plan and information architecture;
- TypeScript, build, tests, and design-token checks;
- routes and navigation;
- request and approval;
- jobs and applicants;
- candidates and Candidate 360;
- interviews and scorecards;
- offers and joining;
- reports and settings or explicit authority-approved deferral;
- API contracts and validation;
- auth, role permissions, tenant scope, PII, documents, consent, and audit;
- loading/empty/error/forbidden/stale/validation/pending/success/retry states;
- Light/Dark themes and all required viewports;
- keyboard/accessibility behavior;
- browser/runtime console health;
- final diff scope and worktree safety.

`CLOSED` is allowed only when every category is PASS or explicitly `N/A` with an authority-backed reason, every finding row is reverified, all required command exit codes are 0, and the report says `CLOSED`.

### 8. Blocker rule

Do not use BLOCKED for a problem that can be fixed in the repository. Before declaring a blocker, exhaust safe local inspection and verification.

A valid blocker report must name:

- the exact missing external system, decision, environment capability, or contract;
- the affected category and finding IDs;
- commands/browser journeys attempted;
- why a safe local implementation would be dishonest or unsafe;
- the owner required to unblock it;
- the exact next action after unblocking.

Until the blocker is resolved, the final verdict is `BLOCKED`, never `CLOSED`.

### 9. Update the rolling report and planning records

Update `docs/development/FRONTEND_SIMPLE_SYSTEM_AUDIT_REPORT.md` after each batch and after the final full re-audit. Preserve the history of finding status changes in the same report without creating duplicate reports.

When this is an explicitly tracked implementation run, update `task_plan.md`, `findings.md`, and `progress.md` with concise current facts only. Do not paste long logs into those files.

### 10. Required final response

Return an evidence-based closure report containing:

1. Final verdict: `CLOSED`, `REWORK REQUIRED`, or `BLOCKED`.
2. Initial findings count versus final findings count.
3. Every finding ID with final status and acceptance evidence.
4. Files changed grouped by root cause.
5. All required commands with exit codes.
6. Browser, role, theme, viewport, and accessibility coverage.
7. Any deferred/N/A item with authority and reason.
8. Confirmation that unrelated user-owned changes were preserved.

Do not write “0 issues,” “complete,” “verified,” or “closed” unless the rolling report and evidence actually satisfy all closure criteria.

Begin by reading the audit report and reproducing the highest-severity finding. Continue until the complete re-audit returns `CLOSED` or a genuine blocker is documented.
