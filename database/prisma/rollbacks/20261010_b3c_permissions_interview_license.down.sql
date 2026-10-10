DELETE FROM "role_permissions" WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code" IN ('INTERVIEW_PARTICIPATE', 'LICENSE_CHECK'));
DELETE FROM "permissions" WHERE "code" IN ('INTERVIEW_PARTICIPATE', 'LICENSE_CHECK');
-- DELETE FROM "_prisma_migrations" WHERE migration_name = '20261010_b3c_permissions_interview_license';
