# RecruitFlow: full application audit and repair record

Date: 8 September 2026. Scope: local application audit followed by a focused repair pass. No business data was changed. A disposable browser response override simulated an employee; it was not a server-side authorization test.

## Confirmed findings and status

P1 means a multi-user UAT blocker. P2 means the next reliability or usability pass.

| ID | Priority | Finding | Evidence and repair status |
|---|---|---|---|
| B01 | P1 | My Work called `.filter` on the paginated task object and showed a service notice. | Fixed with `apps/web/src/utils/taskResponses.ts`, paginated response handling, and explicit panel errors in `EmployeeDashboard.tsx`. Regression tests cover paginated and legacy array responses. |
| B02 | P1 | An Employee/Viewer role could hide an additional Administrator or recruiter role. | Fixed in `workspacePersona.ts`; full-workspace role codes take precedence. Mixed Administrator + Employee regression is covered. |
| B03 | P1 | Unified offer approvals expected nested data while the API returned flat fields. | Fixed with shared `OfferApprovalInboxItem` contract. Both inbox pages render/search the flat response. |
| B04 | P1 | Separate offer inbox navigated with an approval ID instead of the offer ID. | API now returns `offerId`; both inboxes route to `/offers/{offerId}`. |
| B05 | P1 | CV parsing fabricated missing experience/contact/location values and overclaimed domain confidence or verification. | Fixed parser defaults, evidence wording, `Unclassified` domain handling, and confidence calculation. Minimal and clinical parser tests pass. |
| B06 | P2 | Empty Offers state linked to `/offers/new`, while the canonical create route is `/offers/create`. | Fixed CTA. |
| B07 | P2 | Negative task page values produced HTTP 500. | Controller now rejects malformed, non-positive, and oversized values with HTTP 400. A fresh API instance on port 3001 returned HTTP 400 for both negative page and malformed page size; the original port 3000 process remains an older build. |
| B08 | P2 | Email Templates sidebar permission was weaker than its route gate. | Fixed sidebar requirement to `MASTER_DATA_MANAGE`. |
| B09 | P2 | Vacancy sharing hardcoded organization code `sgh`. | Fixed vacancy detail contract and all public links to use `organizationCode`. Verify with two organizations. |
| B10 | P2 | My Work silently treated rejected panel requests as empty queues. | Fixed by clearing the affected panel and naming the failed panel in the service notice. |
| B11 | P2 | The design-token checker still opened the deleted `DesignSystemPage.tsx`, so the repository check crashed with `ENOENT` after page cleanup. | Removed the deleted showcase from the checker’s explicit-file list. The checker now reaches its intended legacy-palette checks; those checks still report the existing baseline violations and are recorded as a separate migration task. |
| B12 | P2 follow-up | A long 396-check browser run began logging 401 responses after the first 156 checks, while a fresh 132-check run passed. | No page defect was reproduced: the API refresh endpoint returns 200 in a direct cookie round-trip, and the fresh 132-check matrix passes. Treat this as session-lifetime/refresh observability work for long-running sessions and test runs, not as a cleared release gate. |

## What is working well

- Backend visibility predicates are centralized for tenant-scoped recruitment resources.
- The full application profile combines activity, screening, stage actions, and candidate context.
- CV intake supports upload, editable extraction, source capture, candidate matching, and document persistence.
- Approval versioning, task records, assignment history, migrations, and automated checks provide a solid base.

## Enhancement plan

### Phase 1: data and navigation correctness

Complete B01-B10, restart the API from the current build, and run action-level browser checks. Keep route/API permission gates authoritative even when the admin changes sidebar labels or visibility.

Exit gate: employee tasks load; mixed-role administrators keep the full workspace; every pending offer opens its package; unsupported CV values stay unknown; invalid pagination returns 400.

### Phase 2: one recruiter workspace

- Add a role-aware Today/My Work queue for assigned vacancies, candidates needing action, overdue follow-ups, and interviews today.
- Consolidate offer and final-hire approval views behind the unified inbox after the contract repair; preserve old URLs as redirects.
- Keep candidate identity/CV data separate from application screening and stage data while presenting both from one profile.

### Phase 3: trustworthy extraction and dynamic configuration

- Add evidence locations and confidence flags for names, titles, experience, certifications, and Arabic/English CV variants.
- Load CV source channels from master data; store source separately from filename, uploader, and upload time.
- Keep current salary, expected salary, and notice period permission-controlled and auditable.
- Define completed activity metrics separately from scheduled tasks and stage events.

### Phase 4: release evidence and performance

- Reduce duplicated CSS and unused rules. The existing CSS budget remains over threshold (401.85 KiB vs 225 KiB); JS is within budget (250.83 KiB vs 300 KiB). A preflight/utilities-only experiment removed required layout utilities and was reverted; the next attempt needs route-safe CSS splitting or a measured semantic-utility migration.
- Migrate the existing legacy palette usage behind `check:design-tokens` in a measured baseline-aware pass. The checker now runs after the removed showcase reference was fixed, but currently reports the existing 9,338 legacy utility occurrences against its 850 budget.
- Add contract tests, mixed-role checks, negative API cases, and action-level browser workflows.
- Repeat two-organization scope checks and live round trips for CV upload, screening, assignment, activity completion, offer approval, and joining in disposable test data.

## Verification

- Web: 153/153 tests passed.
- API: 58/58 tests passed.
- Worker: 4/4 tests passed.
- Workspace typecheck and root lint passed.
- Production web build passed; JS budget passed, CSS budget remains above threshold.
- The design-token checker no longer crashes on the removed showcase page; it now reports the pre-existing legacy palette baseline (9,338 occurrences versus an 850 budget) for a planned migration phase.
- A fresh two-width browser matrix passed 132/132 after the long-run 401 burst; the long-run session behavior remains a P2 authentication reliability follow-up.
- Database: 27 migrations found and schema is up to date.
- Browser route matrix: a fresh rebuilt-API matrix passed 132/132 checks (33 routes x 2 widths x 2 themes) through a temporary Vite proxy on port 5175, and the focused repair matrix passed 32/32 checks (8 routes x 2 widths x 2 themes). The matrix does not cover every registered public/profile/token flow and does not prove every write action.
- Targeted probes before the repair reproduced the employee task contract error and `/tasks?page=-1` HTTP 500. After the frontend repair, the employee simulation no longer showed the task service notice. A fresh API instance on port 3001 now returns HTTP 400 for invalid pagination; port 3000 is an older process and should be restarted when the next UAT session begins.

Evidence: `tests/artifacts/full-audit-2026-09-08/`, including `targeted-probes.json`, `employee-tasks-contract.png`, `full-repair-matrix/matrix-summary.json`, `final-matrix/matrix-summary.json`, and the focused theme summaries.

UAT note: the verified current-build pair is API `http://localhost:3001` behind the temporary web proxy `http://localhost:5175`. The normal web URL `http://localhost:5173` still points at the older API process on port 3000 until that process is restarted from the current build.
