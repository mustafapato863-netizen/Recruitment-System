# Build from the repository root. Dokploy target: api, web or worker.
FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@11.9.0
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --dir database exec prisma generate --schema prisma/schema.prisma --generator client
RUN pnpm --dir apps/api build && pnpm --dir apps/worker build
# Same-origin routing avoids embedding server names or localhost in the browser.
ENV VITE_API_BASE_URL=/api/v1
RUN pnpm --dir apps/web build

FROM base AS runtime
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/database/node_modules ./database/node_modules
COPY --from=build /app/database/generated ./database/generated
COPY --from=build /app/database/package.json ./database/package.json
COPY --from=build /app/database/prisma/schema.prisma ./database/prisma/schema.prisma
COPY --from=build /app/database/prisma/migrations ./database/prisma/migrations
COPY --from=build /app/database/scripts/prisma.cjs ./database/scripts/prisma.cjs
COPY deploy/start-api.sh deploy/validate-runtime.cjs ./deploy/
ENV NODE_ENV=production PORT=3000
ENV RECRUITFLOW_DOCUMENT_STORAGE_PATH=/data/documents
ENV VACANCY_CORE_ADAPTER=prisma
RUN mkdir -p /data/documents && chown node:node /data/documents \
    && chmod +x /app/deploy/start-api.sh
USER node

FROM runtime AS worker
WORKDIR /app/apps/worker
CMD ["node", "dist/main.js"]

FROM nginx:stable-alpine AS web
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
ENV API_UPSTREAM=http://api:3000
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

FROM runtime AS api
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/readiness').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "/app/deploy/start-api.sh"]
