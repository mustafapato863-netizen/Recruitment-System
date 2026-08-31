-- Reconcile operational models that were present in the Prisma schema but absent
-- from the historical migration chain. This migration is additive and idempotent
-- so it is safe for fresh installs and existing environments.

DROP INDEX IF EXISTS "notifications_organizationId_recipientUserId_createdAt_idx";
ALTER TABLE "notifications" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "tasks"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE TABLE IF NOT EXISTS "hiring_cases" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'Pending Compliance',
    "plannedJoiningDate" TIMESTAMPTZ(6),
    "actualJoiningDate" TIMESTAMPTZ(6),
    "ownerUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "hiring_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "compliance_requirements" (
    "id" UUID NOT NULL,
    "hiringCaseId" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'Pending',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "documentId" UUID,
    "expiryDate" TIMESTAMPTZ(6),
    "verifiedAt" TIMESTAMPTZ(6),
    "verifiedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "compliance_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hiring_case_approvals" (
    "id" UUID NOT NULL,
    "hiringCaseId" UUID NOT NULL,
    "roleCode" VARCHAR(80) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'Pending',
    "comment" TEXT,
    "approverUserId" UUID,
    "decidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "hiring_case_approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "talent_pools" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "tags" VARCHAR(100)[] NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "talent_pools_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "talent_pool_candidates" (
    "id" UUID NOT NULL,
    "talentPoolId" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "eligibility" VARCHAR(50) NOT NULL DEFAULT 'Eligible',
    "coolingOffUntil" TIMESTAMPTZ(6),
    "consentStatus" VARCHAR(30) NOT NULL DEFAULT 'Active',
    "consentExpiry" TIMESTAMPTZ(6),
    "source" VARCHAR(100),
    "addedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "talent_pool_candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "candidate_import_jobs" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'Validating',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "newRows" INTEGER NOT NULL DEFAULT 0,
    "updateRows" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "candidate_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "candidate_import_rows" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "firstName" VARCHAR(100),
    "lastName" VARCHAR(100),
    "email" VARCHAR(320),
    "phone" VARCHAR(30),
    "result" VARCHAR(30) NOT NULL DEFAULT 'Pending',
    "details" TEXT,
    "decision" VARCHAR(30),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "candidate_import_rows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pipeline_templates" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(30) NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "pipeline_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pipeline_stages" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "stageType" VARCHAR(50) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "slaDays" INTEGER,
    "defaultOwner" VARCHAR(100),
    "entryGate" VARCHAR(200),
    "exitGate" VARCHAR(200),
    "status" VARCHAR(30) NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "integrations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'Available',
    "configJson" JSONB,
    "lastSyncAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hiring_cases_applicationId_key" ON "hiring_cases"("applicationId");
CREATE UNIQUE INDEX IF NOT EXISTS "hiring_cases_offerId_key" ON "hiring_cases"("offerId");
CREATE INDEX IF NOT EXISTS "hiring_cases_organizationId_status_idx" ON "hiring_cases"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "hiring_cases_ownerUserId_status_idx" ON "hiring_cases"("ownerUserId", "status");
CREATE INDEX IF NOT EXISTS "compliance_requirements_hiringCaseId_idx" ON "compliance_requirements"("hiringCaseId");
CREATE INDEX IF NOT EXISTS "compliance_requirements_status_idx" ON "compliance_requirements"("status");
CREATE INDEX IF NOT EXISTS "hiring_case_approvals_hiringCaseId_idx" ON "hiring_case_approvals"("hiringCaseId");
CREATE INDEX IF NOT EXISTS "hiring_case_approvals_approverUserId_status_idx" ON "hiring_case_approvals"("approverUserId", "status");
CREATE INDEX IF NOT EXISTS "talent_pools_organizationId_status_idx" ON "talent_pools"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "talent_pool_candidates_candidateId_idx" ON "talent_pool_candidates"("candidateId");
CREATE UNIQUE INDEX IF NOT EXISTS "talent_pool_candidates_talentPoolId_candidateId_key" ON "talent_pool_candidates"("talentPoolId", "candidateId");
CREATE INDEX IF NOT EXISTS "candidate_import_jobs_organizationId_status_idx" ON "candidate_import_jobs"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "candidate_import_rows_jobId_result_idx" ON "candidate_import_rows"("jobId", "result");
CREATE INDEX IF NOT EXISTS "pipeline_templates_organizationId_status_idx" ON "pipeline_templates"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "pipeline_stages_templateId_sortOrder_idx" ON "pipeline_stages"("templateId", "sortOrder");
CREATE INDEX IF NOT EXISTS "integrations_organizationId_status_idx" ON "integrations"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "notifications_organizationId_recipientUserId_createdAt_idx" ON "notifications"("organizationId", "recipientUserId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hiring_cases_organizationId_fkey') THEN
    ALTER TABLE "hiring_cases" ADD CONSTRAINT "hiring_cases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hiring_cases_applicationId_fkey') THEN
    ALTER TABLE "hiring_cases" ADD CONSTRAINT "hiring_cases_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hiring_cases_offerId_fkey') THEN
    ALTER TABLE "hiring_cases" ADD CONSTRAINT "hiring_cases_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hiring_cases_ownerUserId_fkey') THEN
    ALTER TABLE "hiring_cases" ADD CONSTRAINT "hiring_cases_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_requirements_hiringCaseId_fkey') THEN
    ALTER TABLE "compliance_requirements" ADD CONSTRAINT "compliance_requirements_hiringCaseId_fkey" FOREIGN KEY ("hiringCaseId") REFERENCES "hiring_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_requirements_documentId_fkey') THEN
    ALTER TABLE "compliance_requirements" ADD CONSTRAINT "compliance_requirements_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "candidate_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_requirements_verifiedById_fkey') THEN
    ALTER TABLE "compliance_requirements" ADD CONSTRAINT "compliance_requirements_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hiring_case_approvals_hiringCaseId_fkey') THEN
    ALTER TABLE "hiring_case_approvals" ADD CONSTRAINT "hiring_case_approvals_hiringCaseId_fkey" FOREIGN KEY ("hiringCaseId") REFERENCES "hiring_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hiring_case_approvals_approverUserId_fkey') THEN
    ALTER TABLE "hiring_case_approvals" ADD CONSTRAINT "hiring_case_approvals_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'talent_pools_organizationId_fkey') THEN
    ALTER TABLE "talent_pools" ADD CONSTRAINT "talent_pools_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'talent_pool_candidates_talentPoolId_fkey') THEN
    ALTER TABLE "talent_pool_candidates" ADD CONSTRAINT "talent_pool_candidates_talentPoolId_fkey" FOREIGN KEY ("talentPoolId") REFERENCES "talent_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'talent_pool_candidates_candidateId_fkey') THEN
    ALTER TABLE "talent_pool_candidates" ADD CONSTRAINT "talent_pool_candidates_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candidate_import_jobs_organizationId_fkey') THEN
    ALTER TABLE "candidate_import_jobs" ADD CONSTRAINT "candidate_import_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candidate_import_jobs_uploadedById_fkey') THEN
    ALTER TABLE "candidate_import_jobs" ADD CONSTRAINT "candidate_import_jobs_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candidate_import_rows_jobId_fkey') THEN
    ALTER TABLE "candidate_import_rows" ADD CONSTRAINT "candidate_import_rows_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "candidate_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_templates_organizationId_fkey') THEN
    ALTER TABLE "pipeline_templates" ADD CONSTRAINT "pipeline_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_stages_templateId_fkey') THEN
    ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "pipeline_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integrations_organizationId_fkey') THEN
    ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
