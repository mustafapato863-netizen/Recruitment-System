-- Rollback for 20261010_b5_application_file_gates (scratch/staging only). Then:
-- DELETE FROM "_prisma_migrations" WHERE migration_name = '20261010_b5_application_file_gates';
-- Notes: scorecard revisions > 1 must not exist (delete is not allowed; rollback refuses below).
-- isLocked is derived back from status. Attendees created from matched free-text names stay
-- (they are real users). Rejection-reason master data rows stay (harmless catalog rows).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "interview_scorecards" WHERE "revision" > 1) THEN
    RAISE EXCEPTION 'B5 rollback refused: scorecard revisions exist';
  END IF;
END $$;

ALTER TABLE "interview_scorecards" DROP CONSTRAINT "interview_scorecards_previousRevisionId_fkey";
ALTER TABLE "interview_scorecards" DROP CONSTRAINT "interview_scorecards_revisedById_fkey";
DROP INDEX "interview_scorecards_interviewId_interviewerId_revision_key";
DROP INDEX "interview_scorecards_interviewId_interviewerId_idx";
DROP INDEX "interview_scorecards_previousRevisionId_key";
ALTER TABLE "interview_scorecards" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false;
UPDATE "interview_scorecards" SET "isLocked" = ("status" = 'Submitted'), "submittedAt" = COALESCE("submittedAt", "createdAt");
ALTER TABLE "interview_scorecards" ALTER COLUMN "submittedAt" SET NOT NULL;
CREATE UNIQUE INDEX "interview_scorecards_interviewId_interviewerId_key" ON "interview_scorecards"("interviewId", "interviewerId");
ALTER TABLE "interview_scorecards" DROP COLUMN "createdAt", DROP COLUMN "previousRevisionId", DROP COLUMN "revisedById",
  DROP COLUMN "revision", DROP COLUMN "revisionReason", DROP COLUMN "status";

ALTER TABLE "offer_versions" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false;
UPDATE "offer_versions" SET "isLocked" = ("status" IN ('Approved', 'Sent', 'Accepted', 'Declined', 'Expired'));
ALTER TABLE "offer_versions" DROP COLUMN "status";

-- offers normalized by the migration go back to "Sent to Candidate" (audit rows stay: append-only)
UPDATE "offers" o SET "status" = 'Sent to Candidate'
WHERE o."status" = 'Sent' AND EXISTS (
  SELECT 1 FROM "audit_logs" a WHERE a."action" = 'B5_MIGRATION_OFFER_STATUS_NORMALIZED' AND a."entityType" = 'Offer' AND a."entityId" = o."id"::text);

ALTER TABLE "interviews" ADD COLUMN "interviewerName" VARCHAR(200);
UPDATE "interviews" SET "interviewerName" = "legacyInterviewerName";
ALTER TABLE "interviews" DROP COLUMN "legacyInterviewerName", DROP COLUMN "roomName";

-- stages back (from the migration's history rows), newest marker first
UPDATE "applications" a SET "stage" = 'Withdrawn', "rejectionReason" = NULL
FROM "application_status_histories" h
WHERE h."applicationId" = a."id" AND h."reason" = 'B5 migration: Withdrawn -> Rejected (Withdrawn by candidate)' AND a."stage" = 'Rejected';
UPDATE "applications" a SET "stage" = 'Hired'
FROM "application_status_histories" h
WHERE h."applicationId" = a."id" AND h."reason" LIKE 'B5 migration: legacy Hired%' AND a."stage" = h."toStage";
UPDATE "applications" a SET "stage" = 'Scorecard'
FROM "application_status_histories" h
WHERE h."applicationId" = a."id" AND h."reason" = 'B5 migration: legacy Scorecard stage -> Interview' AND a."stage" = 'Interview';
UPDATE "applications" a SET "stage" = 'New'
FROM "application_status_histories" h
WHERE h."applicationId" = a."id" AND h."reason" = 'B5 migration: legacy New stage -> Applied' AND a."stage" = 'Applied';
ALTER TABLE "applications" DROP COLUMN "rejectionReason";
-- remove the migration's own history markers so a re-upgrade is exact
DELETE FROM "application_status_histories" WHERE "reason" LIKE 'B5 migration:%';
