# Local demo data

Use the repeatable seed to populate the local PostgreSQL database with a complete RecruitFlow walkthrough:

```powershell
pnpm db:seed
```

The seed is additive and idempotent. It uses deterministic demo IDs and upserts only the dedicated local RecruitFlow fixtures, so running it again does not duplicate the demo workflow or remove unrelated records.

## Demo account

- Email: `super@admin.dev`
- Password: `admin@123456`

Change this password before using any shared or non-local environment. These credentials are for local UI/API testing only.

## Covered screens and scenarios

The fixture set includes:

- 10 candidates with active, blacklisted, and archived examples.
- 5 vacancy requests covering draft, pending approval, approved, and rejected states.
- 3 vacancies with open and partially filled headcount.
- 10 applications across applied, screening, interview, offer, pre-hire, joined, rejected, and withdrawn stages.
- Candidate documents, screening logs, completed/scheduled/cancelled interviews, and scorecards.
- 5 offers covering draft, pending approval, sent, accepted, and declined states, including versions and components.
- 3 hiring cases with pending compliance, pending final approval, and joined outcomes.
- 3 talent pools with candidate memberships.
- A six-row import batch with valid, invalid, and duplicate rows.
- A published six-stage pipeline template.
- Connected, available, and unavailable integration examples.
- Read/unread notifications, open/in-progress/completed tasks, and audit history.

Document records are metadata-only fixtures. No fake PDF/DOCX binary is uploaded, and they do not claim that private storage, OCR, virus scanning, or CV parsing is implemented.

## Expected seed summary

The command prints a JSON summary. A clean local database should report the following demo counts:

```json
{
  "candidates": 10,
  "vacancyRequests": 5,
  "vacancies": 3,
  "applications": 10,
  "interviews": 5,
  "offers": 5,
  "hiringCases": 3,
  "talentPools": 3,
  "importJobs": 1,
  "pipelineTemplates": 1,
  "integrations": 4,
  "notifications": 5,
  "tasks": 5,
  "auditLogs": 6
}
```
