# F0 Frontend Baseline and Inventory Report

**Date:** 2026-08-31  
**Status:** Baseline matrix captured; state-specific and accessibility journeys
remain carry-forward verification for F3/F11.

## Scope

This is an evidence-only baseline for F0 of the frontend rebuild. No
production source was changed during this audit. The approved App Design
compositions are treated as a visual/workflow north star; current API,
permissions, tenant scope, audit, consent, document security, and human
decision rules remain authoritative.

## Current inventory

- 187 frontend source files under `apps/web/src`.
- Auth/public surfaces: login, forgot/reset password, invitation, email
  verification, public jobs, public job detail, and public apply.
- Authenticated surfaces: dashboard, users, master data, audit log, vacancy
  requests, vacancies, candidates/documents, CV intake/bank, talent pools,
  imports, applications, interviews/calendar, offers/approvals, hires,
  joining, reports, pipeline settings, targets, integrations, profile,
  notifications, tasks, and component/design-system showcases.
- Shared UI primitives exist under `components/ui` and a second exported
  family exists under `design-system`. F3 must consolidate usage and avoid
  adding another system.

## Route and state baseline

| Surface | Route family | API/permission boundary | F0 status |
|---|---|---|---|
| Login/recovery | `/login`, `/forgot-password`, `/reset-password`, `/accept-invitation`, `/verify-email` | Public auth contracts | Inventory complete; full matrix pending |
| Public careers | `/careers/:organizationCode/jobs*` | Public DTO, consent, upload rules | Inventory complete; full matrix pending |
| Home | `/` | Authenticated role/scope metrics | Inventory complete; metric provenance audit pending |
| Shell | Protected routes under `AppShell` | Permission-driven navigation | Inventory complete; interaction matrix pending |
| Jobs/requisitions | `/vacancies*`, `/vacancy-requests*` | `VACANCY_*` permissions | Inventory complete; state matrix pending |
| Candidates/CV | `/candidates*`, `/cv-bank`, `/cv-intake*`, `/import*`, `/talent-pool*` | Candidate/import permissions and document gates | Inventory complete; state matrix pending |
| Pipeline | `/applications*`, `/interviews*`, `/offers*`, `/hires*`, `/joinings` | Application/vacancy/approval permissions | Inventory complete; state matrix pending |
| Governance | `/users`, `/master-data`, `/pipeline-settings`, `/audit-log`, `/settings/targets` | Admin and governance permissions | Inventory complete; state matrix pending |
| Reporting/operations | `/reports`, `/notifications`, `/tasks`, `/integrations`, `/profile` | Resource-specific permissions | Inventory complete; state matrix pending |

Required states for the next evidence pass are loading, loaded, empty,
unavailable, error, retry, forbidden, not-found, stale, partial-success, and
modal/drawer where each surface supports them.

## Measured scale findings

### Login source measurements

`apps/web/src/auth/LoginPage.tsx` currently contains:

- desktop panel `lg:min-h-[760px]`
- desktop hero heading `xl:text-[48px]` (base `42px`)
- form controls and submit button `h-[52px]`
- outer card and section `rounded-[32px]`
- desktop hero padding `p-12` and `xl:p-16`
- large vertical gaps including `mt-20`, `mt-10`, and form `gap-5`

These values explain the observed oversized desktop login composition. Mobile
at 375px had no horizontal overflow, but the card and vertical spacing remain
more generous than the intended compact operational product.

### Global source measurements

- `tokens.css` provides a 4/8px spacing scale and a 36px default control token,
  but many pages use local arbitrary values and fractional text sizes.
- Frequency scan found 191 `gap-2`, 170 `text-[11px]`, 145 `gap-3`, 87 `p-5`,
  75 `p-3`, 73 `p-4`, 38 `gap-6`, 27 `p-6`, 19 `rounded-[14px]`, and 15
  `h-[52px]` occurrences. This indicates substantial local styling drift.
- `v2-parity.css` contains broad `!important` sizing/layout overrides,
  including repeated control height and page padding rules. F1 must map and
  reduce these overrides rather than add more exceptions.
- `App.css` still contains legacy layout primitives such as global `.grid` gap
  and fixed `.main-side` columns. These need compatibility review during F1-F3.

## Runtime evidence captured

- Live development app started with `pnpm dev` and served web on
  `http://127.0.0.1:5173` and API on port 3000.
- Login loaded at 1440x900 and 375x812.
- 1440px screenshot: [login-current-1440.png](../../tests/artifacts/browser/login-current-1440.png)
- 375px screenshot: [login-current-375.png](../../tests/artifacts/browser/login-current-375.png)
- Mobile measured `document.documentElement.scrollWidth === window.innerWidth`
  at 375px.
- The complete F0 browser matrix, computed style extraction, keyboard traversal,
  and no-overflow checks were executed by
  `tests/browser/f0_frontend_baseline.py`: **108 route records** (9 routes ×
  12 width/theme cases), **0 matrix failures**, **0 post-auth console failures**,
  **0 5xx responses**, and no measured horizontal overflow.
- Persistent artifact: [f0_frontend_baseline.json](../../tests/artifacts/browser/f0_frontend_baseline.json).

## F0 exit checklist

- [x] Route and component inventory captured.
- [x] Login scale defect reproduced at desktop and mobile.
- [x] Duplicate primitive/design-system families identified.
- [x] Initial token and local-override audit captured.
- [x] Computed measurements for all prioritized screens at six widths.
- [ ] Light/dark loaded and non-loaded state matrix.
- [ ] Permission/persona matrix with real API state.
- [ ] Keyboard/focus and Axe evidence for affected routes.
- [x] No-console-error/5xx evidence across the matrix.

F0 baseline collection is complete, but F0 approval remains conditional until
state-specific, permission/persona, keyboard, and Axe evidence is attached by
F3/F11. F1 scale/token implementation must not be declared complete from this
baseline alone.
