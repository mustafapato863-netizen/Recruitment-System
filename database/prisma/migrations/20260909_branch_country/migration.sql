-- Branches are now organized by country in the first-version workflow.
-- Keep legal entity data nullable for compatibility with existing records and
-- integrations, but stop requiring it for new branch records.
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "country" VARCHAR(3) NOT NULL DEFAULT 'EGY';
UPDATE "branches"
SET "country" = 'UAE'
WHERE LOWER(COALESCE("city", '')) IN ('dubai', 'ajman', 'sharjah', 'ras al khaimah', 'abu dhabi');
ALTER TABLE "branches" ALTER COLUMN "legalEntityId" DROP NOT NULL;
