-- B5 follow-ups (#11): application follow-up date, offer send channel/template,
-- typed joining checks (ID, CONTRACT, SCFHS_LICENCE) read by gate 4.
-- NEVER run on prod without review. Rollback: database/prisma/rollbacks/20261010_b5b_file_followups.down.sql
-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "followUpDate" DATE;

-- AlterTable
ALTER TABLE "offer_versions" ADD COLUMN     "sentAt" TIMESTAMPTZ(6),
ADD COLUMN     "sentById" UUID,
ADD COLUMN     "sentChannel" VARCHAR(20),
ADD COLUMN     "sentTemplateId" UUID;

-- CreateTable
CREATE TABLE "joining_checks" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMPTZ(6),
    "documentId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "joining_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "joining_checks_applicationId_type_key" ON "joining_checks"("applicationId", "type");

-- AddForeignKey
ALTER TABLE "joining_checks" ADD CONSTRAINT "joining_checks_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joining_checks" ADD CONSTRAINT "joining_checks_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joining_checks" ADD CONSTRAINT "joining_checks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "candidate_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "joining_checks" ADD CONSTRAINT "joining_checks_type_check" CHECK ("type" IN ('ID', 'CONTRACT', 'SCFHS_LICENCE'));

-- Map existing compliance requirements (the old name-pattern rule, same regexes as
-- the retired JOINING_CHECKS) to typed checks: one row per application and type,
-- preferring a Verified requirement, then the latest one. Unmatched names are not mapped.
WITH typed AS (
  SELECT hc."applicationId", cr.*, t.type AS check_type
  FROM "compliance_requirements" cr
  JOIN "hiring_cases" hc ON hc."id" = cr."hiringCaseId"
  JOIN LATERAL (VALUES
    ('ID', cr."name" ~* '(^|[^a-z])(id|identity|passport|emirates id|national id|iqama)([^a-z]|$)'),
    ('CONTRACT', cr."name" ~* 'contract'),
    ('SCFHS_LICENCE', cr."name" ~* '(scfhs|licen[cs]e)')
  ) AS t(type, hit) ON t.hit
), best AS (
  SELECT DISTINCT ON ("applicationId", check_type) *
  FROM typed
  ORDER BY "applicationId", check_type, ("status" = 'Verified') DESC, "verifiedAt" DESC NULLS LAST, "updatedAt" DESC
)
INSERT INTO "joining_checks" ("id", "applicationId", "type", "verified", "verifiedById", "verifiedAt", "documentId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "applicationId", check_type, "status" = 'Verified',
       CASE WHEN "status" = 'Verified' THEN "verifiedById" END,
       CASE WHEN "status" = 'Verified' THEN COALESCE("verifiedAt", "updatedAt") END,
       "documentId", now(), now()
FROM best
ON CONFLICT ("applicationId", "type") DO NOTHING;
