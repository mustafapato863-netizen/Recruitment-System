# RecruitFlow Findings

## Repository

- The supplied planning and UI/UX reference pack is now consolidated under `docs/reference/` so planning, UI/UX, and design-system guidance have clear ownership.
- The old `Refrence/` root name is no longer part of the tracked repository structure.
- The GitHub remote appears to be reachable and currently has no visible branch refs, consistent with a new/empty repository.
- The repository now has a pnpm monorepo with independently buildable web, API, and worker applications.

## Approved baseline

- Frontend: React 19.2+, TypeScript strict mode, Vite, React Router, Tailwind CSS 4, shadcn/ui, TanStack Query, React Hook Form, Zod.
- Backend: NestJS modular monolith, REST/OpenAPI, Prisma, PostgreSQL 18.
- Async work: Redis + BullMQ worker.
- Testing: Vitest, React Testing Library, Supertest/Testcontainers, Playwright.

## Non-negotiable domain rules

- Position, Vacancy Request, Vacancy, Candidate, Application, Offer Version, and Hiring Case are separate concepts.
- Stage, source, recruiter, task owner, screening, interviews, offer, and outcome belong to the Application context.
- Primary Recruiter is distinct from Current Task Owner.
- Vacancy fulfillment is based on actual Joined records, not accepted offers.
- Approved/sent offer versions are immutable; material changes create a new version.
- Workflow enforcement and authorization are server-side; UI visibility is not security.
- Files are private, scanned/validated, versioned, and delivered only through temporary authorized access.
- Final Hiring Approver is configurable; no named user may be hard-coded into business logic.

## Initial implementation direction

- Start with Foundation plus Vacancy Core.
- First vertical flow: create vacancy request -> submit -> approval route -> approved request -> vacancy conversion -> assignment/headcount/status.

## Cleanup decisions

- Keep the complete UI prototype and source images as reference material, but move them out of the repository root.
- Keep the design-system implementation in `packages/design-system` and document the corresponding prototype screen instead of duplicating design assets.
- Remove Vite starter-only code/assets from the real application shell once the RecruitFlow shell is in place.
- The generated Vite starter page and its four unused assets were removed; `apps/web` now renders a RecruitFlow dashboard shell based on the approved visual direction.

## Vacancy Core implementation

- The Prisma schema already contains the first-slice entities: `VacancyRequest`, `VacancyRequestApproval`, `Vacancy`, and `VacancyAssignment`.
- The first runnable slice uses a repository interface so domain rules do not depend on Prisma client generation or a live database during local bootstrap.
- The API must enforce the state transitions server-side: Draft -> Pending Approval -> Approved/Rejected/Changes Requested, then Approved -> Converted to Vacancy.
- Conversion must be idempotent and preserve the approved headcount in the created vacancy.
- The web form uses the shared Zod schema; the Nest API uses class-validator DTOs so runtime metadata remains available to the global ValidationPipe.

## Prisma integration checkpoint

- The current API repository token can be switched without changing controllers or the domain service.
- The installed `@prisma/client` is not generated for this schema yet; model typings/runtime are unavailable until `prisma generate` completes.
- No migration directory exists yet, so no schema mutation should be attempted against the user's PostgreSQL database until the local Prisma engine/certificate issue is resolved.
- Keep `VACANCY_CORE_ADAPTER=in-memory` as the safe default; introduce the Prisma adapter only after generated client and migration checks pass.
- Confirmed at runtime that constructing `PrismaClient` fails immediately with `@prisma/client did not initialize yet`; this is a local tooling prerequisite, not an application code failure.
