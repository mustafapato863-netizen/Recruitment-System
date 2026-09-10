-- Legal Entity is no longer part of the recruiting domain. Branch codes now
-- belong directly to an organization, so fail clearly if legacy data would
-- violate the replacement uniqueness rule.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "branches"
    GROUP BY "organizationId", "code"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot remove Legal Entity: duplicate branch codes exist within an organization.';
  END IF;
END $$;

UPDATE "positions"
SET "metadata" = "metadata" - 'legalEntityId'
WHERE jsonb_typeof("metadata") = 'object'
  AND "metadata" ? 'legalEntityId';

ALTER TABLE "branches" DROP CONSTRAINT IF EXISTS "branches_legalEntityId_fkey";
ALTER TABLE "positions" DROP CONSTRAINT IF EXISTS "positions_legalEntityId_fkey";
ALTER TABLE "vacancy_requests" DROP CONSTRAINT IF EXISTS "vacancy_requests_legalEntityId_fkey";
ALTER TABLE "vacancies" DROP CONSTRAINT IF EXISTS "vacancies_legalEntityId_fkey";

DROP INDEX IF EXISTS "branches_legalEntityId_code_key";

ALTER TABLE "branches" DROP COLUMN IF EXISTS "legalEntityId";
ALTER TABLE "positions" DROP COLUMN IF EXISTS "legalEntityId";
ALTER TABLE "vacancy_requests" DROP COLUMN IF EXISTS "legalEntityId";
ALTER TABLE "vacancies" DROP COLUMN IF EXISTS "legalEntityId";

DROP TABLE IF EXISTS "legal_entities";

CREATE UNIQUE INDEX "branches_organizationId_code_key"
ON "branches"("organizationId", "code");
