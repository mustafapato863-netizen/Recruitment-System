# M4 — Governed Talent Pool

Goal: make Talent Pool a complete reusable-candidate capability, not an untracked tag list.

Read first: `AGENTS.md`, master plan M4, blueprint sections 7–8, 11, 13, current candidate/pool/consent/permissions/audit APIs/schema/tests, and planning records.

Implement pool create/edit/list/detail, owner, purpose, scoped membership search, add/remove with reason where policy requires, consent/eligibility/freshness status, filter/pagination, membership history, and audit. Candidate 360 and pool detail must link consistently. Membership actions must use server checks for tenant, role/effective scope, candidate consent/retention eligibility, and duplicate prevention. Do not confuse Talent Pool membership with an application.

Employee has only assigned/allowed interactions; Manager is limited to scoped pools/candidates; Administrator has tenant administration. No automatic shortlisting/application creation. Test pool ownership transfer if supported, membership add/remove, invalid/expired consent, duplicate race handling, cross-tenant/direct URL/export denial, audit coverage, themes, widths, keyboard behavior, and real empty/loading/error states. Record evidence and remaining policy decisions.

