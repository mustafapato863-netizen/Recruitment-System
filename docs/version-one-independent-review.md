# Version-one independent review

Status: completed 8 September 2026 after Luna implementation and independent repair/review by the primary agent. Local UAT is ready on the current API/web build.

## Review contract

Review the implementation delta against `version-one-simplification-plan.md`, distinguishing existing uncommitted changes from this delegation. No completion claim until findings are resolved or explicit limitations are recorded.

## Checks after handover

- Plan coverage: account for every phase and acceptance criterion; distinguish implemented, verified and deferred.
- Candidate activity: atomic call/follow-up creation, retries, immutable actor, rescheduling history, permission checks and truthful counts.
- Interview scheduling: real job title per interviewer, generated title compatibility, missing values and persistence.
- My Work: all open tasks remain reachable, pagination and correct date groups, no inaccessible shortcuts or hidden errors.
- Navigation: CV Bank alias, retired pages, notifications, deep links and preserved route/API authorization.
- Candidate contact: nullable email across schema, API, import, dedupe, exports and outbound actions; preserve existing identity/privacy and application independence.
- Master Data: real foreign keys, tenant scoping, bounded atomic batches, validation errors, stale edits, deactivation and dynamic consumers.
- UI: unsaved work, keyboard focus, mobile/dark layouts, duplicate action removal and successful-save feedback.
- Authentication: diagnose long-session and concurrent-tab refresh; do not hide errors by logging in for each page.
- Verification: independently run relevant tests/typecheck/lint/build, inspect migration evidence and exercise changed workflows using isolated data without external delivery.

## Findings

### Final independent review 2026-09-08

- Candidate contact handling is now nullable and cross-layer: CV intake, direct candidate creation, import and public apply accept email or a valid phone; phones are stored in canonical digits and formatted-phone duplicates are detected without synthetic emails.
- CV identity parsing removes known and generic leading job-title text before storing names, and the Stage 2 source-of-CV value persists with the candidate/application.
- Candidate activity, follow-up completion, refresh persistence, pagination, validation and responsive profile behavior passed the focused browser/API smoke. Interview scheduling preserves generated titles and snapshots each interviewer's job title.
- The final UI pass removed the unused scheduling controls that contained demo interviewer names and did not persist meeting-mode data; the modal now exposes only saved scheduling inputs.
- My Work is the operational replacement for the hidden Tasks destination; `/tasks` remains a permission-gated redirect for bookmarked links. Notifications and integrations remain direct compatibility routes while their sidebar destinations stay removed.
- Master Data uses the six-tab grid with bounded batch saves, tenant checks, optimistic versions and row/column validation. Category-specific columns are editable in the grid, including branch/department links, job-title metadata, candidate-source type and interview duration. A paste dirty-state bug was fixed so Save Changes is enabled after editing pasted cells.
- Migration status is current (29 migrations). The new Position metadata migration applied cleanly; no existing records were deleted or reset.
- Verification passed independently: full web/API/worker suite 153/58/4, typecheck, lint, API and web production builds, database migration status, read-only audit checks, 28/28 browser checks across light/dark and 375/1440px, plus candidate/public-phone/master-data/interview local regression smokes.

Remaining non-blocking release limitations are explicit: the production CSS bundle is 411.84 KiB against the existing 225 KiB budget, several chunks exceed the Vite warning threshold, the design-token checker still reports the legacy palette baseline, and the prior long-session run recorded 401 responses after 156 checks. These need a separate performance/session reliability gate; they do not block the verified local first-version workflows.

### Luna version-one implementation handoff 2026-09-08

- Baseline manifest: `docs/luna-v1-baseline-20260908.md`. Existing dirty files and data were preserved; no commit, reset, seed-user creation, outbound message, or deployment was performed.
- Phase 1: candidate activity is persisted through the existing task model with one-save call/follow-up behavior, retry-safe completion, completed-by attribution, and profile rescheduling. Existing scheduled interviews and stage changes remain timeline events rather than completed activity.
- Phase 2: interview scheduling generates the existing title from candidate, position and type, snapshots interviewer job titles, prefills from active user profiles, and supports per-panel corrections. Applicant Profile scheduling now sends a real selected interviewer instead of the old fixed demo values.
- Phase 3: `/my-work` is the operational route. Recruiters reuse the persisted task queue; employees retain their permission-scoped workspace. `/tasks` redirects to `/my-work`, `/cv-bank` redirects to `/candidates`, and redundant default navigation/quick actions were removed while compatibility routes remain permission-gated.
- Phase 4: candidate email is nullable after migration, candidate creation/public apply/import accept a valid email or phone, existing populated-email uniqueness remains, duplicate suggestions use accessible normalized contact matches, and candidate source options can come from Master Data. No automatic merges or synthetic emails were added.
- Phase 5: Master Data has a bounded six-tab grid with inline editing, search, paste staging, Save/Discard, validation, tenant checks and optimistic versions. Branch saves retain and validate the required `legalEntityId`; branches/job titles continue using their real entities, while the new catalog categories use a scoped `MasterDataValue` table.
- Verification passed: API tests 58/58, web tests 153/153 plus CandidateActivityPanel 4/4, worker tests 4/4, workspace typecheck, root lint, API/web production build, Prisma schema validation, local migration deploy/status, and `git diff --check`.
- Migration recovery evidence: all migrations were deployed to disposable database `recruitflow_migration_check_20260908`, the new migration was reversed there with quoted-column SQL, its migration record removed, and the migration reapplied successfully; the disposable database was then dropped. The real local database migration is applied and status is up to date.
- Runtime evidence: both existing API processes answered health 200 on ports 3000 and 3001; Vite processes were observed on ports 5173, 5174 and 5175. No running process was stopped.
- Remaining acceptance limits: no complete browser UAT workflow was run after this final delta; CSS bundle remains 402.19 KiB versus 225 KiB and the design-token legacy palette remains 9,338 versus 850. Long-session 401 behavior remains documented from the prior controlled test and needs independent release-gate review. The migration has no automatic Prisma rollback command; the disposable reverse/reapply check is evidence for the manually defined recovery path.
