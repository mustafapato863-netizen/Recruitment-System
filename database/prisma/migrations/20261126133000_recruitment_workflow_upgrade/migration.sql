-- Recruitment workflow upgrade (v1.3): additive fields for independent approvals,
-- salary period on requisitions & screenings, Pre-Hire interview stage context,
-- and SGH scorecard template & Not Observed rating support.
-- All new columns are nullable or defaulted so existing rows stay intact.

ALTER TABLE "vacancy_requests"
  ADD COLUMN IF NOT EXISTS "budgetPeriod" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "submittedById" UUID;

ALTER TABLE "screening_logs"
  ADD COLUMN IF NOT EXISTS "salaryPeriod" VARCHAR(20);

ALTER TABLE "interviews"
  ADD COLUMN IF NOT EXISTS "stageContext" VARCHAR(30);

ALTER TABLE "interview_scorecards"
  ADD COLUMN IF NOT EXISTS "evaluationTemplate" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "nextStep" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "nextStepOwnerId" UUID,
  ADD COLUMN IF NOT EXISTS "followUpAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "decisionSummary" TEXT;

ALTER TABLE "interview_scorecard_ratings"
  ALTER COLUMN "rating" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "notObserved" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "offer_versions"
  ADD COLUMN IF NOT EXISTS "submittedById" UUID;

ALTER TABLE "hiring_cases"
  ADD COLUMN IF NOT EXISTS "submittedById" UUID;
