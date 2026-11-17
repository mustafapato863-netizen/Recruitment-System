# RecruitFlow Employee Experience — Phased Implementation Plan

**Version:** 1.2  
**Prepared:** 28 October 2026 (Updated 29 October 2026)  
**Status:** Phases 0–8 engineering implementation & local verification complete (`comfort-desk-review` @ `08bb17a`); Issue 19 release packet ready for owner decision  
**Scope owner:** Product owner; implementation and QA responsibilities are defined below  
**Execution tracker:** [Specification and ticket index](../.scratch/employee-experience-recovery/spec.md)

## 1. Purpose and authority

Deliver a connected, clear and fast recruitment workspace in which an employee can identify the next task, act on the correct candidate/application, see the saved outcome and return to the same work context.

This plan consolidates two evidence documents:

1. [Employee journey audit](employee-journey-audit-2026-10-28.md): observed navigation defects, data/state inconsistencies, incomplete activity workflows and responsive findings.
2. [Visual direction and product benchmarks](employee-visual-odoo-benchmark-2026-10-28.md): the user-selected roles of Odoo, Linear, Ashby and Notion, and the resulting design and capability recommendations.

**Current visual specification:** [Notion-inspired system design](notion-inspired-design-spec.md). The user's later direction makes Notion the primary appearance reference system-wide, with SGH brand colors, consistent icons and selective smooth motion. This specification supersedes earlier glass/neumorphic styling requirements and expands visual coverage beyond the employee pages; workflow scope and business invariants below remain intact.

The audits remain supporting evidence. This document defines the delivery sequence and acceptance requirements for employee workflows and the system visual rollout. Earlier presentation-only plans, including the Comfort desk plan, are historical references where their scope or acceptance language conflicts with this plan. Existing business rules, permission boundaries and data-preservation requirements continue to apply. No historical completion checkbox establishes acceptance for this work.

Writing this plan does not authorize a production cutover or start application implementation. Once implementation is requested, routine implementation and local verification proceed through the phase gates; approval is not required again for every reversible development step.

## 2. Baseline and evidence limits

| Item | Recorded baseline | Required at implementation start |
| --- | --- | --- |
| Source reference | `comfort-desk-review` at `fc3cce2` | Verify the full commit and actual checkout |
| Current checkout during audit | `phase-2-pipeline-application-file`, HEAD `fc3cce2` | Recheck branch, status and differences |
| Existing local work | 27 modified tracked application files, plus untracked styles, tests and artifacts | Preserve and inventory; do not assume it is disposable or part of this plan |
| Stack | React/Vite, NestJS, shared TypeScript contracts, Prisma/PostgreSQL | Use the existing stack and repository scripts |
| Preview | Localhost/127.0.0.1 web on 5173; API previously on 3000 | Confirm the running web/API pair and source revisions |
| Test data environment | Earlier records name `Recruitment_V2_Local_20261012` | Confirm the actual target without printing credentials; never infer isolation from its name alone |
| Historical checks | 285 tests in five web files passed; web typecheck and design-token check passed | Rerun applicable checks after implementation changes |
| Historical browser evidence | Light theme; five surfaces at 375/768/1024/1440px; application file overflowed by 107px at 375px | Reproduce, then verify both themes and affected workflows |

Observed issues describe the local overlay, not necessarily the committed build alone. Complete hiring writes, all-role access, Dark, provider delivery and full accessibility were not certified by the audit. The plan treats them as verification work, not existing successes.

## 3. Outcomes and scope

### Required outcomes

- My Work identifies what the employee can act on, what is overdue and what is waiting on another person.
- A task or candidate action opens the appropriate record or form without requiring a second search.
- Candidate identity is preserved independently of each application to a job.
- Calls, follow-ups, interviews, scorecards, offers, checks, approvals and joining have connected and truthful states.
- Candidate intake, import history and document access have usable destinations.
- The same status, next action, owner and relevant count mean the same thing across the queue, list, pipeline and file.
- Colors, icons, typography, focus and layout guide the user consistently in Light and Dark and at the required widths.
- The system adopts the separate Notion-inspired SGH design contract, with restrained motion and verified performance results.
- Existing recruitment data, historical records and server-side permission rules remain correct.

### Included surfaces

Employee My Work; Open jobs list/cards; a job's candidate pipeline; Candidates active applications and Bank; person and application detail entry points; contextual drawers; document/import entry points; search and notification links into these surfaces; interview/offer/pre-hire workflows where required to complete the employee journey.

Manager, interviewer, licence specialist and final approver surfaces receive the integration and regression work needed to keep shared flows correct. The visual specification also applies to administration, requisitions, reports, authentication and public candidate routes. Shared-style effects are checked as they occur; remaining page-specific visual cleanup is completed in Phase 8. This visual rollout preserves the functions and role-specific navigation of those screens; new administrative workflows and external integrations are outside scope.

### Deferred work

ERP/payroll/HCM replacement; automated hiring decisions; new messaging/calendar providers; unattended outreach sequences; a generic form/report builder; functional expansion of administration; unrestricted bulk stage changes/rejections; a global new design framework. Saved views and bulk CV review are candidates for a later increment, not prerequisites for core acceptance.

The candidate previous/next navigator, a job-specific list view and contextual candidate creation are included productivity improvements in Phases 4–6. They must obey existing scope and unsaved-change protections.

### Success measures

| Measure | Acceptance target |
| --- | --- |
| Action discovery | A queue/card action reaches its relevant file/form within one navigation, without searching for the person again |
| Context continuity | All tested My Work, Candidates, job, search and notification entry paths return to their authorized source context |
| State correctness | No mismatch between the same record's queue/list/file action after a confirmed refresh; differing metric definitions are labeled |
| Persistence | Repeated submission/reload does not duplicate a person, application, completed activity or joining event |
| Visual usability | Zero document-level overflow across required widths/themes; required measured contrast and keyboard cases pass |
| Hiring completeness | Clinical and technical sample journeys pass the applicable gates and multi-role permissions, including invalid/stale writes |
| Performance | Record baseline request/render/effect behavior in Phase 0; meet the design specification's bundle/motion requirements and document comparable before/after results in ticket 21 |

These are release-candidate acceptance targets, not claims about the current build.

## 4. Product and business invariants

1. A **person** is one candidate identity. A **file** is that person's application to one job. Rejecting one application does not delete or reject the person everywhere.
2. Authentication, organization/team scoping, ownership, action permission and sensitive fields are enforced by the API. A more discoverable UI does not grant access.
3. Preserve current Employee pay restrictions and independent pay-related permissions. A person view must not reveal another application's protected information.
4. Screening, interview/scorecard, offer acceptance and joining gates follow the existing domain rules. The UI explains gates and opens the action that resolves them.
5. Offer approval, candidate acceptance, final hiring approval and actual joining remain separate events. Every hire requires final approval; the responsible recruiter records actual joining afterward.
6. Job-specific required checks, approved headcount, historical requirement/offer versions and audit records remain intact. A clinical requirement must not be applied universally without its configured rule.
7. A held job's existing commitments and the rules for new actions must be read from current business policy. A visual change cannot silently cancel commitments or reopen blocked actions.
8. Retries, double clicks, stale updates and partial failures must not create duplicate people, applications, activities, approvals or joined headcount.
9. Provider delivery is described by its recorded state. A draft, queued item, copied link or failed delivery is not shown as a delivered message.
10. Required data that failed to load is unknown, not absent. A failed section cannot justify a false next action or a permissive transition.

## 5. Experience and visual contract

### Reference responsibilities

**Visual authority:** Notion-inspired simplicity now governs every surface, including those whose behavior is informed by another product. The priority table below retains the original workflow-reference order; Notion is no longer limited to cards and empty states.

| Priority | Reference | Apply to RecruitFlow | Boundary |
| --- | --- | --- | --- |
| 1 | Odoo | Record-centered workflow, typed activities, contextual next action and stages | Retain RecruitFlow gates and permissions |
| 2 | Linear | Focused My Work, readable density, predictable filters and fast execution | Do not copy issue-management terminology into recruitment |
| 3 | Ashby | Candidate pipeline, status information, record navigation and application context | Do not copy stage-age thresholds without a product rule |
| 4 | Notion | System-wide appearance: quiet surfaces, page structure, consistent icons, cards, lists and useful empty states | Preserve SGH identity and structured recruitment behavior |

The source benchmark document contains the official product links. These are design inputs, not a requirement for pixel copies or feature parity with paid vendor editions.

### Shared visual rules

- Keep the SGH brand, IBM Plex Sans and existing canonical tokens. Resolve conflicts between `tokens.css`, `tokens-v2.css`, shared primitives and page overlays before adding new values.
- Apply the [separate design specification](notion-inspired-design-spec.md): solid neutral surfaces, subtle borders, restrained elevation and consistent Notion-style SVG icon treatment. Remove operational glass blur, neumorphic styling and decorative background/glow animation from the affected presentation paths.
- Use the action palette to identify the primary available action. Use success for completed/successful work, warning for attention, danger for failure/overdue/destructive intent and neutral/info for ordinary state. Pair state color with text and, where helpful, an icon.
- One primary next-action button per task row or candidate card; one primary workflow action in the file header. Secondary tools remain available but do not compete with it.
- Use icon plus label for meaningful quick actions. Note and Documents need distinct visual identities; icons alone are reserved for familiar utility controls with accessible names.
- Use one line of supporting information where practical. Density comes from information hierarchy and spacing, not browser zoom, transforms or arbitrarily reduced type.
- Normal text contrast target: at least 4.5:1; large text: 3:1; essential control boundaries and focus/state indicators: 3:1 against adjacent colors. Measure actual rendered states in both themes, including gradient endpoints where used.
- Target at least 44×44 CSS pixels for practical touch controls. Provide visible focus, semantic labels, keyboard access, focus return from overlays and reduced-motion behavior.
- Required widths: 375, 768, 1024 and 1440 CSS pixels. No document-level horizontal overflow; intended board/table scrolling stays inside its region. Preserve existing RTL behavior where enabled; adding a new language is not implied.
- Every changed surface must define loading, first-use empty, filtered empty, partial failure, full error, forbidden, disabled, success, selected and closed states as applicable.

### Initial icon vocabulary

| Meaning | Existing icon family direction | Required accompanying information |
| --- | --- | --- |
| Call | Phone | Action label; recorded/planned outcome |
| Follow-up / waiting | Clock | Due time or waiting party and reason |
| Interview | Calendar / CalendarClock | Next appointment and timezone |
| Scorecard | ClipboardCheck | Submitted versus outstanding state |
| Documents | FileText / Files | Known count or explicit loading/error |
| Note | MessageSquare / note-specific icon | Internal note label |
| Offer | FileSignature | Draft/approval/sent/answer status |
| Blocker | TriangleAlert | Specific reason and route to resolve it |
| Next action | ArrowRight with action-specific icon if useful | Verb matching the actual destination |

Use existing Lucide/shared SVGs to implement the consistent Notion-style icon vocabulary defined in the design specification. Verify individual reference glyphs before claiming exact asset parity; no shared underlying icon package with Notion is assumed. The mapping is a small shared presentation contract, not a new component dependency.

### Motion and performance contract

Follow the design specification's interaction table: brief hover/menu/tab/drawer/drag/result feedback only where useful, primarily opacity/transform, no decorative idle loops and complete reduced-motion behavior. Simple effects use CSS/current primitives. Record actual before/after performance; a minimal appearance alone is not evidence of an improvement. Existing main-entry bundle limits remain in force, with route chunks measured separately. Ticket 21 verifies this before final acceptance.

## 6. Integration design

### Navigation and context

Retain the compact employee navigation: My Work, Open jobs and Candidates. Supporting work opens in a record, tab, drawer or focused subroute with a meaningful return path. Candidate detail, import history and document URLs must retain their identifiers; redirects to a generic home do not count as feature preservation. Phase 2 may restore a functional, permission-gated existing page inside the shell as a temporary bridge. Phase 4 completes the person/intake experience and retires that bridge only after equivalent behavior is verified. This avoids making Phase 2 depend on unfinished Phase 4 screens.

Extend the existing validated `returnTo` approach. Preserve the source route, relevant filter/tab/job and pagination where available. Reject external, malformed and unauthorized targets. A direct URL without source context has an authorized fallback. Browser Back and explicit Back must be coherent; closing a drawer returns focus to the triggering control. Previous/next navigation uses the authorized current result set, not an enumeration of candidate IDs.

### Consistent state and next actions

Trace the same record through queue → API → list → pipeline → file. Define a typed action description with action code, label, availability, blocker, relevant entity and due/owner information as needed. Inspect existing contracts before extending them. Prefer a shared server-side domain projection using existing policy, with thin frontend destination mapping; do not maintain independent business-rule copies in every screen.

If an incremental UI-only derivation is sufficient, prove it uses the same data and policy as the API. Any new server/contract work must cover all consumers. An action description is informative; mutation endpoints still enforce permission, state and concurrency. Do not send arbitrary executable URLs from untrusted data.

Unify count definitions: explicitly distinguish jobs owned, jobs actionable, tasks requiring action and cases waiting. Do not call `targets.length` “Open jobs” unless that is the agreed query definition. Reconcile the observed waiting-offer/draft discrepancy without overwriting legitimate records merely to make the screens agree.

### Data, activity and persistence

- Keep critical file data authoritative. Auxiliary sections use explicit loading/ready/empty/error/unavailable states rather than catch-all empty-array fallbacks. A permission-limited section is intentionally unavailable, not a failed request hidden as empty.
- Reuse candidate activity and task services. Generic tasks and candidate follow-ups have different existing permissions and mutation paths; do not assume they are interchangeable.
- Candidate activity create input currently contains `kind`, `summary`, optional `dueAt`; the application follow-up endpoint stores a date. Audit how context is persisted before adding application-linked activity fields or synchronizing the two concepts.
- For a single “log call + set next follow-up” submission, define transaction and retry behavior. If existing APIs cannot guarantee a consistent outcome, add the smallest service/contract change, with idempotency or an explicit recovery contract, before presenting it as one successful save.
- Define timezone behavior for date-only versus timed work and completion attribution. Do not count scheduled activity, automated alerts or stage migration events as completed recruiter contact.
- No schema migration is presumed necessary. If a persistence gap is proven, audit schema/constraints/history first, add an additive migration where possible, regenerate contracts/client as appropriate, and verify upgrade and rollback/recovery on disposable data.

## 7. Delivery roadmap

All implementation phases start **Not started**. A phase gate includes relevant tests and evidence; the historical audit checks are not substituted for it. The ticket index records dependencies. Phases are sequenced for delivery; independent work may be scheduled only when its prerequisites are complete.

| Phase | Deliverable | Depends on | Exit gate | Tickets |
| --- | --- | --- | --- | --- |
| 0 | Reproducible baseline, isolated test data and recovery | None | Source/environment evidence and known failures recorded | 01 |
| 1 | Visual and interaction foundation | 0 | Reference states and shared controls verified in both themes | 02–03 |
| 2 | Navigation and data truth | 0–1 | Links retain identity; partial failures explicit; state/count definitions agree | 04–06 |
| 3 | Actionable, compact My Work | 2 | Task lifecycle works; priorities and returning context verified | 07–08 |
| 4 | Candidate identity, intake and follow-up | 2–3 | Person → application → activity/import workflows persist correctly | 09–11 |
| 5 | Consistent jobs and candidate pipeline | 2–4 | Accurate job views, useful cards/list and contextual actions | 12–13 |
| 6 | Simplified application workspace | 4–5 | One clear next action, truthful history, safe record navigation, usable mobile file | 14–15 |
| 7 | Complete hiring workflow integration | 3–6 | Multi-role interview → offer → checks → approval → joining scenarios pass | 16–17 |
| 8 | System visual coverage, performance, acceptance and controlled rollout | 0–7 | Consistent routes, measured motion/performance, full evidence packet and separate release decision | 20–21, then 18–19 |

### Phase 0 — Baseline and safe execution environment

**Work:** Record source refs, tracked/untracked changes, running revisions and data target. Inventory user-facing routes, existing effects/icons/style imports and comparable performance measurements for later visual coverage and optimization. Preserve pre-existing work in a recoverable snapshot using the repository workflow. If implementation needs a new branch, use `codex/` by default and include the intended local overlay deliberately; a fresh worktree does not copy uncommitted changes. Verify local storage, API/worker/mail configuration and isolated users before write tests. Prepare a restore procedure and protected-record comparison. Record baseline failures separately.

**Acceptance:** A fresh session can open the intended build; the local API/database relationship is proven without exposing secrets; disposable scenarios and mail sink are identified; source and data recovery paths are documented and tested as appropriate. No destructive reset or seed of the original recruitment data.

**Evidence:** Baseline manifest, command results, runtime source map, sanitized data inventory and recovery instructions.

### Phase 1 — Design contract and shared components

**Work:** Implement representative My Work, pipeline-card and application-file states under the Notion-inspired SGH specification, with real component structure and explicit preview data. Inventory tokens, CSS imports and overlays. Standardize actionable rows, status chips, icon/text controls, card anatomy, filters and empty/error patterns. Replace conflicting glass/neumorphic/page-specific effects with the shared solid presentation. Add only specified motion and its reduced-motion equivalents. Fix control focus, labels and responsive primitives; verify other route consumers affected by shared changes.

**Acceptance:** Normal, overdue, waiting, blocked, loading, empty, error and permission-limited examples are reviewable. Color/contrast measurements and practical target sizes pass for the changed components in both themes. Icons are consistent; animation follows duration/property rules and reduced motion. Existing controls retain keyboard behavior. No page-specific palette or unsupported performance claim is introduced.

**Evidence:** Component previews or screenshots, token mapping, contrast results and a short decision record naming the final visual rules. A product review can adjust presentation while downstream implementation preparation continues.

### Phase 2 — Reliable routes, reads and action state

**Work:** Repair legacy-to-v2 mapping without dropping record/import identity, using functional existing pages as scoped temporary bridges where a new replacement is not yet ready. Preserve entry context from My Work, Candidates, job, search and notifications. Separate failure from empty data and define section retries. Reconcile job ownership/count definitions and offer-state discrepancy. Establish one next-action interpretation across surfaces and update shared contracts only when needed.

**Acceptance:** Import history and CV-bank links reach their actual work; candidate document/detail links identify the same person; each entry has an authorized return. A failed offer/scorecard/document read cannot falsely appear missing or unlock a transition. Next action never shows a last-activity label. Counts reconcile for the same scope or have distinct truthful labels. Invalid return URLs and direct unauthorized access are refused safely.

**Evidence:** Route compatibility map, request/response trace for affected records, fault/permission tests and cross-screen assertions.

### Phase 3 — My Work as the daily execution queue

**Work:** Implement complete and reschedule flows for the task types the user is permitted to act on. Reuse existing status and candidate-activity endpoints; add generic rescheduling support only after checking whether it already exists elsewhere. Redesign My Work using the Phase 1 row contract: useful grouping, readable density and icon/label cues. Keep Upcoming interviews and Joining soon actionable. Refresh or invalidate affected data after successful writes.

**Acceptance:** Assigned standalone and linked tasks are actionable; duplicate completion does not duplicate attribution; a failed update leaves the task visible with retry. Date/time boundaries and waiting-party labels are correct. A My Work action opens the relevant form within one navigation, and explicit Back returns to the original tab/filter. Counters and lists update from persisted outcomes. Nothing disappears merely because an entity link is absent.

**Evidence:** Task lifecycle tests and local browser journeys including overdue, empty, error, unavailable action and interviewer-only cases.

### Phase 4 — Candidate Bank, intake and communication activity

**Work:** Provide a person view from Bank even without an application, with authorized documents and application history. Restore workbook import/history/duplicate review through a usable v2 destination or a properly integrated existing page. Keep PDF/Word intake accessible from the job. Add contextual create/select-existing candidate entry with duplicate protection. Integrate completed calls and timed follow-ups, completion and rescheduling, without turning a person activity into every application's state.

**Acceptance:** One person can have two job applications with independent stages. Rejecting one leaves the other and person intact. Duplicate intake and retry do not create extra identities/files. Import validation/errors/history remain accessible after reload. A call and requested follow-up survive reload and appear once, with task/source attribution. A candidate without a job still has a usable authorized profile. Cross-job and sensitive-field permissions are tested.

**Evidence:** Person/application identity scenarios, controlled upload/import cases, activity persistence and duplicate/retry checks, plus negative authorization tests.

### Phase 5 — Open jobs and pipeline productivity

**Work:** Preserve the detailed jobs list and optional cards. Display department/site/owner/headcount/stage counts from confirmed data; distinguish no owner from hidden/unavailable data. Pipeline cards show identity, stage, next activity/due time and blocker without redundant metadata. Provide the same authorized candidate set as a board or job-specific list, with scoped search/filter and retained context. Keep drag and an accessible menu alternative; a refused forward move opens the required action without changing the stage.

**Acceptance:** Own/actionable jobs and redacted team jobs are labeled consistently with Phase 2 definitions. Board/list counts and actions match; filters survive entry and return. One action opens the correct form. Held/closed/filled cases obey current policies; existing commitments are not lost. Large lists remain usable using established paging/window patterns, and no document overflow appears at required widths.

**Evidence:** Jobs/pipeline tests, board/list parity, held/redacted/closed cases, keyboard move and responsive browser results.

### Phase 6 — Application workspace and record navigation

**Work:** Recompose the file around person/job identity, current stage, owner, next action and required blocker. Keep one primary workflow action; expose call/follow-up/note/documents and applicable interview/offer tools through concise labeled controls. Distinguish progress navigation from commands that change state. Add previous/next within the authorized source set and protect unsaved edits. Unify latest activity with the actual timeline while separating automation and fit evidence. Contain the stage rail at narrow widths.

**Acceptance:** A new applicant is not presented with eight equally relevant workflow choices. Future steps explain their prerequisites. Current-stage action, next-action label and destination agree. System alerts do not masquerade as candidate-fit evidence; latest activity includes the agreed event classes. Previous/next and return retain scope and filters. A saved or canceled drawer restores focus; errors retain entered values. The 375px application file has zero document-level overflow.

**Evidence:** Header/action-state matrix, timeline assertions, unsaved-change and restricted-set navigation tests, Light/Dark screenshots and width measurements.

### Phase 7 — Interview, offer and joining integration

**Work:** Exercise schedule/reschedule/no-show/cancellation, assigned interviewer CV and scorecard, scorecard submission and permitted revisions. Surface the next appointment and submitted/outstanding evaluations. Reconnect the existing self-schedule path if configured, with clear copied/sent/booked states and slot-conflict handling. Test offer revisions/approval/expiry/answer, job-specific checks, final approval and responsible-recruiter joining. Retain existing policy rather than simplifying it into one ambiguous “complete” action.

**Acceptance:** The interview loop updates the correct file and task; cancelled/no-show/stale cases do not appear as completed evaluations. Restricted interviewers see only assigned work. Offer summary, pending actor and file action agree after each mutation. Only an accepted offer enters the applicable pre-hire process. Uploading a document does not verify it. Final approval alone does not count a hire; actual joining counts once, within capacity. Clinical and technical test jobs use their configured requirements. Provider-off mode is explicit and safe.

**Evidence:** At least one complete multi-role local hiring scenario, plus failure/permission/concurrency cases and proof that protected existing records remain unchanged.

### Phase 8 — System visual rollout, performance and release readiness

**Work:** First complete ticket 20: the route inventory's remaining manager/specialist/admin/report/auth/public surfaces adopt the shared Notion-inspired SGH design, with functional regressions checked. Next complete ticket 22: eliminate `/login` page lag (artificial `2,000ms` delay, `<ThinkingDots />` canvas loop, `<BorderGlow>` / `BorderGlow.css` 17-gradient/9-mask/13-shadow glow layers and pointer-move reflows, `<AtmosphericBackground />`, `backdrop-blur-xl`, and `blur-3xl` orbs) and prefetch `V2Shell` / `MyWorkRoute` on idle. Then complete ticket 21: split signed-in shell stylesheets into the lazy `V2Shell` chunk, remove measured effect/import/render overhead, and verify motion/reduced-motion, actual entry/route chunk sizes and comparable performance. Run ticket 18's expanded acceptance matrix and applicable static/unit/API/database/browser gates against isolated data. Inspect both themes, required widths and full keyboard paths. Rehearse recovery for the exact release candidate. Review the final diff and capture unresolved limitations; ticket 19 remains the separate release decision.

**Acceptance:** All inventoried user-facing routes have verified design coverage or an explicit recorded exception. AC01–AC20 pass as applicable, including system visual consistency, motion, login/startup speed, and performance evidence; no unresolved defect blocks a core action, violates scope/pay boundaries or produces false workflow state. All unrun checks and accepted baseline failures are named with evidence. The product owner has a local/UAT walkthrough and a concrete release/rollback packet. Publishing requires its own explicit authorization; do not switch `main`, remotes or public deployment configuration during local implementation.

**Evidence:** Route coverage matrix, acceptance results, command exit codes, visual/contrast/keyboard/motion evidence, measured before/after performance and bundle sizes, recovery rehearsal and release decision record.

**Execution order:** 20 → 22 → 21 → 18 → 19 after the Phase 7 gate. New ticket IDs extend the original tracker without renumbering existing references; dependencies determine order.

## 8. Milestones and review points

| Milestone | Completed phases | Demonstrable result |
| --- | --- | --- |
| M1 — Dependable foundations | 0–2 | Real destinations, truthful loading/state, shared visual rules |
| M2 — Usable employee desk | 0–4 | Employee can find a person, act on tasks, log contact and manage follow-up |
| M3 — Connected hiring journey | 0–7 | Job → application → interview → offer → checks → final approval → actual joining works across roles |
| M4 — Release candidate | 0–8 verification | Evidence-backed local/UAT candidate with recovery and a separate release decision |

Show the product owner the actual implemented milestone, with success and failure states. A visual review is not a replacement for persistence/permission verification. Calendar estimates should be assigned after Phase 0 confirms the starting code, defects and API gaps; no delivery dates are implied by phase numbering.

### Responsibility and handoff

| Role | Responsibility |
| --- | --- |
| Product owner | Resolve consequential policy/scope decisions, review implemented milestones and authorize any public release |
| Implementer | Trace the affected path, make the smallest coherent change, run focused checks and record evidence |
| Reviewer / QA | Check acceptance against actual behavior, permissions, visual states and the final diff; identify remaining risks |
| Release operator | Prepare the exact candidate/recovery packet, execute only the authorized rollout and verify smoke results |

One person may perform more than one role, but implementation evidence and final review must be explicit. Do not invent approvals or named assignees.

## 9. Traceability

| Requirement | Source | Implemented in | Acceptance scenarios |
| --- | --- | --- | --- |
| R01 — Real import/Bank/detail destinations | Journey findings 1, 5 | 04, 09, 10 | AC01, AC04, AC05 |
| R02 — Source-aware return and safe navigation | Journey finding 2 | 04, 13, 14 | AC01, AC02, AC16 |
| R03 — True next action and consistent counts/state | Journey findings 3, 10 | 06, 08, 12–14 | AC02, AC06, AC15 |
| R04 — Actionable standalone/linked tasks | Journey finding 4 | 07–08 | AC03, AC06 |
| R05 — Calls and timed follow-up | Journey finding 5; Odoo activities | 09, 11 | AC04, AC06 |
| R06 — Partial failure is not empty | Journey finding 6 | 05–06 | AC07 |
| R07 — Clear file controls and timeline | Journey findings 7–8 | 14–15 | AC08, AC16 |
| R08 — Mobile/visual/keyboard consistency | Journey finding 9; all four benchmarks | 02–03, 08, 12–15, 18 | AC09, AC10 |
| R09 — Job-context intake and reusable person identity | Benchmark feature map | 09–10, 12–13 | AC04, AC05 |
| R10 — Interview and evaluation loop | Odoo/Ashby benchmark | 16 | AC11, AC12 |
| R11 — Offer/checks/final approval/joining | Journey capability map | 17 | AC13, AC14, AC15 |
| R12 — Density, board/list, previous/next and empty states | Linear/Ashby/Notion benchmark | 02–03, 08, 13–14 | AC08, AC09, AC16 |
| R13 — Notion-inspired SGH design across the system | Later user direction; separate design specification | 02–03, 20 | AC09, AC10, AC19 |
| R14 — Selective smooth motion, login/startup speed, and measured performance | Later user direction; design specification sections 7–8 | 01–03, 21, 22 | AC10, AC20 |

## 10. Acceptance scenario matrix

Run each scenario with identified local/test roles and dedicated records. Record fixture identity without credentials or unnecessary candidate personal data. Use at least two isolated organizations and relevant reporting/ownership scopes for authorization checks.

| ID | Scenario | Required result |
| --- | --- | --- |
| AC01 | Bank/import/history/person/document links and refresh | Correct tool/record opens; identifiers and allowed filters remain |
| AC02 | My Work action → file/form → cancel/save → return | Correct action, restored source context and coherent browser Back |
| AC03 | Standalone and linked task completion | Visible permitted action; durable completion; no duplicate effect; failure stays actionable |
| AC04 | One person, zero/one/two applications | Person reachable; applications independent; only authorized detail visible |
| AC05 | CV/workbook intake, duplicate and retry | Existing identity reused according to policy; row errors/history recoverable; no duplicate application |
| AC06 | Log call + follow-up; complete/reschedule | Consistent persisted outcome, timezone/attribution and correct queue/count refresh |
| AC07 | Fail an auxiliary read; retry; permission-limited section | Failure distinct from absence; no false missing evidence/offer or unlocked transition |
| AC08 | Applied/blocked/waiting/closed file controls and history | One clear next action; actual latest event; automation separated from fit evidence |
| AC09 | All included surfaces, widths, themes and empty/long-content states | No document overflow, usable density, truthful empty state and working primary action |
| AC10 | Keyboard-only, focus, controls and measured contrast | Logical navigation; named controls; dialogs contain/restore focus; required contrast and reduced motion |
| AC11 | Schedule, conflict, reschedule, cancel and no-show | Correct appointment/task state; no duplicate booking; clear recovery |
| AC12 | Restricted interviewer submits/revises scorecard | Assigned work only; protected data absent; valid submission updates the correct file |
| AC13 | Offer draft/revision/approval/send/expiry/answer | Correct version and waiting party; no acceptance/approval conflation; provider-off truthful |
| AC14 | Clinical vs technical pre-hire; document pending verification | Configured requirements enforced; upload alone cannot verify; unrelated checks not imposed |
| AC15 | Final approval, actual joining, duplicate/stale/capacity cases | Correct actor and policy; joined count changes once; invalid/stale writes fail explicitly |
| AC16 | Filtered board/list and previous/next; unsaved edits | Same authorized set and context; edits preserved or guarded; no ID-based access expansion |
| AC17 | Direct URLs/API calls across role/team/organization | Server denies unauthorized records/actions and redacts pay correctly |
| AC18 | Release candidate recovery and protected-record comparison | Documented source/data recovery works; historical data and completed hires preserved |
| AC19 | Route-by-route visual coverage: employee, manager, specialist, admin/reports and auth/public | Shared Notion-inspired SGH components, consistent icon meaning, both themes/widths and preserved route-specific behavior |
| AC20 | Menus/drawers/tabs/drag/results with normal/reduced motion; before/after performance | Useful feedback without idle decorative work; required motion and bundle budgets; reproducible measurements with no unsupported improvement/field-pass claims |

All applicable permission and negative variants are part of each feature's acceptance, not postponed to the last phase.

## 11. Verification commands and evidence

Use the scripts verified in the current repository; recheck them at Phase 0. Prefix shell invocations with `rtk` according to the workspace instructions. Run focused checks first, then the applicable broader gates once. Do not run database/browser scripts against production or before reviewing their setup/cleanup behavior.

| Gate | Current command / method | When |
| --- | --- | --- |
| Focused web | `rtk proxy pnpm --dir apps/web test <affected-test-paths>` | Each UI/adapter change |
| Focused API | Existing API Vitest runner, restricted to affected specs after inspecting its invocation | Each service/permission/contract change |
| Types | `rtk proxy pnpm typecheck` | Applicable integration gates and final candidate |
| Lint | `rtk proxy pnpm lint` | Applicable integration gates and final candidate |
| Tokens | `rtk proxy pnpm check:design-tokens` | Shared or page styling |
| Web/API/worker tests | `rtk proxy pnpm test` | Final candidate; classify existing failures |
| Production build | `rtk proxy pnpm build` and `rtk proxy pnpm check:bundle` | Final candidate; inspect bundle changes |
| Motion/performance | Design specification sections 7–8; real browser traces and before/after route/entry measurements | Phase 0 baseline, shared UI work and ticket 21; ensure budget tools locate actual entry assets |
| DB authorization/isolation | `rtk proxy pnpm test:db` | Confirmed disposable test DB; final applicable gate |
| Browser runner | `rtk proxy pnpm test:browser` after reviewing `tests/browser/recruitflow_dual_mode_matrix.py` | Isolated setup; supplement missing journey coverage |
| Activity/intake-specific | Existing candidate activity, bulk import and CV-storage tests as applicable | Phases 4 and 8 |
| Migration conditional | Existing validate/generate/migration-status workflow and disposable upgrade/recovery test | Only if schema changed |
| Visual/accessibility | Live browser interaction, width/overflow measurement, existing axe helpers and contrast measurement | Every changed UI phase, both themes |

A component mock cannot certify the API workflow. A screenshot certifies only its viewport/state. A passing token script does not certify rendered contrast. Record these distinctions in phase evidence.

Store implementation evidence under `artifacts/employee-experience-recovery/phase-<NN>/`: summary, tested source revision/overlay, environment identity, checks with exit codes, scenarios and results, visual evidence, blockers and rollback notes. Do not include secrets, real candidate documents or unnecessary personal data. Update the ticket's Comments and evidence link; historical reports remain unchanged.

## 12. Risk and decision register

| Risk / unresolved detail | Resolution point | Default / rule |
| --- | --- | --- |
| Local overlay differs from remote and may contain other work | Phase 0 | Preserve it, identify ownership and snapshot before editing |
| Waiting offer opens a draft form | Phase 2 | Trace source/service/record; no speculative data rewrite |
| Owned/actionable/target job counts differ | Phase 2 | Establish definitions and query scope; label intentionally different metrics |
| Generic task rescheduling or compound activity save unsupported | Phases 3–4 | Reuse proven endpoints; add a minimal explicit contract, not a pretend success |
| Candidate profile reveals other job/pay information | Phases 2, 4 and 8 | Server scopes and field permissions remain authoritative |
| CSS overlays cause different screens to drift | Phase 1 onward | Resolve ownership of tokens/components; remove only proven redundant styles |
| Notion-inspired appearance conflicts with old glass requirements | Phase 1 and ticket 20 | This later design specification takes visual precedence; historical audits remain evidence |
| Shared theme changes break another role/public route | Each shared change and ticket 20 | Check affected consumers immediately, then finish the route coverage matrix |
| Smooth animation adds idle work or larger entry bundles | Phase 0–1 and ticket 21 | CSS/current primitives first; verify reduced motion, imports and before/after traces |
| Dynamic stage configuration conflicts with hard-coded UI | Phases 2 and 7 | Consume current policy/template; preserve historical configuration snapshots |
| Vendor-inspired features inflate scope | Each milestone | Core requirements first; saved views/bulk decisions remain deferred |
| External email/calendar not configured | Phase 7 | Preserve local/link/export behavior with truthful delivery state |
| Migration becomes necessary | Before schema edits | Audit, additive changes where safe, upgrade/recovery rehearsal; no resets |
| Full-suite baseline failure | Phase 0 and 8 | Prove baseline versus regression, assign owner and document any accepted waiver |

Consequential product-rule changes require a recorded decision when current policy cannot resolve them. Routine visual and implementation choices follow this contract and do not require repeated permission requests.

## 13. Completion, rollback and release

### Definition of phase completion

The requested user outcome works against persisted test data; relevant error/empty/permission paths pass; applicable static and focused checks pass; required browser evidence is captured; the diff contains no unrelated changes; and the ticket records what was verified and what remains. Do not mark a phase complete based on compilation, screenshots or test counts alone.

### Rollback strategy

Use the Phase 0 source snapshot and subsequent verified checkpoints. Revert the scoped change or restore its reviewed patch without destructive cleaning of unrelated work. Preserve working classic functionality until its replacement is accepted. For schema changes, define whether rollback is a tested down migration or compatible application rollback plus verified backup recovery; irreversible data loss is not an acceptable default. Recheck protected records, approvals and joined counts after recovery.

### Release packet

Include the exact release source and configuration, included tickets, acceptance matrix, checks, known limitations, recovery result, deployment sequence, smoke scenarios and rollback triggers. Publish only after explicit release authorization. A migration failure, permission leak, false workflow state or broken core hiring action stops the cutover. Local acceptance does not silently change `main`, GitLab or the public site.

### Current delivery status

Version 1.1 adds the separate Notion-inspired system specification, system visual rollout and measured motion/performance acceptance. Phases 0 and 1 are complete for their isolated local and representative scopes; evidence and limitations are recorded in [the baseline](../artifacts/employee-experience-recovery/phase-00/baseline.md) and [visual verification](../artifacts/employee-experience-recovery/phase-01/verification.md). Phase 2 is in progress; later phases have not yet passed their gates. The [delivery tracker](../.scratch/employee-experience-recovery/spec.md) is the current source for ticket and gate status.
