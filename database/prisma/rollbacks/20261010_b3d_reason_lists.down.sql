-- Data only. Rows are left in place on rollback (deactivate-only lists; history rows quote them by name).
-- To remove them anyway:
-- DELETE FROM "master_data_values" WHERE "category" IN ('rejection-reasons', 'reassign-reasons');

-- B2-M1: forget the migration too, so `prisma migrate deploy` re-applies it cleanly.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261010_b3d_reason_lists';
