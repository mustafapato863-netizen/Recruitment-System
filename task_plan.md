# RecruitFlow Bootstrap Plan

## Goal

Bootstrap the new Recruitment System repository as a secure monorepo with a React frontend, NestJS API, background worker, PostgreSQL/Prisma foundation, and the first vacancy-core slice aligned with the approved reference pack.

## Phases

- [in_progress] 1. Inspect repository, toolchain, and database connectivity
- [pending] 2. Create monorepo workspace and application shells
- [pending] 3. Add database/Prisma foundation and safe local environment configuration
- [pending] 4. Add shared contracts, authentication/authorization foundation, and UI shell
- [pending] 5. Implement first vertical slice: vacancy requests, approvals, and vacancies
- [pending] 6. Run quality checks and document setup/run instructions

## Decisions

- Use pnpm workspaces.
- Use React + Vite + TypeScript for the web app.
- Use NestJS for the API and a separate worker package for BullMQ jobs.
- Use PostgreSQL as the source of truth and S3-compatible storage for future private files.
- Keep the supplied `Refrence/` planning and UI materials unchanged.
- Never commit database credentials or other secrets.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| `Move-Item` could not move `Frontend` because the directory is in use | 1 | Leave the existing folder in place for now; revisit after the frontend dev process is stopped, or keep the original name if it is not safe to move. |
| pnpm ignored dependency build scripts | 1 | Move the explicit `onlyBuiltDependencies` allowlist into `pnpm-workspace.yaml`, which is the supported pnpm 11 configuration location. |
| Prisma CLI could not download `schema-engine.exe` due local issuer certificate validation | 1 | Keep TLS verification enabled; use local formatting/type checks and document that Prisma validate/generate needs the machine certificate chain fixed. |
| Root ESLint selected multiple TypeScript project roots | 1 | Disable type-aware project discovery in the shared lint config; TypeScript correctness remains covered by the dedicated `typecheck` scripts. |
