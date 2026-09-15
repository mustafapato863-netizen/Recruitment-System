# Progress Log

- Final permission audit: users without `VACANCY_VIEW` no longer trigger interview list requests and see a restricted-state message in the Interview stage instead of interview records. Focused Applicant Profile tests (6/6), workspace type checks, and lint passed after this fix.
- Preserved in-progress offer drafts while switching workspace stages; saved server offer versions still refresh the form. Focused UI, API, and workspace type checks passed again afterward.

## 2026-09-15

- Completed the unified Applicant Profile workspace implementation and reviewed the backend/frontend integration.
- Added a no-template fallback for the next-stage action so legacy applications do not become read-only during pipeline setup.
- Aligned Screening editing with `CANDIDATE_EDIT`; stage movement remains controlled by `APPLICATION_MOVE_STAGE`.
- Added confirmation at the point where a stage move, rejection, or interview schedule can refetch data and discard unsaved screening input. Stage-tab and requirement links use the same guard.
- Added UI-side permission guards for legacy note, interview, rejection, and stage-move handlers, plus a CV details action inside the Applied workspace.
- Reduced first-load duplication by hiding the legacy overview/interview detail grid while the unified workspace is active; Resume, Activity, and Tasks remain available as support views.
- Conflict retries now refresh the application, workspace requirements, timeline, and related records together.
- Kept pipeline ordering authoritative when selecting the next stage and added unsaved-change protection to SPA navigation and keyboard candidate switching.
- Interview scorecard entry follows the existing interview view permission, and Offer/Pre-Hire loading is isolated so one restricted endpoint does not hide the other record.
- Guarded stage transition validation for applications whose persisted stage is a custom pipeline value, so a missing canonical transition map cannot crash the API.
- Added API coverage for required gate blocking and the no-default-pipeline fallback.
- Accepted bounded custom pipeline stage labels for transition requests; the server still rejects arbitrary jumps and only permits the immediate persisted next stage.
- Verified API tests (19 files/92 tests), all web tests (47 files/166 tests), worker tests (2 files/6 tests), focused Applicant Profile UI tests (6 tests), API/web/worker type checks, lint, production build, Prisma validation/generation/migration status, bundle budgets, and local browser workspace smoke. The final build still reports advisory Vite chunk-size warnings while completing successfully.
- Restored the user’s ignored deployed-API browser configuration after local smoke testing; generated browser screenshots are temporary verification artifacts.
