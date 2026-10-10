# POST /candidates/:id/anonymize

Administrator-only legal erasure (permission `CANDIDATE_ANONYMIZE` + active `ADMINISTRATOR` role).

Body:

| Field | Type | Required | Description |
|---|---|---|---|
| `reason` | string (10-1000) | yes | Why this candidate is being anonymized (e.g. legal erasure ticket number). **Do not include personal data in the reason.** It is stored verbatim in the immutable audit log. |

Responses: `200 { id, status: "anonymized" | "already_anonymized", anonymizedAt }`, `400` invalid reason,
`403` not an administrator, `404` not found. Irreversible.

Scrubbed: candidate PII and parsed CV JSON (`metadata`), document extracted text, names, checksums and
stored file bytes, application notes, screening notes, interview titles, scorecard free text, tasks,
notifications, email outbox rows (worker queue) addressed to or mentioning the candidate (unsent rows
are parked as `Dead`), and bulk-import rows matching the candidate's email or phone. Search queries these
tables live (no separate index). Audit rows are not modified.
