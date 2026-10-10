-- B3: requisition and job lifecycle (v2 §3, §4, §7, §8, §10 step 2). NEVER run on prod without review.
-- Rollback: database/prisma/rollbacks/20261010_b3_req_job_lifecycle.down.sql

-- AlterTable
ALTER TABLE "vacancies" ALTER COLUMN "status" SET DEFAULT 'Open';

-- AlterTable
ALTER TABLE "vacancy_requests" ADD COLUMN     "activatedAt" TIMESTAMPTZ(6),
ADD COLUMN     "assignedEmployeeId" UUID,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMPTZ(6),
ADD COLUMN     "gradeId" UUID;

-- CreateTable
CREATE TABLE "vacancy_status_histories" (
    "id" UUID NOT NULL,
    "vacancyId" UUID NOT NULL,
    "fromStatus" VARCHAR(40),
    "toStatus" VARCHAR(40) NOT NULL,
    "reason" TEXT,
    "changedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vacancy_status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vacancy_status_histories_vacancyId_createdAt_idx" ON "vacancy_status_histories"("vacancyId", "createdAt");

-- AddForeignKey
ALTER TABLE "vacancy_requests" ADD CONSTRAINT "vacancy_requests_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "master_data_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_requests" ADD CONSTRAINT "vacancy_requests_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_status_histories" ADD CONSTRAINT "vacancy_status_histories_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "vacancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_status_histories" ADD CONSTRAINT "vacancy_status_histories_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Data mapping ──────────────────────────────────────────────
-- Every mapped job gets a vacancy_status_histories row whose reason starts with
-- 'B3 migration' and records the previous requisition status, so the rollback
-- script can restore the old state exactly.

-- (1) Job Cancelled -> Closed; its requisition becomes Cancelled (v2 §3: Cancelled lives on the requisition).
INSERT INTO "vacancy_status_histories" ("id", "vacancyId", "fromStatus", "toStatus", "reason", "createdAt")
SELECT gen_random_uuid(), v."id", 'Cancelled', 'Closed', 'B3 migration: job Cancelled -> Closed; requisition was ' || r."status", CURRENT_TIMESTAMP
FROM "vacancies" v JOIN "vacancy_requests" r ON r."id" = v."vacancyRequestId"
WHERE v."status" = 'Cancelled';

UPDATE "vacancy_requests" r SET "status" = 'Cancelled',
  "cancelledAt" = COALESCE(r."cancelledAt", CURRENT_TIMESTAMP),
  "cancelReason" = COALESCE(r."cancelReason", 'B3 migration: job was Cancelled')
FROM "vacancies" v WHERE v."vacancyRequestId" = r."id" AND v."status" = 'Cancelled' AND r."status" <> 'Cancelled';

UPDATE "vacancies" SET "status" = 'Closed' WHERE "status" = 'Cancelled';

-- (2) Job Closed because it was filled (pre-B3 fill wrote Closed) -> Filled.
INSERT INTO "vacancy_status_histories" ("id", "vacancyId", "fromStatus", "toStatus", "reason", "createdAt")
SELECT gen_random_uuid(), v."id", 'Closed', 'Filled', 'B3 migration: filled job Closed -> Filled', CURRENT_TIMESTAMP
FROM "vacancies" v WHERE v."status" = 'Closed' AND v."approvedHeadcount" > 0 AND v."joinedHeadcount" >= v."approvedHeadcount"
  AND NOT EXISTS (SELECT 1 FROM "vacancy_status_histories" h WHERE h."vacancyId" = v."id");
UPDATE "vacancies" v SET "status" = 'Filled'
WHERE v."status" = 'Closed' AND v."approvedHeadcount" > 0 AND v."joinedHeadcount" >= v."approvedHeadcount"
  AND EXISTS (SELECT 1 FROM "vacancy_status_histories" h WHERE h."vacancyId" = v."id" AND h."reason" = 'B3 migration: filled job Closed -> Filled');

-- (3) Pending Activation with an active PRIMARY owner and a job summary -> Open (it was only waiting on the old dead end).
WITH ready AS (
  SELECT v."id" FROM "vacancies" v
  WHERE v."status" = 'Pending Activation' AND COALESCE(btrim(v."jobSummary"), '') <> ''
    AND EXISTS (SELECT 1 FROM "vacancy_assignments" a WHERE a."vacancyId" = v."id" AND a."isActive" AND a."assignmentKind" = 'PRIMARY')
)
INSERT INTO "vacancy_status_histories" ("id", "vacancyId", "fromStatus", "toStatus", "reason", "createdAt")
SELECT gen_random_uuid(), ready."id", 'Pending Activation', 'Open', 'B3 migration: Pending Activation -> Open (owner and summary present)', CURRENT_TIMESTAMP FROM ready;
UPDATE "vacancies" v SET "status" = 'Open', "openedAt" = COALESCE(v."openedAt", CURRENT_TIMESTAMP)
WHERE v."status" = 'Pending Activation'
  AND EXISTS (SELECT 1 FROM "vacancy_status_histories" h WHERE h."vacancyId" = v."id" AND h."reason" LIKE 'B3 migration: Pending Activation -> Open%');

-- (4) Remaining Pending Activation -> requisition-side state: requisition back to Approved
--     (approved, not yet activated). The placeholder job row is kept (no deletes) as Closed
--     and is reused when the requisition is activated.
INSERT INTO "vacancy_status_histories" ("id", "vacancyId", "fromStatus", "toStatus", "reason", "createdAt")
SELECT gen_random_uuid(), v."id", 'Pending Activation', 'Closed', 'B3 migration: Pending Activation -> requisition Approved (not activated); requisition was ' || r."status", CURRENT_TIMESTAMP
FROM "vacancies" v JOIN "vacancy_requests" r ON r."id" = v."vacancyRequestId"
WHERE v."status" = 'Pending Activation';
UPDATE "vacancy_requests" r SET "status" = 'Approved', "activatedAt" = NULL
FROM "vacancies" v WHERE v."vacancyRequestId" = r."id" AND v."status" = 'Pending Activation' AND r."status" = 'Converted to Vacancy';
UPDATE "vacancies" SET "status" = 'Closed' WHERE "status" = 'Pending Activation';

-- (4b) Requisitions still marked Approved although their job is already live
--      (pre-B3 data drift): they were activated, so mark them Converted to Vacancy.
INSERT INTO "vacancy_status_histories" ("id", "vacancyId", "fromStatus", "toStatus", "reason", "createdAt")
SELECT gen_random_uuid(), v."id", v."status", v."status", 'B3 migration: requisition Approved -> Converted to Vacancy (job already live)', CURRENT_TIMESTAMP
FROM "vacancies" v JOIN "vacancy_requests" r ON r."id" = v."vacancyRequestId"
WHERE r."status" = 'Approved' AND v."status" IN ('Open', 'On Hold', 'Partially Filled', 'Filled');
UPDATE "vacancy_requests" r SET "status" = 'Converted to Vacancy'
FROM "vacancies" v WHERE v."vacancyRequestId" = r."id" AND r."status" = 'Approved' AND v."status" IN ('Open', 'On Hold', 'Partially Filled', 'Filled');

-- (5) Activated requisitions: activatedAt = job openedAt/createdAt.
UPDATE "vacancy_requests" r SET "activatedAt" = COALESCE(v."openedAt", v."createdAt")
FROM "vacancies" v WHERE v."vacancyRequestId" = r."id" AND r."status" = 'Converted to Vacancy' AND r."activatedAt" IS NULL;

-- (6) Assigned employee = the job's active PRIMARY owner when that user is active and not an administrator.
UPDATE "vacancy_requests" r SET "assignedEmployeeId" = a."userId"
FROM "vacancies" v JOIN "vacancy_assignments" a ON a."vacancyId" = v."id" AND a."isActive" AND a."assignmentKind" = 'PRIMARY'
JOIN "users" u ON u."id" = a."userId" AND u."status" = 'Active'
WHERE v."vacancyRequestId" = r."id" AND r."assignedEmployeeId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "user_roles" ur JOIN "roles" ro ON ro."id" = ur."roleId" WHERE ur."userId" = a."userId" AND ro."code" = 'ADMINISTRATOR');

-- Hire-target tasks (v2 §8) are not rewritten here: their seats already live on the
-- requisition (requestedHeadcount) and the target chip moves in B4. Counts are in the mapping report.


-- B3 (E3 gaps): optional hold-until date on the job and in its history (data only, no auto-reopen).
ALTER TABLE "vacancies" ADD COLUMN "holdUntil" DATE;
ALTER TABLE "vacancy_status_histories" ADD COLUMN "holdUntil" DATE;

-- B3 (E3 gaps): master-data reason lists for hold and close (deactivate-only), minimal set per org.
INSERT INTO "master_data_values" ("id", "organizationId", "category", "code", "name", "status", "version", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", v.category, v.code, v.name, 'Active', 1, now(), now()
FROM "organizations" o
CROSS JOIN (VALUES
  ('hold-reasons', 'BUDGET_REVIEW', 'Budget review'),
  ('hold-reasons', 'HIRING_FREEZE', 'Hiring freeze'),
  ('hold-reasons', 'ROLE_UNDER_REVIEW', 'Role under review'),
  ('hold-reasons', 'AWAITING_INTERNAL_CANDIDATE', 'Awaiting internal candidate'),
  ('hold-reasons', 'OTHER', 'Other'),
  ('close-reasons', 'POSITION_NO_LONGER_NEEDED', 'Position no longer needed'),
  ('close-reasons', 'BUDGET_WITHDRAWN', 'Budget withdrawn'),
  ('close-reasons', 'FILLED_INTERNALLY', 'Filled internally'),
  ('close-reasons', 'OTHER', 'Other')
) AS v(category, code, name)
ON CONFLICT DO NOTHING;
