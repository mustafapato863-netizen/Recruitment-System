# RecruitFlow App Design and Workflow Reconciliation

**Date:** 2026-08-30  
**Status:** Review complete; implementation reference and phase-gate update  
**Reviewed source:** `docs/App Deisgn` reference images, current route map, and existing ATS workflow

## Decision

Adopt the supplied design as a visual and workflow north star, not as proof that
the current application implements those screens. The design has a strong
operational sequence and a clearer information hierarchy than several current
views, but its static data, desktop/light-only presentation, and unverified
routes cannot be copied as production behavior.

The implementation remains the existing RecruitFlow application. Odoo-style
patterns may guide usability—job position, applicant pipeline, list/form/
kanban, interviews, offers, refusal reasons, and reports—but RecruitFlow must
retain its approval, consent, audit, tenant, healthcare-governance, and
human-controlled decision rules.

## Review rating

| Area | Rating | Finding |
|---|---:|---|
| Visual hierarchy and brand direction | 8/10 | Clean, readable, and commercially credible as a direction |
| Recruitment workflow coverage | 8.5/10 | Covers the main recruiter journey from job discovery to joining |
| Production readiness | 5.5/10 | Static examples omit contracts, failure states, permissions, and real data behavior |
| Accessibility and responsive evidence | 4/10 | Only light desktop compositions are shown; keyboard, dark mode, mobile, and Axe evidence are absent |
| Compatibility with current source | 6.5/10 | Several concepts map to existing routes; others need scoped product/API work |

## Screen-to-phase reconciliation

| Reference screen/capability | Current status | Owning phase and closure requirement |
|---|---|---|
| Public jobs listing | Exists at `/careers/:organizationCode/jobs` | M1-G2 baseline; refine in M3/M7 with safe DTOs, search, pagination, and public states |
| Job detail and public apply | Detail/apply boundary exists; production CV pipeline remains open | M1-G2, M5, M7: consent, validation, duplicate handling, secure upload, acknowledgement, audit |
| My Applications | No current authenticated candidate portal route | M3-G7: verified candidate identity, own records only, permitted status/messages/documents |
| Recruitment dashboard | Exists, but data availability must remain truthful per role | M2-G1 and M8-G1/G2: role-aware metrics, definitions, as-of/refresh, no-data and retry states |
| Applicants Kanban/List/Form | Pipeline exists; server-configured stages and full actions remain phase work | M3-G3 to M3-G5: vacancy context, filters, pagination, keyboard list alternative, audited transitions |
| Candidate detail / 360 workspace | Candidate and application pages exist but need continuity closure | M3-G5 and M5: candidate, vacancy, CV, history, scorecards, communication, consent, provenance, blockers |
| Interviews calendar and evaluation | Existing routes exist | M2-G2 and M3-G6/M7: discoverability, timezone/conflict rules, scorecards, reminders, retry/audit |
| Offer approvals and offer management | Existing route family exists | M3-G6: authorized approval chain, expiry/status controls, controlled communication, audit |
| Request new role | Vacancy request route exists | M3-G2: complete requisition fields, approval timeline, current approver, SLA, publication state |
| Recruitment settings | Pipeline settings/master data/users routes exist | M8-G3/G4/G5: safe edit/archive, reference protection, effective permission explanation, audit |
| Compare candidates | No dedicated current route | M6-G4/G5: evidence, gaps, score version, uncertainty, human-only actions, no automatic rejection/advance |
| CV Bank / talent database | CV Bank and CV Intake routes exist; binary backup and async parser remain open | M5-G2/M5-G6 and M7-G3: consent, eligibility, freshness, duplicate/parse state, authorized download, binary backup distinct from XLSX metadata |
| Notifications and recruitment inbox | Notifications and tasks exist; communications need broader timeline | M3-G8 and M7-G4/G5: internal/external visibility, delivery state, templates, failure/retry, audit |
| Career site / job publishing management | No complete current back-office publishing workflow | M7-G1/G2/G4: approved vacancies only, configured channels, preview, publish/unpublish/schedule, sync/failure/retry, audit |
| Hiring plan overview | No dedicated current route | M8-G1/G2: demand/headcount, vacancy progress, aging, drill-through, metric definitions, XLSX export |

## Mandatory design acceptance contract

Every affected production screen must be implemented from real API state and
must explicitly handle:

- loading, empty, unavailable, error, retry, forbidden, not-found, stale, and
  partial-success states;
- role and tenant scope, including hidden actions and server-side enforcement;
- clear page purpose with an operational list, form, kanban, detail, calendar,
  approval, or report layout as appropriate—not a repeated card-grid template;
- semantic labels and status text independent of color, Lucide icons, visible
  focus, keyboard operation, focus-safe dialogs/drawers, Escape handling,
  internal scrolling, and reduced-motion behavior;
- light and dark semantic tokens at 1440, 1280, 1024, 768, 430, and 375px;
- evidence from browser journeys and accessibility checks. A screenshot alone
  never closes a phase.

Dashboard and report numbers must identify their source event set, date range,
timezone, scope, definition, and refresh/as-of time. When data is unavailable,
the UI must say why and offer a safe retry or next action; it must not replace
missing data with fabricated zeros or sample records.

## Workflow decisions to preserve

1. A vacancy is the context root for its applicant pipeline, interviews,
   offers, readiness, activity, and vacancy reports.
2. Pipeline stages come from the active server template; transitions are
   permission-checked, reasoned when required, and audited.
3. CV Bank is a controlled document and candidate-data capability. An XLSX
   manifest is metadata export, not a binary CV backup. Binary backup/restore
   requires separate storage, integrity, authorization, retention, and restore
   evidence.
4. Matching starts with deterministic hard eligibility gates. Explanations must
   show evidence, missing requirements, score version, and uncertainty. A human
   recruiter controls shortlist, application, dismissal, and pool actions.
5. Job publishing is not represented by a static “posted” label. It requires
   channel configuration, approved vacancy state, publish controls, sync
   status, failures, retries, and audit.
6. Master-data codes remain automatically generated and concurrency-safe;
   edit/archive operations must protect referenced records and preserve history.

## Phase gating after this review

The execution order remains **M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 →
M9 → M10**. M1-G4 is still open and requires remediation before M1-G5 or M2:

- preserve the current clean source typecheck result and rerun it after every
  scoped change;
- establish tenant context after authentication and register/enforce the
  tenant-scoped guard across supported resources;
- define relationship-aware organization/branch/department/recruiter/
  requester/hiring-manager scope for reads, details, search, mutations,
  reports, exports, notifications, imports, audit, and document downloads;
- add isolated API permission/tenant tests and loaded browser evidence for
  authorized and unauthorized roles.

After M1-G4 is independently approved, complete M1-G5 Master Data integrity,
then start M2 shell/design-system closure using this acceptance contract. Do
not treat the supplied images or historical completion claims as phase evidence.
