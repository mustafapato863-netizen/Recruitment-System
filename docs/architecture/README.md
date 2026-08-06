# Architecture

RecruitFlow is a modular monolith in one repository. The frontend, API, and worker are separate deployable applications with shared contracts and validation packages.

```text
apps/web       React + Vite user interface
apps/api       NestJS REST API and business modules
apps/worker    BullMQ workers for long-running jobs
packages/*     Shared contracts, validation, configuration, and UI tokens
database      Prisma workspace package and PostgreSQL schema
docs/*         Architecture, setup, design, and approved references
```

## Dependency direction

- `apps/web` may depend on shared contracts, validation, and design-system packages.
- `apps/api` owns authorization, workflow rules, transactions, repositories, and audit behavior.
- `apps/worker` handles asynchronous work and must not become the source of truth for business state.
- `database/prisma` is accessed through API application services/repositories; controllers do not own database logic.
- `@recruitflow/database` owns Prisma client generation; the API consumes that package instead of resolving generated artifacts from a second workspace location.
- Cross-module operations that must be atomic stay inside one PostgreSQL transaction.

## System of record

PostgreSQL is authoritative for transactional data. Private CVs and hiring documents will use S3-compatible object storage. Redis/BullMQ is for queues, retries, delayed tasks, and selective caching only.
