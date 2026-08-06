# RecruitFlow Findings

## Repository

- The supplied planning and UI/UX reference pack is now consolidated under `docs/reference/` so planning, UI/UX, and design-system guidance have clear ownership.
- The old `Refrence/` root name is no longer part of the tracked repository structure.
- The GitHub remote appears to be reachable and currently has no visible branch refs, consistent with a new/empty repository.
- No application bootstrap files such as `package.json`, `pnpm-lock.yaml`, `apps/`, or `src/` exist yet.

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
