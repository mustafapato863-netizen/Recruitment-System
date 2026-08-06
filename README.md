# RecruitFlow

RecruitFlow is an internal recruitment and hiring management system. The project is a single monorepo containing independently buildable frontend, API, and worker applications.

Start with [the documentation index](docs/README.md), then read [development setup](docs/development/setup.md) and [the approved reference pack](docs/reference/README.md).

## Repository layout

```text
apps/web/          React + Vite application
apps/api/          NestJS modular API
apps/worker/       Background jobs and scheduled work
packages/contracts Shared API and domain contracts
packages/config    Typed environment/config helpers
packages/validation Shared Zod validation schemas
packages/design-system Shared UI tokens and primitives
database/          Prisma package, PostgreSQL schema, and generated client
docs/              Architecture, setup, design, and references
```

The frontend and backend live in one repository but remain independently buildable and deployable.

## Local setup

1. Install Node.js 24 and pnpm 11.
2. Copy `.env.example` to `.env` and fill in local values. Never commit `.env`.
3. Install dependencies with `pnpm install`.
4. Generate the Prisma client with `pnpm db:generate`.
5. Start the API with `pnpm dev:api`.
6. Start the frontend with `pnpm dev:web`.

## Initial foundation

The first implementation slice is Foundation plus Vacancy Core: identity and access foundations, organization/position data, vacancy requests, approval routes, vacancy conversion, assignment, headcount, and governed status transitions.

Business rules are enforced server-side. PostgreSQL is the system of record; private files will use S3-compatible object storage, and long-running work will use Redis/BullMQ workers. The API starts with `VACANCY_CORE_ADAPTER=in-memory`; switch it to `prisma` only after the database schema has been migrated and seed data exists.
