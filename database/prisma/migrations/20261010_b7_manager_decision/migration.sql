-- B7: grade bands (master data), OFFER_PAY_VIEW permission, manager decisions on offer
-- versions, file reassignment history. NEVER run on prod without review.
-- Rollback: database/prisma/rollbacks/20261010_b7_manager_decision.down.sql
-- CreateTable
CREATE TABLE "grade_bands" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "gradeId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "minMonthlyBase" DECIMAL(12,2) NOT NULL,
    "maxMonthlyBase" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grade_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_version_decisions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "offerVersionId" UUID NOT NULL,
    "decision" VARCHAR(30) NOT NULL,
    "fromStatus" VARCHAR(30) NOT NULL,
    "toStatus" VARCHAR(30) NOT NULL,
    "reason" TEXT,
    "decidedById" UUID NOT NULL,
    "gradeBandId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_version_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_reassignments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "fromUserId" UUID,
    "toUserId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "reassignedById" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_reassignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grade_bands_organizationId_gradeId_branchId_currency_status_idx" ON "grade_bands"("organizationId", "gradeId", "branchId", "currency", "status");

-- CreateIndex
CREATE INDEX "offer_version_decisions_offerVersionId_createdAt_idx" ON "offer_version_decisions"("offerVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "file_reassignments_applicationId_createdAt_idx" ON "file_reassignments"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "file_reassignments_organizationId_batchId_idx" ON "file_reassignments"("organizationId", "batchId");

-- AddForeignKey
ALTER TABLE "grade_bands" ADD CONSTRAINT "grade_bands_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_bands" ADD CONSTRAINT "grade_bands_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "master_data_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_bands" ADD CONSTRAINT "grade_bands_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_version_decisions" ADD CONSTRAINT "offer_version_decisions_offerVersionId_fkey" FOREIGN KEY ("offerVersionId") REFERENCES "offer_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_version_decisions" ADD CONSTRAINT "offer_version_decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_reassignments" ADD CONSTRAINT "file_reassignments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_reassignments" ADD CONSTRAINT "file_reassignments_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_reassignments" ADD CONSTRAINT "file_reassignments_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_reassignments" ADD CONSTRAINT "file_reassignments_reassignedById_fkey" FOREIGN KEY ("reassignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Band sanity (overlap is enforced in the API under an advisory lock).
ALTER TABLE "grade_bands" ADD CONSTRAINT "grade_bands_min_le_max" CHECK ("minMonthlyBase" >= 0 AND "minMonthlyBase" <= "maxMonthlyBase");
ALTER TABLE "grade_bands" ADD CONSTRAINT "grade_bands_currency_upper" CHECK ("currency" ~ '^[A-Z]{3}$');

-- OFFER_PAY_VIEW: offer pay (base, package, component amounts). Distinct from VIEW_CURRENT_SALARY.
INSERT INTO "permissions" ("id", "code", "name", "description", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'OFFER_PAY_VIEW', 'View offer pay', 'See offer base pay, package and component amounts. Current/expected salary still needs VIEW_CURRENT_SALARY.', now(), now())
ON CONFLICT ("code") DO NOTHING;

-- Managers get it (v2 §7: pay visible to Manager only). Admin does NOT.
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE p."code" = 'OFFER_PAY_VIEW' AND r."code" IN ('HR_MANAGER', 'HIRING_MANAGER', 'TALENT_MANAGER')
ON CONFLICT DO NOTHING;
