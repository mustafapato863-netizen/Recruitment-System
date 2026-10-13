-- Additive joining policy: accepted-case snapshot, approval fingerprint, licence expiry.
-- Existing rows stay null. Null snapshot keeps the historical ID + contract + SCFHS rule.

ALTER TABLE "hiring_cases" ADD COLUMN IF NOT EXISTS "requirementSnapshot" JSONB;
ALTER TABLE "hiring_cases" ADD COLUMN IF NOT EXISTS "approvalFingerprint" VARCHAR(512);

ALTER TABLE "hiring_case_approvals" ADD COLUMN IF NOT EXISTS "decisionFingerprint" VARCHAR(512);
ALTER TABLE "hiring_case_approvals" ADD COLUMN IF NOT EXISTS "invalidatedAt" TIMESTAMPTZ(6);

ALTER TABLE "joining_checks" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMPTZ(6);

INSERT INTO "permissions" ("id", "code", "name", "description", "status", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'RECORD_ACTUAL_JOINING',
  'Record actual joining',
  'Record that an approved candidate actually joined. Does not grant final hiring approval.',
  'Active',
  now(),
  now()
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."code" = 'RECORD_ACTUAL_JOINING'
WHERE r."code" IN ('RECRUITER', 'ADMINISTRATOR')
ON CONFLICT DO NOTHING;
