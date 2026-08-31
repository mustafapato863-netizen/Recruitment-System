# RecruitFlow database package

This workspace package owns the canonical PostgreSQL schema and the generated Prisma client.

## Commands

```powershell
pnpm --dir database prisma:format
pnpm --dir database prisma:validate
pnpm --dir database prisma:generate
pnpm --dir database prisma:migrate:deploy
pnpm --dir database prisma:seed
```

The API imports `PrismaClient` from `@recruitflow/database`. Generated files are written to `database/generated/` and are intentionally ignored by Git, so run `pnpm db:generate` after installing dependencies or cloning the repository. Database commands automatically read the root `.env` file.

The schema includes the Vacancy Core entities and a `CodeSequence` table for collision-safe business codes. Applying migrations and seeding reference data are separate, explicit database operations; the repository bootstrap does not mutate PostgreSQL.

The initial migration creates 15 tables and is safe for the new empty database checked during bootstrap. The seed is idempotent: it uses `upsert` with empty update clauses and never deletes rows or overwrites existing reference values.
