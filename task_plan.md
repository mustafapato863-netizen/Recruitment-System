# RecruitFlow — Candidate Journey Completion Plan
Status: COMPLETED (All Phases 0–4 plus E1–E9 Delivered & Verified)
Created: 2026-09-04
Last Updated: 2026-09-06
Owner: AI Pair + Mustafa

## Goal
Close the 5 identified gaps between the current fragmented page experience and
an Odoo-inspired, fully-wired candidate journey — WITHOUT a big-bang rewrite.
Deliver as incremental vertical slices, each independently shippable.

## Phases

| Phase | Title | Priority | Status |
|-------|-------|----------|--------|
| 0 | Stabilize & Contract Alignment (P0.1, P0.2, P0.3) | Critical | `completed` |
| 1 | Candidate 360 Workspace + Smart Action Bar (P1.1–P1.4) | High | `completed` |
| 2 | Unified Chatter / Activity Thread (P2.0–P2.4) | High | `completed` |
| 3 | Scorecard Loop: Interview → Decision (P3.1–P3.3) | High | `completed` |
| 4 | Joining Gateway & Onboarding Handshake (P4.1–P4.3-fix) | Medium | `completed` |
| E1–E5 | Lit Sweep & Operational Polish (E1–E5) | High | `completed` |
| E6 | Per-Position Workflow & Odoo Alignment (E6.1–E6.4) | High | `completed` |
| **E7** | **Per-Position Operational Parity Blueprint (E7.1–E7.4)** | **High** | `completed` |
| **E8** | **Workspace Ergonomics, Breadcrumbs, Card Glow & Recruiter Restrictions** | **High** | `completed` |
| **E9** | **Full Per-Position Workflow Logic & Odoo Parity Implementation (E9.1–E9.6)** | **High** | `completed` |

## Per-Position Workflow Enhancements (E6) - COMPLETED
- **E6.1:** Vacancy-Locked Pipeline Mode (`VacancyOverviewPage.tsx` & `ApplicationsPage.tsx`) [DONE]
- **E6.2:** Quick Action Drawer on Kanban Cards (`ApplicationsPage.tsx`) [DONE]
- **E6.3:** Dynamic Position Competencies in Scorecards (`InterviewDetailPage.tsx` & `Scorecard.tsx`) [DONE]
- **E6.4:** Cross-Application Collision Warning Banner (`ApplicationDetailPage.tsx`) [DONE]

## Per-Position Operational Parity Blueprint (E7) - COMPLETED
- **E7.1:** Direct Candidate Sourcing Modal (`AddApplicationModal.tsx` wired to `ApplicationsPage.tsx` & `VacancyOverviewPage.tsx`) [DONE]
- **E7.2:** Position-Scoped Interviews & Offers Pages (`InterviewsPage.tsx`, `OffersPage.tsx`, and `VacancyOverviewPage.tsx` query param wiring) [DONE]
- **E7.3:** Odoo-Style Job Positions Cards/Grid View Toggle (`VacantListPage.tsx` with 3-column cards, SLA indicators, and 1-click pipeline jump) [DONE]
- **E7.4:** Requisition Bidirectional Linkage & Inline Evaluation Flow (`ApplicationDetailPage.tsx` requisition breadcrumbs, header jump, and inline interviews evaluation panel) [DONE]

## Workspace Ergonomics, Breadcrumbs, Card Glow & Recruiter Restrictions (E8) - COMPLETED
- **E8.1:** Removed redundant "+ New" menu from top header navbar (`AppShell.tsx`).
- **E8.2:** Standardized icon sizes across sidebar & header (`AppShell.tsx`, `shell.css` enlarged `.nav a .ico` container from 20px to 28px, active pill glow, hover tint).
- **E8.3:** Enhanced breadcrumb navigation (`BreadcrumbsBar.tsx` with chevron-right separators, comprehensive label mapping, polished badges).
- **E8.4:** Added `.card-glow` and uniform card sizing (`design-system.css`, `ManagerDashboard.tsx` KPI cards `h-[105px]` and columns `min-h-[460px]`/`min-h-[380px]`, `VacantListPage.tsx` cards `h-[285px]`).
- **E8.5:** Restricted recruiters from assigning or reassigning tasks across UI & backend API (`TasksPage.tsx`, `ManagerDashboard.tsx`, and `apps/api/src/tasks/tasks.controller.ts` with `@RequirePermissions('VACANCY_MANAGE')` and role checks).
- **E8.6:** Breadcrumb Context & Deduplication (`BreadcrumbContext.tsx`, `BreadcrumbsBar.tsx`, removal of in-page duplicate breadcrumb bars across detail pages, contextual route ID fallback resolution, dynamic entity titles).

## Full Per-Position Workflow Logic & Odoo Parity (E9) - COMPLETED 2026-09-06
- **E9.1:** Pipeline Position Switcher Dropdown in `ApplicationsPage.tsx` [DONE]
- **E9.2:** Persistent Odoo Smart Stat Buttons & Clean Sub-flows on `VacancyOverviewPage.tsx` [DONE]
- **E9.3:** Headcount Synchronized Incrementing & Auto-Closure Handshake (API + UI) [DONE]
- **E9.4:** Structured Refusal / Rejection Reason Taxonomy & Modal [DONE]
- **E9.5:** 1-Click Recruiter "Claim Application" on Kanban Card [DONE]
- **E9.6:** Real Vacancy Edit Persistence & Public Careers Preview [DONE]
- Evidence: landed across `6419977` + `d2d8521` (Milestone 1); markers verified in
  `ApplicationsPage.tsx` (E9.1/E9.3/E9.4/E9.5) and `VacancyOverviewPage.tsx` (E9.2/E9.6).

## Verification & Build Status (re-verified 2026-09-06, commit `b01d115`)
- **Web Typecheck (`tsc -p tsconfig.app.json --noEmit`):** Clean (0 errors).
- **API + Worker Typecheck:** Clean (0 errors).
- **Web Build (`pnpm --dir apps/web build`):** Clean (~3s, clean chunk split).
- **Web Tests:** 35 files, 121/121 passing (100%).
- **API Tests:** 4 files, 26/26 passing (gate now covers all `apps/api/src` specs).
- **Worker Tests:** 1 file, 4/4 passing (new `test` script).
- **ESLint:** Clean on all new/changed files (44 errors fixed this session).
- **DB:** `migrate status` up to date (incl. `20260906_phase_c_stage_automation_email_templates`).



