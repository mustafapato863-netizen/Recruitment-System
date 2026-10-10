-- B6: skill library links, skill evidence, normalized candidate contact keys.
-- NEVER run on prod without review. Rollback: database/prisma/rollbacks/20261010_b6_suggest_compare.down.sql
-- Existing duplicate candidates (same email or phone) are REPORTED, never merged.

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "emailNormalized" VARCHAR(255),
ADD COLUMN     "phoneNormalized" VARCHAR(20);

-- CreateTable
CREATE TABLE "candidate_skills" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_skill_evidence" (
    "id" UUID NOT NULL,
    "candidateSkillId" UUID NOT NULL,
    "sourceType" VARCHAR(30) NOT NULL,
    "sourceRef" VARCHAR(80),
    "snippet" TEXT,
    "addedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_skill_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candidate_skills_organizationId_skillId_idx" ON "candidate_skills"("organizationId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_skills_candidateId_skillId_key" ON "candidate_skills"("candidateId", "skillId");

-- CreateIndex
CREATE INDEX "candidate_skill_evidence_candidateSkillId_createdAt_idx" ON "candidate_skill_evidence"("candidateSkillId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_skill_evidence_candidateSkillId_sourceType_source_key" ON "candidate_skill_evidence"("candidateSkillId", "sourceType", "sourceRef");

-- CreateIndex
CREATE INDEX "candidates_organizationId_emailNormalized_idx" ON "candidates"("organizationId", "emailNormalized");

-- CreateIndex
CREATE INDEX "candidates_organizationId_phoneNormalized_idx" ON "candidates"("organizationId", "phoneNormalized");

-- AddForeignKey
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "master_data_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_skill_evidence" ADD CONSTRAINT "candidate_skill_evidence_candidateSkillId_fkey" FOREIGN KEY ("candidateSkillId") REFERENCES "candidate_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_skill_evidence" ADD CONSTRAINT "candidate_skill_evidence_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Contact normalization (must match apps/api/src/candidates/contact-keys.ts) ──
-- No country code is hard-coded here. The API writes the keys on every candidate
-- write and, at boot, runs repairContactKeys() with env DEFAULT_PHONE_COUNTRY_CODE,
-- which also fills local-format phones this backfill leaves NULL (cc unknown here).
-- Email: lower(trim). Phone (E.164-ish), cc = default country calling code:
--   "+..." or "00..." -> international; leading "0" -> cc + rest; <= 9 digits -> cc + digits;
--   otherwise the digits already include a country code. Valid when 8..15 digits.
--   cc NULL -> local formats return NULL.
CREATE OR REPLACE FUNCTION rf_normalize_email(raw TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(lower(btrim(raw)), '')
$$;

CREATE OR REPLACE FUNCTION rf_normalize_phone(raw TEXT, cc TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s TEXT := btrim(COALESCE(raw, ''));
  d TEXT := regexp_replace(s, '\D', '', 'g');
BEGIN
  IF d = '' THEN RETURN NULL; END IF;
  IF left(s, 1) = '+' THEN
    NULL;
  ELSIF left(d, 2) = '00' THEN
    d := substr(d, 3);
  ELSIF left(d, 1) = '0' THEN
    IF cc IS NULL THEN RETURN NULL; END IF;
    d := cc || substr(d, 2);
  ELSIF length(d) <= 9 THEN
    IF cc IS NULL THEN RETURN NULL; END IF;
    d := cc || d;
  END IF;
  IF length(d) < 8 OR length(d) > 15 THEN RETURN NULL; END IF;
  RETURN '+' || d;
END $$;

UPDATE "candidates" SET "emailNormalized" = rf_normalize_email("email"), "phoneNormalized" = rf_normalize_phone("phone", NULL);

-- ─── Map free-text candidate skills to the library (case/whitespace-insensitive) ──
-- Unmatched free text stays in candidates.skills untouched (reported, no entries invented).
-- No evidence rows are created: a listed skill is not evidence ("No evidence" until a source exists).
INSERT INTO "candidate_skills" ("id", "organizationId", "candidateId", "skillId", "createdAt")
SELECT gen_random_uuid(), c."organizationId", c."id", m.id, CURRENT_TIMESTAMP
FROM "candidates" c
CROSS JOIN LATERAL unnest(c."skills") AS cs(name)
JOIN LATERAL (
  SELECT v."id" FROM "master_data_values" v
  WHERE v."organizationId" = c."organizationId" AND v."category" = 'skills'
    AND lower(regexp_replace(regexp_replace(translate(v."name", E'\u00a0\u2007\u202f', '   '), '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g'))
      = lower(regexp_replace(regexp_replace(translate(cs.name, E'\u00a0\u2007\u202f', '   '), '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g'))
    AND v."status" = 'Active'
  ORDER BY v."createdAt" ASC
  LIMIT 1
) m ON TRUE
ON CONFLICT ("candidateId", "skillId") DO NOTHING;
