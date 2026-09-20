# Build context is the repo root (npm workspaces share one root lockfile):
#   docker build -f frontend/Dockerfile --build-arg GIT_SHA=<sha> --build-arg SENTRY_DSN=<dsn> .
#
# No build-time API URL is needed — the app calls a same-origin /api/* (see
# frontend/src/api/client.ts), so one image works for both staging and
# production. GIT_SHA/SENTRY_DSN are the exception: baked in at build time
# because Vite has no other way to expose them (frontend/src/env.ts), but
# both are the same value regardless of which environment this image ends
# up deployed to — GIT_SHA because a new image is built per commit either
# way, SENTRY_DSN by deliberate choice (deployment-strategy.md Phase E, E-d).

FROM node:24-alpine AS build
WORKDIR /app

# npm workspaces resolve against every workspace's package.json even when
# installing just one workspace's dependency tree.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY e2e/package.json e2e/package.json

# The build needs devDependencies (vite, tsc, the Tailwind plugin), unlike
# the backend image — no --omit=dev here.
RUN npm ci --workspace=frontend

COPY frontend frontend

ARG GIT_SHA=unknown
ARG SENTRY_DSN=""
ENV VITE_GIT_SHA=$GIT_SHA
ENV VITE_SENTRY_DSN=$SENTRY_DSN

RUN npm run build -w frontend


FROM caddy:alpine AS runtime

COPY --from=build /app/frontend/dist /srv
COPY frontend/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
