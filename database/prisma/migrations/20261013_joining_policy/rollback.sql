-- Removes the phase-3 joining columns and the RECORD_ACTUAL_JOINING grant.
-- Run only against an isolated copy. This does not delete hiring cases or approvals.

DELETE FROM "role_permissions"
WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code" = 'RECORD_ACTUAL_JOINING');

DELETE FROM "permissions" WHERE "code" = 'RECORD_ACTUAL_JOINING';

ALTER TABLE "joining_checks" DROP COLUMN IF EXISTS "expiryDate";
ALTER TABLE "hiring_case_approvals" DROP COLUMN IF EXISTS "invalidatedAt";
ALTER TABLE "hiring_case_approvals" DROP COLUMN IF EXISTS "decisionFingerprint";
ALTER TABLE "hiring_cases" DROP COLUMN IF EXISTS "approvalFingerprint";
ALTER TABLE "hiring_cases" DROP COLUMN IF EXISTS "requirementSnapshot";
