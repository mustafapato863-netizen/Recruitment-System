# 04 — Backend API Modules & Shared Contracts

The backend API (`apps/api`) is a modular NestJS application mounted under the global `/api/v1` prefix (`apps/api/src/main.ts`), comprising **37 feature modules**, **46 controller source files** (**49 `@Controller` declarations**), shared `@recruitflow/contracts` HTTP envelopes & error codes, and `@recruitflow/validation` Zod DTO schemas.

---

## 1. HTTP Bootstrap, Middleware & Security Controls (`apps/api/src/main.ts`)

1. **Startup Fail-Fast (`isProduction`):** Exits if `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `EMAIL_OUTBOX_ENCRYPTION_KEY`, or `SELF_SCHEDULE_SECRET` are unset in `NODE_ENV=production`.
2. **Response Compression (`response-compression.middleware.ts`):** Zero-dependency Node `zlib` compression (`br` quality `4` preferred, `gzip` level `6` fallback) for JSON/text payloads `>= 1024 B`; preserves `HEAD`, skips `< 1 KB` payloads and pre-compressed binary formats (PDF, `.xlsx`, images), sets `Vary: Accept-Encoding` and weak `ETag`.
3. **Security Headers & Cookies:**
   - `expressApp.disable('x-powered-by')` (no framework fingerprint)
   - `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-site`
   - Strict production CSP: `"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"` + `Strict-Transport-Security`
   - `/api/v1/auth/*` sets `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
4. **Validation & Error Normalization:** Global `ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })` (`validationExceptionFactory`) + global `HttpExceptionFilter` normalizes errors to:
   `{ statusCode, code, message, retryable, retryAfterSeconds, requestId, fields?, gate?, missing? }` (never leaks Prisma SQL or stack traces).
5. **CORS:** Exact allowlist from `WEB_ORIGIN` (comma-separated); localhost/127.0.0.1 regex permitted only when `NODE_ENV !== 'production'`.

---

## 2. Complete Controller & Module Directory (`50` Controllers across `38` Modules)

Every module directory in `apps/api/src/`: `access-control`, `admin-override`, `applications`, `assistant`, `audit`, `auth`, `candidates`, `common`, `database`, `documents`, `email`, `email-templates`, `hiring`, `import`, `integrations`, `interviews`, `manager-decision`, `master-data`, `matching`, `my-work`, `notifications`, `offers`, `pipeline-settings`, `position-level-targets`, `public-jobs`, `recruiter-targets`, `reports`, `results`, `resume`, `roles`, `rules-pack`, `screening`, `search`, `talent-pool`, `tasks`, `users`, `vacancy-core`, `whatsapp-templates`.

### Auth, Identity & Public Health
- `HealthController` (`health.controller.ts`): `GET /api/v1/health` (`@Public`), `GET /api/v1/readiness` (`@Public`, verifies DB + worker heartbeat in prod)
- `AuthController` (`auth/auth.controller.ts`): `POST /auth/login` (`@Public`), `POST /auth/logout`, `POST /auth/refresh` (`@Public`), `GET /auth/me`, `POST /auth/password-reset/request|complete` (`@Public`), `POST /auth/email-verification/request|complete` (`@Public`), `POST /auth/invitations/accept` (`@Public`)
- `MeController` (`auth/me.controller.ts`): `GET|PATCH /me/profile`, `GET|PATCH /me/preferences`, `POST /me/password`
- `UsersController` (`users/users.controller.ts`): `GET /users/interviewers`, `GET /users`, `GET /users/assignable`, `GET /users/:id`, `POST /users`, `POST /users/invitations`, `PATCH /users/:id`, `POST|DELETE /users/:id/roles/:roleId`, `DELETE /users/:id`
- `RolesController` (`roles/roles.controller.ts`): CRUD on `/roles`, `/roles/permissions`, and `/roles/:id/permissions/:permissionId`

### Requisitions, Vacancies & Daily Work
- `VacancyRequestsController` (`vacancy-core/vacancy-requests.controller.ts`): `GET /vacancy-requests/context`, `GET /vacancy-requests`, `GET /vacancy-requests/inbox`, CRUD, `submit`, `approve`, `request-changes`, `reject`, `cancel-impact`, `cancel`, `PATCH .../target`, `activate`, `convert`, `jd`, `criteria`, `jd-text`
- `VacanciesController` (`vacancy-core/vacancies.controller.ts`): `GET /vacancies`, `GET /vacancies/work-queue`, `GET /vacancies/export.xlsx`, CRUD, `status`, `hold`, `reopen`, `close`, `status-history`, `assignments`, `jd`, `criteria`, `jd-text`
- `MyWorkController` (`my-work/my-work.controller.ts`): `GET /me/work`, `GET /team/work`
- `TasksController` (`tasks/tasks.controller.ts`): `GET /tasks`, `GET /tasks/:id`, `POST /tasks`, `PATCH /tasks/:id/status`, `PATCH /tasks/:id/reschedule`
- `NotificationsController` (`notifications/notifications.controller.ts`): `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`
- `SearchController` (`search/search.controller.ts`): `GET /search`
- `AssistantController` (`assistant/assistant.controller.ts`): `GET /assistant/suggestions`, `POST /assistant/ask` (grounded in `docs/system-guide/` with PII-free Gemini / OpenAI-compatible synthesis + deterministic fallback, seat/RBAC filtering, and per-user rate limit)

### Candidates, Documents, Resume Parsing & ATS Matching
- `CandidatesController` (`candidates/candidates.controller.ts`): CRUD on `/candidates`, `export.xlsx`, `metrics`, `duplicates`, `activities` (`GET|POST|complete|reschedule`), `fill-from-cv`, `anonymize`
- `DocumentsController` (`documents/documents.controller.ts`): `GET /documents/candidate/:candidateId`, `GET /documents/cv-bank`, `manifest.xlsx`, `backup-manifest.xlsx`, `backup-status`, `GET /documents/:id`, `POST /documents`, `POST /documents/upload`, `PATCH /documents/:id/retention`, `archive`, `restore`, `download`
- `ResumeController` (`resume/resume.controller.ts`): `POST /resume/parse`
- `MatchingController` (`matching/matching.controller.ts`): `GET /vacancies/:id/suggestions`, `GET /applications/:id/ats-match`, `GET /candidates/:id/job-recommendations`, `GET /vacancies/:id/compare`, `POST /candidates/duplicate-check`, `GET /candidates/:id/skills`, `POST /candidates/:id/skills/evidence`, `POST /candidates/:id/skills/derive-evidence`
- `TalentPoolController` (`talent-pool/talent-pool.controller.ts`): `/talent-pools` (`recently-added`, `health`, `:id`, `candidates`)
- `ImportController` (`import/import.controller.ts`) + `CandidateBulkImportController`, `VacancyRequestBulkImportController`, and `MasterDataBulkImportController` (`import/bulk-import.controller.ts` for `imports/candidates`, `imports/vacancy-requests`, `imports/master-data`): `template`, `inspect`, `upload`, `jobs`, `rows`, `decision`, `confirm`, `error-report`

### Pipeline Execution: Applications, Screening, Interviews, Offers, Decisions & Hiring
- `ApplicationsController` (`applications/applications.controller.ts`): `GET /applications`, `GET /applications/:id/workspace`, `GET /applications/:id`, `history`, `notes`, `POST /applications`, `PATCH /applications/:id/stage`, `PATCH /applications/:id`
- `ApplicationFileController` (`applications/application-file.controller.ts`): `follow-up`, `joining-checks`, `documents`, `document-history`, `document-requests`, `document-portal-link`, `messages` & `retry`
- `ScreeningController` (`screening/screening.controller.ts`): `GET /screening/application/:applicationId`, `draft` (`GET|PUT|DELETE`), `POST /screening`
- `InterviewsController` (`interviews/interviews.controller.ts`), `MeInterviewsController` (`GET /me/interviews`), `PublicInterviewsController` (`GET|POST /public/interviews/schedule/:token`): CRUD, `availability`, `self-schedule-link`, `ics`, `response`, `scorecard`, `revisions`, `cv`, `scorecard-reminder`
- `OffersController` (`offers/offers.controller.ts`): `GET /offers`, `GET /offers/approvals/inbox`, `GET /offers/:id`, `POST /offers`, `revisions`, `status`, `submit`, `send`, `approvals/:approvalId/decide`
- `ManagerDecisionController` (`manager-decision/manager-decision.controller.ts`): `grade-bands` CRUD (`GET|POST|PATCH|DELETE /master-data/grade-bands`), `POST /offers/:id/versions/:versionId/decision`, `POST /admin/overrides/file-reassign`, `POST /files/reassign`
- `HiringController` (`hiring/hiring.controller.ts`): `POST /hiring`, `metrics`, `final-approvals`, `GET /hiring`, `GET /hiring/:id`, `compliance/:reqId`, `submit`, `final-approval`, `joining`

### Public Careers & Candidate Portal
- `PublicJobsController` (`public-jobs/public-jobs.controller.ts`): `GET /public/organizations/:organizationCode/jobs`, `GET .../:vacancyCode`, `POST .../:vacancyCode/apply`
- `CandidatePortalController` (`public-jobs/candidate-portal.controller.ts`): `POST /public/portal/contact`, `GET /public/portal/:token`, `documents/:documentId`, `revoke`, `POST .../documents`

### Reporting, Targets, Admin, Config & Governance
- `ReportsController` (`reports/reports.controller.ts`): `overview`, `export.xlsx`, `kpis`, `funnel`, `hiring-by-department`, `recruiter-workload`
- `ResultsController` (`results/results.controller.ts`): `/results/me|team|org|targets|target-plans|targets/:id|targets/:id/records`
- `RecruiterTargetsController` (`recruiter-targets/recruiter-targets.controller.ts`): `/recruiter-targets` (`my`, `:id`)
- `PositionLevelTargetsController` (`position-level-targets/position-level-targets.controller.ts`): `GET|PUT /position-level-targets`
- `AccessControlController` + `AccessExportController` (`access-control/`): navigation visibility, RLS policies, audit simulation, user responsibilities, `/admin/access-export(.csv)`
- `AdminOverrideController` (`admin-override/admin-override.controller.ts`): `POST /admin/overrides`
- `AuditController` & `AuditSearchController` (`audit/audit.controller.ts`): `GET /audit-logs` & `GET /audit`
- `BranchesController`, `PositionsController`, `OrganizationsController`, `MasterDataCatalogController` (`master-data/`): org units & catalogs
- `PipelineSettingsController` & `WorkflowRulesController` (`pipeline-settings/`): `/pipeline-templates` (+ stage reorder/duplicate) & `/workflow-rules` (`preview`, `apply`)
- `EmailTemplatesController`, `WhatsAppTemplatesController`, `IntegrationsController` (`email-templates/`, `whatsapp-templates/`, `integrations/`): communication templates & integrations (`/integrations/:id/test`)

*(Supporting internal service modules without controllers: `common/`, `database/`, `email/`, `rules-pack/` DB verification spec.)*

---

## 3. CV Storage Security & Stable Domain Error Codes

- **Document Security (`DocumentsController` + `documents.service.ts`):** Rejects EICAR/unsafe uploads (recorded for audit review while never storing downloadable binaries), computes SHA-256 checksums, strips private `storageKey`s from client payloads, enforces consent/retention expiration, supports audited soft `archive`/`restore`, and returns `404` across tenant boundaries.
- **Stable Domain Error Codes (`packages/contracts/src/index.ts`):** Services throw structured codes (`GATE_*`, `OFFER_PAY_OUTSIDE_BAND`, `OFFER_PAY_VIEW_REQUIRED`, `ADMIN_CANNOT_REASSIGN`, `REASSIGN_ADMIN_FORBIDDEN`, `FILE_NOT_OWNED`, `JOB_NOT_OWNED`, `ROOM_URL_HOST_NOT_ALLOWED`, `APPLICATION_EXISTS`, `COMPARE_COUNT`, `SINGLE_PIPELINE_TEMPLATE`, etc.) preserved verbatim by `error-normalizer.ts`.
