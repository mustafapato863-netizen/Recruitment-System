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
pnpm dev:api
pnpm dev:web
```

Keep real credentials only in the untracked `.env` file. Never commit `.env`, database dumps, uploaded files, or production data.

## Quality checks

```powershell
pnpm lint
pnpm lint:web
pnpm typecheck
pnpm build
```

Prisma commands require a working certificate chain so Prisma can download its platform engine on first use. Database migrations will be added only after the schema has passed Prisma validation and the connection has been tested.
