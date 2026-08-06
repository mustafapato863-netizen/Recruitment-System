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
- The generated Prisma client is owned by `@recruitflow/database` and is recreated under the ignored `database/generated/` directory.
- The initial migration has been reviewed and applied to the new local `Recruitment_DB`; the database diff is now empty and no destructive table operation was used.
- Keep `VACANCY_CORE_ADAPTER=in-memory` as the safe default; introduce the Prisma adapter only after generated client and migration checks pass.
- Confirmed at runtime that constructing `PrismaClient` succeeds after generation; the earlier initialization error was caused by missing generated artifacts.
- Windows has a Zscaler Root CA installed in both the user and machine root stores, while Node/npm have no custom CA configured; this is a viable certificate-chain repair path without disabling TLS.
- The root `db:generate` script ran Prisma from the workspace root, causing Prisma's package auto-install step to target the wrong package. Prisma generation should run from `apps/api`, where `@prisma/client` is declared.
- The repeated `pnpm add` message is emitted by the `@prisma/client` lifecycle path when `.prisma/client` is still absent; generated output must be verified after the lifecycle completes, not based on the initial schema-loaded message.

## Prisma integration result

- The Windows Zscaler root certificate was exported only to the current process through `NODE_EXTRA_CA_CERTS`; TLS verification remained enabled.
- Prisma `6.19.3` now generates successfully through the `database` workspace package when `PRISMA_GENERATE_SKIP_AUTOINSTALL=1` is set.
- The generated client is intentionally owned and exported by `@recruitflow/database`; this avoids pnpm virtual-store instances being generated for one workspace and imported from another.
- `PrismaService` and `PrismaVacancyCoreRepository` are available behind `VACANCY_CORE_ADAPTER=prisma`. The default remains in-memory until migration and seed data are applied.
- A `CodeSequence` model was added so request and vacancy business codes can increment atomically through PostgreSQL instead of relying on process-local counters.
- The target `Recruitment_DB` was audited with Prisma `migrate diff` before mutation: it had no project tables, the diff contained 15 table creations, and no `DROP TABLE`/`DROP COLUMN` operations.
- The initial migration is stored at `database/prisma/migrations/20260806_init/migration.sql`; the seed uses idempotent upserts and does not delete or overwrite existing reference values.

## Full-product planning decision

- The bootstrap plan phases are not the same as full product delivery phases. The repository is currently at the end of foundation setup and the first Vacancy Core vertical slice.
- The next controlled phase is Identity/Access/Master Data. Candidate, Application, Interview, Offer, Hiring, Joining, Analytics, Administration, Mobile, and Release phases remain separate and must not be merged into one unreviewable task.
- Each phase in `docs/development/implementation-roadmap.md` has explicit scope, out-of-scope boundaries, dependencies, and acceptance gates for team handoff.
