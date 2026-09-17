# Build context is the repo root (npm workspaces share one root lockfile):
#   docker build -f backend/Dockerfile --build-arg GIT_SHA=<sha> .

FROM node:24-alpine AS deps
WORKDIR /app

# npm workspaces resolve against every workspace's package.json even when
# installing just one workspace's dependency tree, so all three are needed
# here even though only backend/ is installed.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY e2e/package.json e2e/package.json

# tsx is a runtime dependency (backend/api/index.js requires 'tsx/cjs' to run
# .ts controllers directly) — safe to omit devDependencies.
RUN npm ci --omit=dev --workspace=backend


FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S ladu && adduser -S ladu -G ladu

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Only the source the running server needs — no tests/, jest.config.js,
# eslint.config.js, drizzle.config.ts, nodemon.json (dev/CI-only).
COPY backend/package.json backend/package.json
COPY backend/tsconfig.json backend/tsconfig.json
COPY backend/app.js backend/app.js
COPY backend/api backend/api
COPY backend/controllers backend/controllers
COPY backend/middleware backend/middleware
COPY backend/routes backend/routes
COPY backend/scripts backend/scripts
COPY backend/services backend/services
COPY backend/src backend/src
COPY backend/utils backend/utils

RUN chown -R ladu:ladu /app

ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

USER ladu
WORKDIR /app/backend
EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5001/api/health || exit 1

CMD ["node", "api/index.js"]
