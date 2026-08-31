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

### CV Bank document controls

CV uploads are organization-scoped and stored under the private storage provider configured by `RECRUITFLOW_DOCUMENT_STORAGE_PROVIDER`. PDF, DOC, and DOCX uploads are checked against MIME/extension/binary signatures and the antivirus test signature before a file is made downloadable.

- `GET /documents/cv-bank` — paginated active CV metadata.
- `GET /documents/cv-bank/backup-status` — backup readiness and missing-file counts.
- `GET /documents/cv-bank/manifest.xlsx` — existing Excel metadata manifest route.
- `GET /documents/cv-bank/backup-manifest.xlsx` — explicit Excel backup-manifest alias.
- `PATCH /documents/:id/retention` — update consent and retention controls.
- `POST /documents/:id/archive` and `POST /documents/:id/restore` — reversible, audited document lifecycle controls.
- `GET /documents/:id/download` — permission-protected download for clean, stored, consent-valid documents only.

The current Excel export is intentionally a metadata manifest; it does not contain CV binaries. Configure an external binary-backup job and set `RECRUITFLOW_DOCUMENT_BACKUP_PROVIDER` plus `RECRUITFLOW_DOCUMENT_BACKUP_LAST_SUCCESS_AT` only after a verified snapshot. The default scanner is deterministic signature validation for local development; production deployments must connect the approved malware-scanning provider before release.

## Repository adapters

The API supports two adapters behind the same repository interface:

- `VACANCY_CORE_ADAPTER=prisma` is the default and uses PostgreSQL as the source of truth.
- `VACANCY_CORE_ADAPTER=in-memory` is an explicit, non-release option for isolated tests only. Its data resets when the API restarts and must never be used to hide a database or integration failure.

Before using the Prisma adapter, run `pnpm db:generate`, `pnpm db:migrate:deploy`, and `pnpm db:seed`. The context endpoint intentionally fails with a clear message when its reference data is missing.
