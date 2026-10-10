INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'RECRUITER' AND p."code" IN ('VACANCY_REQUEST_CREATE', 'VACANCY_REQUEST_VIEW')
ON CONFLICT DO NOTHING;
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261010_b3e_employee_no_requisitions';
