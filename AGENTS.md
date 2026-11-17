# Engineering Quality Instructions

These instructions apply to Grok and other coding agents working in this repository.
Use them for implementation, design, QA, and code review; follow the closest existing
pattern when it provides a more specific rule.

## Quality bar

- Treat each request as an outcome to deliver, not a prompt to make a plausible-looking
  change. Identify the user, intended workflow, constraints, and observable acceptance
  criteria before implementation. Resolve details from the codebase and product rules;
  ask only when a consequential decision cannot be established safely.
- Inspect the complete affected path before editing: entry point, shared components,
  state/data flow, permissions, API/contracts, styles, and focused tests. Search for
  existing patterns first and preserve unrelated working-tree changes.
- Make the smallest coherent change that completes the workflow across every affected
  surface. Include success, loading, empty, error, disabled, and recovery states as
  applicable. Keep terminology, navigation, and behavior consistent between roles,
  responsive layouts, and light/dark themes.
- Prefer clear, durable behavior over visual tricks, speculative abstractions, or rushed
  output. Review the final diff for omissions, regressions, dead code, and accidental scope.

## Frontend design and implementation

- Before editing a screen, inspect its current component, styles, shared UI primitives,
  tokens, routes, and focused tests. For design work, also consult
  `apps/web/src/design-system/README.md`; for responsive work, consult
  `docs/responsive/audit.md`.
- Deliver a composed, production-ready interface: establish a clear primary task and
  information hierarchy; align typography, spacing, density, control sizes, and content;
  make primary and secondary actions visually distinct; and provide complete loading,
  empty, error, disabled, hover, focus, selected, and success feedback where applicable.
- Validate actual behavior and visuals in the browser when available. Inspect the initial
  viewport and the affected workflow, not only a screenshot; exercise changed controls and
  check for clipped text, awkward wrapping, unintended scroll, overlap, and layout shifts.
- Reuse existing design tokens, components, iconography, and light/dark behavior.
  Keep page-specific changes scoped; avoid one-off palettes, arbitrary fixed widths,
  decorative effects that reduce legibility, and new dependencies without a concrete need.
- Check responsive layouts at 375, 768, 1024, and 1440 CSS pixels. Prevent document-level
  horizontal overflow; contain intentional scrolling within the relevant table, board,
  or navigation region. Keep important controls usable at narrow widths and make
  touch targets at least 44px where practical.
- Preserve semantic HTML, keyboard operation, visible focus, accessible names, sufficient
  contrast, and reduced-motion preferences. Test keyboard paths and accessible names for
  new or changed controls; do not rely on color alone to communicate meaning.
- Treat screenshots as evidence of a specific viewport and state, not as a substitute for
  inspecting the implementation or validating other breakpoints and interaction states.

## QA and testing

- Derive tests from user-visible behavior, acceptance criteria, and nearby regressions.
  Assert meaningful results and boundaries rather than implementation details or CSS class
  names; include error, empty, loading, and permission cases when relevant.
- For each change, identify the highest-risk regression and add a focused assertion for it.
  Cover the behavior at its boundary (for example, the narrow breakpoint, unauthorized
  role, invalid transition, or stale update), not just the happy path.
- Use the repository's existing test runners, fixtures, accessibility helpers, and browser
  checks. Run the smallest focused tests first, then the relevant typecheck, lint, build,
  design-token, or broader gate indicated by the change.
- Do not weaken assertions, skip coverage, or change timeouts just to conceal a failure.
  Investigate failures; distinguish a verified baseline issue from a regression and report
  any gate that could not be run.
- When browser validation is available for UI work, inspect the rendered result at the
  target widths and exercise the changed interaction using keyboard and pointer/touch input.
  Check accessibility with existing project tooling where appropriate. Report the exact
  checks and outcomes; label unrun checks and known failures clearly.

## Backend and data integrity

- Trace a request through its route/controller, DTO validation, service, persistence adapter,
  shared API contract, generated client, and relevant frontend consumer before changing
  behavior. Reuse the established API client and repository abstractions; keep contracts,
  error shapes, and all affected callers consistent.
- Enforce authentication, permission checks, and organization/tenant scoping on the server;
  hiding a frontend control is not authorization. Preserve role-specific visibility and
  sensitive-field boundaries, including compensation and candidate data.
- Validate untrusted input at the API boundary. Keep state transitions, audit records, and
  related writes consistent with existing transaction and concurrency patterns. Consider
  retries, duplicate requests, stale versions, and partial failure where relevant. Make
  failures explicit; do not turn errors into empty, successful, or permissive results.
- For schema changes, add a safe Prisma migration, update affected contracts and call sites,
  and regenerate the client using the repository workflow. Keep the in-memory adapter
  limited to isolated tests; never use it to mask database or integration failures.
- Add or update API tests for successful behavior, invalid input, authorization, tenant
  isolation, sensitive-field disclosure, and relevant conflict or failure paths. Never use
  production recruitment data or expose credentials in code, tests, output, or screenshots.

## Completion

- A change is complete only when the requested workflow works end to end, relevant
  permission and error paths remain correct, focused tests pass, applicable static checks
  pass, and the final diff contains no unrelated edits.
- If a gate cannot run, report why and what remains unverified. Never describe an intended,
  mocked, or screenshot-only behavior as a verified end-to-end result.
- Summarize the delivered outcome, important files or surfaces changed, exact validation
  results, and remaining limitations in concise, verifiable terms.

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default roles: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md`. See `docs/agents/domain.md`.
