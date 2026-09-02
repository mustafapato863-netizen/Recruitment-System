# M2-G1 — Application Shell and Simple Navigation

Goal: implement the coherent internal shell defined in the blueprint without breaking existing routes or authorization.

Read first: `AGENTS.md`, master plan M2, blueprint sections 5–7, current shell/layout/router/theme/permission code, shared components, tests, and planning records. Reference: SAP Object Page and Overview Page links in blueprint; use them for hierarchy, not copied UI.

Implement the 12-destination sidebar: Dashboard; My Work; Vacancy Requests; Jobs & Vacancies; Applications; Interviews & Calendar; Offers & Joining; Candidates; CV Bank & Import; Talent Pool; Reports; Settings. Keep six labelled groups, distinct existing Lucide icons, strong active state, collapsed labelled tooltips, and mobile drawer. Top bar: breadcrumb, safe global search, supported Quick Create, notifications, theme, and account. Keep public careers separate. Settings may consolidate contextual admin destinations while preserving existing deep links/queries through reviewed redirects or tabs.

Navigation must be role-aware for Employee, Manager, Administrator but never replace server enforcement. Do not add pages, fake controls, global ClickSpark, dependencies, or API contract changes. Test allowed/forbidden visibility and direct routes, light/dark, all required widths, keyboard drawer/tooltips, and no horizontal overflow. Update planning records with exact evidence.

