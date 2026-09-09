# Hostinger and Vercel deployment

RecruitFlow can run as a complete Docker stack on a Hostinger **VPS**. Vercel
is supported for the React web application only; the API and worker still run
on Hostinger (or another private container host). Hostinger shared hosting
does not provide the Docker/network/volume features required by this stack.

## Hostinger VPS

1. Install Docker Engine and the Compose plugin on the VPS. Clone the main
   repository and keep the checkout outside the public web root.
2. Copy `deploy/environment.example` to an untracked `.env.production` and
   replace every placeholder. Use a managed PostgreSQL connection and a
   private persistent document volume. Keep `AUTH_COOKIE_SAME_SITE=lax` when
   the Hostinger web container serves the frontend and proxies `/api/`.
3. Set `WEB_ORIGIN` and `APP_WEB_URL` to the public HTTPS Hostinger origin,
   for example `https://recruit.example.com`. Generate separate 32+ character
   JWT/self-schedule secrets and a 64-character hexadecimal outbox key.
4. Validate the runtime file before starting containers:

   ```sh
   RECRUITFLOW_ENV_FILE=.env.production \
     node deploy/validate-runtime.cjs
   docker compose -f compose.production.yml config --quiet
   ```

5. Start the API, web and worker. The shared Compose file deliberately does
   not publish a host port. For a standalone VPS, use the Hostinger override
   and put Hostinger's TLS reverse proxy or a managed HTTPS proxy in front of
   the loopback binding (choose an unused host port):

   ```sh
   RECRUITFLOW_WEB_PORT=8081 RECRUITFLOW_ENV_FILE=.env.production \
     docker compose -f compose.production.yml -f compose.hostinger.yml up -d --build
   ```

6. Verify `/healthz`, `/api/v1/health`, `/api/v1/readiness`, login, private CV
   upload/download, and one SMTP invitation. Keep PostgreSQL and `/data/documents`
   backups outside the containers. Run one API instance during first migration.

The supplied `Dockerfile` targets are `api`, `web`, and `worker`. The web
container proxies `/api/` to the private API service and serves hashed assets
with gzip and immutable caching. Do not publish port 3000 or `/data/documents`.

### Dokploy settings

For the Compose deployment shown in the Dokploy UI, select GitHub repository
`Recruitment-System`, branch `main`, and Compose path
`./compose.production.yml`. Choose Docker Compose mode, not Stack mode. The
Environment tab writes the variables to `.env`, which this Compose file loads
by default. Do not add `compose.hostinger.yml` in Dokploy; attach the public
Hostinger domain to the `web` service on internal port 80.
For the Vercel setup, attach a separate HTTPS API domain to the `api` service
on port 3000 and use that URL in Vercel's `VITE_API_BASE_URL`.

## Vercel web frontend

The root `vercel.json` builds `apps/web`, serves `apps/web/dist`, preserves
React Router history routes, and caches hashed assets. Create a Vercel project
from the repository root and set:

| Vercel setting | Value |
| --- | --- |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm --dir apps/web build` |
| Output Directory | `apps/web/dist` |
| `VITE_API_BASE_URL` | `https://api.example.com/api/v1` |

The API origin must be HTTPS and must be added exactly to the API's
comma-separated `WEB_ORIGIN` value. Because this frontend and API are on
different origins, set `AUTH_COOKIE_SAME_SITE=none` in the Hostinger API and
worker environment. Production cookies are then Secure and are sent only to
the configured API origin with credentialed CORS requests. Do not use a
wildcard CORS origin.

After the first Vercel deployment, verify login, refresh after 15 minutes,
logout, CV upload, and a private document download from the Vercel domain.
If the API and web are hosted on the same Hostinger domain instead, keep
`VITE_API_BASE_URL=/api/v1` and `AUTH_COOKIE_SAME_SITE=lax`; no Vercel rewrite
is required.

## Repository and secret handling

Commit `Dockerfile`, `compose.production.yml`, `deploy/environment.example`,
`deploy/nginx.conf.template`, `deploy/validate-runtime.cjs`, and `vercel.json`.
Never commit `.env.production`, database dumps, CV binaries, or Vercel secret
values. The runtime validator intentionally fails on placeholders and local
HTTP origins.
