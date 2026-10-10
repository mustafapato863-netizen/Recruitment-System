-- Data only; nothing to undo (b3f's down deactivates "Other"). Forget the migration so deploy re-runs it.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261010_b3g_rejection_other_active';
