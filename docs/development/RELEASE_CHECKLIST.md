# RecruitFlow V1 — Release Checklist

**Milestone:** P10-RELEASE-02 — Final Release Hardening & Commercial Readiness  
**Date:** 2026-09-06  
**Status:** COMPLETED  

---

## Gate Evidence

### ✅ Automated Tests
| Check | Result | Command |
|---|---|---|
| Web test suite | **35 files, 121 tests, 100% passing** | `pnpm --dir apps/web test --run` |
| TypeScript (web) | **0 errors** | `pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit` |
| TypeScript (api) | **0 errors** | `pnpm --dir apps/api exec tsc --noEmit` |
| API tests | **11/11 passing** | `pnpm --dir apps/api test` |
| Production build (web) | **passes** | `pnpm --dir apps/web build` |

### ✅ Security Headers
| Header | Value | Location |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | `apps/api/src/main.ts` |
| `X-Frame-Options` | `SAMEORIGIN` | `apps/api/src/main.ts` |
| `X-XSS-Protection` | `1; mode=block` | `apps/api/src/main.ts` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `apps/api/src/main.ts` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | `apps/api/src/main.ts` |
| `Content-Security-Policy` | `default-src 'self' ...` | `apps/api/src/main.ts` |
| `Strict-Transport-Security` | Production only, `max-age=31536000; includeSubDomains` | `apps/api/src/main.ts` |
| CORS origin | Restricted to `WEB_ORIGIN` env var | `apps/api/src/main.ts` |
| Error response body | Safe normalized envelopes — no stack traces | `apps/api/src/common/filters/http-exception.filter.ts` |

### ✅ Accessibility
| Item | Status | Evidence |
|---|---|---|
| Skip-to-main-content link | ✅ Added | `apps/web/src/layout/AppShell.tsx` — first focusable element |
| `<nav aria-label="Primary navigation">` | ✅ Added | AppShell.tsx, wraps all nav items |
| `id="main-content"` on `<main>` | ✅ Added | AppShell.tsx, skip link target |
| `aria-modal="true"` on dialog | ✅ Existing | `apps/web/src/components/Modal.tsx` |
| `role="dialog"` on modal | ✅ Existing | `apps/web/src/components/Modal.tsx` |
| `aria-labelledby` on modal | ✅ Existing | `apps/web/src/components/Modal.tsx` |
| Focus trap & Escape key on modal | ✅ Verified | `apps/web/src/components/Modal.tsx` & `AccessibilityRegression.test.tsx` |
| NavLink `aria-current="page"` | ✅ React Router v6 automatic | NavLink sets `aria-current="page"` when active by default |

### ✅ Light & Dark Modes
| Check | Status |
|---|---|
| Light mode (first-visit default) | ✅ Implemented |
| Dark mode (user toggle) | ✅ Implemented via `ThemeToggle` |
| WCAG AAA contrast on dark banners | ✅ Fixed (NextActionGuidanceBanner `!text-white`) |
| `@media (prefers-reduced-motion)` | ✅ Defined in `tokens.css` |

### ✅ Critical Mutation & Accessibility Tests Added (P10-R02.1 / P10-R02.2)
| Test File | Tests | Covers |
|---|---|---|
| `ApplicationDetailPage.test.tsx` | 5 | Stage transition, 409 conflict, 403 forbidden, note saving |
| `OfferDetailPage.test.tsx` | 6 | Offer load, approval modal, reject modal, API call, not-found |
| `HiringCasePage.test.tsx` | 6 | Clinical items, compliance progress, joining dialog, 403 forbidden |
| `AccessibilityRegression.test.tsx` | 8 | DataTable column headers, Modal dialog/Escape trap, FormField aria-invalid/alert, IconButton aria-label |

### ✅ Release Documentation
| Document | Location | Status |
|---|---|---|
| Release Notes | `RELEASE_NOTES.md` (workspace root) | ✅ Created |
| This Checklist | `docs/development/RELEASE_CHECKLIST.md` | ✅ Created |
| Deferred capabilities | `RELEASE_NOTES.md` — Deferred section | ✅ AI/storage/payroll/SSO explicitly marked |
| Known limitations | `RELEASE_NOTES.md` — Known Limitations section | ✅ 6 limitations documented |

---

## Pending / Out of Scope for This Session

| Item | Reason |
|---|---|
| E2E Playwright tests | Requires live running backend and seeded database; out of scope for this milestone slice |
| Penetration testing | Requires dedicated security engagement |
| SOC2 / ISO 27001 | No certification scope defined for V1 |
| Production deployment | Environment provisioning is an infrastructure concern |

---

## Milestone Summary

P10-RELEASE-02 closes the final release hardening gate:

1. **✅ Mutation test coverage** — 25 new tests across 4 critical suites (ApplicationDetail, OfferDetail, HiringCase, AccessibilityRegression)
2. **✅ Accessibility hardening** — Skip link, `<nav>` semantic element, `id="main-content"`, Modal focus-trap, FormField aria-invalid / alert
3. **✅ Performance** — All heavy pages already lazy-loaded; pagination exists on all lists
4. **✅ Security** — Security headers and safe error envelopes implemented in NestJS pipeline
5. **✅ Release notes** — Honest capability disclosure with deferred items explicitly listed

**Test gate:** 35 files / 121 tests / 100% passing  
**Build gate:** Passes in production mode  
**TypeScript gate:** 0 errors across all packages (apps/web + apps/api)  
