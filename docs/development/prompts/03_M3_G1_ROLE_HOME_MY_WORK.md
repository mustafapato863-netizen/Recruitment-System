# M3-G1 — Role Home and My Work

Goal: make Dashboard and My Work reliable role-aware operational starting points.

Read first: `AGENTS.md`, master plan M3, blueprint sections 3–7 and 15, current dashboard/tasks/notifications/report APIs and UI, permissions, event models, tests, and planning records.

Implement only data backed by persisted, tenant-scoped events. Employee sees assigned work, own requests, due actions, and assignment-target progress. Manager sees scoped approvals, vacancies needing ownership/target attention, team workload, and scoped target progress. Administrator sees tenant operational exceptions and administrative work. My Work provides a table/list of accountable actions with owner, source record, due state, status, and permitted action. Every card must link to a real filtered workspace or display unavailable with an explanation.

Avoid invented KPIs, personal data leakage, a generic one-size dashboard, and automatic workflow changes. Preserve report formulas and API contracts unless reviewed. Test each role, cross-tenant and direct-link denial, zero-data/loading/error states, target evidence links, themes, widths, and keyboard access. Add proportional unit/integration/browser coverage and document exact evidence.

