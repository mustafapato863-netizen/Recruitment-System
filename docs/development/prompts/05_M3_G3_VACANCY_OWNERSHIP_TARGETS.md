# M3-G3 — Vacancy Ownership, Reassignment, and Targets

Goal: implement manager-controlled employee assignment/reassignment and measurable vacancy targets as audited server-owned capability.

Read first: `AGENTS.md`, master plan M3/M8, blueprint section 9 plus sections 4, 10, 15, current vacancy/user/scope/schema/audit/notification/report code, migrations, tests, and planning records.

Inspect the existing schema before changing it. Implement an equivalent tenant-scoped model for one primary employee owner, optional supporting employees, responsibility, effective dates, reassignment reason/history, and vacancy/employee targets. Only scoped Manager or Administrator can assign/reassign; Employee cannot. Reassignment requires new owner, effective date, and reason, preserves history, occurs transactionally, and produces audit/notification/task behavior supported by the backend. Targets require period, unit, source-event definition, target value, status/effective dates, and actual-versus-target evidence.

Vacancy detail is the primary workspace: ownership, target progress, history, and scoped actions. No target or reassignment may automatically contact/reject/advance/create an application. Use unique/foreign-key/index/rollback-safe migration rules if schema changes are necessary. Test concurrent/invalid assignment handling, effective scope, cross-tenant denial, list/export/report isolation, audit contents, and UI themes/responsiveness/accessibility. Record migration rehearsal and exact evidence.

