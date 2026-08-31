# M1 Entry Gate — Verify the Functional Integrity Baseline

Goal: independently determine whether M1 is genuinely closed before any M2 implementation. This is review/evidence work first; do not redesign product pages.

Read first: `AGENTS.md`; production master plan M0/M1; product blueprint; current planning records; package manifests; routes; API controllers/services; authentication; permissions/guards; Prisma schema/migrations; tests; CI/deployment configuration. Inspect the dirty worktree without changing unrelated files.

Verify actual evidence for: login/logout/recovery and public job journeys; validation/error contract; tenant isolation/RLS for all resource-by-ID, list/search, export/download and nested mutations; three-role mapping or a migration-safe path to it; master-data uniqueness/code generation behavior; audit organization ownership; public-to-authenticated boundaries; baseline type/lint/test/build/database checks. Reproduce known failures rather than accepting historical explanations.

Record a dated evidence matrix: criterion, source inspected, command/browser evidence, result, blocker, owner. Correct only P0/P1 functional-integrity defects that are required to enter M2, with tests and no contract weakening. Update `task_plan.md`, `findings.md`, `progress.md` and a dated M1 gate report. M2 starts only if no unresolved P0 dependency remains.

