# RecruitFlow version-one implementation baseline

Recorded 8 September 2026 by the Luna implementation agent before Phase 0 changes.

## Repository state

- Branch: `main`
- Worktree: already dirty with 102 tracked files modified and numerous untracked audit, migration, fixture and test artifacts. These predate this implementation and are preserved in place.
- Authoritative scope: [version-one-simplification-plan.md](version-one-simplification-plan.md).
- Existing planning files (`task_plan.md`, `findings.md`, `progress.md`) contain prior audit history and remain user-owned; this implementation appends only scoped evidence.
- Running processes at baseline included several Node processes from prior local API/web/worker sessions. Their ports/build identities must be checked before verification; no process was stopped by this baseline capture.

## Affected-surface inventory

- Web shell/navigation and routes: `apps/web/src/App.tsx`, `apps/web/src/layout/AppShell.tsx`, `apps/web/src/pages/*`, quick actions and command palette.
- Candidate/profile/activity: candidate and application pages, activity panel, tasks client/API, screening and document flows.
- Interviews: `apps/api/src/interviews/*`, `apps/web/src/components/candidate/ScheduleInterviewModal.tsx`, interview detail/calendar pages.
- My Work/tasks: `apps/api/src/tasks/*`, dashboard/employee dashboard and task response normalization.
- Candidate persistence/import: `apps/api/src/candidates/*`, `apps/api/src/import/*`, public apply, documents, Prisma candidate/application models and web CV intake.
- Master Data: `apps/api/src/master-data/*`, `apps/web/src/pages/MasterDataPage.tsx`, Prisma branch/department/job-title/skill/source/interview-type entities and their dependent selectors.
- Authorization/session: auth client/context, permission guards, tenant scoping and refresh behavior.

## Baseline acceptance risks

1. Candidate email is currently required by at least one persisted/API path; phone-only entry must be coordinated across schema, DTOs, import, public apply and deduplication while retaining populated-email uniqueness.
2. Candidate activity attribution must use the actual completer for completed tasks and retain reschedule history; task assignee is not a substitute.
3. Master Data branch records require `legalEntityId`; a simplified grid must preserve that relationship and tenant scope.
4. Earlier audits report CSS/design-token budget failures and possible long-session 401 bursts. These remain explicit verification gates and must not be hidden by threshold changes or blind re-login.

## Pre-existing changed-file manifest

The complete machine-readable baseline is the `git status --short` output captured in the parent task log immediately before this file was added. Any files reported as modified after this baseline are not automatically Luna-owned: compare the final status against this manifest and the implementation-owned list in the handoff.
