# Phase 1 Async Email Delivery

RecruitFlow uses PostgreSQL as the durable source of truth for outbound email.
Auth token and outbox writes share a database transaction. Workflow services
await preference-aware notification persistence after the business write; the
notification and its email outbox row are committed together. The worker
drains due rows and uses BullMQ/Redis as an optional scheduler; database
polling remains enabled as a recovery path when Redis is unavailable.

## Runtime

Run the API and worker as separate processes:

```text
pnpm dev:api
pnpm dev:worker
```

Development defaults to `MAIL_TRANSPORT=console`, which renders the final
plain-text message to the worker log. Production must set
`MAIL_TRANSPORT=smtp`, `SMTP_HOST`, `MAIL_FROM`, `APP_WEB_URL`, and a 32-byte
`EMAIL_OUTBOX_ENCRYPTION_KEY`; the API and worker fail fast when the key is
missing or production is configured with the console sink or invalid SMTP
settings.

`WORKER_PROCESSING_LEASE_MS` controls crash recovery. A row left in
`Processing` beyond this lease is reclaimed as `Pending` until its retry limit
is exhausted, then moved to `Dead` with the failure recorded in `lastError`.

## Delivery contract

- Auth recovery and invitation tokens are hashed in `auth_tokens`; the outbox
  stores only AES-256-GCM ciphertext, IV, and authentication tag for the
  delivery token. The worker decrypts it immediately before rendering.
- Production API responses never expose `devToken`; they return
  `delivery: "queued"`.
- Auth emails are transactional and ignore the optional marketing/notification
  preferences.
- Approval, offer, vacancy, interview, and task notifications create email
  outbox rows only when the recipient's master email preference and category
  preference are enabled.
- Repeated workflow events are guarded by a transaction-scoped PostgreSQL
  advisory lock and unread-event check.
- Delivery is at-least-once. The SMTP message ID is deterministic from the
  outbox row ID, and consumers/providers must treat retries as potentially
  duplicated sends.

## Verification

The focused checks are:

```text
pnpm test:p1-email-outbox
pnpm test:p1-production-queue
pnpm test:p1-workflow-notifications
```

The first suite covers transactional enqueueing, encrypted payload storage,
SMTP failure/backoff,
stale-lease recovery, dead-lettering, console delivery, and invitation token
redemption. The production suite verifies no raw token disclosure and a
usable queued token. The workflow suite verifies in-app plus preference-aware
email notification creation.
