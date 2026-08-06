# RecruitFlow Bootstrap Plan

## Goal

Bootstrap the new Recruitment System repository as a secure monorepo with a React frontend, NestJS API, background worker, PostgreSQL/Prisma foundation, and the first vacancy-core slice aligned with the approved reference pack.

## Phases

- [completed] 1. Inspect repository, toolchain, and database connectivity
- [completed] 2. Create monorepo workspace and application shells
- [in_progress] 3. Add database/Prisma foundation and safe local environment configuration
- [completed] 4. Add shared contracts, authentication/authorization foundation, and UI shell
- [pending] 5. Implement first vertical slice: vacancy requests, approvals, and vacancies
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
