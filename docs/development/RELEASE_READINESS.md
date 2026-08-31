# RecruitFlow V1 Release Readiness

Date: 2026-08-17

Status: `PARTIAL — NOT READY TO DECLARE Enterprise Beta`

Product-mode update (2026-08-18): Light and Dark are now approved release surfaces, with Light as the first-visit default. This explicitly supersedes the earlier light-only/deferred-dark boundary; release evidence must cover both modes.

This report is the release-hardening handoff for `P10-RELEASE-01`. It records executed evidence and open gates. Passing build or browser checks does not by itself authorize a production release.

## Evidence completed

| Gate | Result | Evidence |
|---|---|---|
| API build | PASS | `npm --prefix apps/api run build` |
| API typecheck | PASS | `npm --prefix apps/api run typecheck` |
| Web build | PASS | `npm --prefix apps/web run build` |
| API/web lint | PASS | `npm run lint` |
| P5.5 offer-to-joining lifecycle | PASS | `database/test-p55-offers-hiring-integration.cjs` — 57/57 |
| P9 admin/trust API acceptance | PASS | `database/test-p9-admin-trust-integration.cjs` — 42/42 |
| Browser critical journeys | PASS | `tests/browser/recruitflow_critical_journeys.py` — 13/13 on workspace Vite (`localhost:5182`) + API |
| Browser shell accessibility checks | PASS | Keyboard order, password visibility focus, reduced-motion preference, accessible-name smoke, 375px overflow |
| Browser navigation timing instrumentation | PASS | Release browser journey records non-zero response and DOMContentLoaded timing |
| Code quality review | PASS | `code_quality_checker.py apps/web/src/pages` — 0 findings |
| Auth/tenant/RBAC/workflow regression matrix | PASS | 7/7 safe disclosure, 10/10 isolation, RBAC, auth 93/93, workflow 115/115, candidate 51/51, interviews 38/38 |
| Reference/live boundary | PASS | No `DesignSystemPage`, `/design-system`, or `docs/reference/ui-ux` references under `apps/web/src` |
| CORS origin policy | PASS | Configured/local development origins allowed; unknown external origin receives no CORS headers |
| Document contract truthfulness | PASS | Metadata-only UI, no false private-storage/download claims, storage key redaction verified in P5.3 — 53/53 |

The browser suite intentionally avoids mutating shared demo data. The expected four pre-session `401 Unauthorized` responses are treated as normal session bootstrap behavior; no unexpected browser console errors were reported.

## Open release gates

- Add isolated Playwright mutation journeys for request approval, candidate/application transition, interview decision, offer approval, final hiring approval, joining, full-vacancy rejection, and duplicate-joining prevention.
- Run a dedicated accessibility audit for all route groups: contrast, semantic headings, focus trapping, table semantics, dialogs/drawers, keyboard activation, and reduced-motion behavior.
- Complete the authorized pre-production security review: IDOR, tenant isolation, RBAC, session behavior, headers, secret exposure, and dependency review. Existing API suites are evidence, not a substitute for this gate.
- Capture a performance baseline for route loading, bundle size, API latency, pagination, and obvious request waterfalls.
- Run UAT with a dedicated demo organization and record owner-approved acceptance results, limitations, support notes, and rollback steps.
- Review migration provenance and upgrade/rollback evidence before any deployment decision.

## Explicit V1 boundaries

The following remain explicitly deferred: AI features, secure binary CV storage and scanning, SSO/SAML, MFA, and report export until their contracts and security requirements are approved. Light/Dark behavior and report date-range filtering are now release-gated implemented surfaces. The UI must continue to label unavailable capabilities rather than imply support.

## Next task

`P10-RELEASE-02` — add isolated browser mutation journeys and a full accessibility evidence pass. Keep the overall release status `PARTIAL` until every open gate above has evidence.
