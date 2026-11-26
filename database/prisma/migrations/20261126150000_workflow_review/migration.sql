BEGIN;
ALTER TABLE "organizations" ADD COLUMN "timezone" VARCHAR(80) NOT NULL DEFAULT 'Africa/Cairo';
ALTER TABLE "branches" ADD COLUMN "timezone" VARCHAR(80);
UPDATE "branches" SET "timezone" = CASE "country" WHEN 'ARE' THEN 'Asia/Dubai' WHEN 'SAU' THEN 'Asia/Riyadh' END
WHERE "country" IN ('ARE', 'SAU');
ALTER TABLE "offer_versions" ADD COLUMN "sendDates" TIMESTAMPTZ(6)[] NOT NULL DEFAULT '{}';

LOCK TABLE "candidates" IN SHARE ROW EXCLUSIVE MODE;
UPDATE "candidates" SET "emailNormalized" = rf_normalize_email("email")
WHERE "emailNormalized" IS NULL AND "email" IS NOT NULL;
UPDATE "candidates" SET "phoneNormalized" = rf_normalize_phone("phone", NULL)
WHERE "phoneNormalized" IS NULL AND "phone" IS NOT NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "candidates" WHERE "phoneNormalized" IS NULL AND "phone" IS NOT NULL
             AND rf_normalize_phone("phone", '966') IS NOT NULL) THEN
    RAISE EXCEPTION 'Run the existing contact-key repair with the configured country calling code before migrating.';
  END IF;
  IF EXISTS (SELECT 1 FROM "candidates" WHERE "phoneNormalized" IS NOT NULL GROUP BY "organizationId", "phoneNormalized" HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM "candidates" WHERE "emailNormalized" IS NOT NULL GROUP BY "organizationId", "emailNormalized" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Candidate contact keys conflict within an organization. Review the existing records before retrying this migration.';
  END IF;
END $$;
CREATE UNIQUE INDEX "candidates_organizationId_phoneNormalized_key" ON "candidates" ("organizationId", "phoneNormalized");
CREATE UNIQUE INDEX "candidates_organizationId_emailNormalized_key" ON "candidates" ("organizationId", "emailNormalized");
DROP INDEX "candidates_organizationId_phoneNormalized_idx";
DROP INDEX "candidates_organizationId_emailNormalized_idx";
COMMIT;
