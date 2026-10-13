# RecruitFlow — Local v2 replacement plan

Date: 13 October 2026.
Status: implementation plan only. Execution has not started under this request.

Primary design reference: [RecruitFlow — approved desktop Figma design](https://www.figma.com/design/W0wgsg7tz9ldpbnsxxMgBV/RecruitFlow?node-id=77-3422&p=f).

Use this Figma file as the visual reference throughout implementation, including the Employee, Manager and Admin desktop flows in Light and Dark. The specific business scenario guides are linked under Implementation references below.

## Objective and scope

Implement the approved Figma desktop design in the existing application, then make it the replacement for local v2 at the same preview address. Reuse the current services and preserve existing capabilities, records and history.

- Target local web address: http://127.0.0.1:5173/
- Target local API address: http://127.0.0.1:3000/
- Previously documented test database: Recruitment_V2_Local_20261012. Verify the actual connection before execution; this plan does not establish that the services are currently running.
- Source baseline verified during planning: 16e26b3.
- Existing stack: React/Vite, Nest API, shared contracts, Prisma/PostgreSQL.
- Desktop focus: Light/Dark, IBM Plex Sans, SGH colors and the approved glass/neumorphic treatment.
- Public production, its deployment settings and the original database remain outside this local implementation.
- Mobile is a separate later stage.
- Figma scenario frames become reusable components and data states, not a separate product page for each frame.

## Fixed business rules

1. Every hire requires final hiring approval.
2. The responsible Recruiter records actual joining after approval, without receiving final-approval authority.
3. Required checks follow the job profile. The configured clinical job requires a licence; unrelated technical jobs do not.
4. Offer approval, offer acceptance, final hiring approval and actual joining are separate events.
5. Approved capacity cannot be exceeded; one joining event cannot be counted twice.
6. Organization, team, ownership and action permissions are enforced by the API as well as the interface.
7. Document versions, offer versions, approvals and historical records are preserved.
8. Held jobs retain existing interview, offer and applicable joining commitments.
9. Cancellation resolves existing commitments before closing the job and rejecting active applications with a reason; completed hires and history remain.

## Delivery approach

Each phase includes implementation, relevant checks and evidence of the result. Fix blockers affecting business correctness, permissions or the phase's core workflow before advancing.

Replace modules incrementally inside the existing v2 application, keeping a practical rollback path during development. Retire legacy routes and shortcuts only after their replacement works and compatible links are verified.

### Phase 1 — Establish the local baseline and rollback

**Work**
- Preserve the current source state, uncommitted changes and existing artifacts before modifying anything.
- Use a local implementation branch such as codex/local-desktop-upgrade.
- Verify the isolated database, local file storage and service configuration.
- Take a fresh backup of the test database and required attachments; restore it to a temporary database and compare critical records.
- Prepare clearly identified test users and scenarios for each permission scope while retaining existing records.
- Use controlled test destinations for communication and outbound workers; do not send to real candidates.
- Record current check results so existing failures can be distinguished from regressions.

**Exit criteria**
Local login and data access work against the isolated test database. Source/data recovery is documented and tested, and existing changes are preserved.

### Phase 2 — Shared design system and navigation

**Work**
- Consolidate colors, typography, spacing, glass effects and shadows into shared rules.
- Build or standardize buttons, inputs, cards, tables, badges, tabs, drawers and status messages.
- Implement persistent Light/Dark selection.
- Match the approved navigation: three Employee destinations, three Manager destinations and eight Admin destinations, subject to permissions.
- Remove conflicting styling between old and new components.
- Include loading, empty, error and disabled states, keyboard operation, drawer dismissal and focus return.
- Use explicit component-preview fixtures during visual review; do not present fixtures as live business data.

**Exit criteria**
Compare the shared interface with Figma in both themes at desktop widths of 1280, 1440 and 1920. No clipped content or inconsistent controls/typography.

### Phase 3 — Business rules, permissions and data contracts

**Work**
- Align application and hiring-case transitions so every path to Joined enforces the same rules.
- Separate joining confirmation from FINAL_HIRING_APPROVAL and enforce responsible-Recruiter ownership.
- Apply job-specific requirements consistently to checklist creation, verification, final submission and joining.
- Preserve accepted-case requirement snapshots and verification history.
- Define material changes that invalidate an approval or require review again.
- Enforce narrow access for assigned interviewers, licence specialists and final-approval-only users.
- Keep OFFER_PAY_VIEW independent from VIEW_CURRENT_SALARY.
- Audit the schema first; add migrations only where needed. Verify upgrade and recovery on an isolated database copy.
- Define required fields, rejection/conflict responses and audit events.

**Exit criteria**
API tests prevent approval bypasses and unauthorized access while preserving historical cases. Technical and clinical scenarios enforce their different required checks correctly.

### Phase 4 — Daily work, requisitions, jobs and applications

**Work**
- Implement My Work, Open jobs and the application list within Candidates using real data.
- Consolidate hiring-plan details, capacity, owner and due date within requisitions.
- Connect approval, requested changes, decline and activation according to the applicable policy.
- Implement job details, pipeline, recruiter assignment and screening.
- Retain commitments for held jobs.
- Enforce capacity-reduction and cancellation rules with explicit impact and commitment resolution.
- Connect notifications and deep links to the correct record and organization/team scope.

**Exit criteria**
Create or open a requisition, approve/activate it as appropriate, assign the Recruiter, add an application and move it to Screening. Counts come from persisted records and survive refresh.

### Phase 5 — Complete hiring journey through actual joining

**Work**
- Interviews, evaluation, attendance, no-show and rescheduling; assigned-interviewer-only access.
- Offer approval, versions, revisions, sending, acceptance, decline and expiry.
- Job-specific documents/checks and licence-specialist-only access.
- Final hiring submission, assigned approver review, approval and decline.
- Actual joining recorded by the responsible Recruiter after approval.
- Block joining when checks are incomplete, a required licence has expired, approval is missing or capacity is full.
- Handle repeated clicks and concurrent requests safely; update work queues, counts and history.

**Exit criteria — first complete operational trial**
Run one technical hire and one clinical hire from application to Joined. Count joining once. Verify declined approval, the last available seat, licence expiry and narrow permissions. Final approval alone must not increase completed-hire counts.

### Phase 6 — Candidate bank, imports, documents and communication

**Work**
- Connect candidate bank, talent pools, search, matching and comparison to existing records.
- Add a person to a job while retaining one candidate identity and separate job applications.
- Preserve supported CV/PDF/DOCX/ZIP ingestion and a distinct workbook-import path, including preview, review and error reports.
- Make duplicate decisions explicit and prevent accidental duplicate applications.
- Document versions, previews, downloads and requests.
- Message history, templates, queued/sent/failed states and retry with earlier attempts retained.
- Follow-ups and work-linked notifications.
- Verify messaging through a controlled test destination. Saved configuration is not proof of provider connectivity.

**Exit criteria**
Review and confirm an import containing valid, invalid and duplicate rows; add a bank candidate without duplication; inspect document history; retry a failed message while retaining its history.

### Phase 7 — Administration, configuration and reporting

**Work**
- Users, invitations, roles, permissions, reporting structure and deactivation without deleting history.
- Organization settings, grade bands and workflow-rule impact previews.
- Preserve legacy activity targets and position-level settings separately from seat targets.
- Move business settings currently held in localStorage to authorized durable persistence.
- Templates, integrations, audit and reasoned overrides.
- Team result, reports and exports with existing calculations and authorized scope retained.
- Configuration access must not imply permission to see an individual's salary.

**Exit criteria**
Settings survive application restart and changes are audited. Report/export scope is correct. Deactivation and reporting-line changes preserve history and explicit record ownership.

### Phase 8 — Candidate journeys and staff access

**Work**
- Public jobs, application forms, privacy consent, validation and receipt confirmation.
- Self-scheduling, occupied-slot conflicts and closed/held-job outcomes.
- Candidate own-application portal, document requests and scoped uploads.
- Restore or replace the /portal and /my-applications capabilities with compatible entry paths after checking their access rules.
- Expired/revoked links must not expose another person's records.
- Sign-in, staff invitations, password reset and session expiry; handle draft preservation safely.
- A received candidate upload remains awaiting verification rather than automatically completing a check.

**Exit criteria**
A candidate journey connects to a real application in the test database. Candidates see only their own records. Expired links and applications without required privacy consent are handled correctly.

### Phase 9 — Combined verification and local cutover

**Work**
- Run the 26 business acceptance scenarios across Recruiter, Manager, Admin, final approver, interviewer, licence specialist and candidate roles.
- Run type checking, lint, unit tests and the relevant API/database integration checks.
- Test complete browser workflows, failure paths, concurrency and permission changes.
- Review both themes, keyboard use, tables/drawers and desktop sizes; preserve RTL behavior where Arabic is enabled.
- Review Chrome and Edge locally. Record actual browser coverage; do not infer Firefox/Safari coverage if they were not tested.
- Compare counts, calculations, files and history with the baseline; test existing deep links.
- Once equivalent features work, remove More (classic) shortcuts from the normal experience and redirect old links without bypassing authorization.
- Make the new interface the local default at 127.0.0.1:5173; recheck login, refresh and saved links.
- Exercise local rollback and document startup instructions, results and limitations.

**Exit criteria**
The replacement is available at the usual local address. Every retained capability has a working home, with no unresolved blocker in core business behavior, permissions or data integrity. Other limitations are recorded explicitly. Public release remains a separate later decision.

## Practical review milestones

| Milestone | What is ready to try |
| --- | --- |
| After Phase 2 | Shared visual system, navigation and both themes |
| After Phase 4 | Recruiter daily work, requisitions, jobs and basic applications |
| After Phase 5 | A complete technical and clinical hiring journey through joining |
| After Phase 7 | Employee, Manager and Admin workflows with supporting capabilities |
| After Phase 8 | Candidate-facing journeys connected to internal workflows |
| After Phase 9 | Complete local v2 replacement for operational testing |

## Verification and rollback rules

- Run checks appropriate to each phase and record changes, results and remaining gaps.
- Visual similarity to Figma does not establish correct permissions or business behavior.
- Prefer additive database changes; do not delete records to simplify integration.
- Restoring an older interface is insufficient if its schema is incompatible. Rollback includes compatible source/data or restoration of the isolated local database.
- Keep record-containing backups and attachments local and outside release artifacts.
- Figma names, dates and counts must not become hardcoded production data.
- Routine authorized local implementation can proceed without repeated approval questions. Review milestones provide a concrete result to try.
- Do not change production deployment or run migrations against a public/original database under this plan.

## Available project checks

These scripts exist in the current project. Run them during implementation after validating isolated database and outbound-provider configuration. They were not run as part of writing this plan.

- Types: rtk pnpm typecheck
- Lint: rtk pnpm lint
- Design tokens: rtk pnpm check:design-tokens
- Web/API/worker tests: rtk pnpm test
- Build: rtk pnpm build
- Database tests: rtk pnpm test:db
- Existing browser tests: rtk pnpm test:browser
- Select existing import, storage and notification checks according to the changes; inspect their database and delivery targets before execution.

The ordinary full-stack launcher may load the original database settings. Phase 1 must establish an isolated startup path. Review the previous startup record in artifacts/rollback-review/verification.md before reusing it.

## Implementation references

- [Business baseline and 26 acceptance scenarios](../artifacts/figma-upgrade/business-design-readiness.md)
- [Current-system capability mapping and implementation gaps](../artifacts/figma-upgrade/current-system-integration-map.md)
- [Design verification evidence](../artifacts/figma-upgrade/business-design-verification.json)
- [Previous production/local isolation record](../artifacts/rollback-review/verification.md)
- [Figma — Employee guide](https://www.figma.com/design/W0wgsg7tz9ldpbnsxxMgBV/RecruitFlow?node-id=176-17465)
- [Figma — Manager guide](https://www.figma.com/design/W0wgsg7tz9ldpbnsxxMgBV/RecruitFlow?node-id=177-33352)
- [Figma — Admin guide](https://www.figma.com/design/W0wgsg7tz9ldpbnsxxMgBV/RecruitFlow?node-id=178-19860)

