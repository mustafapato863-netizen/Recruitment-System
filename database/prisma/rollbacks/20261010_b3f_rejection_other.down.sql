-- Deactivate (never delete) the seeded "Other" rejection reason, then forget the migration.
UPDATE "master_data_values" SET "status" = 'Inactive', "version" = "version" + 1, "updatedAt" = now()
WHERE "category" = 'rejection-reasons' AND "code" = 'OTHER';
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261010_b3f_rejection_other';
