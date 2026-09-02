# Task Plan: RecruitFlow Complete UI/UX Redesign

## Goal
Completely redesign the RecruitFlow web application (excluding the login page) to perfectly match the 16 visual reference screenshots in `docs/recruitment-visual-reference-complete`, ensuring every component, phase, and page is meticulously aligned, including the specific metric card styles requested.

## Current Phase
Phase 1: Planning & Structure

## Phases

### Phase 1: Planning & Structure
- [x] Analyze all 16 reference screenshots.
- [x] Identify the core design system components (Metric Cards, Outline Pills, Steppers, Alert Boxes, Data Tables).
- [x] Create the detailed implementation plan.
- **Status:** complete

### Phase 2: Core Design System & App Layout
- [ ] Sub-phase 2.1: `index.css` & Theme Tokens
  - Define all colors to exactly match the reference (pure white surfaces, dark text, specific blue gradients).
  - Setup the metric card shadow and gradient border tokens.
- [ ] Sub-phase 2.2: The `AppShell` & Navigation
  - Implement the `#111827` dark sidebar.
  - Implement active states (left blue border, slate-800 background).
  - Implement top breadcrumb header and global search.
- [ ] Sub-phase 2.3: Shared UI Components
  - Build `MetricCard.tsx` (white bg, shadow, right/bottom blue gradient border, icon).
  - Build `PillButton.tsx` (rounded-full).
  - Build `OutlineBadge.tsx`.
- **Status:** pending

### Phase 3: Dashboard & My Work (`01-my-work-dashboard.png`)
- [ ] Sub-phase 3.1: Dashboard Layout
  - Refactor `ManagerDashboard.tsx` to use the new `MetricCard` component for KPI summaries (Draft Offers, Tasks, etc.).
- [ ] Sub-phase 3.2: Task Lists & Prioritization
  - Implement the "My Priorities" side panel styling.
- **Status:** pending

### Phase 4: Job Positions (`02-job-positions.png`, `03-job-overview.png`)
- [ ] Sub-phase 4.1: Vacancy List Page
  - Refactor `VacantListPage.tsx` table (row borders, outline pill status badges, checkbox alignment).
  - Update top filters and spacing.
- [ ] Sub-phase 4.2: Job Overview Detail
  - Redesign the split-pane job overview page.
- **Status:** pending

### Phase 5: Applications & Kanban (`04-applications-pipeline-kanban.png`, `13-applications-list-view.png`)
- [ ] Sub-phase 5.1: Kanban Board
  - Refactor `ApplicationsPage.tsx`. Update columns, card typography, "Next Action" box, and "+ Add Candidate" dotted footers.
- [ ] Sub-phase 5.2: Application List View
  - Implement the alternate table list view for applications.
- **Status:** pending

### Phase 6: Candidate Profiles & Transitions (`05-applicant-profile.png`, `06-stage-transition.png`)
- [ ] Sub-phase 6.1: Applicant Profile
  - Refactor `CandidateDetailPage.tsx`. Implement text-based pipeline stepper, exact header badges, and tab styling.
- [ ] Sub-phase 6.2: Stage Transition 
  - Refactor `ApplicationDetailPage.tsx`. Add dark cyan alert box, split-pane layout, and pill action buttons.
- **Status:** pending

### Phase 7: Interviews & Feedback (`09-interviews.png`, `10-interview-detail-feedback.png`)
- [ ] Sub-phase 7.1: Interview Calendar/List
  - Refactor interview list view.
- [ ] Sub-phase 7.2: Feedback Form
  - Refactor interview detail page to match the evaluation/feedback card design.
- **Status:** pending

### Phase 8: Offers & Joining (`11-offers.png`, `12-offer-detail-hire.png`)
- [ ] Sub-phase 8.1: Offer List
  - Refactor the offer pipeline/list view.
- [ ] Sub-phase 8.2: Offer Details
  - Redesign the offer drafting and approval split-pane view.
- **Status:** pending

### Phase 9: Settings & Analytics (`15-job-analytics.png`, `16-recruitment-settings.png`, `07-recruitment-reports-dark.png`)
- [ ] Sub-phase 9.1: Settings Forms
  - Refactor form inputs, toggles, and layout in settings.
- [ ] Sub-phase 9.2: Analytics & Reports
  - Style charts and data tables for analytics pages.
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Centralize `MetricCard` | The requested card design (gradient border) appears in multiple places. Extracting it ensures consistency. |
| Stick to pure Tailwind CSS where possible | Prevents CSS bloat and aligns with the existing App architecture. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       |         |            |
