# Development setup

## Prerequisites

- Node.js 24 LTS
- pnpm 11
- PostgreSQL 18 (or the approved compatible local version)
- Redis for worker jobs when those jobs are enabled

## First run

```powershell
Copy-Item .env.example .env
pnpm install
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev:api
pnpm dev:web
```

For a complete local walkthrough across the frontend, use the deterministic fixtures documented in [Local demo data](./demo-data.md).

Keep real credentials only in the untracked `.env` file. Never commit `.env`, database dumps, uploaded files, or production data.

## Database adapter

`database/` is the Prisma workspace package. It owns the canonical schema and exports the generated client to the API. The generated files under `database/generated/` are ignored and must be recreated after a clean checkout:

```powershell
pnpm db:generate
```

The API defaults to `VACANCY_CORE_ADAPTER=prisma`; PostgreSQL is the runtime source of truth. `VACANCY_CORE_ADAPTER=in-memory` is reserved for explicit isolated tests and must not be used for release verification or to hide unavailable database records. `db:migrate:deploy` and `db:seed` are explicit database writes; review `DATABASE_URL` before running them.

## Quality checks

```powershell
pnpm lint
pnpm lint:web
pnpm typecheck
pnpm build
```

Prisma commands require a working certificate chain so Prisma can download its platform engine on first use. On Windows machines with an enterprise TLS inspection certificate, configure Node to trust the approved local CA without disabling TLS verification. `pnpm db:validate` also requires `DATABASE_URL` to be present in the environment, but validation itself does not connect to PostgreSQL.
