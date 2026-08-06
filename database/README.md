# RecruitFlow database package

This workspace package owns the canonical PostgreSQL schema and the generated Prisma client.

## Commands

```powershell
pnpm --dir database prisma:format
pnpm --dir database prisma:validate
pnpm --dir database prisma:generate
```

The API imports `PrismaClient` from `@recruitflow/database`. Generated files are written to `database/generated/` and are intentionally ignored by Git, so run `pnpm db:generate` after installing dependencies or cloning the repository.

The schema includes the Vacancy Core entities and a `CodeSequence` table for collision-safe business codes. Applying migrations and seeding reference data are separate, explicit database operations; the repository bootstrap does not mutate PostgreSQL.
