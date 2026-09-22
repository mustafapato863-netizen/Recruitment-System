# RecruitFlow — IT Handover Documentation & Presentation Guide

**Document type:** Technical handover pack (speaker guide + product documentation)  
**Audience:** IT Department  
**Presenter:** Mustafa Zainhom — HRIS Performance Specialist, Saudi German Health  
**Product:** RecruitFlow (internal recruitment and hiring operations platform)  
**Language:** English  
**Companion deck:** `docs/handover/RecruitFlow_IT_Handover_Presentation.pptx`  
**Date:** 22 September 2026  

---

## 1. Purpose of this document

This pack supports a formal handover of **RecruitFlow** to the IT Department. It includes:

1. **How to present** the system to IT (delivery method, timing, tone).
2. **Slide-by-slide speaker notes** aligned with the PowerPoint deck.
3. **Full feature documentation** for support and ownership.
4. **Architecture, security, deployment, and operations** notes.
5. **Handover checklist** and recommended next steps.

IT should leave the session knowing: what RecruitFlow is, what it is not, how it is built, how it is secured, how it is deployed, and what ownership items transfer to IT.

---

## 2. How to present (recommended delivery method)

### 2.1 Session format

| Item | Recommendation |
|------|----------------|
| Duration | 45-60 minutes (+ 15 minutes Q&A) |
| Format | Live walkthrough + PowerPoint (do not read slides word-for-word) |
| Audience | IT leadership, application support, infrastructure/DevOps, security (if available) |
| Materials | This document + PPTX deck + optional live demo (staging preferred) |
| Outcome | Shared understanding + agreed ownership checklist |

### 2.2 Presentation tone

- Professional, factual, and precise — this is an **IT ownership transfer**, not a marketing pitch.
- Emphasize **boundaries**: what is production-ready versus deferred.
- Never oversell AI: fit scoring is **assistive**; decisions remain human.
- Keep language **English** (organizational preference).
- Invite questions per section; capture action owners in writing.

### 2.3 Suggested session flow (60 minutes)

| Time | Block | Goal |
|------|-------|------|
| 0-5 min | Opening and agenda | Set expectations and outcomes |
| 5-12 min | What RecruitFlow is / is not | Align business versus IT scope |
| 12-22 min | Architecture and stack | How the system is composed |
| 22-32 min | Security and access | What IT must protect |
| 32-42 min | Feature tour (lifecycle) | Map modules to hiring process |
| 42-48 min | Recent delivery and known risks | Avoid support surprises |
| 48-55 min | Deploy, ops, checklist | Transfer practical ownership |
| 55-60+ min | Q&A and next steps | Assign 30/60/90 actions |

### 2.4 Demo tips (optional but powerful)

If you show the live system:

1. Use a **non-production** environment when possible.
2. Prepare one clean path: **Vacancy request -> Approval -> Vacancy -> Candidate/CV -> Application -> Interview -> Offer**.
3. Show **Permission denied** behavior once (proves server-side RBAC).
4. On Compare / Smart Sourcing, select a vacancy first so **Fit %** is meaningful.
5. Do not digress into unfinished roadmap items unless asked.

### 2.5 Opening script (you can read this)

> Good morning. I am Mustafa Zainhom, HRIS Performance Specialist. Today I am handing over RecruitFlow to IT — our internal recruitment operations platform for Saudi German Health. The goal is not a feature sales pitch. The goal is for IT to understand architecture, security, operations, and ownership boundaries so you can support, host, and govern the system confidently.

---

## 3. Slide-by-slide speaker notes

Use with: `RecruitFlow_IT_Handover_Presentation.pptx`

### Slide 1 — Title

**Say:** Introduce yourself, role, and session purpose. Mention the deck includes architecture, security, modules, deployment, and a handover checklist.  
**Do:** Keep to 30-45 seconds.

### Slide 2 — Agenda

**Say:** We will move from product definition to technical design, security, functional modules, recent changes, operations, then checklist.  
**Ask:** Any topic IT wants prioritized before we start?

### Slide 3 — What is RecruitFlow?

**Key messages:**
- Internal recruitment and hiring operations platform.
- Covers demand -> sourcing -> selection -> assessment -> offer -> hire.
- Modular monolith: one monorepo, separately deployable web, API, and worker.
- PostgreSQL is the system of record.
- Not a full HCM/ERP/payroll replacement.

**IT ownership framing:** hosting, database, secrets, access, backups, monitoring, CI/CD, support.

### Slide 4 — High-level architecture

**Key messages:**
- `apps/web` — React UI
- `apps/api` — NestJS business rules and RBAC
- `apps/worker` — async jobs (queues), not source of truth
- Shared packages: contracts, validation, config, design-system
- Data plane: PostgreSQL + Redis/BullMQ + document storage volume/S3-compatible path

**Emphasize:** UI never owns authorization. API enforces permissions and workflow rules.

### Slide 5 — Technology stack

**Frontend:** React 19, TypeScript, Vite, React Router, Tailwind + design tokens, Vitest.  
**Backend:** NestJS 11, Prisma, PostgreSQL, JWT (Passport), Zod, BullMQ worker.  
**Integrations:** Affinda for resume parsing (where configured).  
**Ops:** pnpm workspaces, Docker multi-stage (api / web / worker), compose production stack.

### Slide 6 — Repository layout

Walk the monorepo folders briefly. Mention remotes and that docs live under `docs/`.

### Slide 7 — Security and access control

**Must-say points:**
- JWT access + refresh cookies (httpOnly, SameSite).
- Server-side RBAC on sensitive routes.
- Frontend gates improve UX; API remains authoritative.
- Security headers, CORS locked to configured web origin.
- Safe API error envelopes (no stack traces to clients).
- Audit logging for sensitive actions.

### Slide 8 — Hiring lifecycle modules

1. **Demand** — vacancy requests, approvals, org/headcount context
2. **Attract** — vacancies/JD, public careers pages, CV intake
3. **Select** — candidates, smart sourcing and fit, compare, applications
4. **Assess** — interviews, scorecards, tasks/SLA
5. **Hire** — offers, final approval, hiring cases / joining readiness

### Slide 9 — Key operational surfaces

Dashboards; vacancy requests; vacancies; candidates; CV bank; sourcing match; applications; interviews; offers; hires; reports; admin (users/roles/master data/import).

### Slide 10 — Recent delivery (Sep 2026)

**UX density (Phases F-I):** denser shell, unified titles, compact KPIs, responsive Wave-1 actions, confirm+toast trust on Offer/Final inboxes, design-token burn-down, English-only i18n scaffold.

**Fit and skills fix:** Compare skills use matched-first tags + exact +N; Compare no longer shows fake 0% + Good Match; real fit when vacancy selected; otherwise Select a position.

### Slide 11 — Environments and deployment

Docker targets for api/web/worker; production compose; web proxies API; env via secrets/env file; documents volume; never commit `.env`.

### Slide 12 — Essential commands

Point IT to day-1 commands (install, migrate, seed, dev processes, typecheck/lint/test, token gate, migrate status/deploy). Prefer repository scripts.

### Slide 13 — Known deferrals and risks

- No SSO/SAML yet
- No autonomous AI hiring decisions
- Limited messaging/email dispatch maturity
- Not a payroll/HCM replacement
- Design-token debt gated (must not grow)
- Compare fit requires selected vacancy

### Slide 14 — Handover checklist

Walk both columns; ask IT to assign owners during or after the meeting.

### Slide 15 — 30 / 60 / 90 days

Confirm which items IT accepts for the first month (deploy shadow, secrets, backup drill, smoke tests).

### Slide 16 — Close / Q&A

**Closing script:**
> RecruitFlow is ready for operational ownership transfer. I will leave the deck, this documentation pack, and the checklist. Happy to schedule a technical deep-dive with infrastructure or security next.

---

## 4. Product overview (full documentation)

### 4.1 Business purpose

RecruitFlow digitizes and governs recruitment operations for Saudi German Health: workforce demand, vacancy management, candidate intake, screening/matching assistance, interviewing, offers, approvals, and pre-hire readiness.

### 4.2 Primary users

| Role (examples) | Typical needs |
|-----------------|---------------|
| Recruiter | Source candidates, manage pipeline, schedule interviews |
| Hiring Manager | Request headcount, review candidates, interview feedback |
| Approver | Vacancy / offer / final hiring approvals |
| HR Admin | Users, roles, master data, configuration |
| Interviewer | Scorecards and interview execution |
| Administrator | System configuration and governance |
| Candidate (limited) | Public apply / self-schedule links |

### 4.3 What RecruitFlow is not

- Not a full HRIS/HCM core
- Not payroll
- Not an autonomous AI decision engine
- Not a replacement for clinical credentialing systems of record (it tracks readiness gates)

---

## 5. Feature catalog (detailed)

### 5.1 Authentication and session
- Login with JWT access + refresh token pair (httpOnly cookies, SameSite)
- Session expiry handling; password visibility toggle; invitation accept / email verify / password reset flows
- Fail-fast environment validation on API startup

### 5.2 Authorization (RBAC)
- Server-enforced permissions on API routes
- Frontend PermissionGate / route guards for UX and navigation hygiene
- Roles include Recruiter, Hiring Manager, Approver, HR Admin, Interviewer, Administrator
- Support principle: never trust UI-only checks

### 5.3 Organization and master data
- Organizational structures needed for recruitment
- Master data administration for governed reference values
- Bulk import capabilities for supported datasets

### 5.4 Vacancy requests (workforce demand)
- Multi-step vacancy request creation
- Sequential approval chain
- Budget / headcount-oriented tracking
- Conversion into managed vacancies after approval

### 5.5 Approval inbox
- Unified approval inbox for permitted approval types
- Dedicated Offer Approval Inbox and Final Hiring Approval Inbox
- Confirm-dialog + feedback toasts on sensitive Offer/Final decisions

### 5.6 Vacancies / positions
- Vacancy lifecycle (Open -> On Hold -> Closed)
- Position/vacancy workspace including JD-oriented import flows where enabled
- SLA/aging indicators
- Vacancy analytics views

### 5.7 Candidates and CV bank
- Candidate identity profiles with skills and experience metadata
- Candidate detail + documents screens
- CV bank / talent repository views
- CV intake and parsing (Affinda where configured)
- Candidate compare view with skills overflow (+N) and vacancy-based fit scoring

### 5.8 Smart sourcing and match
- Position-driven bench matching
- Empirical fit scorecard breakdown (skills / experience / licenses / location)
- Match tiers (high / moderate / gap)
- Skill chips prioritize matched skills and show exact remaining count

### 5.9 Applications / pipeline
- Application list and kanban-style pipeline
- Stage transitions with concurrency/conflict handling
- Fit scorecards against target vacancy requirements
- Bulk actions where permitted

### 5.10 Interviews
- Interview list and calendar
- Interview detail workspace
- Candidate self-scheduling via signed links
- Scorecards with competency ratings and evidence comments
- .ics export where enabled

### 5.11 Offers
- Offer creation and versioned offer chain
- SAR-oriented compensation components
- Offer preview/print
- Offer approval workflow with confirmation on decision actions

### 5.12 Hiring cases and joining readiness
- Pre-hire checklist / hiring case management
- Clinical/compliance gate concepts (SCFHS, DataFlow, Mumaris+, BLS/ACLS/CPR style items as configured)
- Joining confirmation controls tied to required verifications
- Final hiring approval inbox

### 5.13 Public careers
- Public job listing and job detail pages
- Public apply flow under organization careers routes

### 5.14 Reporting and audit
- Operational reports (funnel, aging, workload, source, approvals-oriented insights)
- Immutable audit log concepts for actor/action/entity traceability

### 5.15 Administration
- Users and roles management
- Workflow/settings and email templates
- Integration health visibility where configured

### 5.16 UX platform capabilities
- Light/Dark themes (Light first-visit default)
- Responsive layouts
- Design-token system with CI gate to prevent legacy palette growth
- English-only i18n scaffolding (Arabic locale intentionally not used)

---

## 6. Architecture documentation (IT view)

### 6.1 Application topology

| App | Responsibility |
|-----|----------------|
| apps/web | Browser SPA; presentation, client routing, UX state |
| apps/api | Business rules, authz, persistence orchestration, audit |
| apps/worker | Background jobs, retries, async side-effects |
| packages/* | Shared contracts, validation, config, design tokens |
| database/ | Prisma schema, migrations, seeds |

### 6.2 Dependency direction
- Web depends on shared contracts/validation/design tokens
- API owns authorization, workflows, transactions
- Worker must not become system of record for business state
- Controllers do not own raw DB logic; services/repositories do

### 6.3 Systems of record
- PostgreSQL: authoritative transactional data
- Redis/BullMQ: queues/retries/delayed work
- Document storage: private files via configured volume / S3-compatible strategy

---

## 7. Security documentation (IT view)

### 7.1 Identity
- JWT cookie session model with refresh pattern
- Password and invitation-based onboarding flows
- SSO/SAML not in current release

### 7.2 Access control
- Permission strings enforced in API
- Route-level frontend gates for navigation
- Principle: least privilege by role

### 7.3 Application hardening
- Security headers (including CSP posture; HSTS in production)
- CORS restricted to configured web origin
- Normalized error responses; stack traces server-side only
- Audit trail for sensitive operations

### 7.4 Secrets handling
- Environment variables via deployment secret store / env file
- Never commit .env
- Rotate JWT secrets, DB credentials, Affinda keys under IT custody after handover

---

## 8. Deployment and operations

### 8.1 Packaging
- Docker multi-stage builds for api, web, worker
- compose.production.yml wires services and documents volume
- Web container exposes HTTP and proxies API upstream

### 8.2 Day-1 local commands (engineering reference)

```bash
pnpm install
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev:api
pnpm dev:web
pnpm dev:worker
pnpm typecheck
pnpm lint
pnpm test
pnpm check:design-tokens
```

Exact script names are defined in the monorepo root package.json and may evolve; always prefer the repository scripts.

### 8.3 Operational concerns for IT
- Database backup/restore drill
- Migration apply process in release pipeline
- Worker health and queue backlog monitoring
- Disk/object storage growth for CVs/documents
- Certificate/TLS termination at reverse proxy / platform edge
- Log aggregation and alerting on API 5xx and worker failures

---

## 9. Recent changes IT should know (Sep 2026)

| Area | Change | Support implication |
|------|--------|---------------------|
| Shell density | Smaller brand/header/user chip | Visual only; no auth change |
| Page titles / KPIs | Unified denser typography | Visual only |
| Approvals trust | Confirm + toasts on Offer/Final inboxes | Users must confirm before approve/reject |
| Tokens | Legacy palette burn-down under baseline | CI fails if legacy utilities grow |
| i18n | English-only scaffold | Do not expect Arabic UI |
| Compare skills | Matched-first + +N overflow | Long skill lists no longer dump fully |
| Compare fit | Real score when vacancy selected | If no vacancy: Select a position, not fake 0% |

---

## 10. Known deferrals (do not promise)

- SSO / SAML / OAuth enterprise login
- Autonomous AI screening decisions
- Full production multi-channel messaging (WhatsApp/SMS) as a core promise
- Payroll integration
- Full HCM replacement
- Compliance certification claims beyond architecture intent

---

## 11. Handover checklist (copy for meeting minutes)

### Access and governance
- [ ] Repository access granted to IT owners
- [ ] Branch protection / release permissions reviewed
- [ ] Secret ownership transferred (DB, JWT, Affinda, storage)
- [ ] Admin break-glass account process defined

### Runtime and data
- [ ] Staging deploy validated by IT
- [ ] Production topology documented (web/api/worker/db/redis/storage)
- [ ] Backup + restore drill scheduled/executed
- [ ] Migration process documented in release runbook

### Security and support
- [ ] CORS/web origin reviewed
- [ ] TLS and security headers verified in target env
- [ ] L1/L2 triage matrix agreed (app vs infra)
- [ ] Monitoring/alerting owners named

### Knowledge transfer
- [ ] Deck + this document received
- [ ] Critical path smoke test completed
- [ ] 30/60/90 actions assigned with dates

---

## 12. Recommended 30 / 60 / 90 day plan

### 0-30 days
- IT shadow deploy and backup restore
- Secrets custody transfer
- Support escalation path
- Smoke test of critical hiring path

### 30-60 days
- Monitoring dashboards live
- SSO discovery workshop (if required)
- Performance and backup SLO draft
- L1/L2 training session

### 60-90 days
- Hardening backlog prioritization
- DR exercise
- Capacity review (DB / Redis / storage)
- Release governance finalized

---

## 13. FAQ IT may ask

**Q: Is RecruitFlow multi-tenant SaaS?**  
A: It is an internal enterprise platform under SGH IT governance.

**Q: Can we enable Arabic UI tomorrow?**  
A: Not as a completed product language pack. English-only scaffolding is intentional.

**Q: Why did Compare show 0% before?**  
A: Some compare entry paths hardcoded 0 without vacancy context and mislabeled it as a good match. Fixed: compute real fit when vacancy is selected; otherwise ask user to select a position.

**Q: Who owns Affinda costs/keys?**  
A: Transfer API key ownership and vendor contact to IT/procurement after handover.

**Q: Where is the source of truth for permissions?**  
A: API authorization. UI gates are convenience only.

---

## 14. Artifacts index

| Artifact | Location |
|----------|----------|
| PowerPoint deck | docs/handover/RecruitFlow_IT_Handover_Presentation.pptx |
| This documentation and speaker guide | docs/handover/RecruitFlow_IT_Handover_Documentation_and_Speaker_Guide.md |
| Architecture docs | docs/architecture/ |
| Operations / deploy notes | docs/operations/, deploy/ |
| Release notes | RELEASE_NOTES.md |
| Source repository | RecruitFlow monorepo (apps/web, apps/api, apps/worker, database) |

---

## 15. Document control

| Field | Value |
|-------|-------|
| Author / presenter | Mustafa Zainhom, HRIS Performance Specialist |
| Organization | Saudi German Health |
| Classification | Internal — IT handover |
| Status | Ready for presentation |
| Companion visual brand | SGH heart mark from design-system brand assets |

---

*End of RecruitFlow IT Handover Documentation and Presentation Guide*