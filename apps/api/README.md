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

## Repository adapters

The API supports two adapters behind the same repository interface:

- `VACANCY_CORE_ADAPTER=in-memory` is the safe default for UI and workflow development. Data resets when the API restarts.
- `VACANCY_CORE_ADAPTER=prisma` uses the generated client from `@recruitflow/database` and PostgreSQL as the source of truth.

Before using the Prisma adapter, run `pnpm db:generate`, `pnpm db:migrate:deploy`, and `pnpm db:seed`. The context endpoint intentionally fails with a clear message when its reference data is missing.
