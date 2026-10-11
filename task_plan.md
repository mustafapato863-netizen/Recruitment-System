# Current task: simpler RecruitFlow workspace and live release (2026-10-11)

## Goal
Restore SGH branding and working themes, simplify daily navigation without removing capabilities or changing access, merge the completed fix, and verify the production deployment.

## Current phases
- [x] Review current shell, role navigation, routes and PR #36 status.
- [x] Replace the always-expanded classic menu with a grouped, searchable tools dialog; keep daily work visible.
- [x] Give specialist roles direct navigation to their own queues and simplify administrative navigation.
- [ ] Verify permissions, keyboard interaction, themes, responsive layout, frontend checks and CI.
- [ ] Merge PR #36 and confirm production assets contain the final change.

## Constraints
Preserve existing data, API authorization, URLs, specialist licence/final-approval access, and existing work. Do not expose extra records or run destructive production tests. Preserve the prior planning history below.

---

# Previous task: System-Wide 10% Visual Compaction (/goal)

## Goal
Make the entire RecruitFlow application feel approximately 10% more compact at 100% browser zoom, matching how it looks at 90% zoom without using CSS zoom or transforms. Sizing is reduced systematically across shared design tokens, layout geometry, UI primitives, reusable components, and optimized with 8px card padding from all sides for improved UI/UX.

## Phases
- [x] Phase 1: Shared Design Tokens & Density Scaling (`tokens.css`, `density.css`)
- [x] Phase 2: Layout Geometry & Visual Parity Stylesheets (`v2-parity.css`, `shell.css`)
- [x] Phase 3: UI Primitives & Design System Rules (`ui-primitives.css`, `design-system.css`, `admin.css`)
- [x] Phase 4: Core Reusable UI & Layout Components (`PageFrame`, `Button`, `Input`, `Card`, `Badge`, `DataTable`, `MetricCard`, `BreadcrumbsBar`, `Modal`, `AlertDialog`, `AppShell`, `VacancyCard`, `CandidateFitScorecard`, `ComparisonMatrixCard`, `MyTargetsWidget`, `ReportsPage`)
- [x] Phase 5: Automated Checks (`check:design-tokens` [0 violations], `typecheck` [8 projects clean], unit tests [69 files / 287 tests passed])
- [x] Phase 6: Visual and responsive layout verification across Desktop, Tablet, and Mobile in Light and Dark modes
- [x] Phase 7: 8px Card Padding Enhancement (`--space-card: 8px;`, `p-[8px]`)
- [x] Phase 8: Brand Button Color Replacement (`bg-blue-600` replaced with `oklch(0.51 0.14 249.51)`)

## Constraints
- Do NOT use browser zoom, CSS `zoom`, or CSS transforms to scale the interface. [MET - achieved via rem scaling and token reduction]
- Preserve readability, WCAG 2.1 AA accessible contrast, keyboard focus, and usable control hit areas. [MET - desktop >=32px, mobile >=40px touch targets]
- Keep layouts responsive and prevent clipping, overflow, or awkward wrapping. [MET - fully responsive across desktop, tablet, and mobile]
- Preserve existing functionality, dark mode, and Arabic/RTL layouts. [MET - dark mode tokens and RTL styles intact]
- Do NOT change business logic or remove information. [MET - 100% tests pass, zero business logic modified]
