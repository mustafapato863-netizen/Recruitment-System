# M5-G2 — XLSX Import/Export and Master-Data Code Integrity

Goal: make large candidate/vacancy-request data operations reliable, permissioned, and Excel-first.

Read first: `AGENTS.md`, master plan M5, blueprint sections 12 and 15, current import/export endpoints/jobs/schema/master-data services/tests, and planning records. Begin by reproducing any visible API error; do not mask it in the UI.

Implement/repair XLSX template download, upload, sheet inspection/mapping, staging, row validation, duplicate resolution, error-workbook download, confirmation, batch history, and XLSX-only product export. Candidate imports must preserve consent and duplicate policy; vacancy rows create draft requests that use normal approvals. Exports must be server-side, filter/scope constrained, UTC-safe, audited, and clearly labelled XLSX. CSV may remain only as documented legacy API compatibility, never as a misleading product export.

For Master Data, generate human-readable codes server-side in transaction with tenant/type uniqueness and retry-safe conflict handling; do not ask users to enter IDs. Prefer deactivation over deletion for referenced values. Test malformed/formula/duplicate/large-boundary files, tenant/role batch and export isolation, failed confirmation rollback, generated-code concurrency, audit, and UI/keyboard/theme/responsive states. Use isolated test data; record exact limits and evidence.

