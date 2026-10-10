-- B2-3: Employees (RECRUITER role) can't create or list requisitions (v2 §5). Removes two role grants (config rows, not business data).
DELETE FROM "role_permissions"
WHERE "roleId" IN (SELECT "id" FROM "roles" WHERE "code" = 'RECRUITER')
  AND "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code" IN ('VACANCY_REQUEST_CREATE', 'VACANCY_REQUEST_VIEW'));
