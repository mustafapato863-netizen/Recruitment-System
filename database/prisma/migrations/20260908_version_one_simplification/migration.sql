-- Version-one simplification: preserve existing records while making contact
-- and interviewer profile metadata optional/snapshot-safe.
ALTER TABLE "candidates" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "jobTitle" VARCHAR(120);
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "interview_attendees" ADD COLUMN IF NOT EXISTS "jobTitle" VARCHAR(120);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completedById" UUID;
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "tasks_completedById_idx" ON "tasks"("completedById");

CREATE TABLE IF NOT EXISTS "master_data_values" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "category" VARCHAR(40) NOT NULL,
  "code" VARCHAR(80),
  "name" VARCHAR(200) NOT NULL,
  "metadata" JSONB,
  "status" VARCHAR(30) NOT NULL DEFAULT 'Active',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "master_data_values_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_data_values_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "master_data_values_organizationId_category_code_key" ON "master_data_values"("organizationId", "category", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "master_data_values_organizationId_category_name_key" ON "master_data_values"("organizationId", "category", "name");
CREATE INDEX IF NOT EXISTS "master_data_values_organizationId_category_status_idx" ON "master_data_values"("organizationId", "category", "status");
