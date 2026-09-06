-- Phase C: Stage Automation — tenant-scoped email templates + stage automation fields.
-- - New `email_templates` table (seeded per-organization at runtime by EmailTemplatesService).
-- - `pipeline_stages` gains emailTemplateId (SET NULL), autoMoveToStageId (reserved),
--   folded, isHiredStage, tooltip.
-- - `application_notes.authorId` becomes nullable (NULL author = system/automation actor).

-- AlterTable
ALTER TABLE "application_notes" ALTER COLUMN "authorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(50) NOT NULL DEFAULT 'stage_auto',
    "subject" VARCHAR(500) NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(30) NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_templates_organizationId_status_idx" ON "email_templates"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_templates_organizationId_category_idx" ON "email_templates"("organizationId", "category");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_organizationId_fkey'
  ) THEN
    ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "pipeline_stages" ADD COLUMN IF NOT EXISTS "emailTemplateId" UUID;
ALTER TABLE "pipeline_stages" ADD COLUMN IF NOT EXISTS "autoMoveToStageId" UUID;
ALTER TABLE "pipeline_stages" ADD COLUMN IF NOT EXISTS "folded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pipeline_stages" ADD COLUMN IF NOT EXISTS "isHiredStage" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pipeline_stages" ADD COLUMN IF NOT EXISTS "tooltip" VARCHAR(500);

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_stages_emailTemplateId_fkey'
  ) THEN
    ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_emailTemplateId_fkey" FOREIGN KEY ("emailTemplateId") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
