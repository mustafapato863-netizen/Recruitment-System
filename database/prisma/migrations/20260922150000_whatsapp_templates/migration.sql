-- CreateTable
CREATE TABLE IF NOT EXISTS "whatsapp_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(50) NOT NULL DEFAULT 'misc',
    "interviewType" VARCHAR(60) NOT NULL DEFAULT 'Any',
    "bodyTemplate" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(30) NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "whatsapp_templates_organizationId_status_idx" ON "whatsapp_templates"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "whatsapp_templates_organizationId_category_idx" ON "whatsapp_templates"("organizationId", "category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "whatsapp_templates_organizationId_interviewType_idx" ON "whatsapp_templates"("organizationId", "interviewType");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
