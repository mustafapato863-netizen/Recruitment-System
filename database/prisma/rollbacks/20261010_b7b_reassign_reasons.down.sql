-- Rollback for 20261010_b7b_reassign_reasons (run BEFORE the B7 rollback). Removes only unused values;
-- file_reassignments store the reason text, not an id, so history is unaffected.
DELETE FROM "master_data_values" WHERE "category" = 'reassign-reasons';
-- DELETE FROM "_prisma_migrations" WHERE migration_name = '20261010_b7b_reassign_reasons';
