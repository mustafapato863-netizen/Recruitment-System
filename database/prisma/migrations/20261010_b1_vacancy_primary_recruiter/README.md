# 20261010_b1_vacancy_primary_recruiter

Adds `vacancies.primaryRecruiterId` (nullable, FK users ON DELETE RESTRICT, indexed) and
backfills it from the single active PRIMARY `vacancy_assignments` row when that user is
Active, in the same organization and not an ADMINISTRATOR. Other jobs stay NULL.

Report: `DATABASE_URL=... node scripts/b1-backfill-report.cjs [--out file]` (read-only).

Rollback (manual; Prisma has no down migrations). Run in a transaction, then delete the
`_prisma_migrations` row for this migration and revert the schema change:

```sql
BEGIN;
ALTER TABLE "vacancies" DROP CONSTRAINT IF EXISTS "vacancies_primaryRecruiterId_fkey";
DROP INDEX IF EXISTS "vacancies_primaryRecruiterId_idx";
ALTER TABLE "vacancies" DROP COLUMN IF EXISTS "primaryRecruiterId";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261010_b1_vacancy_primary_recruiter';
COMMIT;
```

No data outside the new column is touched; vacancy_assignments rows are unchanged.

**Do not run on production without Mustafa's explicit approval.**
