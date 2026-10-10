-- Rollback for 20261010_b3b_req_department (run BEFORE 20261010_b3_req_job_lifecycle.down.sql).
ALTER TABLE "vacancy_requests" DROP CONSTRAINT IF EXISTS "vacancy_requests_departmentId_fkey";
ALTER TABLE "vacancy_requests" DROP COLUMN IF EXISTS "departmentId";

-- B2-M1: forget the migration too, so `prisma migrate deploy` re-applies it cleanly.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261010_b3b_req_department';
