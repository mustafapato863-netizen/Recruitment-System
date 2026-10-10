-- Rollback for 20261010_b5b_file_followups (scratch/staging only). Then:
-- DELETE FROM "_prisma_migrations" WHERE migration_name = '20261010_b5b_file_followups';
-- compliance_requirements were never changed, so dropping the typed checks loses only
-- verifications recorded after the migration (and follow-up dates / send metadata).
DROP TABLE IF EXISTS "joining_checks";
ALTER TABLE "offer_versions" DROP COLUMN IF EXISTS "sentChannel", DROP COLUMN IF EXISTS "sentTemplateId", DROP COLUMN IF EXISTS "sentAt", DROP COLUMN IF EXISTS "sentById";
ALTER TABLE "applications" DROP COLUMN IF EXISTS "followUpDate";
