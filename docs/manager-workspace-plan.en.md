# RecruitFlow Manager Workspace — Page Descriptions and Implementation Plan

**Date:** 1 November 2026  
**Design revision:** Compact layout with a workload-first manager home page  
**Scope:** Five main pages for the Manager role. Employee and Admin remain the other two roles.

This document describes the existing interactive prototype and recommends its next revision. The revised Team Work layout and production integrations described below are planned work. Writing this plan does not change the prototype, application, APIs, or database.

## 1. Navigation and page responsibilities

| Main page | Main question | Primary action |
|---|---|---|
| Team Work | Who needs support, and how should we redistribute the workload? | Review redistribution |
| Jobs & Requisitions | What do we need to hire, and who owns each job? | New requisition |
| Approvals | Which decisions require my approval? | Review a pending request |
| Interviews | Which interviews and evaluations need attention? | Schedule interview or complete my assigned evaluation |
| Team Reports | Are we meeting the hiring plan, and where are we losing time? | Open the records behind a result |

Use **Team Work** for the manager's home page. Keep **My Work** as the employee's personal task page. Job details, candidate application files, approval details, and scorecards are supporting views, not extra main navigation items.

## 2. Team Work — redesigned manager home

### Existing prototype

The current page has three summary cards, a large next-actions area, a smaller team-workload panel, and upcoming interviews. It can open approvals, interviews, and job reassignment using synthetic local data.

The workload panel currently shows job and application counts. Its bars scale against a demo constant, rather than configured employee capacity. The employee-level View action navigates to Jobs rather than opening a focused redistribution review. These are prototype limitations, not production workload logic.

### Recommended change

Make workload distribution the main task. Move the workload table into the main content area. Keep approvals and interview feedback as short, actionable reminders linking to their dedicated pages.

**Suggested layout, from top to bottom:**

1. Page title, branch/team filter, and **Review redistribution** button.
2. One compact summary line showing active jobs, overdue work, and decisions waiting for the manager.
3. A team workload table occupying most of the page.
4. A short Needs your attention list showing up to five urgent items, with View all links to the appropriate page.

| Table column | Visible content |
|---|---|
| Recruiter | Name and a short role/team label when useful |
| Current workload | Open jobs and active applications, displayed together |
| Due / overdue | Work due soon and overdue follow-ups or feedback, counted consistently |
| Availability | Recorded availability or “Not recorded” |
| Action | Review workload |

Keep detailed stage counts, job urgency, blocked files, and task history inside the workload review panel. Avoid separate cards for every metric, rankings, and an additional analytics dashboard on this page.

### Redistribution interaction

1. Open a recruiter's workload and select a job to review.
2. Show the current owner, urgency, relevant open work, and the proposed handoff scope.
3. Choose an eligible active recruiter within the manager's permitted team/branch scope. Show the recipient's current workload alongside the selection.
4. Preview the affected job and any active application ownership changes supported by the actual server rules.
5. Enter a handoff reason and confirm.
6. After a successful save, update both recruiters' workload, job ownership, and affected employee work queues. Record the previous owner, new owner, actor, reason, and time.

**Initial implementation:** support a deliberate, single-job reassignment. Add individual application/task transfers or bulk balancing only after their separate permission and ownership rules are implemented. Do not show working controls for unsupported transfer types.

**Capacity rules:** counts alone do not establish whether someone is overloaded. Use recorded availability and agreed workload thresholds before showing capacity labels or percentages. Until that information exists, show actual counts and due work without inventing a capacity score. Any recommendation must explain its basis; it must not move work automatically.

**Integrity rules:** reassignment must not silently change interview panel members, submitted scorecards, approval requesters, approval owners, candidate history, or deadlines. Define which open tasks follow job ownership and which keep their individual assignees. A failed or conflicting save must not leave the interface showing a successful handoff.

**Acceptance:** a reassignment persists after refresh, appears correctly for both employees, keeps historical attribution intact, and cannot target an inactive or out-of-scope user.

## 3. Jobs & Requisitions

### Purpose and existing prototype

One workspace for hiring demand and job ownership, with Open jobs, Requests, and Closed tabs. The prototype supports viewing jobs and their pipelines, submitting a sample requisition, and simulating recruiter reassignment.

### Planned capabilities

- Create a requisition with job title, branch, headcount, target date, and business reason.
- Track draft, submitted, returned, approved, and rejected requests where supported by the agreed workflow.
- See each job's owner, target date, confirmed joinings against approved headcount, and status.
- Open the job pipeline and the existing application file.
- Reassign the job using the same handoff flow as Team Work.
- Put a job on hold or close it with an authorized, recorded reason.

### Layout

Compact header with New requisition, a short filter row, and one job/request list. Show essential columns first; open pipeline, request history, and ownership details on demand. Avoid separate main pages for targets, assignments, and requisitions.

### Workflow connection and acceptance

An approved request creates or opens the correct job according to the confirmed backend contract. A draft request does not become an open job. The assigned employee sees the job in their workspace. Confirmed joinings alone count toward filled headcount; approval does not fill a seat. Self-approval restrictions and resubmission/version rules must be enforced on the server.

## 4. Approvals

### Purpose and existing prototype

A single decision inbox covering offers, final hiring, and requisitions. The prototype provides Pending/Decided views, versioned request details, and local simulations of approval, rejection, and return for changes, including example blocking conditions.

### Planned capabilities

- Filter by request type and branch, with the oldest or most urgent pending requests easy to find.
- Review the current version, requester, supporting evidence, missing requirements, and relevant changes.
- Approve or reject with a recorded decision. Require a reason for rejection.
- Offer Return for changes only where an actual state transition and policy support it.
- Show compensation only to users with the required permission.
- Protect against duplicate decisions, self-approval where prohibited, and decisions on superseded versions.

### Layout

One focused queue. Review opens a decision panel with a short summary, supporting details, and the permitted action. Keep full documents and audit history behind explicit links. Avoid a separate page for each approval type or an unqualified bulk-approve action.

### Workflow connection and acceptance

The employee sees the decision, reason, current version, and next task. Offer approval does not mean Sent, Accepted, or Joined. Final-hiring approval does not record attendance or joining. Verify controller, service, and seeded permission names together before wiring controls; previous audit findings require checking against the current implementation.

## 5. Interviews

### Purpose and existing prototype

The required fifth main page combines List and Calendar views, Upcoming/Needs feedback/Completed tabs, and My interviews/Team interviews scopes. The prototype simulates scheduling, draft evaluations, and submitting the manager's own assigned scorecard.

### Planned capabilities

- Schedule interviews against a valid application with real panel members, date, duration, location/link, and an explicit time zone.
- Open candidate preparation information and the existing application file.
- Reschedule, cancel, or record no-show according to permissions and timing rules.
- Let the manager submit their own evaluation only when assigned as an interviewer and the interview is eligible.
- Preserve drafts, submitted evaluations, and reasoned revisions as distinct states.
- Track outstanding evaluations without letting a manager overwrite another evaluator's scorecard.

### Layout

Use a compact list by default. Calendar is a view switch inside the same page, with event details opening in a panel. Keep scheduling and evaluation forms contextual. Show the time zone clearly; production dates come from saved records and configured time-zone rules, rather than prototype defaults.

### Workflow connection and acceptance

Scheduling and changes appear consistently in employee interviews, My Work, the manager workspace, and the application file. Only a submitted eligible evaluation can satisfy a scorecard gate; a draft cannot. Participation as an interviewer is an assignment capability within Employee/Manager/Admin, not a fourth role.

## 6. Team Reports

### Purpose and existing prototype

One reporting page with period, branch, and job filters. The prototype calculates sample confirmed joinings, median time to hire, offer acceptance, stage reach, source distribution, and team contribution. Clicking a result opens its sample records with the filters preserved.

### Planned capabilities

- Show confirmed joinings against an available, period-aligned hiring target.
- Calculate median time to hire using one declared start/end definition.
- Calculate offer acceptance using accepted offers and eligible sent offers from a clearly defined cohort.
- Show stage conversion, sources, and team contribution without repeating the same data across multiple subpages.
- Open the authorized underlying records behind every metric.
- Export the filtered authorized data when a real export contract is implemented.

### Layout

Three compact result summaries, a stage/source analysis row, and a team contribution table. Make explanations and underlying records available on demand. Keep workload intervention on Team Work and period-based performance analysis here.

### Workflow connection and acceptance

Each count must reconcile with the saved application, offer, interview, and joining records. Distinguish people from applications and current workload ownership from historical contribution. Reassigning a job must not rewrite past performance attribution. Empty denominators or missing targets show an explicit unavailable value, not a fabricated percentage. Filters and exports cannot broaden access beyond the manager's team/organization scope.

## 7. Shared design requirements

- **Compact is the default density**, while preserving readable text and practical 44px interaction targets.
- Preserve the existing SGH palette, typography, shared components, English labels, and light/dark behavior.
- **No decorative borders, sharp outlines, or rings in normal, hover, focus, or selected states. Shadows are for buttons only.** Cards, inputs, tables, panels, drawers, and dialogs remain flat and shadowless.
- Keep keyboard focus visible through button shadows and field background/label emphasis. Menus and dialogs must support keyboard operation, Escape, focus management, and accessible names.
- Use one short filter row and a clear page-level action where appropriate. Reveal secondary detail when requested.
- Separate loading, empty, forbidden, partial, stale, error, and retry states. A failed request must not appear as zero work or a successful action.
- Check 375, 768, 1024, and 1440px layouts. On narrow screens, stack content and keep intentional scrolling within a table or calendar region.
- Mail Templates remain deferred to v3. Candidate communication uses Admin-managed ready WhatsApp templates; employees select a type/template, preview, and edit in WhatsApp if necessary.

## 8. Implementation sequence

| Phase | Work | Completion gate |
|---|---|---|
| 0 — Confirm workflow contracts | Verify manager team scope, permission names, ownership propagation, approval transitions, metric definitions, and employee handoffs. Identify existing and missing APIs. | Written action/data/permission map with synthetic test data; unsupported actions clearly identified. |
| 1 — Revise the prototype | Replace the current Team Work composition with the workload-first layout and focused handoff review. Apply Compact consistently across all five pages. | The revised interaction is understandable and passes keyboard, responsive, theme, and button-only-shadow checks. |
| 2 — Team Work + ownership | Connect real workload reads and single-job reassignment. Reuse the handoff flow from Jobs. | Saved transfers persist, update both employee queues, preserve history, and enforce scope/conflict rules. |
| 3 — Jobs + Approvals | Connect requisition lifecycle, job/pipeline views, current-version decisions, and employee notifications/next actions. | A real request and decision produce the correct downstream work; no self-approval or premature hiring counts. |
| 4 — Interviews | Connect list/calendar, scheduling, panel assignment, draft/submitted evaluations, and permitted changes. | Every surface uses the same records; evaluator and timing rules hold on the server. |
| 5 — Reports | Implement agreed calculations, filters, record drilldowns, historical attribution, and supported exports. | Every result reconciles with source records and preserves access scope. |
| 6 — Full journey verification | Exercise the manager/employee handoffs, failures, permissions, retries, stale updates, and responsive behavior. | Evidence identifies the tested source/build and environment; remaining gaps are explicitly listed. |

## 9. End-to-end acceptance scenario

Requisition submitted → approved by the appropriate manager → job assigned → employee adds and screens a candidate → interview scheduled → assigned evaluations submitted → current offer approved → offer sent and candidate response recorded → joining checks completed → final hiring approved → actual joining recorded.

During that journey, redistribute an eligible job and verify the employee handoff. Check Team Work, employee My Work, Jobs, Approvals, Interviews, the application file, notifications, and Reports after relevant events.

Also verify out-of-scope users, inactive recipients, stale ownership, duplicate confirmation, superseded approval versions, failed/partial reads, rejected or returned requests, future/cancelled/no-show interviews, missing requirements, and duplicate joining attempts. Use an authorized local/test environment with synthetic records.

## 10. Delivery boundary

The existing five-page prototype uses synthetic local state. Its earlier browser checks demonstrate prototype interactions only. This English plan adds a proposed workload-first revision; it does not establish production backend integration or claim that the revised layout has already been built or tested.
