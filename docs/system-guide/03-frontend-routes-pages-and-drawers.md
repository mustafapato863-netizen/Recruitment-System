# 03 — Frontend Routes, Pages & Drawers

The web application (`apps/web`) runs React + Vite (`vite.config.ts`) with route-level lazy loading (`src/App.tsx`), V2 shell navigation (`V2Shell.tsx` + `AppShellV2.tsx`), and strict route governance verified by `route-coverage.test.ts` and `v2-qa-release-matrix.test.tsx`.

---

## 1. Complete 64-Route Registry (`SCREEN_ROUTES` in `apps/web/src/v2/screenRegistry.ts`)

| Group | Surface | Count | Registered Paths |
|---|---|---:|---|
| **Public, Auth & Candidate Entry** | `public` | 13 | `/login`, `/forgot-password`, `/reset-password`, `/change-password`, `/accept-invitation`, `/verify-email`, `/schedule/:token`, `/portal`, `/portal/applications/:token`, `/my-applications`, `/careers/:organizationCode/jobs`, `/careers/:organizationCode/jobs/:vacancyCode/apply`, `/careers/:organizationCode/jobs/:vacancyCode` |
| **Core Recruitment Workflows** | `v2` | 17 | `/my-work`, `/my-result`, `/my-interviews`, `/search`, `/profile`, `/notifications`, `/applications/:id`, `/offers/:id`, `/reports`, `/hires/approvals/inbox`, `/hires`, `/hires/:id`, `/offers`, `/joinings`, `/licenses`, `/interviews`, `/interviews/calendar` |
| **Recruiter Desk** | `v2` | 11 | `/vacancies`, `/vacancies/:id`, `/vacancies/:id/analytics`, `/candidates`, `/candidates/compare`, `/candidates/:id`, `/candidates/:id/documents`, `/cv-bank`, `/sourcing-match`, `/import`, `/import/:dataset/:jobId` |
| **Manager Desk** | `v2` | 4 | `/team-work`, `/vacancy-requests`, `/approvals`, `/team-interviews` |
| **Administration** | `v2` | 7 | `/users`, `/roles`, `/master-data`, `/audit-log`, `/pipeline-settings`, `/whatsapp-templates`, `/integrations` |
| **Legacy Aliases & Catch-all** | `redirect` | 12 | `/talent-pools`, `/talent-pools/:id`, `/email-templates`, `/joining`, `/classic/candidates`, `/classic/vacancies`, `/settings/targets`, `/access-control`, `/classic/master-data`, `/settings`, `/classic/pipeline-settings`, `/talent-pool`, `*` |

> [!NOTE]
> **Route-count convention:** the 64 total counts registered paths only. The `*` catch-all is listed in the Legacy row for completeness (the guide verifier checks its presence) but is not counted as a route.
> **`/change-password` placement:** the forced first-login password-change screen lives in the Public group alongside `/login` and `/reset-password` — it is reachable before a full session exists, which is exactly when a `mustChangePassword` user needs it (see 01 §3).

> [!NOTE]
> **`/reporting-tree` Canonical Behavior:** Per `ADM-AC01` (`AdminNavigationAndRoutes.test.tsx`), navigating to `/reporting-tree` redirects cleanly to `/users` (preserving `?focus=<userId>` as `/users?drawer=tree&focus=<userId>`). The interactive visual org chart (`ReportingTreeV2`) renders directly inside `/users?view=tree`.

---

## 2. Key V2 Pages & `v0.2.0` UI/UX Capabilities

- **Daily Desks (`/my-work`, `/team-work`, `/my-result`, `/my-interviews`):** Urgency-ordered work queues, standalone & candidate-linked tasks (`MyWorkActivity`, `MyWorkTargets`), interviewer scorecard panels, and direct-report team KPI dashboards (`TeamWorkV2`, `TeamActivityPanel`, `TeamResultV2`). Also supports `J`/`K` keyboard list triage (`useKeyboardListTriage.ts`).
- **Open Jobs & Pipeline (`/vacancies`, `/vacancies/:id`, `/vacancies/:id/analytics`):** Filterable job directory (`OpenJobsV2` with memoized state), stage-based Kanban/list board (`JobPipelineV2`), manager jobs desk (`ManagerJobsDesk`), and funnel/source analytics (`JobAnalyticsV2`).
- **Candidates (`/candidates`, `/candidates/compare`, `/candidates/:id`, `/candidates/:id/documents`, `/cv-bank`):**
  - **Pagination & Slice Cache (`CandidatesV2.tsx`):** Both Active Applications and Bank tabs paginate at **15 rows/page** with cached next-page slicing (`nextActiveSliceRef` / `nextBankSliceRef`).
  - **Interactive `Cards | List` View Toggle:** Switches between a 3-column responsive card grid (`.rf2-cand__grid`) and dense table (`.rf2-jtable`), with `>= 44px` narrow touch targets on mobile.
  - **CV Bank (`/cv-bank`, `CvBankV2.tsx`):** Centralized CV file inventory, parsing review queue, retention/consent expiry tracking, archive/restore, and manifest Excel export.
- **Match Skills (`/sourcing-match`, `MatchSkillsV2.tsx`):**
  - Target Job Specification card with vacancy selector, Lucide iconography, metadata pills, JD viewer, and clinical/technical skill editor.
  - **15 cards/page pagination**, O(1) next-page slice cache, per-vacancy `/suggestions` cache (`2 min` TTL), proactive background batch prefetch near end of loaded server batches (`pageSize=100`), and race-safe `internalSearchWritesRef` URL synchronization.
- **Application File (`/applications/:id`, `ApplicationFileV2.tsx`):** Smart action bar highlighting the single **Next action**, 5 stage-gate enforcement banners, timeline/history (`FileHistory.tsx`), private screening drafts, documents/portal upload links, interview scheduling, offer revisions, and hiring-case transition.
- **Notification Center (`/notifications`, `NotificationsV2.tsx`):** Semantic `<h1>Notifications</h1>`, category filter tabs (`All Notifications`, `Unread Only`, `System Alerts`, `Pending Approvals`), mark-read actions, and return-context links (`?returnTo=...`).
- **Administration (`/users`, `/roles`, `/master-data`, `/audit-log`, `/pipeline-settings`, `/whatsapp-templates`, `/integrations`, `/reports`, `/import/:dataset/:jobId`):**
  - `/users?view=tree` hosts `ReportingTreeV2` (interactive 4-level SVG org chart, zoom controls `40%/60%/100%`, subtree focus, unassigned-user review, manager reassignment).
  - **Create User (`/users`, `USERS_MANAGE`):** Creates a user with roles, manager, and branch, and sets a temporary password. New users are created with `mustChangePassword: true` by default, so their first login lands on the forced-change screen (`/change-password`, see 01 §3) before they can use the app. Admins can also reset any user's password from `/users` (`POST /api/v1/users/:id/password`, see 04 §2).
  - `/reports` (`AdminReportsV2`) renders keyboard-focusable (`tabIndex={0}`) scrollable report cards alongside KPI summary and CSV export.
  - **Bulk Master Data Import (`MASTER_IMPORT_DATASETS` in [destinations.ts](../../apps/web/src/v2/destinations.ts)):** Supports `branches`, `positions`, `departments`, `skills`, `candidate-sources`, and `interview-types` under `/import/:dataset/:jobId` gated by `MASTER_DATA_VIEW` / `MASTER_DATA_MANAGE` (alongside `candidates` and `vacancy-requests`).

---

## 3. All 12 Workflow Drawer Modules (`apps/web/src/v2/drawers/`, alongside `StageFormSection.tsx`, `skillFormat.ts`, and drawer CSS)

| Drawer Module | Purpose |
|---|---|
| `CvIntakeEngineDrawer.tsx` | Multi-step CV upload, extraction review, inline editing, duplicate resolution, and job-fit evaluation (`skillFormat.ts`) |
| `ImportCvsDrawer.tsx` | Job-scoped bulk CV import from `/vacancies/:id?drawer=import` with duplicate detection & role-fit scoring |
| `JdReviewDrawer.tsx` | Job description text/PDF extraction and structured required/nice-to-have skills editor |
| `RequisitionDrawers.tsx` | Create/Edit/Inspect/Target-update/Cancel requisition workflows (`?req=...`) |
| `InterviewScheduleDrawerV2.tsx` | Interview scheduling with host-allowlisted room URL validation and attendee selection |
| `OfferDecisionDrawer.tsx` | Manager compensation decision (`Approve`/`Reject`) enforcing `GradeBand` bounds |
| `OnboardingChecklistDrawer.tsx` | Pre-hire & joining document verification checklist drawer |
| `ReassignDrawer.tsx` | Direct-manager file reassignment with team-eligibility filtering and mandatory reason |
| `SuggestDrawer.tsx` | Skill-matched candidate compare launch drawer (`2–4` candidates) |
| `SuggestJobsDrawer.tsx` | Reverse match suggestions from candidate profile to open vacancies |
| `JobStatusDrawer.tsx` | Open / Hold (`holdUntil`) / Reopen / Close job status transitions with reason |
| `FileDrawers.tsx` | Contextual Screening, Scorecard, Offer Revision, Candidate Answer, Joining, and Rejection drawers |

---

## 4. Client Performance, Tokens & Accessibility Rules

- **SWR View Caching & Route Preload:** [viewCache.ts](../../apps/web/src/v2/api/viewCache.ts) + [useCachedResource.ts](../../apps/web/src/v2/api/useCachedResource.ts) cache API lists across route switches; [routePreload.ts](../../apps/web/src/v2/routePreload.ts) warms sidebar chunks on hover/focus/idle (`AppShellV2.tsx`).
- **Bundle Budgets (`scripts/check-bundle-budgets.mjs`):** Main JS `<= 500 KB` raw / `<= 150 KB` gzip (`262.96 KB` raw / `79.79 KB` gzip in `v0.2.0`); heavy `pdf` / `pdf.worker` parser chunks are code-split lazily.
- **Design Tokens (`pnpm check:design-tokens`):** [tokens.css](../../apps/web/src/styles/tokens.css) + [tokens-v2.css](../../apps/web/src/styles/tokens-v2.css) enforce `84` strict CSS/TSX token-only files with WCAG AA `>= 4.5:1` dark-mode contrast (`--rf2-brand-action: #0369a1`, `--rf2-avatar-bg: #047857`, `--rf2-danger-badge-bg: #b91c1c`, `--rf2-warning-ink: #fdba74`).
- **Global Ctrl+K Command Search & AI Guide Assistant (`AppShellV2.tsx` + `AssistantDrawer.tsx`):** `HeaderSearch` searches candidates, jobs, and workspace destinations; the lazy-loaded `AssistantDrawer` (`Open Guide Assistant` header button and `QuickGuideModal` handoff) answers role-scoped guide questions backed by `docs/system-guide/`.
