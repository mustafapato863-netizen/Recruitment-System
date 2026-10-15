-- Private screen draft: one row per organization, user, and application.
-- CreateTable
CREATE TABLE "screening_drafts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "outcome" VARCHAR(40) NOT NULL,
    "notes" TEXT,
    "notice_period_days" INTEGER,
    "method" VARCHAR(80),
    "evidence_source" VARCHAR(500),
    "next_step" VARCHAR(200),
    "move_to_interview" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screening_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "screening_drafts_organization_id_user_id_application_id_key" ON "screening_drafts"("organization_id", "user_id", "application_id");

-- AddForeignKey
ALTER TABLE "screening_drafts" ADD CONSTRAINT "screening_drafts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_drafts" ADD CONSTRAINT "screening_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_drafts" ADD CONSTRAINT "screening_drafts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
