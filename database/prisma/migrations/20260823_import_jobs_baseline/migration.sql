-- The bulk-import migration alters this table before schema reconciliation
-- creates it. Establish the same baseline first without rewriting applied SQL.
-- Existing databases already contain the table and are left unchanged.
-- Indexes and foreign keys are added by 20260825_schema_reconciliation.
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
