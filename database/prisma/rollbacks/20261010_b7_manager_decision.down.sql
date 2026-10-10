-- Rollback for 20261010_b7_manager_decision (scratch/staging only). Then:
-- Drops bands, decision and reassignment history (application owners already moved stay moved;
-- the audit log keeps every decision and reassignment).
DELETE FROM "role_permissions" WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code" = 'OFFER_PAY_VIEW');
DELETE FROM "permissions" WHERE "code" = 'OFFER_PAY_VIEW';
DROP TABLE IF EXISTS "file_reassignments";
DROP TABLE IF EXISTS "offer_version_decisions";
DROP TABLE IF EXISTS "grade_bands";

-- B2-M1: forget the migration too, so `prisma migrate deploy` re-applies it cleanly.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261010_b7_manager_decision';
