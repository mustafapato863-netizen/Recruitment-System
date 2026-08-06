# RecruitFlow API

NestJS REST API for the recruitment workflow.

## Current slice

Vacancy Core is available under `/api/v1`:

- `GET /vacancy-requests/context` — local demo context for the first form.
- `GET /vacancy-requests` — list requests.
- `POST /vacancy-requests` — create a Draft request.
- `POST /vacancy-requests/:id/submit` — submit for approval.
- `POST /vacancy-requests/:id/approve` — approve the current revision.
- `POST /vacancy-requests/:id/request-changes` — send the request back for changes.
- `POST /vacancy-requests/:id/reject` — reject the current revision.
- `POST /vacancy-requests/:id/convert` — create the linked Vacancy.
- `GET /vacancies` — list converted vacancies.

The current adapter is intentionally in-memory so the workflow can be exercised while Prisma engine setup is blocked by the local certificate chain. Data resets when the API restarts. The next database phase will replace the adapter behind the same repository interface and add the authenticated actor context.
