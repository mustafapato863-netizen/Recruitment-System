# M3-G4 — Jobs, Vacancies, Applications, and Explicit Pipeline

Goal: make approved vacancies and their candidate pipelines usable, truthful, and accessible without mandatory drag-and-drop.

Read first: `AGENTS.md`, master plan M3, blueprint sections 3, 7–8, 10, current vacancy/application/stage/workflow APIs, permissions, schema, tests, and planning records. Reference Odoo Job Positions/Recruitment Flow in blueprint for simple operational flow only.

Implement/repair vacancy list/detail (health, owner, target, approved headcount, fill progress), applications list with filters/pagination, accessible board/list view, application detail, and explicit transition UI. A transition must state current/new stage, validation/required scorecard or reason, actor, and outcome; server policy decides whether it is allowed. Support links from vacancy, candidate, My Work, and reports without losing filters or deep links.

Do not require drag/drop, infer a recruiter decision, loosen transition constraints, leak candidates through search/pagination/export, or manufacture stage metrics. Test valid/invalid transitions, Employee/Manager/Admin scope, cross-tenant/direct-ID denial, current-stage concurrency/stale-action behavior where supported, audit history, themes, widths, keyboard interaction, and empty/error states. Add targeted tests and evidence.

