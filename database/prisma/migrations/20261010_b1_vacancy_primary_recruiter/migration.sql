-- B1 (Roadmap v2 step 1): single job owner on vacancies.
-- Additive and non-destructive: nullable column, FK, index, then backfill.
-- Rollback (manual, see PR): DROP the FK, index and column (README.md in this folder).

-- 1. Nullable owner column.
ALTER TABLE "vacancies" ADD COLUMN "primaryRecruiterId" UUID;

-- 2. Index + FK (RESTRICT so an owner user can't be hard-deleted).
CREATE INDEX "vacancies_primaryRecruiterId_idx" ON "vacancies"("primaryRecruiterId");
ALTER TABLE "vacancies"
  ADD CONSTRAINT "vacancies_primaryRecruiterId_fkey"
  FOREIGN KEY ("primaryRecruiterId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Backfill from the active PRIMARY assignment. Only when there is exactly
--    one distinct active PRIMARY user, that user is Active, in the same
--    organization, and does not hold the ADMINISTRATOR role. Everything else
--    stays NULL and is listed by scripts/b1-backfill-report.cjs.
WITH primary_candidates AS (
  SELECT va."vacancyId", MIN(va."userId"::text)::uuid AS "userId", COUNT(DISTINCT va."userId") AS n
  FROM "vacancy_assignments" va
  WHERE va."isActive" = true AND va."assignmentKind" = 'PRIMARY'
  GROUP BY va."vacancyId"
)
UPDATE "vacancies" v
SET "primaryRecruiterId" = pc."userId"
FROM primary_candidates pc
JOIN "users" u ON u."id" = pc."userId"
WHERE v."id" = pc."vacancyId"
  AND pc.n = 1
  AND v."primaryRecruiterId" IS NULL
  AND u."status" = 'Active'
  AND u."organizationId" = v."organizationId"
  AND NOT EXISTS (
    SELECT 1 FROM "user_roles" ur JOIN "roles" r ON r."id" = ur."roleId"
    WHERE ur."userId" = u."id" AND r."code" = 'ADMINISTRATOR'
  );
