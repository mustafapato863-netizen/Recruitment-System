-- Migration: JD Extraction, ATS Scoring, and Scorecard Criteria Ratings

ALTER TABLE "vacancy_requests" ADD COLUMN IF NOT EXISTS "jdCriteria" JSONB;
ALTER TABLE "vacancies" ADD COLUMN IF NOT EXISTS "jdCriteria" JSONB;
ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "parsedProfile" JSONB;

ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "atsScore" DECIMAL(5, 2);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "atsBreakdown" JSONB;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "atsKnockoutPass" BOOLEAN DEFAULT true;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "atsScoredAt" TIMESTAMPTZ(6);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "atsVersion" VARCHAR(30);

CREATE TABLE IF NOT EXISTS "vacancy_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "vacancyRequestId" UUID,
    "vacancyId" UUID,
    "documentType" VARCHAR(60) NOT NULL DEFAULT 'JOB_DESCRIPTION',
    "fileName" VARCHAR(255) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "storageProvider" VARCHAR(50) NOT NULL DEFAULT 'local-private',
    "sha256" VARCHAR(64),
    "extractionText" TEXT,
    "parserStatus" VARCHAR(40) NOT NULL DEFAULT 'NotStarted',
    "uploadedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vacancy_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vacancy_documents_org_req_idx" ON "vacancy_documents"("organizationId", "vacancyRequestId");
CREATE INDEX IF NOT EXISTS "vacancy_documents_org_vac_idx" ON "vacancy_documents"("organizationId", "vacancyId");

CREATE TABLE IF NOT EXISTS "interview_scorecard_ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scorecardId" UUID NOT NULL,
    "criterionKey" VARCHAR(100) NOT NULL,
    "criterionName" VARCHAR(200) NOT NULL,
    "category" VARCHAR(40) NOT NULL DEFAULT 'SKILL',
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_scorecard_ratings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "interview_scorecard_ratings_card_key" ON "interview_scorecard_ratings"("scorecardId", "criterionKey");
CREATE INDEX IF NOT EXISTS "interview_scorecard_ratings_card_idx" ON "interview_scorecard_ratings"("scorecardId");

DO $$ BEGIN
  ALTER TABLE "vacancy_documents" ADD CONSTRAINT "vacancy_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "vacancy_documents" ADD CONSTRAINT "vacancy_documents_vacancyRequestId_fkey" FOREIGN KEY ("vacancyRequestId") REFERENCES "vacancy_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "vacancy_documents" ADD CONSTRAINT "vacancy_documents_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "vacancies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "vacancy_documents" ADD CONSTRAINT "vacancy_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "interview_scorecard_ratings" ADD CONSTRAINT "interview_scorecard_ratings_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "interview_scorecards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
