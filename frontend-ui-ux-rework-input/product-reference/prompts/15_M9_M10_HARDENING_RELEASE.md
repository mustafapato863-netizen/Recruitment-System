# M9–M10 — Production Hardening and Release Certification

Goal: certify RecruitFlow only with exact-source evidence; this goal must not be closed by screenshots or document claims.

Read first: `AGENTS.md`, master plan M9/M10, blueprint sections 17–19, all planning records, CI/deployment/backup configuration, schema/migrations, security controls, and every prior phase report. Reconcile discrepancies before certification.

Execute the repository's actual release checks: dependency install, token validation, lint, typecheck, unit/integration/security tests, database validation/migration rehearsal including rollback, clean production build, bundle budget, browser/E2E critical mutations, three-role/tenant isolation, upload/export authorization, all required responsive widths/themes, keyboard/a11y evidence, backup/restore rehearsal, deployment/rollback rehearsal, dedicated-tenant UAT, and staging soak. Verify environment secrets, error handling, logging, rate limits, file security, CORS/session policy, observability, and performance budgets as supported by the system.

Do not suppress failures, test against production destructively, invent UAT/soak evidence, or call the product production-ready on partial evidence. Produce a dated go/no-go report listing every command/result, browser journey, known failure, waiver owner/expiry, rollback steps, and final decision. A single unresolved P0 blocks go; P1 requires explicit authorized waiver.

