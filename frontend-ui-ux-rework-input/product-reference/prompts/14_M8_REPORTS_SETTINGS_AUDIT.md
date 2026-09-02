# M8 — Reports, Administration, Three Roles, and Audit

Goal: make reports and contextual Settings trustworthy, tenant-scoped, and operationally useful.

Read first: `AGENTS.md`, master plan M8, blueprint sections 4, 9, 12, 14–15, current report query/services/settings/master-data/users/pipeline/audit APIs/schema/tests, and planning records.

Reports: implement/repair filterable vacancy health/fill progress, time-to-fill, pipeline conversion/aging, interview/offer outcomes, source quality, workload/targets, and manager team progress. Each KPI has real source events, formula, scope, period, as-of/freshness, accessible underlying data, unavailable state, and XLSX-only export. Do not show percentages with invalid denominators or fabricated values.

Settings: use contextual tabs/routes for Users, Master Data, Pipeline, approved Integrations, and Audit Log while preserving deep links. Enforce exactly Employee, Manager, Administrator; map effective organizational scope without permitting client-side elevation. Pipeline settings need safe edit/deactivate/delete behavior: dependency checks, protected default/history rules, confirmation/reason/audit, and no destructive change of historical stage semantics. Master Data uses server-generated codes and reference-safe deactivation.

Test permission matrix, RLS/search/export, report correctness against persisted events, audit filters/diffs, settings mutations, themes/widths/keyboard, and all relevant migrations. Record formulas, policy choices, command evidence, and unresolved manual checks.

