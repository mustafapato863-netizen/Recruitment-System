ALTER TABLE "vacancy_assignments"
  ADD COLUMN IF NOT EXISTS "assignmentKind" VARCHAR(20) NOT NULL DEFAULT 'PRIMARY';

ALTER TABLE "vacancy_assignments"
  DROP CONSTRAINT IF EXISTS "vacancy_assignments_vacancyId_userId_roleCode_isActive_key";

CREATE UNIQUE INDEX IF NOT EXISTS "vacancy_assignments_vacancyId_userId_roleCode_isActive_assignmentKind_key"
  ON "vacancy_assignments" ("vacancyId", "userId", "roleCode", "isActive", "assignmentKind");
