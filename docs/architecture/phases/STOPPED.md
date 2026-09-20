# Gate log — resume parsing phase loop

## RESOLVED 2026-09-20 18:20 — concurrent-agent gate and API boot failure

### Gate 1: a second agent was writing the tree (RESOLVED)
`apps/api/src/resume/extraction/worker/` appeared between 17:40 and 17:46, written by the
Antigravity IDE agent, not by this session. Confirmed by two directory samples 45s apart and by
typecheck reporting identical errors at shifting line numbers. Writes ceased at ~17:51; the tree
has been stable since. Its Phase 2.5 worker code was kept and now compiles (three
`exactOptionalPropertyTypes` violations in `extraction-worker-pool.ts` fixed by the orchestrator).

NOTE: the Antigravity IDE remains open. If it resumes it will collide with delegated runs.

### Gate 2: API boot failure / `/api/v1/resume/parse` 404 (RESOLVED)
`packages/validation` and `packages/contracts` are `"type": "module"` with exports maps pointing at
raw TypeScript. Node's ESM loader cannot resolve extensionless relative specifiers, so
`export * from './matching'` threw `ERR_MODULE_NOT_FOUND` at startup. Nothing listened on :3000, so
Vite proxied `/api/v1/resume/parse` into a dead target and the browser saw 404. Routing was never
the bug.

Fixed by the delegated implementer (Antigravity, run `33673775`): explicit `.ts` specifiers in both
packages, `rewriteRelativeImportExtensions` in `apps/api/tsconfig.json`, value imports for Nest DI
constructor params, and a `nest-cli.json` asset rule copying the worker script into `dist`.

Verified independently by the orchestrator:
- port 3000 listening
- `POST /api/v1/resume/parse` → **401** (auth required; route alive)
- control `POST /api/v1/resume/doesnotexist` → **404** (proves the 401 is a real route match)
- clean boot, empty stderr

Side effect: the `web test` "Worker exited unexpectedly" error was NOT a flake — it was the same
ESM defect crashing a vitest worker. Suite went from 60 files / 236 tests (exit 1) to
61 files / 242 tests (exit 0).

## Gate state

| Gate | Result |
|---|---|
| `pnpm --filter api typecheck` | clean |
| `pnpm --filter api lint` | clean |
| `pnpm --filter api test` | 28 files / 191 tests |
| `pnpm --filter web typecheck` | clean |
| `pnpm --filter web test` | 61 files / 242 tests, exit 0 |
| `pnpm lint:web` | 25 warnings / 0 errors — FAILS on `--max-warnings=0` |

The 25 warnings are pre-existing and unrelated: 14 of the 18 files carrying them are entirely
unmodified, and no `apps/web` file was touched by the boot fix. All are `react-hooks/exhaustive-deps`.

## Commits (local, not pushed)
- `e5486d2` reporting lines and team-scoped tasks
- `5f1e0d3` resume parsing foundation, matching utilities, ESM resolution fix
- `36dbce0` audit findings sections E-K

Deviation from the approved A->B->C->D split: B and C were committed together. They cannot be
separated because `packages/validation/src/index.ts` is one file re-exporting both groups; splitting
it would produce a commit whose index references files that do not exist yet.

## PII remediation
CV-derived fixtures were anonymized and renamed to neutral slugs; employers and institutions were
replaced with fictional equivalents.

STILL OUTSTANDING: `apps/web/src/utils/resumeParser.test.ts` was already committed before this
session and contains a real personal email address and name. Scrubbing the working tree does not
remove it from git history. Needs a decision.

## Still-open hard stop gates (from the goal loop)
- Phase 4 Prisma migration — plan the schema diff and SQL, then STOP.
- Any package install or model runtime (Ollama, model download) — STOP. Phase 3 must use a
  `LocalInferenceClient` interface plus a deterministic fake client.
- Phase 7 Validate & Edit UI changes a recruiter would see — plan, then STOP.
