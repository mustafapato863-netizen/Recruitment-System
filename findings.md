# RecruitFlow Findings

## Repository

- The workspace currently contains the supplied planning and UI/UX reference pack under `Refrence/`.
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

