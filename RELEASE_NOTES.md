# RecruitFlow V1 — Release Notes

**Version:** 1.0.0  
**Release Date:** 2026-09-06  
**Product Mode:** Light and Dark modes (Light is first-visit default)  
**Environment:** Saudi German Health — Enterprise Recruitment Operations Platform  

---

## What is Implemented (Production-Ready)

### Authentication & Session Management
- JWT-based login with `access` + `refresh` token pair (httpOnly cookies, SameSite)
- Password-visible toggle, pending/error/success states, session expiry handling
- Rate-limit and lockout decisions documented; fail-fast env validation on startup

### Role-Based Access Control (RBAC)
- Roles: `RECRUITER`, `HIRING_MANAGER`, `APPROVER`, `HR_ADMIN`, `INTERVIEWER`, `ADMINISTRATOR`
- Row-level and route-level permission checks enforced server-side
- Frontend route guards for forbidden/not-found distinction (no sensitive data leakage)
- Cross-tenant isolation enforced by PostgreSQL RLS and API query scoping

### Recruitment Lifecycle
- **Workforce Requests**: Multi-step creation form, sequential approval chain, budget and headcount tracking
- **Job Positions**: Vacancy lifecycle (Open → On Hold → Closed), position cards with SLA/aging indicators
- **Candidates**: Reusable identity profile, skills, CV intake (CSV/template), talent pool membership
- **Applications**: Kanban pipeline board, stage transitions with optimistic locking (409 conflict detection), bulk actions
- **Interviews**: Calendar view (week/day/month), candidate self-scheduling portal via HMAC-signed links, Quick-View dossier modal, `.ics` export
- **Scorecards**: Structured competency ratings, evidence comments, draft/submitted/locked states, 1-click fast scorecard from calendar
- **Offers**: Immutable version chain, SAR compensation components, offer letter preview/print, approval workflow with comment modal
- **Hiring Cases**: Pre-hire readiness checklist, Clinical Gate for SCFHS/DataFlow/Mumaris+ items, verification note logger, compliance officer print dossier

### Compliance & Joining
- Clinical compliance gate: automatic detection of SCFHS, DataFlow, Mumaris+, BLS/ACLS/CPR items
- Joining confirmation blocked until all required compliance items are verified
- Joining outcome recorded with actual date; vacancy filled headcount atomically incremented

### Insights & Administration
- Hiring funnel, aging, time-to-stage, workload, source, and approvals reports
- Users/roles management, master data, workflow settings, email templates
- Integration health panel (provider, connection state, last sync, failure reason)
- Immutable audit log: actor, organization, action, entity, before/after summary, timestamp

### Shell & UX
- Responsive Light and Dark web experience at `375px`, `768px`, `1024px`, `1440px`
- Skip-to-main-content link (keyboard accessibility)
- Primary navigation wrapped in `<nav aria-label="Primary navigation">`
- Gamified Quick Guide system with tour overlay, mission objectives, XP progression
- Notification bell with unread count, popover, and mark-as-read

### API Security
- Global security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Content-Security-Policy` (self-origin)
- `Strict-Transport-Security` enabled in production
- CORS restricted to configured `WEB_ORIGIN` (no wildcard `*`)
- All API errors normalized to safe envelopes — stack traces logged server-side only, never in response body

### Test Coverage
- **35 test files, 121 tests, 100% passing** in Web test suite (plus 11 tests in API suite)
- Covers: stage transitions, 409 conflict auto-refresh, offer approval/rejection, clinical gate rendering, joining confirmation, scorecard modal, calendar layout, candidate self-scheduling, auth flows, UI components, accessibility focus trap and semantic attributes

---

## Explicitly Deferred (Not in V1)

The following capabilities are intentionally out of scope for this release:

| Capability | Status | Notes |
|---|---|---|
| **AI screening / AI recommendations** | ❌ DEFERRED | No autonomous decisions. All screening is human-controlled. No AI claims in the product. |
| **Production CV binary storage** | ❌ DEFERRED | No binary file upload, storage scanning, virus checking, or retention design exists. CV intake is text/CSV only. |
| **Email dispatch from the application** | ❌ DEFERRED | Email template management UI exists; actual SMTP dispatch requires a reviewed outbox design. |
| **Single Sign-On (SSO) / SAML / OAuth** | ❌ DEFERRED | Username/password auth only. |
| **WhatsApp / SMS / external messaging** | ❌ DEFERRED | Notifications are in-app only. |
| **Payroll integration** | ❌ DEFERRED | Offer compensation is recorded for pre-hire purposes only. |
| **Full HCM / ERP replacement** | ❌ DEFERRED | RecruitFlow is a recruitment operations module, not a full HR system. |
| **Dark mode as first-visit default** | ❌ DEFERRED | Light mode is the first-visit default. Both Light and Dark are supported thereafter. |
| **Additional color themes** | ❌ DEFERRED | Only the approved Light and Dark RecruitFlow themes exist. |
| **Compliance certification claims** | ❌ DEFERRED | No GDPR, PDPL, ISO, or SOC2 certification claims. Architecture decisions only. |

---

## Known Limitations

1. **Single tenant per deployment** — Multi-tenant SaaS deployment (multiple organizations on one instance) is not yet supported.
2. **Candidate self-scheduling HMAC tokens** — Tokens expire after 7 days. Re-invitation requires a new link from a recruiter.
3. **Reports are read-only** — No scheduled report delivery or export-to-PDF; export is manual browser print or CSV download.
4. **Audit log export** — Available via CSV download in the UI; API bulk export requires admin permission.
5. **Scorecard locking** — Submitted scorecards are locked. Correction requires admin intervention in the database.
6. **Joining date reversal** — Once a candidate is marked `Joined`, reversal requires admin escalation.

---

## Rollback Plan

1. Revert to the previous tagged release (`git revert` or deploy prior Docker image).
2. Run `pnpm --dir apps/api exec prisma migrate reset` only if a database migration must be reversed — requires DBA approval.
3. Configuration secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`) are in the secrets manager; rotation is independent of application rollback.
4. Frontend assets are served from CDN with versioned paths; CDN cache invalidation is automatic on deploy.

---

*Prepared by: AI-assisted engineering session — P10-RELEASE-02*  
*Milestone: P10-RELEASE-02 (Final Release Hardening & Commercial Readiness)*
