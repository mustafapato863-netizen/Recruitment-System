# Visual correction follow-up (2026-10-12)
- [x] Identify the remaining sidebar/mode and icon mismatch against the SGH reference.
- [x] Restore theme surfaces, rounded icon tiles, visible SGH accents and logo backing.
- [x] Verify responsive layouts, colour contrast, existing tests, full CI, merge and production assets.

PR #37 merged and deployed as `16e26b3dbb21c12d7c69bead86b35e188b56aceb`; 822 frontend and 384 browser checks passed. Live sidebar tokens now adapt to light/dark. Evidence: `artifacts/theme-icons-review/verification.md`.

---

# Current task: simpler RecruitFlow workspace and live release (2026-10-11)

## Goal
Restore SGH branding and working themes, simplify daily navigation without removing capabilities or changing access, merge the completed fix, and verify the production deployment.

## Current phases
- [x] Review current shell, role navigation, routes and PR #36 status.
- [x] Replace the always-expanded classic menu with a grouped, searchable tools dialog; keep daily work visible.
- [x] Give specialist roles direct navigation to their own queues and simplify administrative navigation.
- [x] Verify permissions, keyboard interaction, themes, responsive layout, frontend checks and CI.
- [x] Merge PR #36 and confirm production assets contain the final change.

Release evidence: PR #36 merged as `e8ec1879aa087db4fee5e53c89fa65f702eb11ff`; production Vercel deployment succeeded. CI passed 822 frontend tests, 117 security cases, cross-tenant/RBAC checks and all 384 browser/accessibility checks. Live URL assets include searchable workspace tools; light SGH colours and persistent dark surfaces were verified in the browser.

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

## 2026-10-12 — old production restored; v2 local only
Production is pinned to classic commit e2ef442 / deployment dpl_4CWQRx6YHvJ6p9CHvminiiqEiFg5. Vercel autoAssignCustomDomains=false; do not release v2 until the user approves after local testing. Latest v2 source stays on local main 16e26b3. Local web 127.0.0.1:5173 and API 127.0.0.1:3000 run against isolated Recruitment_V2_Local_20261012; original Recruitment_DB remains unchanged. Login and Users screen verified locally; full workflow acceptance testing is pending. Evidence and restart instructions: artifacts/rollback-review/verification.md.

# 2026-10-13 — Figma desktop workflow completion

Scope: implement the six approved workflow improvements in RecruitFlow v4 Light/Dark for Employee, Manager and Admin. Figma only; preserve mobile, app code and classic public deployment. IBM Plex Sans and SGH glass-neumorphism stay intact.

- [x] Audit existing frame anatomy, instance properties, variables and prototype links.
- [x] Merge requisition and target; job-dependent checks; accepted-offer entry gate.
- [x] Add offer revisions/expiry, interview rescheduling/absence and narrow specialist views.
- [x] Add upcoming interviews/joining tabs, held-job commitments and complete action outcomes.
- [x] Verify all new states, destinations, permissions, themes, fonts, layout and representative screenshots.

Complete: all six approved workflow points are implemented in Figma desktop, Light/Dark, preserving IBM Plex Sans and SGH glass-neumorphism. Updated frame audit has zero scoped issues and all scenarios reachable. Final form geometry passes for 166 fields. Screenshots verify My Work, joining Dark, unified requisition, workflow rules and licence-only assignment. Evidence: artifacts/figma-upgrade/workflow-six-points-verification.json. This is design/prototype evidence, not application/API tests. No app code, mobile, deployment or Git operations were performed.

Selected skills: planning-with-files, figma-use, ui-ux-pro-max; mandatory figma-generate-design added for composed state screens. Four skills are justified by the Figma prerequisite.

Error: first Employee Light/Dark write rejected same-frame NAVIGATE on selected tabs. Tool reported safeToRetryWithoutCanvasRead=true (transaction rolled back). Fixed link helper to leave the active tab without a navigation reaction.

Error: second Employee write returned 65 KB of node IDs, exceeding 20 KB tool output cap; both transactions rolled back. Replaced node-ID encoding with shared prefix/suffix groups and lossless base36 delta ranges. All affected IDs remain recoverable.

The first compact encoding still produced 26 KB; deduplicating created/mutated/removed IDs into one lossless affectedNodeIds set resolved the output limit. A later read-only action query exceeded the cap and was reduced to label/destination data. Employee repair hit a null deferred destination and rolled back; the link helper now skips deferred destinations until explicitly wired.

# 2026-10-13 — Current-system / Figma integration assessment

Scope: read-only comparison of existing RecruitFlow implementation and new desktop Figma workflows. Recommend feature mapping, permission/state alignment and local integration sequence. No app implementation, deployment or Figma edits requested in this turn.

- [x] Inventory current routes, services and data models; distinguish local main from pinned classic production.
- [x] Compare current capabilities with new Employee/Manager/Admin Figma destinations and states.
- [x] Record evidence-backed gaps and an incremental local integration recommendation.

Assessment complete: artifacts/figma-upgrade/current-system-integration-map.md records feature preservation, live Figma evidence, universal SCFHS vs job-specific rules, final hiring approval representation and held-job commitments. Read-only source/design review; no runtime tests, implementation or deployment.

# 2026-10-13 — Business-complete desktop design

Scope: complete the new desktop Figma business journeys before application implementation. Preserve SGH glass-neumorphism, IBM Plex Sans, Light/Dark and compact main navigation. User confirmed final hiring approval is required for every hire. No code/deployment/mobile changes.

- [x] Audit current prototype and source business capabilities; record requirement/owner/state coverage.
- [x] Complete final hiring approval and contextual states for candidate bank/import/documents/messages, requisition approvals, administrative configuration and external journeys.
- [x] Wire scenarios and role-limited actions; validate outcome paths, guards, counts, layout and representative screenshots in both themes.
- [x] Save business rules, acceptance scenarios, decision assumptions and design handoff evidence.

Selected skills: planning-with-files, figma-use, ui-ux-pro-max; mandatory figma-generate-design added for composed Figma views (distinct prerequisite responsibility).

Complete: 252 new editable Business prototype states across six desktop pages, with unchanged main navigation. User decisions represented: final approval for every hire; responsible Recruiter records actual joining afterward. Final scoped audits pass; six representative final screenshots inspected; primary-button endpoint contrast measured on 344 enabled instances. Corrected screenshot-discovered external content clipping and inherited Admin reporting/header/template/drawer geometry. Handoff: artifacts/figma-upgrade/business-design-readiness.md; evidence: business-design-verification.json. These are design/prototype checks, not runtime/API/mobile/accessibility certification. No source, database, mobile, deployment, commit or PR change was performed.

# 2026-10-13 — Local v2 replacement implementation plan

User request: write a phased plan to implement the new Figma design in place of local v2 for testing. This turn produces a plan only; execution has not started.

Selected skills: planning-with-files for staged tracking and acceptance gates; senior-fullstack for frontend/API/data/permission dependencies.

- [x] Confirm source baseline, existing test scripts and isolated-local restart evidence.
- [x] Save phased local replacement plan with business rules, test gates, rollback and final cutover.
- [x] Prepare the user-facing phases and first usable milestone.

Baseline confirmed: local HEAD 16e26b3; React/Vite web, Nest API, shared contracts, Prisma/PostgreSQL. Prior preview uses 127.0.0.1:5173 and API 127.0.0.1:3000 against Recruitment_V2_Local_20261012. Process health and database target must be rechecked before execution. Existing uncommitted planning/artifact files and docs/design-system.zip must be preserved. Public classic deployment and mobile remain outside the local replacement scope.

Plan delivered in docs/local-v2-replacement-plan.md: nine phases with local isolation/restore; shared visual system; business contracts/permissions; daily job/requisition work; complete hiring; candidate/data/communication support; Admin/reports; external journeys; combined acceptance and same-URL local cutover. First complete hiring trial follows phase 5. Implementation phases have not started; no runtime tests, app changes, database operations or deployment were performed in this planning task.

Future execution checklist:
- [x] 1. Local baseline, isolated services and verified restore.
- [x] 2. Shared desktop components, themes and navigation.
- [x] 3. Business rules, contracts, permissions and necessary data changes.
- [x] 4. My Work, requisitions, jobs and application basics.
- [x] 5. Interviews, offers, checks, final approval and actual joining.
- [x] 6. Candidate bank, pools, imports, documents and communication.
- [x] 7. Administration, durable configuration and reports.
- [x] 8. Candidate external journeys and staff access.
- [x] 9. Combined verification and default local replacement.

# 2026-10-13 — Phases 1–3 implemented locally

Selected skills: planning-with-files for the phase record; RTK for shell commands; senior-backend and senior-fullstack for joining rules, permissions and schema; the existing v2 token and shell primitives for the shared desktop system; Playwright for the desktop layout review. Live Figma access was unavailable (Figma MCP auth required). Saved screenshots and the existing SGH token set were the visual source. This is not a claim of pixel-verified Figma parity.

Branch `codex/local-desktop-upgrade` remains at `16e26b3`. No commit. Phases 4–9 are not started.

Phase 1: isolated preview verified on `Recruitment_V2_Local_20261012` with mail frozen in the start script. Pre-change dump restored to a disposable database, compared, migrated, and dropped. Original `Recruitment_DB` was read only.

Phase 2: IBM Plex Sans on the shared tokens, full seat navigation with capability filters, More (classic) retained, TabsV2 fixture, light/dark desktop review at 1280, 1440 and 1920.

Phase 3: one joining policy for both Joined paths; `RECORD_ACTUAL_JOINING` separate from final approval; requirement snapshots and approval fingerprints; narrow hiring-case, licence and interview payloads. Phase 5 hiring UI was not built.

Evidence and exact check results: artifacts/local-desktop-upgrade/phases-1-3-report.md.

# 2026-10-13 — Phase 4 implemented locally

Selected skills: planning-with-files for the phase record; senior-fullstack for requisitions, jobs and applications; Playwright on the already-running local preview. Live Figma access was unavailable. Saved SGH tokens and local screenshots were the visual source. This is not a claim of pixel-verified Figma parity.

Branch `codex/local-desktop-upgrade` remains at `16e26b3`. No commit. Phases 5–9 are not started. Phases 1–3 notes above stay as written.

Phase 4: My Work, Open jobs and the Candidates application list use persisted records. Requisitions hold seats, owner and due date. A draft with a due date and an in-tree recruiter activates directly. Approval, requested changes and decline stay on Pending Approval when `VACANCY_REQUEST_APPROVE` is held. Capacity updates send `seats`. Cancellation impact blocks close while interviews, sent or accepted offers, or Awaiting Joining are unresolved, and it does not erase joined hires or history. Held jobs keep those commitments off the hire-target list. Notification and My Work links resolve to the record inside organization or team scope.

Exit walkthrough: Hassan activated VR-2026-011 (Cardiology Specialist, Head Office, due 2026-12-20) onto Sarah Ahmed, reduced seats from 2 to 1, and left the job Open. Sarah added sample candidate Phase4 Sample and moved application `edd8e3a3-2f0f-4200-86e0-531479587ffe` to Screening. Counts survived refresh. The job was not cancelled.

Evidence and exact check results: artifacts/local-desktop-upgrade/phase-4-report.md.

# 2026-10-13 — Phase 5 implemented locally

Selected skills: planning-with-files for the phase record; senior-fullstack for interviews, offers, checks, final approval, and joining; Playwright on the local preview. Live Figma access was unavailable. This is not a claim of pixel-verified Figma parity.

Branch `codex/local-desktop-upgrade` remains at `16e26b3`. No commit. Phases 6–9 are not started. Earlier phase notes stay as written.

Phase 5: one technical hire and one clinical hire ran from application through Joined. Final approval did not increase the completed-hire count. A second click and two overlapping clinical joins counted one hire. A declined final approval, the last seat, and an expired SCFHS licence did not count a hire. The assigned interviewer sees the assigned evaluation. The licence specialist sees the assigned SCFHS licence. The responsible recruiter records joining.

Evidence: artifacts/local-desktop-upgrade/phase-5-report.md.

# 2026-10-13 — Phase 6 implemented locally

Selected skills: planning-with-files for the phase record; senior-fullstack for the bank, import review, document history, and message attempts; Playwright on the local preview. Live Figma access was unavailable. This is not a claim of pixel-verified Figma parity.

Branch `codex/local-desktop-upgrade` remains at `16e26b3`. No commit. Phase 6 is recorded. Phases 7–9 are not started. Earlier phase notes stay as written.

Phase 6: one workbook with a valid row, an invalid row, and a duplicate row was reviewed and confirmed. Repeating one bank identity did not create a second person. A new small PDF has stored bytes, a version, a preview, downloads, and a document request. A failed message was retried and the failed attempt stayed. Phase 5 joined counts and the phase 4 Screening file were left as they were.

Evidence: artifacts/local-desktop-upgrade/phase-6-report.md.

# 2026-10-13 — Phase 7 implemented locally

Selected skills: planning-with-files for the phase record; senior-fullstack for durable settings, workflow preview, users, and report scope; Playwright on the local preview. Live Figma access was unavailable. This is not a claim of pixel-verified Figma parity.

Branch `codex/local-desktop-upgrade` remains at `16e26b3`. No commit. Phase 7 is recorded. Phases 8–9 are not started. Earlier phase notes stay as written.

Phase 7: position-level activity targets are stored for the organization and read back as 17 after an API restart. A protected joining-profile change stayed a preview. Hassan’s team result lists Mona only. Ahmed’s reports and export cover the wider team. One disposable user was deactivated, one disposable reporting line was changed, and a local invitation was recorded without an email. Sarah can open configuration and does not see an individual’s salary.

Evidence: artifacts/local-desktop-upgrade/phase-7-report.md.

# 2026-10-13 — Phase 8 implemented locally

Selected skills: planning-with-files for the phase record; Playwright on the local preview. Live Figma access was unavailable. This is not a claim of pixel-verified Figma parity.

Branch `codex/local-desktop-upgrade` remains at `16e26b3`. No commit. Phase 8 is recorded. Phase 9 has not been started. Earlier phase notes stay as written.

Phase 8: a public application with consent creates a real application and an on-screen receipt. A second candidate sees only their own application. A revoked link and the other candidate’s receipt do not return the file. An application without privacy consent is rejected. A requested upload stays awaiting verification and does not complete a joining or licence check. `/portal` stays a candidate entry. Staff sign-in still opens My Work. More (classic) stays.

Evidence: artifacts/local-desktop-upgrade/phase-8-report.md.

# 2026-10-13 — Phase 9 implemented locally

Branch `codex/local-desktop-upgrade` remains at `16e26b3`. No commit. Phase 9 is recorded. The public release has not been started. Earlier phase notes stay as written.

A normal login at `http://127.0.0.1:5173/` opens the new interface. More (classic) is no longer in the sidebar. Each classic page keeps its route and permission gate, and the signed-in person gets a retained link for every classic page they can open. The 26 acceptance rows still match the phase 4–8 records. The phase-1 dump was restored to disposable database `recruitment_v2_phase9_recover_20261013` and that database was dropped.

Evidence: artifacts/local-desktop-upgrade/phase-9-report.md.
