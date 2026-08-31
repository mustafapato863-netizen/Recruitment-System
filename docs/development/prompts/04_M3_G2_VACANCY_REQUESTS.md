# M3-G2 — Vacancy Requests and Approval Workflow

Goal: deliver a clear request-to-approved-vacancy workflow without bypassing established approval rules.

Read first: `AGENTS.md`, master plan M3, blueprint sections 3, 4, 7–8, current vacancy-request routes/controllers/services/DTOs/schema/approval policy/tests, and planning records. Reference Odoo Recruitment Flow in the blueprint for workflow clarity only.

Implement the request list, create/edit-draft full-page or step form, request detail, approval queue, decision rationale, history, and linked vacancy state using the current real API. Employees create/manage only their own allowed requests; Managers approve only scoped requests; Administrators administer tenant policy. Required values, headcount, master-data references, business justification, duplicate handling, submission confirmation, and recoverable errors must be clear. Approved requests create/link vacancies only through the established server workflow.

Do not allow client-selected tenant/approver, approval bypass, silent conversion, un-audited edits, or new business rules. Test request lifecycle, role/tenant denial, duplicate/error semantics, direct detail URL, audit entries, themes, widths, and keyboard/form behavior. Update planning records with routes/contracts changed, commands run, evidence, risks, and rollback notes.

