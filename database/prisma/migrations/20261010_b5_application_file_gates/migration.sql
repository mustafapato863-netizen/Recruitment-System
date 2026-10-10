-- B5: application file and the five gates (v2 §7, §8, §10 step 4). NEVER run on prod without review.
-- Rollback: database/prisma/rollbacks/20261010_b5_application_file_gates.down.sql

-- ─── Schema (additive first) ──────────────────────────────────
ALTER TABLE "applications" ADD COLUMN "rejectionReason" VARCHAR(200);

ALTER TABLE "interview_scorecards"
  ADD COLUMN "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "previousRevisionId" UUID,
  ADD COLUMN "revisedById" UUID,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "revisionReason" TEXT,
  ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
  ALTER COLUMN "submittedAt" DROP NOT NULL;

ALTER TABLE "interviews"
  ADD COLUMN "legacyInterviewerName" VARCHAR(200),
  ADD COLUMN "roomName" VARCHAR(200);

ALTER TABLE "offer_versions" ADD COLUMN "status" VARCHAR(30) NOT NULL DEFAULT 'Draft';

-- ─── Backfill isLocked -> explicit statuses ───────────────────
UPDATE "interview_scorecards" SET "status" = CASE WHEN "isLocked" THEN 'Submitted' ELSE 'Draft' END;
UPDATE "interview_scorecards" SET "submittedAt" = NULL WHERE "status" = 'Draft';

-- Current version takes the offer's lifecycle state; older versions their approval outcome.
UPDATE "offer_versions" ov SET "status" = CASE
    WHEN o."currentVersionId" = ov."id" AND o."status" IN ('Sent','Accepted','Declined','Expired','Withdrawn','Approved','Pending Approval') THEN o."status"
    WHEN ov."approvalStatus" = 'Rejected' THEN 'Changes Requested'
    WHEN ov."approvalStatus" = 'Approved' THEN 'Approved'
    WHEN ov."approvalStatus" = 'Pending' THEN 'Pending Approval'
    ELSE 'Draft' END
FROM "offers" o WHERE o."id" = ov."offerId";

-- ─── Interviewer = user: map free-text names to users ─────────
UPDATE "interviews" SET "legacyInterviewerName" = "interviewerName" WHERE COALESCE(btrim("interviewerName"), '') <> '';
WITH matches AS (
  SELECT i."id" AS interview_id, min(u."id"::text)::uuid AS user_id, count(DISTINCT u."id") AS n
  FROM "interviews" i
  JOIN "users" u ON u."organizationId" = i."organizationId"
   AND (lower(btrim(u."displayName")) = lower(btrim(i."interviewerName")) OR lower(u."email") = lower(btrim(i."interviewerName")))
  WHERE COALESCE(btrim(i."interviewerName"), '') <> ''
  GROUP BY i."id"
)
INSERT INTO "interview_attendees" ("id", "interviewId", "userId", "role", "jobTitle")
SELECT gen_random_uuid(), m.interview_id, m.user_id, 'Interviewer', i."interviewerJobTitle"
FROM matches m JOIN "interviews" i ON i."id" = m.interview_id
WHERE m.n = 1
ON CONFLICT ("interviewId", "userId") DO NOTHING;

ALTER TABLE "interviews" DROP COLUMN "interviewerName";

-- ─── Stage remap (v2 §8) ──────────────────────────────────────
-- Legacy New -> Applied (v2 pipeline starts at Applied).
INSERT INTO "application_status_histories" ("id", "applicationId", "fromStage", "toStage", "reason", "createdAt")
SELECT gen_random_uuid(), "id", 'New', 'Applied', 'B5 migration: legacy New stage -> Applied', CURRENT_TIMESTAMP
FROM "applications" WHERE "stage" = 'New';
UPDATE "applications" SET "stage" = 'Applied', "version" = "version" + 1 WHERE "stage" = 'New';

-- Scorecard -> Interview (scorecard gate unmet until a Submitted scorecard exists).
INSERT INTO "application_status_histories" ("id", "applicationId", "fromStage", "toStage", "reason", "createdAt")
SELECT gen_random_uuid(), "id", 'Scorecard', 'Interview', 'B5 migration: legacy Scorecard stage -> Interview', CURRENT_TIMESTAMP
FROM "applications" WHERE "stage" = 'Scorecard';
UPDATE "applications" SET "stage" = 'Interview', "version" = "version" + 1 WHERE "stage" = 'Scorecard';

-- Hired -> Joined only when ID, contract and SCFHS licence are Verified; otherwise Pre-Hire.
WITH checks AS (
  SELECT a."id",
    bool_or(cr."status" = 'Verified' AND (lower(cr."name") ~ '(^|[^a-z])(id|identity|passport|emirates id|national id|iqama)([^a-z]|$)')) AS id_ok,
    bool_or(cr."status" = 'Verified' AND lower(cr."name") LIKE '%contract%') AS contract_ok,
    bool_or(cr."status" = 'Verified' AND (lower(cr."name") LIKE '%scfhs%' OR lower(cr."name") LIKE '%licen%')) AS licence_ok
  FROM "applications" a
  LEFT JOIN "hiring_cases" hc ON hc."applicationId" = a."id"
  LEFT JOIN "compliance_requirements" cr ON cr."hiringCaseId" = hc."id"
  WHERE a."stage" = 'Hired'
  GROUP BY a."id"
)
INSERT INTO "application_status_histories" ("id", "applicationId", "fromStage", "toStage", "reason", "createdAt")
SELECT gen_random_uuid(), c."id", 'Hired',
  CASE WHEN COALESCE(c.id_ok AND c.contract_ok AND c.licence_ok, false) THEN 'Joined' ELSE 'Pre-Hire' END,
  CASE WHEN COALESCE(c.id_ok AND c.contract_ok AND c.licence_ok, false) THEN 'B5 migration: legacy Hired -> Joined (joining checks done)' ELSE 'B5 migration: legacy Hired -> Pre-Hire (joining checks not done)' END,
  CURRENT_TIMESTAMP
FROM checks c;
UPDATE "applications" a SET "stage" = h."toStage", "version" = a."version" + 1
FROM "application_status_histories" h
WHERE h."applicationId" = a."id" AND a."stage" = 'Hired' AND h."reason" LIKE 'B5 migration: legacy Hired%';

-- Withdrawn is no longer an exit: Rejected with reason "Withdrawn by candidate" (history keeps the original).
INSERT INTO "application_status_histories" ("id", "applicationId", "fromStage", "toStage", "reason", "createdAt")
SELECT gen_random_uuid(), "id", 'Withdrawn', 'Rejected', 'B5 migration: Withdrawn -> Rejected (Withdrawn by candidate)', CURRENT_TIMESTAMP
FROM "applications" WHERE "stage" = 'Withdrawn';
UPDATE "applications" SET "stage" = 'Rejected', "rejectionReason" = 'Withdrawn by candidate', "version" = "version" + 1 WHERE "stage" = 'Withdrawn';

-- Existing Rejected files keep their last recorded reason when there is one.
UPDATE "applications" a SET "rejectionReason" = left(h."reason", 200)
FROM (
  SELECT DISTINCT ON ("applicationId") "applicationId", "reason"
  FROM "application_status_histories" WHERE "toStage" = 'Rejected' AND COALESCE(btrim("reason"), '') <> ''
  ORDER BY "applicationId", "createdAt" DESC
) h
WHERE h."applicationId" = a."id" AND a."stage" = 'Rejected' AND a."rejectionReason" IS NULL;

-- ─── Rejection reasons (master data, category rejection-reasons) ─
INSERT INTO "master_data_values" ("id", "organizationId", "category", "code", "name", "status", "updatedAt")
SELECT gen_random_uuid(), o."id", 'rejection-reasons', r.code, r.name, 'Active', CURRENT_TIMESTAMP
FROM "organizations" o
CROSS JOIN (VALUES
  ('REQ_CANCELLED', 'Requisition cancelled'),
  ('DECLINED_OFFER', 'Declined offer'),
  ('WITHDRAWN_BY_CANDIDATE', 'Withdrawn by candidate'),
  ('NOT_QUALIFIED', 'Not qualified'),
  ('FAILED_SCREENING', 'Did not pass screening'),
  ('FAILED_INTERVIEW', 'Did not pass interview'),
  ('NO_RESPONSE', 'No response from candidate'),
  ('POSITION_FILLED', 'Position filled')
) AS r(code, name)
ON CONFLICT DO NOTHING;

-- ─── Drop isLocked, swap scorecard keys ───────────────────────
ALTER TABLE "interview_scorecards" DROP COLUMN "isLocked";
ALTER TABLE "offer_versions" DROP COLUMN "isLocked";
DROP INDEX "interview_scorecards_interviewId_interviewerId_key";
CREATE UNIQUE INDEX "interview_scorecards_previousRevisionId_key" ON "interview_scorecards"("previousRevisionId");
CREATE INDEX "interview_scorecards_interviewId_interviewerId_idx" ON "interview_scorecards"("interviewId", "interviewerId");
CREATE UNIQUE INDEX "interview_scorecards_interviewId_interviewerId_revision_key" ON "interview_scorecards"("interviewId", "interviewerId", "revision");
ALTER TABLE "interview_scorecards" ADD CONSTRAINT "interview_scorecards_previousRevisionId_fkey" FOREIGN KEY ("previousRevisionId") REFERENCES "interview_scorecards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interview_scorecards" ADD CONSTRAINT "interview_scorecards_revisedById_fkey" FOREIGN KEY ("revisedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
