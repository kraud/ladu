# Build context is the repo root (npm workspaces share one root lockfile):
#   docker build -f frontend/Dockerfile .
#
# No build-time API URL is needed — the app calls a same-origin /api/* (see
# frontend/src/api/client.ts), so one image works for both staging and
# production.

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

RUN npm run build -w frontend


FROM caddy:alpine AS runtime

COPY --from=build /app/frontend/dist /srv
COPY frontend/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
