# RecruitFlow Role Playbooks & Error-Code Troubleshooting FAQ

Grounded user & support reference derived from live `v0.2.0` UI routes, server error codes, and gate preconditions.

---

## 1. Playbooks by User Persona

### Recruiter (`employee` seat)
- **Daily Queue (`/my-work`):** Triage urgent tasks, follow-up due dates, and stalled candidate files (`J`/`K` keyboard shortcuts supported).
- **Review Open Jobs (`/vacancies` → `/vacancies/:id`):** Track open seats, open `Import CVs` drawer (`?drawer=import`) for job-scoped extraction and role-fit evaluation, or switch to Kanban/List pipeline (`JobPipelineV2`). Note: Recruiters cannot access `/vacancy-requests`.
- **Source & Match Talent (`/candidates`, `/cv-bank`, `/sourcing-match`):**
  - Paginate `15` rows/page on `/candidates` (switch `Cards` / `List` views or Active vs Bank tabs).
  - Select a target job on `/sourcing-match`, inspect `Best / Good / Potential / Low match` tiers (`15` cards/page), pick `2–4` candidates for `/candidates/compare`, or add to pipeline.
- **Advance a File (`/applications/:id`):** Always perform the **Next action** shown on the smart action bar (e.g., save a Screening note before moving to `Interview`, confirm at least one submitted Scorecard before moving to `Offer`).

### Hiring Manager (`manager` seat)
- **Team Oversight (`/team-work`, `/team-interviews`, `/reports`):** Monitor direct reports' files, upcoming interviews, and team monthly KPIs (`/results/team`).
- **Create & Approve Requisitions (`/vacancy-requests`, `/approvals`):** Ensure a **Target Fill Date** (`targetFillDate`) is set before submitting (`DUE_DATE_REQUIRED`), approve pending requests, or adjust seats/due date with a reason (`SEATS_BELOW_JOINED` blocks cuts below joined hires).
- **Decide Offer Compensation (`/offers/:id` or Offer Decision Drawer):** Managers with `OFFER_PAY_VIEW` review/set monthly base against the site's `GradeBand`.
- **Reassign Team Files (`ReassignDrawer`):** Direct managers can reassign open files among eligible direct reports (`REASSIGN_NOT_MANAGER` / `REASSIGN_SCOPE` blocks cross-team or unauthorized users).

### Interviewer (`my-interviews` permission scope)
- Open `/my-interviews` to review assigned interviews, open candidate CVs (`GET /api/v1/interviews/:id/cv`), and submit scorecards (`1–5` ratings + recommendation). Edits after submission require submitting a scorecard revision with an explicit reason.

### License Specialist (`LICENSE_SPECIALIST` → `/licenses`) & Final Hiring Approver (`FINAL_HIRING_APPROVER` → `/hires/approvals/inbox`)
- **License Specialist (`/licenses` & `/applications/:id`):** Verify pre-hire compliance items (`SCFHS_LICENCE` status + future expiry date, `ID`, `CONTRACT`). Expired licences trigger `LICENCE_EXPIRED`.
- **Final Hiring Approver (`/hires/approvals/inbox` & `/hires/:id`):** Approve or reject finalized pre-hire cases with a mandatory comment before `Joined` can be recorded with an explicit `actualJoiningDate`.

### Administrator (`admin` seat)
- **User Directory & Visual Org Chart (`/users` & `/users?view=tree`):** Create/invite users, assign roles, review unassigned employees (`Needs manager`), and maintain reporting lines on the 4-level interactive SVG tree (`ReportingTreeV2`). *(Direct visits to `/reporting-tree` redirect to `/users`.)*
- **Configuration & Governance (`/roles`, `/master-data`, `/pipeline-settings`, `/whatsapp-templates`, `/integrations`, `/audit-log`):** Maintain grade bands, rejection reason catalogs, canonical 8-stage pipeline order, WhatsApp templates, external integrations, and immutable audit logs. Admins **cannot** change vacancy status or reassign job/file owners.

### External Candidate (`/careers/:organizationCode/jobs`, `/portal`, `/schedule/:token`)
- Browse public openings and submit applications under `/careers/:organizationCode/jobs`.
- Select interview time slots cleanly via email/SMS signed `/schedule/:token` links.
- View requested documents and upload files securely via `/portal` or `/portal/applications/:token`.

---

## 2. Error-Code Troubleshooting Matrix (AI Assistant Lookup)

| Server `code` | HTTP | Why It Happened | Verified Resolution / Next Action |
|---|---:|---|---|
| `GATE_SCREEN_NOTE_MISSING` | 409 | Tried moving `Applied`/`Screening` → `Interview` with only a draft or blank notes. | Open Screening on `/applications/:id`, enter screening notes, and save/log the screen (not just private draft). |
| `GATE_SCORECARD_NOT_SUBMITTED` | 409 | Tried moving `Interview` → `Offer` without a submitted scorecard. | Interviewer submits their scorecard on `/my-interviews` (`status = Submitted`). |
| `GATE_OFFER_NOT_ACCEPTED` | 409 | Tried moving `Offer` → `Pre-Hire` before an offer version was accepted. | Record candidate acceptance on `/applications/:id` or `/offers/:id`. |
| `GATE_JOINING_CHECKS_INCOMPLETE` | 409 | Tried moving `Pre-Hire` → `Joined` with unverified ID/Contract/SCFHS checks. | Verify all required joining checks in `OnboardingChecklistDrawer` / `/licenses`. |
| `GATE_REJECT_REASON_REQUIRED` | 409 | Rejected a file without picking an active org rejection reason (or `< 3`-char note on `Other`). | Select a valid reason from the `rejection-reasons` list (add a note for `Other`). |
| `OFFER_PAY_VIEW_REQUIRED` | 403 | Caller without `OFFER_PAY_VIEW` tried sending/reading offer compensation. | Only a role holding `OFFER_PAY_VIEW` (e.g., authorized Hiring Manager) can set/view offer pay. |
| `OFFER_PAY_OUTSIDE_BAND` | 409 | Proposed monthly base fell outside the org/site `GradeBand` min/max. | Adjust base pay within the configured band or request HR Master Data update on `/master-data`. |
| `OFFER_SEND_REQUIRES_TEMPLATE` | 409 | Tried sending an offer without selecting an active template. | Choose an active template matching the send channel (`/whatsapp-templates`). |
| `ADMIN_CANNOT_CHANGE_JOB_STATUS` / `ADMIN_CANNOT_REASSIGN` / `REASSIGN_ADMIN_FORBIDDEN` | 403 | Administrator attempted recruiter/manager job status change or file/job reassignment. | Have the eligible Hiring Manager or owner perform the action, or use audited `/admin/overrides` when justified. |
| `DUE_DATE_REQUIRED` | 400 | Submitted/activated requisition without `targetFillDate`. | Enter a valid `YYYY-MM-DD` Target Fill Date before saving/activating. |
| `SEATS_BELOW_JOINED` | 409 | Tried reducing requisition headcount below already joined hires. | Set target seats `>=` current joined count. |
| `ROOM_URL_HOST_NOT_ALLOWED` | 400 | Interview video URL was non-HTTPS or outside `INTERVIEW_ROOM_HOSTS`. | Provide an `https://` Teams, Zoom, Google Meet, or Webex meeting URL. |
| `COMPARE_COUNT` | 400 | Fewer than `2` or more than `4` candidates selected for `/candidates/compare`. | Select between `2` and `4` candidates before launching Compare. |
| `FILE_UNSAFE` | 400 | Uploaded CV/document failed antivirus/safety scan. | Reject unsafe file (audit logged automatically) and request a clean PDF/DOCX file. |
| `LICENCE_EXPIRED` | 409 | Pre-hire SCFHS licence check expiry date is in the past. | Candidate must provide a valid, unexpired licence before Pre-Hire/Joined completion. |
