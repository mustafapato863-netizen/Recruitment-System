# M1-G3 Stable API Error Contracts Completion Report

**Date:** 2026-08-30
**Component:** M1-G3 API Error Envelope and Normalization
**Status:** COMPLETE & VERIFIED — independently reviewed after rework.

## 1. Goal Overview
The M1-G3 phase required verifying and remediating the API error contracts so that every backend and frontend flow produces safe, stable, actionable, machine-readable errors without leaking internal stack traces, ORM errors (Prisma), or weakening security.

## 2. Implemented Behaviors & Fixes

### Error Normalization & Envelope
- Implemented a bounded fail-safe sanitizer in `error-normalizer.ts`. The new normalizer detects Prisma `P*` codes, SQL fragments, `node_modules` paths, absolute paths, credential/token markers, JWT-like values, and object dumps, replacing unsafe messages with stable user-safe fallbacks while preserving ordinary safe business messages.
- Standardized `ErrorEnvelope` across the API (`packages/contracts`) requiring `{ statusCode, code, message, requestId, retryable, retryAfterSeconds }` with optional `fields` for field-level validation details.
- Request IDs (`req_<uuid>`) are properly generated, sanitized, mirrored in headers, and attached to all error envelopes.

### API Error Client Layer
- Updated the frontend `client.ts` to uniformly parse the stable envelope for both `fetchApi` (JSON payloads) and `downloadApi` (Blob streams).
- Implemented a resilient fallback in `downloadApi` that attempts session token refresh upon receiving 401s, preventing premature forced logouts during large file requests.

### Error-Code Registry 
The following stable codes are utilized and enforced:
`VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INVALID_CREDENTIALS`, `FILE_INVALID`, `FILE_TOO_LARGE`, `FILE_UNSAFE`, `IMPORT_INVALID`, `INTERNAL_ERROR`.

### Tenant Isolation & Security
- Safe 404 behavior was verified: Cross-tenant data fetches strictly return `NOT_FOUND` indistinguishable from non-existent data, mitigating existence enumeration.
- No storage paths or internal object keys leak on file upload failures (`FILE_TOO_LARGE` / `FILE_INVALID`).

## 3. Verified Testing Coverage & Evidence

### Unit Tests
- **Frontend API Client:** `vitest` unit tests created in `apps/web/src/api/client.test.ts`. Verified 401, 403, 404, 429, and 503 error handling, including the envelope parsing fallback for `downloadApi()`. **(5/5 passed)**
- **Backend Error Normalizer:** Direct unit tests created in `apps/api/src/common/errors/error-normalizer.spec.ts`. Verified Prisma leakage, raw stack string suppression, JWT/path sanitization, safe business messages, and unsafe non-5xx diagnostic fallback. **(11/11 passed)**

### Backend Integration Test
- `node database/test-m1-g3-error-contracts.cjs`
  - Validates login failures, token expiration, validation arrays vs field maps, safe unknown-record responses, CV file size limits, rate limiting retry intervals, and request-ID preservation. Cross-tenant isolation remains covered by its dedicated regression suite.
  - Asserted 19 sampled live errors for no internal string leaks.
- **Count:** 87/87 checks PASSED (100%) on the current build; the suite also passed on two earlier consecutive isolated runs.

### Browser UI Checks
- `python tests/browser/test_m1_g3_browser_matrix.py`
  - **Coverage:** Login surface (invalid credentials, missing fields), Session (corrupted tokens, deep-link returns), responsive error rendering at six viewport widths in light and dark themes, and Accessibility (Axe audits on both themed error states).
  - Note: Explicit intercept testing for `downloadApi` (e.g. Reports export) error parsing is covered by the frontend unit tests; browser checks focus on the login/session UI.
  - **Count:** 33/33 checks PASSED (100%) on two consecutive runs.

### Static Analysis & Regressions
- `pnpm typecheck`: 0 errors
- `pnpm lint`: 0 errors
- `pnpm test`: web **32/32** passed, followed by API normalizer **11/11** passed (**43 total**)
- `pnpm --dir apps/api test`: **11/11** backend normalizer tests passed
- `pnpm build`: API, worker, and web production builds passed
- `node database/test-m1-auth-contracts.cjs`: **72/72 passed** against the current build
- `node database/test-m1-auth-recovery.cjs`: **39/39 passed** against the current build
- `node database/test-m1-g2-public-boundary.cjs`: **121/121 passed** against the current build, including real cross-tenant read/mutation and XLSX export controls
- Prior regression evidence remains green for safe-disclosure **7/7**, isolation **10/10**, RBAC **12/12**, and P0-A **24/24**.

## 4. Recovery & Rollback Notes
If any unexpected regression in error formatting occurs, revert only the scoped normalizer/filter/client/test changes through a reviewed patch. Do not use destructive Git operations. No database schema was changed and no dependency was added.

## 5. Next Phase
M1-G3 is fully resolved. The exact next phase is **M1-G4**.

## 6. Required Phase Reporting

1. **Phase status:** Complete and verified; no M1-G3 acceptance blocker remains.
2. **Scope completed:** Stable API error envelope, safe diagnostic normalization, request/correlation IDs, frontend JSON/blob error parsing, download refresh behavior, unit coverage, integration coverage, and responsive/themed browser verification.
3. **Files changed:** `apps/api/src/common/errors/error-normalizer.ts`, `apps/api/src/common/filters/http-exception.filter.ts`, `apps/api/src/common/errors/error-normalizer.spec.ts`, `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/web/src/api/client.ts`, `apps/web/src/api/client.test.ts`, `packages/contracts/src/index.ts`, `package.json`, `tests/browser/test_m1_g3_browser_matrix.py`, `task_plan.md`, `findings.md`, `progress.md`, and this report.
4. **Shared components created or changed:** No visual shared component was changed; the shared API client and shared error contract layer were strengthened.
5. **Database or contract changes:** `ErrorEnvelope` core typing and API error behavior were reconciled; no Prisma schema or migration changed.
6. **UX and visual improvements:** Safe actionable error text, field-level validation mapping, focus restoration to the first invalid field, and download failures that preserve retry metadata without leaking response internals.
7. **Light-mode verification:** Login error and validation states passed the six-width browser matrix; Axe reported 0 critical/serious findings.
8. **Dark-mode verification:** The same login error and validation states passed at all six widths; Axe reported 0 critical/serious findings.
9. **Responsive verification:** 375x667, 430x932, 768x1024, 1024x768, 1280x800, and 1440x900 passed without horizontal overflow or runtime page errors.
10. **Accessibility verification:** 33/33 browser assertions passed twice; both themed Axe login error scans reported 0 critical/serious violations; inline errors and focus behavior were verified.
11. **Performance impact:** API, worker, and web production builds passed. No new dependency or global animation was introduced. The broader bundle-budget gate remains a release-wide check for its owning phase.
12. **Security impact:** Unsafe non-5xx diagnostics, paths, credentials, tokens, SQL/Prisma markers, and stack/object dumps are replaced with safe fallbacks; server logs receive sanitized diagnostics; authorization, tenant isolation, and audit behavior were preserved.
13. **Dependencies added or removed:** None; the API unit suite reuses the existing workspace Vitest installation.
14. **Commands executed:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm db:validate`, `pnpm db:migrate:status`, `git diff --check`, the API normalizer unit suite, M1-G1, M1-G2, M1-G3, safe-disclosure, isolation, RBAC, and P0-A permission suites, plus the browser matrix.
15. **Test results:** Web 32/32 and API 11/11 unit tests passed; M1-G1 72/72; auth recovery 39/39; M1-G2 121/121; M1-G3 87/87; safe-disclosure 7/7; isolation 10/10; RBAC 12/12; P0-A 24/24. The new browser matrix passed 33/33 twice.
16. **Browser journeys verified:** Invalid credentials, server field validation, client validation, protected deep-link return, corrupted session redirect, authenticated shell, logout, responsive/theme error rendering, and themed Axe scans. `downloadApi` error behavior is verified by its unit tests.
17. **Remaining issues:** None blocking M1-G3. Full product route accessibility, bundle budgets, production email/storage, and later ATS workflow capabilities remain owned by later phases.
18. **Risks requiring manual testing:** Real production browser download UX, screen-reader behavior beyond automated Axe and keyboard assertions, and provider/storage failure handling require later staging/UAT evidence.
19. **Rollback or recovery notes:** Revert only the scoped normalizer, filter, client, test-runner, and test changes through a reviewed patch. No destructive Git operation or database rollback is required.
20. **Exact next phase:** **M1-G4**, after which M1 continues through its remaining P0 integrity gates before M2 begins.
