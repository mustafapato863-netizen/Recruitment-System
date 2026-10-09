-- Rollback for 20261010_b3_req_job_lifecycle. Scratch/staging only. Run, then
-- DELETE FROM "_prisma_migrations" WHERE migration_name = '20261010_b3_req_job_lifecycle';
-- Restores the pre-B3 job/requisition statuses recorded by the migration's history rows.
-- Status changes made by the app after B3 (hold/reopen/cancel cascade) are NOT reverted;
-- their history rows are lost with the table.

-- (4b) requisitions that were Approved with a live job
UPDATE "vacancy_requests" r SET "status" = 'Approved'
FROM "vacancies" v JOIN "vacancy_status_histories" h ON h."vacancyId" = v."id"
WHERE v."vacancyRequestId" = r."id" AND h."reason" = 'B3 migration: requisition Approved -> Converted to Vacancy (job already live)';

-- (4) placeholder jobs back to Pending Activation, requisitions back to their old status
UPDATE "vacancies" v SET "status" = 'Pending Activation'
FROM "vacancy_status_histories" h
WHERE h."vacancyId" = v."id" AND h."reason" LIKE 'B3 migration: Pending Activation -> requisition Approved%' AND v."status" = 'Closed';
UPDATE "vacancy_requests" r SET "status" = split_part(h."reason", 'requisition was ', 2)
FROM "vacancies" v JOIN "vacancy_status_histories" h ON h."vacancyId" = v."id"
WHERE v."vacancyRequestId" = r."id" AND h."reason" LIKE 'B3 migration: Pending Activation -> requisition Approved%' AND r."status" = 'Approved';

-- (3) Open back to Pending Activation
UPDATE "vacancies" v SET "status" = 'Pending Activation'
FROM "vacancy_status_histories" h
WHERE h."vacancyId" = v."id" AND h."reason" LIKE 'B3 migration: Pending Activation -> Open%' AND v."status" = 'Open';

-- (2) Filled back to Closed
UPDATE "vacancies" v SET "status" = 'Closed'
FROM "vacancy_status_histories" h
WHERE h."vacancyId" = v."id" AND h."reason" = 'B3 migration: filled job Closed -> Filled' AND v."status" = 'Filled';

-- (1) Closed back to Cancelled; requisition back to its old status
UPDATE "vacancy_requests" r SET "status" = split_part(h."reason", 'requisition was ', 2)
FROM "vacancies" v JOIN "vacancy_status_histories" h ON h."vacancyId" = v."id"
WHERE v."vacancyRequestId" = r."id" AND h."reason" LIKE 'B3 migration: job Cancelled -> Closed%';
UPDATE "vacancies" v SET "status" = 'Cancelled'
FROM "vacancy_status_histories" h
WHERE h."vacancyId" = v."id" AND h."reason" LIKE 'B3 migration: job Cancelled -> Closed%' AND v."status" = 'Closed';

-- schema
DROP TABLE "vacancy_status_histories";
ALTER TABLE "vacancy_requests" DROP CONSTRAINT "vacancy_requests_gradeId_fkey";
ALTER TABLE "vacancy_requests" DROP CONSTRAINT "vacancy_requests_assignedEmployeeId_fkey";
ALTER TABLE "vacancy_requests" DROP COLUMN "activatedAt", DROP COLUMN "assignedEmployeeId", DROP COLUMN "cancelReason", DROP COLUMN "cancelledAt", DROP COLUMN "gradeId";
ALTER TABLE "vacancies" ALTER COLUMN "status" SET DEFAULT 'Pending Activation';
