# M7 — Approved Integrations and Asynchronous Operations

Goal: add only the approved, secure integration foundations: email status, calendar/ICS, CV storage backup/restore, XLSX operations, and internal events/webhooks where real backend support exists.

Read first: `AGENTS.md`, master plan M7, blueprint sections 11, 12, 14, current queue/job/provider/configuration/storage/security/deployment code and tests, and planning records.

For each enabled integration, define authenticated configuration, secret storage, validation, connection/test status, job idempotency, retry/backoff, failure visibility, tenant ownership, audit, observability, and safe rollback. Calendar UI may generate/send invitations only after real provider/ICS contract validation. CV backup/restore requires a documented retention, encryption/access, recovery rehearsal, and scoped restore procedure. UI never reports Connected or Delivered without backend evidence.

Do not add social networks, job boards, WhatsApp, SMS, browser-held credentials, secret leakage, unbounded retries, or queue actions that mutate candidate workflow automatically. Test provider failure, retry/idempotency, tenant separation, revoked config, file restore authorization, status truth, audit, and user-safe error states. Use test/local providers only; record credentials/infrastructure blockers rather than bypassing them.

