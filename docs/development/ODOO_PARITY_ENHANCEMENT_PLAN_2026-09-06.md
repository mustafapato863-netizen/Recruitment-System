# Odoo Parity Enhancement Plan — 2026-09-06

Status: **PROPOSED — enhancement roadmap vs Odoo 19 Recruitment.**
Complements (does not replace) `PROJECT_EXECUTION_PLAN.md` (V1.3 ACTIVE) and
`COMPETITIVE_ENHANCEMENT_PLAN_2026-08-26.md`. Closes the open E9 backlog in
`task_plan.md:47-53` first, then adds the Odoo speed layer without losing the
Saudi-healthcare governance edge.

## Basis

RecruitFlow today (50 pages, 24 API modules, 42 Prisma models):

- Stronger than Odoo: SCFHS/DataFlow/Mumaris+ gates, 3-tier vacancy approvals,
  immutable offer versions, hiring-case compliance gate, optimistic-lock stage
  machine (`expectedStage+expectedVersion` → 409), tenant RLS, PII/salary masking,
  CV scan, consent/retention, audit + encrypted email outbox.
- Slower than Odoo: kanban has no status dots / folded stages / tooltips,
  no per-stage auto-email, no candidate self-scheduling, no calendar sync,
  no UTM channel ROI, no referrals, no tests/surveys, no offer e-sign,
  no Create-Employee handoff. Sidebar exposes 8 items (`AppShell.tsx`);
  vacancy-requests, inboxes, cv-intake, talent-pool, hires, licenses are
  reachable only via deep links. Storage is `local-private` only.

Strategy: **keep the governance wedge, add the Odoo speed layer.**
No big-bang rewrite. Each phase is independently shippable with
lint/typecheck/build/test/tenant-isolation evidence.

Odoo references: `Recruitment` app dashboard + Kanban (`hr.applicant`),
`Configuration → Stages` (email template, folded, hired-stage, job-specific),
`/jobs` website + email alias ingestion, Calendar sync + self-schedule link,
Survey tests, Sign offer + Create Employee, Reporting (Recruitment Analysis,
Pipeline Analysis, Source Effectiveness).

## Phase overview

| Phase | Theme | Priority | Depends on |
|---|---|---|---|
| A | Pipeline ergonomics + E9 closure (kanban parity) | P0 | — |
| B | Recruitment home + navigation (Odoo dashboard) | P0 | A |
| C | Stage automation (auto-email, auto-move, sweepers) | P1 | A |
| D | Interview scheduling + calendar sync + self-schedule | P1 | C |
| E | Sourcing channels, UTM ROI, referrals, inbound email | P1 | B |
| F | Assessment kits, tests, skills matching | P2 | A |
| G | Offer PDF + e-sign + Create-Employee onboarding | P1 | F |
| H | Storage (S3), privacy/GDPR, webhooks/API keys, extra reports | P2 | G |
| I | Parity certification + hardening + docs | P0 | A–H |

## Phase A — Pipeline ergonomics + E9 closure

Goal: kanban as fast as Odoo, governed underneath.

- [ ] A1 Pipeline position switcher (`ApplicationsPage.tsx`) — vacancy-scoped
      kanban/list toggle, query-param `?vacancyId=`, persists per user.
      Reuses E6.1 vacancy-locked mode.
- [ ] A2 Odoo smart stat buttons (`VacancyOverviewPage.tsx`) — New
      Applications / In Interview / Offer / Hired counts, each jumps to
      pre-filtered pipeline sub-view. Clean sub-flows, no dead buttons (E9.2).
- [ ] A3 Card status signal — per-card dot (gray In Progress / red Blocked /
      green Ready) + stage header color bar, folded terminal stage
      (`Joined`/`Contract Signed` collapsed by default, click to expand),
      `Hired` banner on hired cards. Manual set via card menu; stored on
      application (`statusSignal` field or note tag — product-owner pick).
- [ ] A4 Drag-drop polish + per-stage tooltips — Kanban DnD commits
      `PATCH /applications/:id/stage` with optimistic lock + 409 snapshot
      refresh (P0.1 pattern); stage settings carry recruiter tooltip text
      surfaced on column header (`PipelineSettingsPage.tsx` + `PipelineBoard`).
- [ ] A5 E9 remainder — E9.3 headcount increment + auto-close handshake
      (API + UI), E9.4 refusal/rejection taxonomy modal (required reason,
      re-entry rules kept), E9.5 1-click Claim on kanban card (assigns
      `primaryRecruiterId` with permission check), E9.6 vacancy edit
      persistence + public careers preview link.
- [ ] A6 Quick-action drawer on cards (E6.2 follow-through) — schedule,
      note, move, reject without opening detail.

Acceptance: drag card or Claim/refuse flows move stage via API, 409 handled,
history in `ApplicationStatusHistory`, audit rows written, no ungoverned jump.
Verify: `tsc`, web build, `vitest run src/pages src/components`, manual
kanban matrix 1440/768/375.

## Phase B — Recruitment home + navigation

Goal: Odoo-style command center, kill hidden-route problem.

- [ ] B1 Recruitment dashboard (new home or reworked `DashboardPage.tsx`) —
      job-position cards grid (3-col like `VacantListPage.tsx` E7.3) with live
      vacancies / applicants / activities / SLA badges, 1-click pipeline jump.
      Role-aware (manager vs recruiter vs interviewer views).
- [ ] B2 Sidebar restructure — add Requisitions, Inboxes (badge counts),
      Sourcing (CV Intake, Talent Pool), Hires & Joining; keep 8-item simple
      default with expandable groups. Inbox counts from
      `getApprovalInbox`/`getFinalInbox` endpoints.
- [ ] B3 In-page linkage audit — every hidden route reachable in ≤2 clicks
      from dashboard/sidebar/command palette; `BreadcrumbsBar` covers all.

Acceptance: fresh recruiter finds vacancy-requests, approval inboxes,
cv-intake, talent-pool, hires without URL typing. Verify: nav journey tests.

## Phase C — Stage automation

Goal: Odoo `Configuration → Stages` automation (email on enter, auto-move).

- [ ] C1 Stage → email template binding — extend `PipelineTemplate`/
      `PipelineStage` with `emailTemplateId?`, `autoMoveToStageId?`,
      `folded?`, `isHiredStage?`, `tooltip?`, `jobSpecificVacancyIds?`.
      Migration + Prisma + `pipeline-settings.service.ts` + UI in
      `PipelineSettingsPage.tsx`. Tenant-scoped.
- [ ] C2 Enter-stage runner — on `updateStage` success, inside same txn:
      enqueue template email (outbox), optionally create scheduled activity
      (task), optionally auto-move per rule. All logged to audit + chatter
      (`ApplicationNote` "moved by automation").
- [ ] C3 Email templates admin (minimal) — list/create/edit templates
      (acknowledgement, interest, schedule-interview, refuse) with
      `{{candidateName}} {{positionTitle}}` variables. Seed Odoo-equivalent
      defaults. Permission-gated.
- [ ] C4 Worker sweepers (new job types in `apps/worker/src`) — interview
      reminders (T-24h/T-2h), task due reminders, stale-applicant nudges
      (e.g. >7d in stage), consent/retention expiry, outbox janitor,
      `Dead` replay endpoint. `REDIS_URL` BullMQ or DB-poll fallback kept.
- [ ] C5 Automation audit — every auto-email/move visible in timeline with
      actor `system`.

Acceptance: moving card to Interview fires Schedule-Interview template;
stale rule creates task; Dead mail replayable. Verify: API tests for runner,
worker tests for sweepers, isolation suite green.

## Phase D — Interviews + calendar sync + self-schedule

Goal: Odoo Calendar parity.

- [ ] D1 Availability + conflict detection — interviewer free/busy from
      existing interviews, clash warning on `POST /interviews`, timezone
      shown (design-system date/time rule), reschedule/cancel flows.
- [ ] D2 Google/Outlook sync — finish `IntegrationsPage.tsx` seeds:
      OAuth connect, push interview event, inbound status. Store tokens
      encrypted (outbox-crypto pattern). Start read-only push, document limits.
- [ ] D3 Candidate self-schedule link — signed single-use link
      (`/schedule/:token`, expiry) showing recruiter slots; candidate picks;
      creates/updates interview + notifies all. Rate-limited like public jobs.
- [ ] D4 Interviewer experience — magic-link or role view listing my
      interviews + scorecard submit; locks on submit kept.

Acceptance: schedule → calendar event visible; candidate books own slot;
no double-book without warning. Verify: API + browser journey, timezone cases.

## Phase E — Sourcing, UTM ROI, referrals, inbound email

Goal: Odoo source effectiveness + email-alias ingestion.

- [ ] E1 UTM capture — `Application.source`, `sourceDetail`, `utmSource`,
      `utmMedium`, `utmCampaign`; public apply auto-captures query params;
      manual create requires source. Report grouped by source×stage.
- [ ] E2 Channel ROI report — extends `reports.service.ts` + `ReportsPage`:
      volume, conversion to Joined, time-to-hire per channel.
- [ ] E3 Email-alias ingestion (phased) — v1: per-vacancy alias displayed +
      documented forward + `POST /public/ingest` authenticated endpoint
      creating candidate+application+document (reuse `public-jobs.service.ts`
      atomic path). v2: real mailbox polling (product-owner approval).
- [ ] E4 Referral portal — employee submits referral (candidate + vacancy),
      referral record with status/points, referrer sees progress. Minimal
      points ledger; no gamification beyond Odoo-style accrual.
- [ thousands of rows ok today; add agency/vendor minimal registry if needed.]

Acceptance: external `?utm_source=linkedin` apply attributes correctly;
alias-forwarded CV creates applicant with attachments. Verify: public-jobs
tests + source report tests.

## Phase F — Assessment kits, tests, skills matching

Goal: Odoo Survey parity, position-aware.

- [ ] F1 Interview kits — per-position competencies + questions
      (extends E6.3 dynamic competencies in `InterviewDetailPage`/`Scorecard`).
      Kit template CRUD, attach to vacancy, auto-seed on interview create.
- [ ] F2 Questionnaire/test builder (minimal) — text/choice/rating questions,
      applicant answers via portal link, results on applicant card +
      comparison matrix (`CandidateComparisonPage.tsx` extension).
- [ ] F3 Skills matching search — searchable `Candidate.skills[]` +
      `Vacancy.requiredSkills[]` overlap rank across talent pool; explainable
      (matched vs missing list, no AI claims per V1 boundary).

Acceptance: kit attached → interview shows kit questions; answers comparable
side-by-side. Verify: kit/test API tests + UI tests.

## Phase G — Offer PDF + e-sign + Create-Employee onboarding

Goal: Odoo Sign + Create Employee parity.

- [ ] G1 Offer letter PDF — server render from template + version data
      (`OfferVersion` + components), stored as `CandidateDocument`,
      downloadable with permission `DOWNLOAD_DOCUMENTS`.
- [ ] G2 E-signature — provider interface (`eSignProvider`: manual-upload
      first, Sign/DocuSign later). `Sent → Accepted|Declined` tracked;
      never allow direct email send before approvals (keep current guardrail).
- [ ] G3 Create-Employee handoff — `POST /hiring/:id/create-employee`
      payload (name, email, phone, department, position, start date,
      HR responsible); applicant archived + `empId` link for audit trail.
      Out of V1 HCM scope: hand off via API/webhook, don't build payroll.
- [ ] G4 Onboarding tasks auto-gen — equipment, accounts, training activities
      seeded on `Joined`; visible in `JoiningManagementPage` + tasks queue.

Acceptance: Approved offer → PDF → sent → signed → employee created +
onboarding tasks exist. Verify: offer/hiring API tests + document tests.

## Phase H — Storage, privacy, platform, extra reports

- [ ] H1 S3-compatible storage adapter (`document-storage.service.ts`) —
      keep `local-private` for dev, S3 for prod via env; backup verification
      real (replace `manifestOnly:true`); keep traversal guards + scan gate.
- [ ] H2 GDPR/PDPL center — deletion request queue, consent-expiry sweeper
      (worker), PII export, retention proof. Builds on existing
      `consentStatus/retentionExpiresAt`.
- [ ] H3 Webhooks + API keys admin — per-org keys, event subscriptions
      (application.moved, offer.accepted, hiring.joined), signed deliveries,
      replay log. Extends `IntegrationsPage`.
- [ ] H4 Extra reports — SLA-breach audit, interviewer load, time-in-stage
      distribution, requisition aging. Additive to `reports.service.ts`.

## Phase I — Parity certification + hardening

- [ ] I1 Odoo-flow acceptance matrix (browser): New→Qualification→Interview
      ×2→Offer→Signed→Employee; website apply; alias ingest; self-schedule;
      stage auto-email; offer sign; channel report. 1440/768/375 light+dark.
- [ ] I2 Perf + tenancy — pagination audit, Postgres FTS where needed,
      `test-isolation` + `test-rbac` + `test-p36-auth-matrix` green,
      bundle budgets (`check:bundle`), OTel wiring if approved.
- [ ] I3 Docs — update `PROJECT_EXECUTION_PLAN`, per-surface Page Guides
      (`pageGuidesData.ts` entries for new flows), `docs/operations` runbooks
      for worker/sweepers/calendar-sync/S3.

## Non-goals (stay out)

Payroll/full HCM, performance management, native video interviewing (integrate
Teams/Zoom), mobile app, CRM nurture campaigns, AI screening/autonomous
decisions (V1 boundary). Revisit after parity rating ≥ 8.0.

## Execution rules

1. Governance first: no stage/offer/hire bypass; every auto-action audited.
2. Tenant isolation holds after every phase (isolation + RBAC suites green).
3. Real contracts only: live route needs user + job-to-be-done + permission +
   next action + loading/empty/error states (V1 boundary).
4. Semantic tokens only, no page hex (design-system gate + `check:design-tokens`).
5. Each item lands with lint/typecheck/build/test evidence; update checkboxes here.
