# RecruitFlow Frontend Simple System - Full Audit Prompt

Status: ACTIVE audit prompt  
Authority: `docs/development/FRONTEND_SIMPLE_SYSTEM_PLAN.md`  
Output: one rolling report at `docs/development/FRONTEND_SIMPLE_SYSTEM_AUDIT_REPORT.md`

## Copy/paste prompt

You are the independent auditor for the RecruitFlow frontend implementation. Audit the current repository against the active frontend plan and the real product, API, security, and design-system contracts. Do not assume that a previous report, screenshot, “complete” label, or passing root command is proof. Inspect the current source and reproduce every important claim.

This audit is read-only by default. Do not fix source files while auditing. The purpose is to produce a trustworthy finding list for the rework prompt. You may update only the rolling audit report and the tracked planning records when the current run explicitly owns them.

“Closed” means every applicable audit category is PASS, every finding is resolved and reverified, all required commands exit 0, and no known security, contract, workflow, responsive, accessibility, or runtime defect remains. If evidence is missing, mark the item `NOT PROVEN` or `BLOCKED`; never mark it PASS by inference.

### 1. Read first

Read these sources before inspecting implementation:

1. Available project instructions and `RTK.md`.
2. `docs/development/PROJECT_EXECUTION_PLAN.md`.
3. `docs/development/PROJECT_MILESTONES.md`.
4. `docs/development/AI_EXECUTION_PLAYBOOK.md`.
5. `docs/development/FRONTEND_SIMPLE_SYSTEM_PLAN.md`.
6. `docs/development/prompts/FRONTEND_SIMPLE_SYSTEM_IMPLEMENTATION.md`.
7. `docs/design-system/enterprise-product-direction.md`.
8. `docs/design-system/enterprise-visual-identity.md`.
9. `docs/reference/planning/README.md` and only the supplied planning documents relevant to the audited behavior.
10. The exact current source, route tree, auth/session model, permissions, contracts, validation schemas, database/API boundary, package scripts, tests, and current worktree diff.

When documents disagree, follow the authority order in the frontend plan. Historical evidence is useful for locating claims but does not replace current source inspection or a reproducible command/browser result.

### 2. Worktree safety and terminal rules

- Prefix every terminal command with `rtk` as required by the repository environment.
- Start with `rtk git status --short` and record the branch and dirty files.
- Do not run destructive cleanup, reset, checkout, clean, broad deletion, or unrelated formatting.
- Do not modify application source, tests, contracts, package manifests, or configuration during the audit.
- Do not open or rely on retired screenshots or prototype assets as implementation authority.
- Use exact paths and line numbers in findings. Inspect the relevant diff when a changed file is involved.

### 3. Audit verdicts and severity

Use these statuses:

- `PASS`: verified by current source plus an appropriate command, test, or browser result.
- `FAIL`: a reproducible defect exists.
- `NOT PROVEN`: implementation may exist, but the required evidence is missing.
- `BLOCKED`: verification cannot proceed because of a clearly identified external/environment/product dependency.
- `N/A`: genuinely outside the approved scope, with a one-line reason.

Use these severities:

- `P0`: security, tenant isolation, unauthorized access, data loss/corruption, broken build, or a release-stopping failure.
- `P1`: a required lifecycle, route, mutation, role journey, or core state is broken or materially misleading.
- `P2`: important contract, usability, accessibility, responsive, maintainability, or quality defect that should be fixed before closure.
- `P3`: polish or low-risk improvement. It still remains open until explicitly deferred by the product authority.

Unknown, untested, or historical claims are not PASS. A failed required command is at least P0/P1 depending on impact and must be reworked.

### 4. Baseline and static audit

Inspect package scripts and TypeScript configuration first. Confirm that the app-level check actually includes `apps/web/src`; a root project with an empty file list is not sufficient evidence.

Run and record the exact result of:

```text
rtk pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit
rtk pnpm --dir apps/web build
rtk pnpm --dir apps/web check:design-tokens
rtk pnpm --dir apps/web test
rtk git diff --check
```

If dependencies are missing, inspect the lockfile and existing setup first. Use the repository's normal install command only when necessary and record it. Do not silently change dependency versions.

Check for:

- TypeScript errors, unused imports/locals, invalid icon names, invalid component props, unsafe casts, suppressed diagnostics, dead routes, unreachable branches, and stale imports.
- API DTO, enum, validation, route-loader, query, mutation, and page-prop mismatches.
- Design-token violations, random production colors, duplicate primitives, and one-off visual systems.
- Hardcoded tenant/user/candidate/job/interview/offer/KPI values in production surfaces.
- Console errors, unhandled promise rejections, and warnings in the touched areas.
- New dependencies, scripts, routes, or config changes without an approved reason.

### 5. Plan and information-architecture audit

Verify that the implementation follows one simple shell and the visible lifecycle:

`Request -> Approval -> Job -> Applicants -> Interviews -> Offer -> Joining`

Verify the seven primary destinations are exactly:

- Home
- Jobs
- Candidates
- Interviews
- Offers & Joining
- Reports
- Settings

Check that:

- Deep detail/create pages are routable without becoming duplicate sidebar destinations.
- Every sidebar item maps to a real route and real product responsibility.
- Mobile drawer, collapsed rail, and desktop sidebar share one navigation source.
- Topbar search, allowed quick create, notifications, theme, help, and account/org context use real contracts.
- Organization, role, environment, and user labels come from authenticated session/config data.
- No old route is silently left as a dead link or duplicate entry.

### 6. Functional lifecycle audit

Audit each required story end to end, using real API behavior and authorized test identities where available.

#### A. Request and approval

- Employee can create a valid vacancy request.
- Required fields and validation are clear.
- Manager can approve, request changes, or reject with required evidence.
- Pending, failure, retry, and success states are correct.
- Unauthorized roles cannot view or mutate the request by direct URL or client replay.

#### B. Jobs and applicants

- Job list shows real status, owner, department, SLA, applicant count, and next action.
- Job detail has Overview, Applicants, Interviews, Offers, and Activity context.
- Applications are grouped by real server stage.
- Stage changes use approved server/API mutations and refresh or invalidate data correctly.
- Invalid, forbidden, stale, concurrent, and failed transitions are handled without false success.

#### C. Candidates

- Candidate directory filters and search use real query contracts.
- Consent, document metadata, duplicate warning, source, and last activity are accurate.
- Candidate 360 shows application history, interviews, offers, timeline, notes, owner, status, and next action only when permitted.
- PII and documents are not exposed to roles without permission.

#### D. Interviews

- List/calendar switch is real and consistent.
- Timezone, participants, availability/conflict errors, scheduling, rescheduling, cancellation, and scorecard status are correct.
- Scorecard draft, validation, pending, saved, failed, and forbidden states are covered.

#### E. Offers and joining

- Offer preparation and approval use real fields and permissions.
- Approval evidence and audit history are visible.
- Signed/declined terminal states cannot be falsely changed.
- Joining readiness is not shown before the contract's approved/signed state.

#### F. Reports and settings

- Reports use real filters, date/timezone semantics, table fallback, empty state, and authorized export.
- Settings show draft/published state, validation, impact, permission checks, and audit trail.
- Missing backend capabilities are explicitly deferred, not simulated with hardcoded data.

### 7. Security, data, and contract audit

Verify current server/API and frontend behavior together. The UI is not an authorization boundary.

Check:

- Every request is tenant/org scoped from the authenticated session.
- List, detail, search, nested mutation, export, download, and direct-ID routes enforce authorization server-side.
- Role-specific actions match the permission contract.
- Candidate PII, salary, contact data, documents, interviews, offers, and notes are protected.
- Candidate document access is metadata-first unless secure private storage, malware scanning, retention, and access logging are actually implemented.
- Consent, audit, ownership, revision/version, and decision evidence are preserved.
- AI assistance, if present, does not auto-rank, auto-reject, hide criteria, or mutate decisions without approved product/security rules.
- Frontend error handling does not convert forbidden, validation, conflict, or server failures into success.
- Contracts are not weakened merely to make TypeScript compile.

Any security or tenant finding is P0 until proven otherwise.

### 8. UI, responsive, and accessibility audit

Inspect changed routes in both Light and Dark themes at:

- 1440px
- 1280px
- 1024px
- 768px
- 430px
- 375px

Verify:

- Shared components and tokens are used consistently.
- Primary actions use the approved visual language.
- Status has text/icon meaning in addition to color.
- Loading, empty, error, forbidden, stale, validation, pending, success, and retry states are usable.
- No clipping, horizontal overflow, inaccessible table, broken drawer, or hidden primary action exists.
- Keyboard tab order, focus visibility, focus restoration, labels, semantic headings, dialog behavior, and reduced-motion behavior work.
- Interactive targets are at least 44px where applicable.
- Contrast and readable text remain correct in both themes.

Use the repository's configured browser/Playwright/a11y checks. Discover commands from package scripts and test configuration; do not invent a command. If a browser check cannot run, record the exact environment limitation as BLOCKED and do not call it passed.

### 9. Test and release audit

Inspect existing unit, integration, browser, API, and security tests. Confirm tests cover the changed behavior rather than only rendering a page.

Check:

- route access for signed-out, forbidden, permitted, and expired-session states;
- role-specific shell and actions;
- request-to-approval;
- job-to-applicant stage transitions;
- candidate-to-interview-to-offer-to-joining;
- validation, server error, retry, stale, conflict, and success behavior;
- Light/Dark and mobile/desktop states;
- direct URL and mutation authorization;
- no false-positive test fixtures or production fallbacks.

Review the final diff for scope creep, accidental deletions, generated files, secrets, debug code, temporary files, and unrelated rewrites. Preserve all user-owned changes.

### 10. Required rolling audit report

Write or update `docs/development/FRONTEND_SIMPLE_SYSTEM_AUDIT_REPORT.md`. Keep one current report; do not create a new report for every run.

The report must contain:

1. Audit date, branch, commit, and worktree status.
2. Scope and exact authority documents read.
3. Command matrix with command, exit code, result, and relevant output.
4. Browser/theme/viewport/role matrix with evidence or BLOCKED reason.
5. Finding matrix with these columns:

   `ID | Severity | Category | File:line | Expected | Actual | Reproduction/evidence | Status | Rework acceptance test`

6. Category summary for plan/IA, static/build, contracts, lifecycle, security/data, UI/design system, responsive/accessibility, tests/release.
7. Open finding count by severity.
8. Final verdict: `CLOSED`, `REWORK REQUIRED`, or `BLOCKED`.
9. Exact next action.

The verdict rules are strict:

- `CLOSED`: every applicable category is PASS, all finding rows are resolved and reverified, all required commands pass, and open count is zero.
- `REWORK REQUIRED`: one or more FAIL or NOT PROVEN items can be fixed in the repository.
- `BLOCKED`: the remaining issue depends on a clearly named external system, missing product decision, unavailable environment, or missing contract. Include the owner and unblock action.

Do not downgrade severity to obtain closure. Do not close a finding because a workaround hides it. Do not mark historical evidence as current verification.

### 11. Final auditor response

Return only an evidence-based summary:

- verdict;
- counts by severity and status;
- highest-risk findings first;
- commands and exit codes;
- browser/accessibility coverage;
- exact file/line locations;
- whether the repository is ready for the rework loop or genuinely CLOSED.

If the verdict is not CLOSED, the next action is to use `FRONTEND_SIMPLE_SYSTEM_REWORK_LOOP.md` with this rolling report.
