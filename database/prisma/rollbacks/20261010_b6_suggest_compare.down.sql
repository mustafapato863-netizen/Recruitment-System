-- Rollback for 20261010_b6_suggest_compare (scratch/staging only). Then:
-- DELETE FROM "_prisma_migrations" WHERE migration_name = '20261010_b6_suggest_compare';
-- Drops evidence and candidate-skill links (free-text candidates.skills was never changed).
DROP FUNCTION IF EXISTS rf_normalize_phone(TEXT, TEXT);
DROP FUNCTION IF EXISTS rf_normalize_email(TEXT);
DROP TABLE IF EXISTS "candidate_skill_evidence";
DROP TABLE IF EXISTS "candidate_skills";
DROP INDEX IF EXISTS "candidates_organizationId_emailNormalized_idx";
DROP INDEX IF EXISTS "candidates_organizationId_phoneNormalized_idx";
ALTER TABLE "candidates" DROP COLUMN IF EXISTS "emailNormalized", DROP COLUMN IF EXISTS "phoneNormalized";
