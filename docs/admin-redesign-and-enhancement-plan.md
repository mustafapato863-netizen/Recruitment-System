# RecruitFlow Admin — Redesign and Enhancement Plan

Version: 1.0 · Prepared: 2 November 2026

Status: complete planning specification; implementation under this plan has not started.

Owner: product owner. Delivery: bounded implementation tickets, independent review and evidence-based phase acceptance.

## 1. Purpose, scope and authority

Create a clear, fast administration workspace that helps an authorized user answer five questions: what needs attention, who can access what, how the organization is configured, which recruitment rules apply, and what changed.

This plan covers the Admin main screens, subpages, workflows, functional enhancements, visual design, API/data implications, implementation sequence and acceptance criteria requested on 2 November 2026. It extends the existing visual rollout with explicitly planned Admin enhancements; the earlier employee plan did not authorize those functional additions by itself.

Use the [Notion-inspired SGH design specification](notion-inspired-design-spec.md) as visual authority, the [employee implementation plan](employee-experience-implementation-plan.md) for recruitment invariants, and [engineering instructions](../AGENTS.md) for delivery. The [employee tracker](../.scratch/employee-experience-recovery/spec.md) now records Phases 0–8 engineering/local verification complete and a separate release decision pending. This is a tracker statement, not fresh verification of every Admin feature. Do not restart historical Phase 2 or use old PR heads as the baseline without checking live repository state.

Plan completion means this specification is ready to implement. Product completion requires the gates below. Public deployment remains a separate owner decision.

### Included

- Eight functional areas: Overview; Users & Access; Organization; Recruitment Setup; Reports; Data; Audit; System Settings. Navigation groups Audit under Settings with a prominent direct link.
- Complete detail views, forms, controlled mutations, compatibility routes, useful empty/error states and real return paths.
- Existing supported capabilities plus the enhancements explicitly described below, delivered after capability/contract verification.
- Both themes; 375, 768, 1024 and 1440 CSS pixels; accessible pointer and keyboard workflows.
- Shared-component regressions in manager, employee and specialist surfaces when Admin changes affect them.

### Boundaries

No replacement of the hiring policy engine, universal Admin access to candidate/pay data, new external messaging provider, payroll/ERP functions, user impersonation, automatic hiring decisions, generic visual workflow builder or unrestricted destructive bulk action. Retention deletion, arbitrary new provider integrations and scheduled automated outreach need separate policy/scope decisions. Existing authorized behavior remains accessible throughout migration.

## 2. Evidence-based starting point

Static inspection on 2 November 2026 found the following in the root working checkout. It has extensive unrelated uncommitted work, including active manager/reporting improvements. This plan does not certify runtime behavior or claim those changes were reviewed.

| Area | Existing source capability | Planning consequence |
| --- | --- | --- |
| Users | `UsersV2.tsx`, `usersApi.ts`; directory, invitation, status, reporting manager, open-work conflict/reassignment | Improve this workflow before adding a separate user manager |
| Roles/access | `RolesV2.tsx`, `rolesApi.ts`, `/access-control`; permission assignment, navigation/RLS configuration and role simulation endpoints | Unify discovery, while preserving server policy and privileged operations |
| Gate inconsistency | `/roles` and its navigation use `USERS_VIEW`; role APIs require `ROLES_VIEW` | Establish intended policy and align route/nav/API tests; never widen API access to match the UI |
| Organization/catalogs | `MasterDataV2.tsx`, `configApi.ts`, classic grid; branches, positions, catalogs and grade bands across existing services | Inventory each entity's real schema before introducing Teams/Departments as editable models |
| Workflow | One pipeline template; stage rename; clinical/technical rule preview/apply and impact data | Preserve the single-template constraint, protected snapshots and preview/reason workflow |
| Templates | Email and WhatsApp adapters exist; current UI is WhatsApp-focused; `/email-templates` redirects to `/whatsapp-templates` | Build explicit channels and preserve old links without displaying the wrong channel |
| Reports | `AdminReportsV2.tsx`; jobs, stage counts, waiting offers, team results, CSV, controlled overrides | Preserve metric definitions, redaction, partial results and override safeguards |
| Audit | `AuditV2.tsx`; `/audit` with `/audit-logs` fallback | Preserve accurate filtering/export boundaries when the fallback is paged |
| Integrations | `IntegrationsV2.tsx`; allowlisted `careers_site` and `smtp`, safe config editing/testing | Keep configured, verified and delivered meanings separate |
| Other configuration | `/settings`, `/settings/targets`, access-control and classic configuration bridges | Inventory and retain all useful controls before retiring overlapping pages |
| Additional features | Admin overview, session directory/revocation, rich template lifecycle, data-quality dashboard, retention/branding controls | Proposed; endpoint, policy and persistence readiness must be proven individually |

Important entry points: `apps/web/src/App.tsx`, `apps/web/src/components/v2/shell/navConfig.ts`, `apps/web/src/v2/admin/AdminRoutes.tsx`, `apps/web/src/v2/admin/`, domain API controllers and `packages/contracts/src/`. There is no general `apps/api/src/admin/` service directory in this checkout; follow actual domain ownership.

Every feature gets one readiness label during A0: **existing and verified**, **existing with a gap**, **new backend required**, or **policy decision required**. No planned feature is presented as working because a button or empty page exists.

## 3. Information architecture and routes

Use seven primary navigation groups: **Overview · Users & Access · Organization · Recruitment Setup · Reports · Data · Settings**. Place Audit as the first visible Settings item, support pinning its existing direct route, and include audit links on relevant records. Use clear page titles rather than repeating the group name everywhere.

The following is a target route contract, not a claim that proposed routes currently exist. Prefer existing canonical paths for existing capabilities; introduce a proposed route only when its functional page is delivered. Keep record IDs, allowed query parameters and source context on old links.

| Navigation group | Subpages / target URL | Compatibility requirement |
| --- | --- | --- |
| Overview | `/admin/overview?tab=summary|attention|health` | New; authorized cards only, with an existing-route fallback when no permitted overview sections exist |
| Users & Access | `/users`, `/users/:id?tab=profile|access|responsibilities|activity`; `/roles`, `/roles/:id`; `/access-control`; proposed `/settings/sessions` | Preserve Users/Roles/access-control links and filters; session page only after backend support |
| Organization | `/master-data?section=branches|departments|positions|grades|teams`; entity detail route/query agreed in A0 | Keep classic master-data and reference IDs reachable; do not invent team IDs from display names |
| Recruitment Setup | `/pipeline-settings?tab=stages|requirements`; `/settings/targets`; `/whatsapp-templates`; `/email-templates`; proposed `/recruitment-setup/evaluations` and template types | Maintain one owner/editor per setting; old settings tabs link to equivalent functional destinations |
| Reports | `/reports?report=overview|funnel|time|teams|sources|headcount` | Preserve manager `/reports` behavior through seat-aware routing; retain filters and permitted drilldowns |
| Data | `/import?dataset=…`; `/import/:dataset/:jobId`; proposed `/data/quality` and `/data/duplicates` | Existing dataset/job identity retained; duplicate page only with supported review/resolution API |
| Settings | `/settings` hub; `/audit-log`; `/integrations`; proposed `/settings/branding`, `/settings/notifications`, `/settings/documents`, `/settings/history` | Safe aliases for supported pages; no dead cards or broad redirects that discard IDs |

Navigation and search must reflect effective permissions and the active organization. Breadcrumbs and Back return to the previous authorized list/filter/page. Direct links have safe fallbacks; external or unauthorized `returnTo` values are rejected. A denied destination must not briefly render protected data.

## 4. Design and interaction contract

### Visual hierarchy

- Use the existing SGH logo, IBM Plex Sans, neutral Light/Dark surfaces and canonical cyan/emerald accents. Avoid separate page palettes or a new UI dependency solely for this redesign.
- Use solid panels, restrained 1px boundaries, shared modest radii and shadows only for floating overlays. Remove decorative glass/glow/ambient effects from affected paths.
- Page anatomy: breadcrumb when useful → icon/title/one-line purpose → one primary action → search/filter toolbar → working content → pagination/status. Detail pages add an identity/status header and contextual tabs.
- Typography starting points: page title 24–28px; section title 16–18px; working text 14–15px; metadata 12–13px; mobile inputs at least 16px. Use existing tokens, not inline page values.
- Use existing spacing steps of 4/8/12/16/24/32px. Keep forms readable and tables compact without browser zoom or scale transforms.
- Data-heavy screens default to rows. Cards summarize a small number of actionable items; they are not wrappers for every field. An overview metric needs a definition, freshness and permitted drilldown.

### Shared components and page behavior

| Pattern | Required behavior |
| --- | --- |
| Admin page frame | Stable heading/action region; responsive navigation and breadcrumbs; correct landmark/heading hierarchy |
| Data toolbar | Labeled search, applied-filter chips, result count, clear-all and explicit refresh; URL-backed shareable filters |
| Data view | Server paging/sort where available, readable row links, column labels, row menus and contained horizontal scroll only when required |
| Detail view | Stable record ID, relevant tabs, status, permitted actions, recent audit context and meaningful Back |
| Edit form | Inline errors, input preservation on failure, Save/Cancel, dirty-state navigation guard and clear persisted-success feedback |
| Drawer/dialog | Short focused action only; named title, focus containment, Escape rules, scroll containment and focus restoration |
| Impact review | Proposed changes, affected scope, protected records, explicit confirmation/reason where required; revalidated on save |
| Section boundary | Independent loading/ready/empty/denied/unavailable/error state and scoped retry; unknown counts are never zero |
| Export feedback | Permission-aware scope, filters, result count/completeness and retry; cancellation if long-running backend work supports it |

Use one existing shared component per meaning, extending primitives deliberately. Audit real `PageFrame`, `DataToolbar`, `ResponsiveDataView` and v2 primitives before choosing wrappers. Do not build a parallel Admin component framework.

### Icons

Use existing Lucide/shared outline SVGs with a consistent stroke convention: Overview `LayoutDashboard`; Users `Users`; permissions `ShieldCheck`; Organization `Building2`; recruitment `Workflow`; templates `FileText`; reports `ChartNoAxesCombined` or existing equivalent; import `Upload`; audit `History`; integrations `Plug`; settings `Settings`. Confirm each glyph is available in the installed version. Use 16px metadata, 18px controls and 20px navigation where consistent with shared primitives. Meaningful actions retain labels; standalone utilities have accessible names. These are Notion-style metaphors, not a claim of identical proprietary assets.

### Responsive, accessibility and motion

- Validate 375/768/1024/1440px in both themes, including long names, many permissions, wide tables and error messages. No document-level horizontal overflow.
- On phones, move secondary filters into the established sheet, preserve the primary action, wrap labels and use row summaries/detail disclosure when suitable. A matrix may scroll inside its own labeled region.
- Verify full keyboard traversal, logical focus order, dialog containment/return, screen-reader labels and error announcements. Preserve existing RTL behavior; adding a language is outside this task.
- Target text contrast at least 4.5:1, large text 3:1 and meaningful control/focus boundaries 3:1. Measure rendered states, including selected/disabled/error states. Practical touch controls target 44×44px.
- Motion target: hover/focus 100–150ms; menus/tabs 120–180ms; drawers/dialogs 180–240ms, within the canonical specification. Prefer opacity/transform; no idle animation, bounce or decorative page entrances. Reduced motion removes spatial transitions while preserving state feedback.

## 5. Screen specifications

### 5.1 Overview

**Purpose:** identify an actionable configuration or operational problem without inspecting every setup page.

**Summary:** show at most six useful metrics from authorized sources: active users, pending invitations, open jobs, pending decisions, failed import batches and delivery issues. Label time range and scope on each metric. Counts from inaccessible modules are omitted; failed reads show unavailable with retry. Pending hiring decisions are links to the real responsible-role queue, not new Admin approval powers.

**Needs attention:** prioritized rows contain issue type, affected record, owner/responsible actor where known, detected time and one action. Initial types: blocked user deactivation, failed import, invalid/incomplete supported integration settings, missing required configuration. Do not invent priorities or SLA thresholds; use explicit policy or factual age labels.

**System health:** display application-visible provider configuration/test status and supported import/delivery queue status with last check time. Infrastructure metrics need a redacted health projection; do not expose host paths, connection strings or secrets.

**Layout/actions:** compact title and date/scope filters; summary above an attention list; small health section below. Quick actions are Invite user, Add organization value and Review failed import when permitted. Each drilldown preserves filters.

**Acceptance:** every tile reconciles with its destination under the same scope/time; a failed module leaves other sections usable; a viewer without a module permission never receives its data.

### 5.2 Users & Access

**Users directory:** columns name/email, role/seat, branch/team if supported, manager, status and last login when recorded. Search name/email; filter status/role/scope; sort/paginate according to API. Statuses reflect actual server values such as invited/active/inactive; do not invent online status.

**Invite user:** name, email and eligible role IDs, plus scope fields supported by policy. Detect duplicates; preserve input on failure. Distinguish invitation created, delivery queued/failed and invitation accepted. Re-send/revoke requires actual invitation lifecycle support and permission checks.

**User detail:** Profile (identity/status), Access (roles/effective capabilities/scope), Responsibilities (manager and owned open work), Activity (permitted access/audit events). Linking from Users to Organization must refer to the same authoritative record.

**Deactivate/reactivate:** use existing status APIs. Deactivation that returns `USER_OWNS_OPEN_WORK` shows exact known counts or an explicit unknown state, eligible reassignment targets, required reason and remaining work. Existing file override does not prove jobs/requisitions/tasks were reassigned: handle each existing domain path, recheck ownership and deactivate only after the server permits it. Preserve histories and completed work. Protect last eligible administrator and self-lockout according to audited existing policy; add missing enforcement if the approved capability requires it.

**Roles & permissions:** role directory and detail with module-grouped permissions; separate read/manage/approve/export capabilities. Show effective access versus assigned role facts distinctly. Stage edits locally, show additions/removals, save with conflict handling and an audit record. If the existing API applies one grant at a time, add an atomic change contract or visibly report partial outcomes and reload canonical state; never claim all saved after one operation failed. Preserve supported role creation/archive behavior; locked system roles explain their restrictions.

**Team access / responsibility scope:** expose existing reporting, navigation/RLS and responsibility settings with plain-language scope descriptions and server-backed simulation. A simulation is diagnostic; it does not impersonate a user or authorize access. Empty permissions cannot become allow-all.

**Sessions:** new capability unless verified in A0. Authorized session list: user, device/session label, created/last-active timestamps and expiry where captured; revoke one or all allowed sessions with confirmation. Enforce session revocation server-side, including the refresh lifecycle; never display tokens. Minimize IP/device detail to what policy permits.

**Acceptance:** user changes persist; invitation state is truthful; blocked deactivation cannot bypass reassignment; role changes do not elevate the actor unexpectedly; direct API/URL access and stale writes are covered; session revocation actually prevents subsequent protected use.

### 5.3 Organization

**Branches & sites:** search/filter active state; detail shows code, name and existing location/timezone fields, related departments/positions and permitted usage counts. Create/edit/archive/reactivate through existing domain rules. Treat site/branch as distinct only if the schema does.

**Departments:** list code/name, branch relationship if supported, responsible manager and status. Detail shows associated roles/jobs and reference impact. A catalog without relational department ownership cannot safely support a fabricated department manager: add a reviewed model/contract only if needed.

**Teams & reporting:** readable tree and equivalent searchable list, manager/membership details and unassigned users. Validate self-reference, cycles, cross-organization references, inactive managers and reporting scope changes on the server. Reuse existing manager links if they define teams; create a separate Team model only when the data semantics justify it.

**Positions/job titles:** code, title, department, level/grade, technical/clinical profile and active status where supported. Link profile edits to the workflow impact review rather than duplicating clinical/technical policy in a second form.

**Grades & bands:** grade and site/branch association, currency, effective status and salary amounts only for authorized responses. Validate minimum ≤ maximum, currency and uniqueness rules. Distinguish catalog maintenance permissions from candidate/offer pay access. Do not derive salary from a generic Admin seat.

**Lifecycle rule:** archive/deactivate referenced values while retaining historical labels/relationships. A renamed current label must not rewrite a historical snapshot whose meaning is immutable. Explain active usage before a change; reject unsupported deletion.

**Acceptance:** one edit updates every legitimate consumer after refresh; no historical record is orphaned; team changes cannot form cycles or expand tenant scope; redacted band fields stay absent in responses and exports.

### 5.4 Recruitment Setup

**Workflow stages:** ordered stage rows show label, stable type, entry/exit prerequisites, enabled/archive status and allowed next actions. Preserve the existing single-template rule: do not offer duplicate/multiple-template/delete controls prohibited by `SINGLE_PIPELINE_TEMPLATE`. Expose rename and other edits only where server policy supports them. Reordering/removing stages is not implied by the visual list. If no template exists, expose only the existing permitted initialization path.

**Hiring requirements:** position-to-clinical/technical profile mapping and the existing preview/apply workflow. Before applying, show affected open cases, protected vacancies/snapshots, blocked impacts and required reason. Revalidate impact at save; stale preview cannot override newer state. Preserve clinical/technical differences and completed/historical cases.

**Targets & headcount settings:** retain `/settings/targets` and its existing authorized scope. Display level/position, applicable period/site, target, effective status and recorded definition. Distinguish productivity targets from approved hiring headcount; do not silently recalculate reports using the other measure. Changes explain their impact on existing reporting periods.

**Evaluation forms:** list existing interview/scorecard definitions if present; otherwise deliver a versioned form capability with type, required questions, rating scale and criteria before exposing editing. Validate scales, required fields and permitted question types. New versions affect only the agreed future-assignment scope; submitted evaluations retain their original schema/version. No generic form builder is required.

**Reasons & sources:** maintain rejection, hold, close, reassignment and candidate-source catalogs where supported. Stable codes/IDs, readable labels and active/archive state; reactivate an existing duplicate rather than creating a second identity. Preserve reason-required and Other-note policies.

**Acceptance:** stage naming does not change stage semantics; invalid transitions still fail on the server; impact previews are current; closed hires and submitted scorecards retain history; settings applied to one position do not affect unrelated positions.

### 5.5 Templates — inside Recruitment Setup

**Template library:** type/channel tabs, name, usage category, status/default, updated time/actor where available, search and permitted create/edit/archive. Begin with the supported WhatsApp and email adapters. Offer, interview and job-description template tabs require a real model and consumers before release; no placeholder pages.

**Editor:** name, channel/type, category, subject for email, body, permitted variables and synthetic preview. Preserve unsaved text when switching tabs or leaving. Reject unknown/unsafe variables; escape rendered content according to channel. Missing variable values are shown as unresolved in preview, never silently replaced with invented facts.

**Default and version behavior:** preserve existing default-template archive restrictions. Record version/change history; for providers that only support current-template edits, preserve a send-time rendered/version snapshot before promising historical reconstruction. Draft/publish and rollback apply only once backend lifecycle support exists. Restoring an older version creates a new version; it does not rewrite sent messages.

**Channel migration:** `/email-templates` must open email content once its functional UI exists. Until then, the existing behavior is explicitly accounted for in the compatibility inventory. Do not relabel WhatsApp as Email. “Preview” renders locally; “test connection” is not a delivered message.

**Acceptance:** valid placeholders render; unsupported values fail clearly; permissions distinguish view/manage; sent communication remains tied to the right content/version; archive cannot break a protected default or active requirement.

### 5.6 Reports

**Shared report frame:** report selector, time period, timezone, branch/site, job and team filters only where supported. Show applied scope, data freshness, metric definitions, coverage/omitted records and export action. A global filter must not appear to apply to a section whose API cannot filter it; label that section's true scope or implement the server filter first.

**Hiring overview/funnel:** job status totals and stage distribution, stage entries/exits or cohort conversion with an explicit definition. Current stage stock is not historical conversion. Drilldowns retain the same definition, denominator and scope.

**Time metrics:** time to fill, time to hire and stage duration only after event endpoints, timestamp semantics, timezone, inclusion of still-open work and excluded states are documented. Distinguish average/median and sample size. Never infer time from last updated timestamps alone.

**Team results:** reuse existing results services and ongoing manager analytics work. Display the same measures, reporting scope, sample thresholds and missing-data states. Do not recalculate scores in the browser or create a different Admin formula.

**Source performance:** applications, qualified candidates and actual hires by recorded source, with explicit attribution for people having multiple applications, unknown sources, cohort windows and small samples. No causal “best source” claim from raw totals.

**Headcount:** requested, approved, offered, finally approved and actually joined counts are separate. Joined count changes once at actual joining, subject to capacity policy. Preserve the distinction between person counts and application counts.

**Overrides:** retain existing Admin hold/reopen/close operations with current allowed-state checks, reason catalog/free-text rules, optional hold-until, audit and conflict handling. Treat reassignment as its dedicated operation. Present a clear contextual action rather than a normal hiring step; no blanket transition override.

**Exports:** use server authorization and scoped projection; filtered complete export or clearly labeled current page/loaded rows. CSV neutralizes formula-leading cells. Large exports require bounded/streaming/job support before advertising complete results. Exported fields obey the same sensitive-data restrictions as the screen.

**Acceptance:** UI, drilldown and export reconcile on dedicated fixtures; source failures do not become zero; filters and time boundaries are truthful; stale/unauthorized overrides fail without changing a job; manager reporting remains unchanged unless its own accepted work changes it.

### 5.7 Data — Imports, duplicate review and quality

**Import start:** dataset selection → current template download → upload → mapping if supported → validation → review → confirm → durable result. Clearly identify candidate, requisition or master-data mode. Separate view, create/stage and confirm permissions per dataset; broad route access never grants all actions.

**Batch history/detail:** ID, dataset, creator, times, status, known progress and counts. Reopen by durable URL. Review successful/failed rows, validation messages and safe error export; retry supported failed rows with defined idempotence. A staged batch is not a confirmed import.

**Duplicate review:** candidate/existing record comparison with match reasons and authorized fields. Begin with link/reuse/select-existing resolution when policy supports it. Do not add irreversible merge merely because two emails match. Ambiguous identities remain pending. If true merge is separately approved, require transaction/audit, provenance, history and relationship preservation, conflict preview and explicit recovery design.

**Data quality:** actionable findings from authoritative server queries: missing mandatory fields, invalid references, unresolved duplicate matches and failed mappings. Each finding links to the correct authorized record; filters and counts reconcile. No automatic deletion, record mutation or background “cleanup” is implied.

**Acceptance:** duplicate upload/confirm/retry does not duplicate a person/application; one person with two applications keeps independent stages; cross-organization batches are inaccessible; row-level failures survive reload; completed historical data is preserved.

### 5.8 Audit

**Views:** All events, Access changes, Workflow decisions, Imports and Configuration. These are saved server-filtered views of one authoritative log, not separate duplicated histories.

**List:** occurred time/timezone, actor (including recorded system actor), action, entity type/reference, result when recorded, organization/scope and correlation ID where available. Search/filter date range, actor, action and entity; paginate on the server. Link only to permitted entity views; an actor's display name is not a substitute for stable identity.

**Event detail:** human-readable summary, sanitized before/after field changes, reason, related batch/version and correlated events. Distinguish unavailable/redacted values from null/deletion. Credentials, tokens and unnecessary personal data must not enter the audit payload or DOM.

**Integrity/export:** Admin has read/export according to policy; no edit/delete log controls. If `/audit-logs` fallback cannot apply a filter globally, label results as filtered loaded page or add backend support before showing global totals/exports. Preserve immutable event semantics and export scope.

**Acceptance:** a configuration change appears once with the correct actor/entity/reason; denied writes produce only events actually captured by current policy; redaction survives detail/export; paging and date boundaries do not omit or duplicate matching events.

### 5.9 System Settings

**Settings hub:** grouped searchable links with purpose and current status only where known. Make Audit immediately visible. Avoid a wall of decorative cards and duplicate editors for the same setting.

**Branding:** approved logo assets, product/organization display label and supported theme settings, synthetic preview and restore-to-approved-default. Preserve SGH identity and canonical tokens. Arbitrary CSS/script, unverified external assets and arbitrary inaccessible colors are excluded. Persist only settings backed by server configuration; show static brand guidance instead of a fake editor if branding is deployment-controlled.

**Notifications:** supported event/channel rules, recipient scope and permitted user preferences; distinguish mandatory policy-driven events from optional preferences. Preview recipient logic using synthetic examples, guard against loops/duplicates and show persisted settings. Do not promise schedule/silent-hours behavior unless the worker supports it. Reuse the actual event registry.

**Email & integrations:** existing careers-site/SMTP settings with redacted public fields, configured/disabled/unverified/failed states and actual last-test outcome. Save does not mark Connected; existing SMTP testing does not prove delivery. Treat connection tests as explicit actions; use controlled local sinks during testing. Additional providers require separate scope.

**Documents & retention:** allowed file types/sizes and safe validation/storage rules where configurable; counts/usage only from verified projections. Retention settings initially show the current effective policy and change history. Any deletion schedule requires separate approved retention/legal rules, preserved holds, scoped preview, recovery and protected-record tests before enablement. Uploading evidence does not verify a hiring requirement.

**Configuration history:** link settings changes to the existing audit log; show version/actor/time/reason and before/after values. Offer restore only for a setting with validated reversible semantics, creating a new audited change. Do not imply universal rollback.

**Acceptance:** settings survive reload and affect the real consumer; concurrent edits are not silently overwritten; failed saves retain input; secret values are write-only or redacted in every response; notification/provider labels describe recorded facts.

## 6. Essential workflows across screens

| Journey | Required sequence and observable result |
| --- | --- |
| Invite and configure | Users → invite → real invitation result → role/scope detail → permitted acceptance → active account; no excess access |
| Departing recruiter | User → responsibilities → blocked deactivate → eligible per-domain reassignment → verify remaining work → deactivate; completed history retained |
| Change access | Role → inspect effective scope → stage permission changes → review impact → save/reload → verify access as affected test identities → audit |
| Change organization | Catalog/detail → usage impact → edit/archive → refresh legitimate consumers → historical relationships remain readable |
| Change requirements | Position → technical/clinical preview → protected/affected list → reason/apply → server revalidation → future/open-case behavior matches policy |
| Correct message template | Channel library → edit → validate variables/preview → supported save/publish → use synthetic consumer → audit/version history |
| Recover failed import | Attention/history → exact batch → validation failures → correct/retry supported rows → confirm → durable count/identity check |
| Investigate a report | Metric definition/scope → filter → permitted records → export same scope → explain omissions; no silent widening |
| Resolve a provider issue | Health → integration → inspect public configuration → save → explicit safe test → recorded verification result; no false delivered label |
| Trace a change | User/job/setting detail → filtered audit → sanitized event → authorized related entity → Back restores investigation filters |

## 7. Authorization, correctness and data contracts

### Permission mapping

Verify the current catalog, route guards and service checks; labels below identify known families, not permission grants created by this document.

| Capability | Existing permission family / requirement |
| --- | --- |
| User view / manage | `USERS_VIEW` / `USERS_MANAGE`; per-action server checks |
| Role view / manage | `ROLES_VIEW` / `ROLES_MANAGE`; resolve current frontend mismatch |
| Organization/catalog view / manage | `MASTER_DATA_VIEW` / `MASTER_DATA_MANAGE`, plus actual domain-specific constraints |
| Workflow configuration | `OVERRIDE_WORKFLOW` where existing route/service requires it; inspect workflow-rules policy separately |
| Reports/record drilldowns | Existing report/application/result policy, including team/tenant and sensitive-field rules |
| Audit | `AUDIT_VIEW`; verify export policy independently |
| Template/integration management | Actual template/integration controller guards; do not assume an Admin navigation seat is sufficient |
| Sessions, quality, branding and new settings | Define specific server permissions or deliberately reuse an appropriate existing capability after review; no generic `isAdmin` shortcut |

Authentication and permission checks apply at API entry and service/domain boundaries. The organization comes from the authenticated context; a client-supplied organization/user ID cannot broaden scope. Every new list/search/export uses the same authorization and redaction as detail/mutation. Verify existing Administrator bypass semantics explicitly rather than changing them accidentally. Grade-band maintenance visibility does not grant pay visibility for all candidate offers.

### API and state requirements

- Trace route → DTO → service → persistence → shared contract → API adapter → component before editing. Reuse existing clients; no raw unscoped request path in a new page.
- Paginate large collections at the API; honor existing page-size limits. Do not gather every user/report record on initial render solely to calculate a badge. Add bounded aggregates only where justified.
- Use explicit section state unions and typed errors; distinguish 401, 403, missing entity, unsupported capability, conflict, validation and transient failure. A 404 is not automatically an empty result or unsupported feature.
- Keep critical validation and writes authoritative on the server. Add version/ETag/expected-state support where necessary for conflicting Admin edits; preserve drafts while reloading updated server state.
- For preview/apply workflows, recompute or validate the preview revision in the apply transaction. Expired/stale impact requires review again.
- Use established idempotency/uniqueness/transaction patterns for invitations, batch confirmation and version publishing. Disable duplicate clicks for feedback, but do not rely on that for correctness.
- Commit the business write and its required audit record consistently under the existing transaction/outbox model. A failure cannot return a false success.
- Secret update forms do not receive stored values back. Exclude secrets from errors, logs, audit diffs, exports, screenshots and browser persistence.
- Do not cache protected data across users, organizations or changed scopes. Clear relevant queries when access changes; reauthorize mutations against current state.

### Schema change gate

Inventory existing models first. Prefer safe application changes when the existing schema suffices. Possible additions such as template versions, session records, data-quality jobs or configuration versions need a reviewed model, ownership, indexes, uniqueness, foreign keys, nullability, backfill and retention policy. Produce a Prisma migration and generated contracts/client where required; verify upgrade and an actual rollback or forward-recovery procedure on disposable data. Never alter existing recruitment data simply to make a new view consistent.

## 8. Performance and loading

- Lazy-load Admin pages and heavy chart/import/template-preview modules. Keep spreadsheet/PDF parsing and full permission matrices off the initial Overview path until needed.
- Load only visible/selected tabs; use bounded parallel requests for independent Overview sections. Prevent N+1 user/role/report requests with scoped projections or bounded existing patterns.
- Debounce search through established utilities, cancel obsolete requests and keep rows stable while refreshing. Do not reset filters, selection or focus after every successful change.
- Prefer server totals; identify incomplete/omitted datasets. Use paging and measure before adding virtualization, which must preserve keyboard and selection behavior.
- Preserve current entry budgets: main JS raw 500 KiB, gzip 150 KiB; main CSS gzip 60 KiB; raw CSS 225 KiB is an advisory. Verify against current budget tooling; record Admin route chunks separately.
- Baseline and compare cold/warm Overview, Users search, role editor, report filter, import review and settings save. Record environment, fixture size, requests/bytes, long tasks, render/paint and input acknowledgement. Local p95 visible acknowledgement target ≤100ms uses at least 20 comparable interactions; it excludes server completion.
- Record any regression with a cause and resolution. Lab measurements do not establish field Core Web Vitals or an API speedup.

## 9. Delivery phases and ticket backlog

Use independent Admin ticket IDs to avoid overwriting employee ticket history. All tickets start **planned**, not implemented. Each has implementation, focused verification, evidence and independent acceptance. Stop advancement at a failed dependency gate; research/preparation can continue read-only.

| Phase | Tickets / concrete deliverables | Dependencies | Exit gate |
| --- | --- | --- | --- |
| A0 — Baseline and scope | ADM-01 capability/route/API/permission inventory; ADM-02 source snapshot, disposable fixtures, regression and performance baseline | Current review branch and active-work ownership verified | Every subpage classified; policy/schema gaps explicit; recovery/data test boundary verified |
| A1 — Shared Admin shell | ADM-03 grouped navigation, route compatibility and context; ADM-04 frame/toolbar/list/form/dialog/section states and representative previews | A0 | Users, report and settings examples work in both themes/widths with keyboard/contrast evidence |
| A2 — Users and access | ADM-05 directory/detail/invitations; ADM-06 role/scoping reconciliation and safe permission edits; ADM-07 deactivation/reassignment; ADM-08 sessions | A1; session lifecycle inventory for ADM-08 | Provision/deactivate/access/revocation journeys persist; role/tenant/lockout failures covered |
| A3 — Organization | ADM-09 branch/department/position catalogs and lifecycle; ADM-10 reporting tree, grades/bands and usage impact | A2 scope contract; confirmed entity model | References/history intact; cycles/duplicates/pay restrictions tested |
| A4 — Recruitment setup | ADM-11 pipeline and profile impact; ADM-12 targets/reasons/sources/evaluation forms; ADM-13 channel-correct template library/editor; ADM-14 template versions and supported lifecycle | A3 identifiers; accepted existing workflow/report definitions | Real consumers use saved values; stable stage semantics, evaluation/template history and protected snapshots pass |
| A5 — Data tools | ADM-15 dataset-aware import/history/retry; ADM-16 duplicate reuse/review and quality findings | A2 permissions; A3 catalogs; matching/import contracts | Duplicate/retry/validation/tenant scenarios pass; findings link to actual records |
| A6 — Reports and Overview | ADM-17 metric dictionary/filter/export/override consistency; ADM-18 Admin Overview and attention/health aggregation | A4 definitions; A5 batch statuses; accepted manager analytics contracts | Metrics reconcile with drilldowns/exports; partial failures and all filters are truthful |
| A7 — Audit and settings | ADM-19 audit investigation and configuration history; ADM-20 branding/notifications/provider settings; ADM-21 document policy and retention inspection | A2 audit events; A4/A5/A6 consumers | Settings affect consumers; sanitized audit, provider-off, conflict and policy paths verified |
| A8 — Integrated acceptance | ADM-22 route/role/visual/accessibility/performance matrix and recovery rehearsal; ADM-23 final owner walkthrough/release packet | A0–A7 accepted | No core blocker; all evidence tied to candidate revision; deployment waits for explicit owner decision |

Recommended first implementation slice: ADM-01/02 → ADM-03/04 → ADM-05/06/07. This produces a reviewable Users/Access journey before optional dashboards. ADM-08, richer template types and policy-dependent retention features must have real backend contracts before their pages ship; they cannot be silently marked complete as placeholders.

### Parallel delegation and review

Use Grok `grok-4.7-build-fast` with `xhigh` for bounded implementation and AGY `gemini-4-argon-high` with high effort for independent review/fixes, reflecting the owner's established preference. Confirm available model names when launching. The orchestrator owns dependency coordination, source/evidence review and phase decisions; implementation/QA delegates own coding and their checks. Do not repeat identical delegate checks without a new change/failure or evidence gap.

Permitted parallel lanes after A1: user detail versus isolated organization catalogs; template editor versus import screens; read-only report contract audit versus unrelated UI work. Shared routes/navigation, common CSS, permission contracts, schema/migrations and report metric changes have one writer at a time. Each lane needs its own worktree/branch, explicit owned files, exact base revision and no-overlap boundary.

Use bounded tasks and observable checkpoints. Lack of a final response is not success. If Grok stalls, preserve status/logs/diff and hand the specific remaining work to AGY promptly; if both fail on setup, diagnose the setup instead of repeatedly dispatching the entire plan. Reassignment must identify partial files and current owner before a new writer begins.

After initial accepted integration, continue locally as the owner requested; GitHub PRs are used only for agreed review/integration checkpoints, not for every minor edit. Commit/push/merge remain subject to existing task authorization and verified current branch state. This documentation task performs none of them. Keep production, `main` and GitLab outside local implementation changes unless separately authorized.

## 10. Acceptance matrix

The implementer records PASS, FAIL, BLOCKED or NOT RUN for each applicable case, environment identity, source revision, role and evidence. Mock/unit proof and persisted API/browser proof are separate fields.

| ID | Scenario | Required result |
| --- | --- | --- |
| ADM-AC01 | Existing Admin URLs and bookmarks | Correct functional destination, entity/channel/filter identity and authorized Back preserved |
| ADM-AC02 | View-only user across all modules | Can read permitted data; direct mutation, hidden routes and exports are denied according to server policy |
| ADM-AC03 | Invite duplicate/retry/delivery-off | No duplicate identity; truthful invitation/delivery state; no real external message |
| ADM-AC04 | Deactivate user owning work | Server blocks until eligible domain reassignments complete; task/history ownership remains consistent |
| ADM-AC05 | Role edits and stale/concurrent save | Correct resulting permissions, conflict recovery, audit and last-admin safeguards; no partial false success |
| ADM-AC06 | Session revoke | Revoked session/refresh lifecycle loses protected access; permitted active sessions behave correctly |
| ADM-AC07 | Reporting manager and tenant manipulation | Cycles, invalid/inactive references and cross-organization changes rejected |
| ADM-AC08 | Catalog archive/rename/retry | IDs/history remain intact; duplicate/reference rules enforced; consumer selections stay truthful |
| ADM-AC09 | Band maintenance and offer pay | Exact policy enforced in API, detail, report, export and preview; no salary leak |
| ADM-AC10 | Stage/profile/target changes | Single-template policy, gates, protected snapshots and configured clinical/technical behavior preserved |
| ADM-AC11 | Evaluation/template versions | Future-use policy correct; submitted scores/sent content preserve their original definitions |
| ADM-AC12 | Email/WhatsApp preview and archive | Correct channel, valid/invalid variables, default protections, dirty-state guard and persisted outcome |
| ADM-AC13 | Import stage/confirm/invalid/duplicate/retry | Per-dataset rights, exact batch identity, row errors and durable idempotent results |
| ADM-AC14 | Duplicate person with two applications | Authorized reuse preserves independent stages and all documents/history; no silent merge |
| ADM-AC15 | Reports/drilldowns/export | Scope, definition, timezone, denominator and completeness reconcile; formula cells neutralized |
| ADM-AC16 | Admin hold/reopen/close/reassign | Allowed states/reasons/current versions enforced; no unintended transition or historic deletion |
| ADM-AC17 | Overview and partial failures | Authorized totals reconcile; failed sections are unknown with retry; healthy sections stay usable |
| ADM-AC18 | Audit search, paging, redaction and export | Correct immutable records and scope; no secrets or misleading global filtering on partial pages |
| ADM-AC19 | Settings save/conflict/consumer effect | Real persisted configuration and effective consumer behavior; errors preserve input |
| ADM-AC20 | Provider test/notification rules | Configured/tested/delivered states distinct; local test sink and disabled delivery respected |
| ADM-AC21 | Responsive/theme/long content | Required surfaces usable at all four widths in both themes; no document overflow or lost primary action |
| ADM-AC22 | Keyboard/labels/focus/contrast/motion | End-to-end keyboard paths pass; overlays restore focus; measured thresholds and reduced motion pass |
| ADM-AC23 | Loading/empty/filter-empty/403/404/error/retry | Correct state meaning and recovery on each affected list/detail/form; draft survives unrelated failures |
| ADM-AC24 | Data volume/performance/cache isolation | Budgets and comparable measurements recorded; no unbounded reads, unexplained regression or cross-user cache leak |
| ADM-AC25 | Recovery and existing workflow regression | Exact candidate source/data recovery demonstrated; employee/manager/specialist functions and protected historical records retained |

Use at least two synthetic organizations, full administrator, delegated user administrator, role administrator, catalog viewer/manager, auditor, read-only report viewer, recruiter, manager, interviewer, licence specialist and final approver combinations as relevant. Include mixed permissions and permission removal while a form is open. These are fixture capabilities, not newly invented production roles.

## 11. Verification and evidence

Recheck actual package scripts before running. Execute focused checks for changed boundaries first, then the relevant integration/static gates once. Repeat only after new edits, failures or unresolved concerns.

| Gate | Current entry / scope |
| --- | --- |
| Frontend focused | `rtk proxy pnpm --dir apps/web test <affected paths>`; relevant Admin suites include `UsersRoles`, `Config`, `Ops`, `WorkflowRules` and override-error cases |
| API focused | Existing API test runner restricted to changed users/roles/access/catalog/pipeline/templates/integrations/audit/reports/import specs |
| Static | `rtk proxy pnpm typecheck`, `rtk proxy pnpm lint`, `rtk proxy pnpm check:design-tokens` for applicable affected surfaces |
| Build/budget | `rtk proxy pnpm build`, then `rtk proxy pnpm check:bundle`; verify the tool found actual assets and record Admin chunks |
| Database | `rtk proxy pnpm test:db` and focused affected DB specs only on verified disposable synthetic data |
| Imports/storage | Existing `test:master-data-import`, `test:bulk-import`, `test:cv-storage` as affected, after setup/cleanup review |
| Browser | Existing `test:browser`/`test:browser:master-data` where relevant plus missing Admin journeys; authenticated real API mode distinct from interception |
| Visual/accessibility | Live interactions, screenshots per state, exact widths/themes, keyboard traversal, existing accessibility helpers and measured contrast |
| Migration | Actual schema validation/client generation and disposable upgrade/backfill/recovery evidence only if a schema changes |

For persisted checks, use the verified disposable Docker setup or an equivalent authorized local environment with synthetic identities, isolated storage and delivery disabled. Revalidate a historical environment before reuse; do not assume old process/volume names prove safety. Use the established no-project-`.env` boundary for these synthetic acceptance runs. A helper that loads project environment files must be replaced or safely isolated before execution. No production recruitment data or external messaging.

Store evidence under `artifacts/admin-redesign/phase-A<n>/`: revision/overlay manifest, environment/fixture identity, API/permission trace, exact checks and exit codes, acceptance table, screenshots/contrast/keyboard/performance observations, unresolved gaps and recovery notes. Exclude credentials and real personal data.

A screenshot proves only its viewport/state. Token lint does not certify contrast. A mocked response does not certify durable writes. A successful CI database suite does not certify every browser journey. Record the useful evidence and its limits without rerunning unrelated suites as a substitute for missing scenarios.

## 12. Definition of done and delivery packet

A ticket is accepted only when its entire affected path works: permitted entry → correct data → intended action → durable result → useful return; denied/empty/error/retry/stale variants remain correct; relevant focused/static checks pass; the diff is scoped and reviewed. No self-approval by an implementation agent.

A phase additionally requires its complete screen/role matrix, affected shared-consumer regression, both themes/widths, keyboard/contrast and linked evidence. Newly discovered policy or schema scope is resolved explicitly; baseline failures are named and either corrected or accepted by the appropriate owner with rationale.

The final packet includes route compatibility/coverage, capability and permission matrix, approved metric dictionary, schema/change/recovery records, current acceptance evidence, measured performance, known limitations, local/UAT walkthrough and an exact candidate revision. The owner receives a concrete result before any release decision.

Progress is reported as accepted tickets and completed gates against this backlog, not an invented overall percentage or the number of files changed.

## 13. Open decisions and default handling

| Decision | Default until evidence establishes more |
| --- | --- |
| Teams/departments are catalogs versus independent entities | Reuse existing model and manager relationships; no speculative schema |
| Roles UI/API gate mismatch and Admin bypass | Server policy is authoritative; document intended exceptions and align route/navigation |
| Multiple pipelines or free-form transition editing | Existing single template and domain gates remain enforced |
| Richer template types, versions and publishing | Deliver only backed types/lifecycle; add contracts and history before exposing new controls |
| Session administration | Implement only after actual token/refresh revocation semantics and auditing are defined |
| Report definitions and manager changes in progress | Reuse accepted server definitions and coordinate with the active analytics owner |
| True candidate merge | Reuse/link existing identity first; destructive merge needs separate approval/design |
| Retention deletion and legal periods | Read-only effective policy/impact; no invented period or automatic deletion |
| Branding/runtime settings | Preserve SGH and deployment-controlled fields; enable editors only for supported persisted settings |
| Time estimates | Estimate after A0 classifies gaps; no delivery dates implied by ticket numbers |

## 14. First implementation brief

Start with **ADM-01 and ADM-02 only**. Read the current route tree, navigation, Admin UI/adapters, relevant API guards/services, contracts and closest tests. Establish the current accepted review branch and all unrelated local work. Produce the capability/route/permission compatibility inventory for every subpage in this plan, list missing endpoints/models and report policies, and prepare verified disposable fixture/recovery/performance baselines. Preserve active manager/reporting work. Do not implement the whole Admin system in one run.

Return a bounded A0 report with: verified facts and source locations; proposed new scope; decisions required; exact available test commands; isolated environment evidence; owned-file map for A1; unresolved blockers; acceptance recommendation. Proceed to A1 only after independent review accepts A0. Use this plan's page specifications and ticket dependencies for subsequent individual briefs.
