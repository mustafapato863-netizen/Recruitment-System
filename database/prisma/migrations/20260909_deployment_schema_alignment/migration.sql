-- The earlier assignment-kind migration tried DROP CONSTRAINT, but this is an index.
-- Keep assignment-kind uniqueness and remove only the obsolete stronger rule.
DROP INDEX IF EXISTS "vacancy_assignments_vacancyId_userId_roleCode_isActive_key";
DROP INDEX IF EXISTS "vacancy_assignments_vacancyId_userId_roleCode_isActive_assignmentKind_key";
CREATE UNIQUE INDEX IF NOT EXISTS "vacancy_assignments_vacancyId_userId_roleCode_isActive_assi_key"
  ON "vacancy_assignments" ("vacancyId", "userId", "roleCode", "isActive", "assignmentKind");
