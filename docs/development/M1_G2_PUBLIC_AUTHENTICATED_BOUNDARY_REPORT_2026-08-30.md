# RecruitFlow Production Engineering Report
## Phase M1-G2: Public & Authenticated Surface Separation (Browser Remediation Complete)

**Date**: 2026-08-30  
**Phase**: M1-G2 — Public & Authenticated Surface Separation  
**Status**: COMPLETE & VERIFIED  
**Next Phase**: M1-G3 — Stable API Error Contracts  

---

### Executive Summary

Phase **M1-G2 (Public & Authenticated Surface Separation)** has been fully implemented, remediated, and empirically verified across both backend API contracts and end-to-end browser user journeys.

#### Browser Remediation Summary:
- **Previous Failure**: `AssertionError: Open vacancy VAC-DEMO-001 should be listed` in Journey 1 of `tests/browser/test_m1_g2_browser_matrix.py`.
- **Root Cause**: The test asserted DOM contents immediately after `domcontentloaded` while the React client was still asynchronously fetching `/api/v1/public/organizations/RECRUITFLOW-DEMO/jobs`. Furthermore, the test relied on a hard-coded static fixture (`VAC-DEMO-001`).
- **Remediation & Fix**:
  1. Built [`database/browser-fixture-manager.cjs`](file:///d:/Projects/Recruitment%20Workflow%20System/database/browser-fixture-manager.cjs) which creates a unique, isolated open vacancy fixture (`VAC-BROWSER-...`) in `RECRUITFLOW-DEMO` with `status: 'Open'` and `openedAt: pastDate`.
  2. The browser suite dynamically discovers this vacancy code and uses it across the responsive matrix (36 route/viewport evaluations), automated Axe audits, and all 12 functional journeys.
  3. Added explicit synchronization (`with page.expect_response(...)` and `page.wait_for_selector(...)`) ensuring deterministic execution without arbitrary sleeps.
  4. Cascading database teardown in `finally` cleanly removes the vacancy, test candidate documents, applications, status history, audit logs, and rate-limit counters without altering pre-existing data.
- **Two Consecutive Independent Verification Runs**:
  - **Run 1**: Exit Code 0 (36 matrix checks + 3 Axe audits + 12 functional journeys PASSED).
  - **Run 2**: Exit Code 0 (36 matrix checks + 3 Axe audits + 12 functional journeys PASSED).

---

### Empirical Verification Matrix

| Test Suite / Quality Gate | Scope | Result | Details |
| :--- | :--- | :--- | :--- |
| `tests/browser/test_m1_g2_browser_matrix.py` (Run 1) | 6 viewports x 2 themes, Axe a11y, 12 functional journeys, CV upload | **36 / 36 Matrix PASSED**<br>**3 / 3 Axe Audits PASSED**<br>**12 / 12 Journeys PASSED** | Exit code 0, isolated fixture lifecycle verified |
| `tests/browser/test_m1_g2_browser_matrix.py` (Run 2) | Second consecutive run from isolated state | **36 / 36 Matrix PASSED**<br>**3 / 3 Axe Audits PASSED**<br>**12 / 12 Journeys PASSED** | Exit code 0, 100% deterministic reproducibility |
| `database/test-m1-g2-public-boundary.cjs` | Public boundary, CV upload, 429 rate limit, real Org B fixtures, 32 private 401s, cleanup | **121 / 121 PASSED (100%)** | 0 failed, reproducible across clean runs |
| `database/test-p2-public-acquisition.cjs` | Public acquisition, deduplication, atomic code sequencing | **19 / 19 PASSED (100%)** | 0 regressions |
| `database/test-m1-auth-contracts.cjs` | Authentication contracts, HttpOnly cookies, token rotation, profile | **72 / 72 PASSED (100%)** | 0 regressions |
| `database/test-m1-auth-recovery.cjs` | Password recovery, email verification, invitations, rate limits | **39 / 39 PASSED (100%)** | 0 regressions |
| `database/test-safe-disclosure.cjs` | Safe 404/403 disclosure and non-existence probing defense | **7 / 7 PASSED (100%)** | 0 regressions |
| `database/test-isolation.cjs` | Tenant isolation across candidates, branches, and vacancy requests | **10 / 10 PASSED (100%)** | 0 regressions |
| `database/test-rbac.cjs` | RBAC persona permissions across Admin, Recruiter, HM, Interviewer | **12 / 12 PASSED (100%)** | 0 regressions |
| `database/test-p36-auth-matrix.cjs` | Comprehensive security, permission, and cross-tenant matrix | **93 / 93 PASSED (100%)** | 0 regressions |
| `pnpm typecheck` | Monorepo TypeScript compilation across 8 packages | **0 ERRORS** | Strict type safety |
| `pnpm lint` | ESLint rules across monorepo (`--max-warnings=0`) | **0 WARNINGS / 0 ERRORS** | Clean code formatting |
| `pnpm test` (Vitest) | Unit & component tests across web application | **14 / 14 Files PASSED**<br>**27 / 27 Tests PASSED** | 100% pass rate |
| `pnpm db:validate` | Prisma schema syntactic and structural integrity | **VALID 🚀** | schema.prisma valid |
| `pnpm db:migrate:status` | PostgreSQL migration sync and alignment | **17 / 17 Migrations Synced** | Database schema up to date |

---

### Key Technical Architecture & Code Artifacts

#### 1. Public CV Upload Pipeline
- **DTO Transformation (`PublicApplicationDto`)**:
  - `@Transform` parsing for FormData boolean values (`'true'` -> `true`) and comma-separated skills strings into arrays.
  - Single authoritative source validation regex: `/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/` with HTTP 400 Bad Request on invalid inputs.
- **Controller Interception (`PublicJobsController`)**:
  - `@UseInterceptors(FileInterceptor('cv', { limits: { fileSize: 10 * 1024 * 1024 } }))`
  - Client IP resolved via Express `request.ip || request.socket.remoteAddress` under configured `TRUST_PROXY` policy.
- **Validation & Binary Scanning (`PublicJobsService`)**:
  - Validates non-empty file, size `<= 10MB`, allowlisted extension (`.pdf`, `.doc`, `.docx`), allowlisted MIME types, single extension (rejects `.pdf.exe`), and path traversal characters (`..passwd.pdf`).
  - Binary signature inspection via `DocumentScannerService.scan()` checking magic byte headers (`%PDF-`, `PK\x03\x04`, `\xD0\xCF\x11\xE0`), EICAR test strings, and embedded macros.
- **Storage & Entity Linking**:
  - Binary stored via `DocumentStorageService.put(organizationId, candidateId, safeName, buffer)`.
  - `CandidateDocument` created with `documentType: 'CV'`, `scanStatus: 'Clean'`, `consentStatus: 'Active'`.
  - `AuditLog` emitted for `CV_FILE_UPLOAD` and `PUBLIC_APPLICATION_CREATE` with null `actorUserId`.

#### 2. Rate Limiting & Proxy Configuration
- `RateLimiterService` enforces public application submission limits per email/IP identity.
- When limit is exceeded, HTTP 429 Too Many Requests is returned with a standardized, safe error message.
- Express `trust proxy` configured via `TRUST_PROXY` environment variable, preventing client header spoofing while enabling accurate IP resolution in reverse-proxy environments.

#### 3. Real Cross-Tenant Positive & Negative Controls
- Complete Organization B entity graph (Candidate, Document, Application, Vacancy, Vacancy Request, Interview, Offer, Talent Pool).
- User B in Acme Global Healthcare (`tarek.kamal@acme-health.local`) verified with positive controls (HTTP 200).
- User A in RecruitFlow Demo Organization (`ahmed.mahmoud@recruitflow.local`) strictly rejected with HTTP 404 Not Found on all read and mutation attempts.
- Cascading database cleanup ensures deterministic teardown without foreign key restriction errors.

#### 4. Automated Axe Accessibility Audits & Responsive Matrix
- 6 responsive viewports tested: `375x667`, `430x932`, `768x1024`, `1024x768`, `1280x800`, `1440x900` across both light and dark themes (36 matrix evaluations).
- Automated Axe accessibility audits (`axe-playwright-python` / `Axe().run(page)`) verified **0 critical or serious violations** on public listing, detail, and application surfaces.
- Keyboard tab order, visible focus indicators, file input keyboard access, and reduced motion verified.

---

### Next Milestone / Gate

**Approved Next Phase**:  
👉 **M1-G3 — Stable API Error Contracts**  
*(Standardizing global API exception filters, error envelopes, field-level validation responses, correlation IDs, and frontend error boundary handling across all endpoints)*
