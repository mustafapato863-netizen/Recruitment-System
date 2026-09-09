-- Add focused vacancy assignment capabilities to the shared permission catalog.
-- This is data-only so existing deployments receive the options on migrate deploy
-- without requiring a manual seed run.
INSERT INTO "permissions" ("id", "code", "name", "description", "organizationId", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'VACANCY_ASSIGN', 'Assign vacancy team', 'Assign a vacancy to a primary or supporting recruiter.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'VACANCY_REASSIGN', 'Reassign vacancy team', 'Replace the active primary recruiter assigned to a vacancy.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "updatedAt" = CURRENT_TIMESTAMP;

-- Preserve the existing manager capability while exposing the focused options
-- to the standard manager roles. Recruiter is intentionally excluded.
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."code" IN ('VACANCY_ASSIGN', 'VACANCY_REASSIGN')
WHERE r."code" IN ('ADMINISTRATOR', 'TALENT_MANAGER', 'HR_MANAGER')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
