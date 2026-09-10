-- Add a dedicated administrator-only candidate cleanup permission.
-- Existing applications and documents remain unchanged until an administrator
-- explicitly deletes a candidate through the protected API endpoint.
INSERT INTO "permissions" ("id", "code", "name", "description", "organizationId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'CANDIDATE_DELETE',
  'Delete candidate data',
  'Permanently delete a candidate and linked test data.',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."code" = 'CANDIDATE_DELETE'
WHERE r."code" = 'ADMINISTRATOR'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
