-- Data only. Archived and formerly-Inactive skills can't be told apart, so statuses stay 'Archived'
-- (both mean "deactivated"; pickers only show 'Active'). Remove the migration record so deploy can re-run it.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261010_b6b_skills_archived';
