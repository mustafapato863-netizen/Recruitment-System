# RecruitFlow deployment

Hostinger VPS and Vercel instructions are in
[`deploy/hostinger-vercel.md`](./hostinger-vercel.md). Vercel hosts the web
frontend only; the API and worker require the Docker targets described below.

Build from repository root (`.`), Dockerfile path `Dockerfile`. Do not use a
compose filename as Dokploy's build directory. No hosting changes are made by
these files.

## Dokploy Compose deployment

In the screenshot's Compose source settings use:

| Dokploy field | Value |
| --- | --- |
| Provider | GitHub |
| Repository | `Recruitment-System` |
| Branch | `main` |
| Compose path | `./compose.production.yml` |
| Mode | Docker Compose (not Stack) |
| Build context | repository root (`.`) |

The repository has no `docker-compose.yml`; selecting that path is incorrect.
Dokploy stores Environment-tab values in `.env`, which is the default used by
the Compose file. Add the variables listed in `deploy/environment.example` to
that tab. Attach a Hostinger domain to the `web` service on internal port 80;
the web service proxies `/api/` to the private `api:3000` service. If Vercel
hosts the frontend, attach an HTTPS API domain to the `api` service on port
3000 and set `WEB_ORIGIN` to the exact Vercel origin.

Use Docker Compose mode rather than Stack mode because the production file
builds the API, web, and worker targets.

## Dokploy services

| Service | Docker target | Internal port | Health route |
| --- | --- | --- | --- |
| API | `api` (default) | `3000` | `/api/v1/readiness` |
| Web | `web` | `80` | `/healthz` |
| Email worker | `worker` | none | process monitoring / outbox delivery |

Put API and web on the same private Docker network. Set web runtime variable
`API_UPSTREAM=http://<actual-api-service-name>:3000` (no trailing slash or path).
The compose configuration uses service name `api`. Route the public HTTPS domain
to web port 80. `/api/` is proxied through web; the browser uses `/api/v1` on its
own domain. A separate public API domain is unnecessary. Changing a Vite variable
after build does not change JavaScript: the supplied Docker build fixes the base
to `/api/v1` and runtime configuration selects the private upstream instead.

Copy `deploy/environment.example` into untracked `.env.production` for Compose,
or enter the values in Dokploy's runtime environment for API/worker. Set
`WEB_ORIGIN` and `APP_WEB_URL` to the actual HTTPS frontend origin. Generate
independent secrets; the outbox key must be exactly 64 hexadecimal characters
and match between API and worker. Do not reuse AssessFlow domains or secrets.
Match `PORT` to the reverse proxy's internal target if overriding 3000.
Remove local `RECRUITFLOW_API_PORT` overrides. Configure `TRUST_PROXY` for your
actual private proxy hops; do not expose the backend directly with broad trust.

Email delivery is enabled only when `MAIL_DELIVERY_ENABLED=true`; enabled
production workers require real SMTP settings. Set it to `false` with
`MAIL_TRANSPORT=console` to freeze outbound mail while keeping in-app
notifications and recruitment workflows available. Existing outbox rows remain
pending until delivery is enabled again. The worker can use database polling
without Redis. Successful process startup does not prove external SMTP delivery;
verify a controlled invitation after hosting credentials are configured.

## Database and files

API startup validates runtime configuration, runs `prisma migrate deploy`, then
starts Nest. Failed validation/migration prevents startup. There is no schema
push, reset, demo seed, automatic account creation or deletion.

Before first launch, restore a verified backup of the intended RecruitFlow
database (including admin, permissions and reference data) into the dedicated
production PostgreSQL service, and copy private document binaries into the volume.
Empty databases get tables only; they do not get login accounts or recruitment
configuration. Do not run the legacy demo/cleanup scripts as production bootstrap.
Check migration history before restoring a database originally created by db push;
baseline it only after a schema comparison, never mark unapplied changes complete.

Mount a private persistent volume at `/data/documents` on API. It must be writable
by container UID 1000. Compose uses a named volume. Do not publish this directory
through nginx. PostgreSQL and document backups must be coordinated: database
exports contain metadata, not the CV binaries. Keep backups outside the containers.

Run one API instance during initial migrations; scale only after migration success.
Readiness checks database connectivity and application-table availability. It does
not certify that business reference data, an admin account or SMTP are configured.

## Compose alternative

After filling `.env.production`, run from the repository root:

```sh
RECRUITFLOW_ENV_FILE=.env.production \
  docker compose -f compose.production.yml config --quiet
RECRUITFLOW_ENV_FILE=.env.production \
  docker compose -f compose.production.yml up -d --build
```

The compose web binding is port 8080; place an HTTPS proxy in front of it.
Production auth cookies are Secure, so normal public HTTP login is unsupported.
In Dokploy Compose mode select the actual compose file separately from build path.

## Verification and recovery

Local evidence (2026-09-08/09): all 30 migrations replayed on isolated PostgreSQL 16;
Prisma reported no schema difference; 66 API tests, 4 worker tests and deployment
validation tests passed; API/web TypeScript, lint and production builds passed.
Fresh Linux API, web and worker images started healthy, the web proxy returned 200,
and the authenticated Chromium matrix passed 33/33 checks at 1440/768/390px.
These are local UAT results, not a production signoff; configure real secrets,
SMTP, backups and HTTPS before go-live.

The API preflight rejects unresolved example values, wildcard origins, invalid
PostgreSQL/Redis URLs, and incomplete production SMTP settings before migrations
run. A rejected preflight is intentional: fix the value in Dokploy's Environment
tab (or the Compose env file), redeploy, and then inspect `/api/v1/readiness`.

Build all final targets:

```sh
docker build --target api -t recruitflow-api:preflight .
docker build --target web -t recruitflow-web:preflight .
docker build --target worker -t recruitflow-worker:preflight .
```

Test against an isolated database and private volume first. After a controlled
document upload, recreate the API container with the same volume and verify that
download still works. Restart with the migrated database to confirm migrations
are a no-op. Validate missing-secret and missing-database failures before UAT.

Check `/healthz`, `/api/v1/health`, `/api/v1/readiness`, a direct page reload
(`/users`), `/favicon.ico`, login, permission reads and private CV upload/download.
Missing `/api/` endpoints should return JSON 404, never the SPA index page.
Assets are cached; HTML is revalidated to avoid obsolete bundle references.

Save the previous image tags plus database and document snapshots before upgrades.
Prefer rolling back the application image when schema remains compatible. Prisma
does not auto-undo migrations. For a schema rollback, stop writers and restore a
verified pre-upgrade database/document snapshot together. The assignment-index fix
relaxes an obsolete uniqueness rule: recreating the old index may fail once new
assignment kinds coexist. Never force that rollback over valid newer records.
