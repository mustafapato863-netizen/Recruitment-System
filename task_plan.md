# RecruitFlow Bootstrap Plan

## Goal

Bootstrap the new Recruitment System repository as a secure monorepo with a React frontend, NestJS API, background worker, PostgreSQL/Prisma foundation, and the first vacancy-core slice aligned with the approved reference pack.

## Current project status — 2026-08-07

- Phase 0 through Phase 9 implementation scope is present and the confirmed P0/P1 defects from the comprehensive audit were remediated locally.
- Phase 9 responsive/UI remediation has fresh authenticated browser evidence; Phase 10 is the next scope for release hardening.
- Remaining release gates are explicit: no automated test suite, metadata-only document storage without private upload/scanning, no license backend domain, migration provenance decision for Phase 6–8 models, and the Vite chunk-size warning.

### Phase status matrix

| Phase | Status | Current decision |
|---|---|---|
| 0 — Foundation | Remediated | Verification gates passed |
| 1 — Identity / Access / Master Data | Remediated | Verification gates passed |
| 2 — Vacancy Core | Remediated | Verification gates passed |
| 3 — Candidate / Application | Remediated | Automated tests still open |
| 4 — Documents / Screening / Interviews | Remediated | Real storage/scanning still open |
| 5 — Offers | Remediated | Automated tests still open |
| 6 — Hiring / Joining | Remediated locally | Release acceptance pending |
| 7 — Talent Pool / Import | Remediated locally | Release acceptance pending |
| 8 — Reports / Admin / Integrations | Remediated locally | Release acceptance pending |
| 9 — UI Completeness | Remediation complete | Browser evidence passed for tested scope |
| 10 — Release Hardening | Next | Open release gates above |

## Comprehensive audit — current session

Goal: compare the actual repository against the approved roadmap for Phases 0–8, identify implementation gaps and defects, verify quality gates, and produce a review report without changing application code.

- [completed] 1. Inventory roadmap, modules, routes, migrations, scripts, and reference evidence
- [completed] 2. Run static quality, typecheck, build, database, and repository hygiene gates
- [completed] 3. Audit backend contracts, permissions, tenant isolation, workflow rules, and persistence
- [completed] 4. Audit frontend routes, states, responsive/accessibility behavior, and browser workflows
- [completed] 5. Compare each Phase 0–8 against acceptance criteria and classify findings by severity
- [completed] 6. Write the comprehensive audit report and update findings/progress with reproducible evidence

## Remediation execution — 2026-08-07

Goal: fix the confirmed P0/P1 defects from the audit before advancing Phase 9, preserve existing data and applied migrations, and publish fresh verification evidence.

- [completed] 1. Restore API startup and verify authenticated request boundaries
- [completed] 2. Enforce route permissions, audit coverage, tenant isolation, and workflow invariants
- [completed] 3. Replace fake or unsafe data paths in documents, imports, reports, integrations, and pipeline settings
- [completed] 4. Repair lint debt and record the remaining automated-test gap without weakening compiler rules
- [completed] 5. Complete Phase 9 UI states and remove misleading/mock actions
- [completed] 6. Run full quality/browser/database gates and update the audit handoff

### Remediation rules

- Do not edit an applied migration in place.
- Do not delete or reset database data; schema changes require a reviewed forward migration.
- Do not claim a feature is complete when the backing storage/provider/test path is not implemented.
- Keep organization scoping on every read, write, approval, and related-user lookup.
- Preserve the existing visual language while correcting misleading UI states and non-functional actions.

### Remediation outcome

- API bootstrap, health/auth boundaries, route permission metadata, audit metadata, tenant checks, role-code normalization, transactional workflow transitions, import idempotency, and offer status guards were repaired.
- Metadata-only document handling is now explicit and safer: file metadata is validated, scan state remains `Pending`, and no insecure download/storage claim is exposed.
- Reports, integrations, imports, hiring, joining, talent-pool, and approval screens now use live API paths or clearly state when a provider/domain is unavailable.
- Pipeline Settings and Integrations no longer render hardcoded catalog data: templates/stages/providers are API-backed, connection testing is wired, and unavailable configuration/docs actions explain their limitation.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm db:validate`, `pnpm db:migrate:status`, `git diff --check`, and the code-quality checker pass.
- Authenticated browser evidence passes for the tested routes, login validation, 404 recovery, accessibility basics, mobile navigation, and responsive widths 1440/768/375.
- Remaining release gates are intentionally open: no automated unit/integration/E2E suite exists yet; private object storage and virus scanning are not implemented; license management has no backend domain; migration provenance for Phase 6–8 models needs an approved release decision; and the web build still emits a bundle-size warning.

## Phases

- [completed] 1. Inspect repository, toolchain, and database connectivity
- [completed] 2. Create monorepo workspace and application shells
- [completed] 3. Add database/Prisma foundation, generated client, migration, seed, and safe local environment configuration
- [completed] 4. Add shared contracts, authentication/authorization foundation, and UI shell
- [completed] 5. Implement first vertical slice: vacancy requests, approvals, and vacancies
- [completed] 6. Clean repository structure, references, starter assets, and documentation

## Decisions

- Use pnpm workspaces.
- Use React + Vite + TypeScript for the web app.
- Use NestJS for the API and a separate worker package for BullMQ jobs.
- Use PostgreSQL as the source of truth and S3-compatible storage for future private files.
- Keep the supplied planning and UI materials unchanged, but organize them under `docs/reference/`.
- Never commit database credentials or other secrets.
- Keep all deployable applications under `apps/`; the frontend is now `apps/web`.
- Keep reference material under `docs/reference/`; runtime code must not import from the prototype.
- Keep design-system ownership in `packages/design-system` and document visual references separately.
- Use a server-side application service and repository boundary for Vacancy Core; keep the first slice runnable with an in-memory adapter until Prisma engine setup is available locally.
- Expose request/approval/conversion contracts from `packages/contracts`; validate browser writes with `packages/validation` and keep Nest DTOs as the runtime API boundary.
- Keep the canonical Prisma schema under `database/prisma`; make `database/` the owner of Prisma generation and export its ignored generated client to the API.
- Keep `VACANCY_CORE_ADAPTER=in-memory` as the default until a migration and reference-data seed are explicitly applied.
- Treat `db:migrate:deploy` and `db:seed` as explicit database writes; audit the target URL first and never use them against production by assumption.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| `Move-Item` could not move `Frontend` because the directory was in use | 1 | Moved the tracked frontend source/configuration into `apps/web`; only the ignored old `Frontend/node_modules` cache remains locally. |
| pnpm ignored dependency build scripts | 1 | Move the explicit `onlyBuiltDependencies` allowlist into `pnpm-workspace.yaml`, which is the supported pnpm 11 configuration location. |
| Prisma CLI could not download `schema-engine.exe` due local issuer certificate validation | 1 | Keep TLS verification enabled; use local formatting/type checks and document that Prisma validate/generate needs the machine certificate chain fixed. |
| Root ESLint selected multiple TypeScript project roots | 1 | Disable type-aware project discovery in the shared lint config; TypeScript correctness remains covered by the dedicated `typecheck` scripts. |
| Root ESLint still detected the web app's local tsconfig after moving it to `apps/web` | 1 | Centralized lint ownership in the root config and removed the duplicated web ESLint config; `pnpm lint` now covers all application and package source. |
| Cleanup command for the old generated `Frontend/node_modules` directory was blocked by the shell safety policy | 1 | Leave the ignored cache in place; it is not tracked and does not affect the repository structure. |
| `git mv` wildcard syntax was rejected for the reference folders | 1 | Moved each child entry explicitly with `git mv`, preserving history. |
| Prisma client generation is still blocked by the local certificate chain | 1 | Start Vacancy Core behind a repository interface with an in-memory adapter; keep Prisma schema and adapter integration as the next database phase. |
| Nest typecheck could not resolve the workspace contracts package and root lint flagged Nest runtime metadata imports | 1 | Added an API TypeScript path alias, disabled the base unused-vars rule in favor of the TypeScript-aware rule, and documented runtime DTO/service imports. |
| Hidden API smoke-test process was rejected by the command safety policy | 1 | Use a direct temporary API session and a separate request session instead of spawning a hidden process from a PowerShell script. |
| In-process smoke test started from the monorepo root and could not resolve API-local Nest dependencies | 1 | Run the temporary Nest test from `apps/api`, where the workspace dependency links are resolved normally. |
| Code-reviewer checker failed before analysis because Windows stdout used `cp1252` for a Unicode status symbol | 1 | Rerun the checker with `PYTHONIOENCODING=utf-8`. |
| Prisma client construction failed because the generated client and local Prisma engine are absent | 1 | Keep the in-memory adapter active and defer Prisma adapter/migration work until Prisma engine installation and certificate validation are repaired. |
| Prisma engine download succeeded with the Windows Zscaler CA, but `prisma generate` exited while auto-running `pnpm add @prisma/client@6.19.3` | 1 | Inspect the generated output and align workspace Prisma versions/configuration before rerunning generation. |
| Running generation from `apps/api` still triggered Prisma auto-install | 1 | Align the declared `prisma` and `@prisma/client` versions to the installed `6.19.3` release before retrying. |
| Prisma continued the auto-install failure after version alignment | 1 | Bypass Prisma's package auto-install by verifying the API dependency manually and invoking the local CLI explicitly. |
| Custom generated-client output did not bypass Prisma's auto-install stage | 1 | Inspect the installed CLI for a supported skip/disable condition; do not repeat generation attempts without changing the execution path. |
| Prisma client generated into a pnpm virtual-store instance that the API did not use | 1 | Make `database` a workspace package, generate to its own ignored `generated/client` path, and export that client through `@recruitflow/database`. |
| `db:validate` could not find `DATABASE_URL` in the clean shell | 1 | Keep the schema environment-driven and document that validation needs the variable present but does not connect to PostgreSQL. |
| Prisma's package export map resolved `require('prisma')` to a non-runtime types entry in the database wrapper | 1 | Resolve the explicit CLI entry at `prisma/build/index.js` and keep the wrapper responsible for loading the root `.env`. |

## Pre-Phase 3 Audit and Hardening

### Goal

Review the completed Foundation, Identity/Access/Master Data, and Vacancy Core work against their acceptance criteria; fix confirmed defects without expanding into Candidate/Application scope; run the relevant quality gates; and leave a clear handoff for Phase 3.

### Phases

- [completed] 1. Inventory the current working tree, phase evidence, contracts, and database state
- [completed] 2. Review API authentication, authorization, organization isolation, workflow transitions, and audit behavior
- [completed] 3. Review Prisma schema, migrations, seed repeatability, repository boundaries, and data integrity
- [completed] 4. Review frontend routes, protected states, API integration, validation, and responsive/error states
- [completed] 5. Add or repair focused tests and run lint, typecheck, build, database, and smoke checks
- [completed] 6. Update phase documentation and produce a Phase 3 handoff; do not implement Candidate/Application features

### Scope guard

- In scope: defects and missing acceptance coverage in Phases 0, 1, and 2.
- Out of scope: Candidate, Application, document processing, interviews, offers, hiring, reports, and unrelated redesigns.
- Do not push to GitHub unless explicitly requested after review.

### Audit errors

| Error | Attempt | Resolution |
|---|---:|---|
| UI/UX design-system search could not print Unicode output under Windows `cp1252` | 1 | Rerun with `PYTHONIOENCODING=utf-8`; no source change required. |
| `pnpm --dir apps/web test` resolved `apps/web` as a command in this workspace setup | 1 | Use the workspace filter form `pnpm --filter @recruitflow/web test`. |
| Migration safety scan used Bash `||` syntax in PowerShell | 1 | Rerun with PowerShell exit-code handling; no command was executed. |
| Lint rejected unused parameters in the in-memory repository no-op | 1 | Keep the interface-compatible method with no named parameters; Prisma performs the real organization check. |
| Full local API smoke command was blocked because it embedded local login credentials | 1 | Do not repeat or expose credentials; use readiness and unauthenticated-boundary checks instead. |
| Readiness-only API smoke command was blocked by the Windows policy for starting a hidden process | 2 | Stop live-process attempts; report the smoke test as not run rather than claiming runtime evidence. |
| API startup attempts created duplicate watch processes while the Nest entry path was invalid | 1 | Stop only the verified API processes, fix the API start/build entry path, and run one direct managed process. |
| Nest runtime could not resolve dependencies imported as `type-only` (`PermissionsGuard`, then `RolesController`) | 1 | Convert all Nest-injected classes to runtime imports and keep type-only imports only for non-DI types. |
| PowerShell loop used the read-only automatic `$PID` variable name | 1 | Use the task-specific `$apiProcessId` variable for process cleanup. |
| PowerShell login probe used an unbraced variable before a colon in an interpolated string | 1 | Simplify the output and use `${status}` when a variable is followed by punctuation. |

## Final audit result

- Phase 0–8 implementation review and reconciliation are complete locally; Phase 9 UI completeness is the current active phase.
- UI/UX gate is complete for the current scope: shared SVG icons, real navigation or explicit future-phase states, accessible modal focus behavior, mobile navigation, readable controls, responsive table overflow, loading/empty/error/success states, and API-backed Vacancy Core screens.
- `pnpm typecheck`, `pnpm build`, `pnpm db:validate`, and `pnpm db:migrate:status` passed. The production web build emits a Vite chunk-size warning.
- `pnpm lint` currently fails with 109 errors, and no project test files or test scripts were found. These are explicit technical-debt/release-gate items; they must not be reported as passed.
- The latest API health check was unavailable. Previous route checks verified health 200, unauthenticated auth/me 401, and invalid-login validation 400, but a current runtime check remains unverified.
- The applied Phase 1 migration's legacy `DROP COLUMN IF EXISTS` statements remain a production release-review item; do not edit the applied migration in place.

## Execution governance update — 2026-08-07

- Strengthened `docs/development/implementation-roadmap.md` with mandatory Definition of Ready, required implementation order, non-negotiable security/data/UI rules, scope change control, evidence requirements, completion gates, and reviewer records.
- Added a Phase 3 entry gate covering adapter selection, migration review, Candidate/Application domain contracts, permissions, fixtures, and a supported smoke path; this gate is now historical because Phase 3–8 implementation has been accepted.
- During the requested local startup, fixed the API runtime entry path and Nest dependency-injection imports. Verified `/api/v1/health` returns 200, `/api/v1/auth/me` returns the expected unauthenticated 401, and `POST /api/v1/auth/login` returns validation 400 rather than 404.
- Reconciled the execution roadmap and phase matrix so Phase 0–8 are complete, Phase 9 is current, and Phase 10 is pending release hardening.
