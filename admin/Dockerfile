# Build context is the repo root (npm workspaces share one root lockfile):
#   docker build -f admin/Dockerfile .
#
# The admin app (admin-dashboard.md, slice 7), served as static files. Same
# shape as frontend/Dockerfile: no build-time API URL, because the app calls a
# same-origin /api/* (admin/src/api/client.ts) and edge Caddy routes that to
# the backend of the same environment. So one image serves both admin-staging.
# and admin. -- nothing in it is specific to either.
#
# No GIT_SHA or SENTRY_DSN build args, unlike the web image: the admin app has
# no error reporting, and the running version is shown by the health page
# (the backend's own commit), not by this image.

FROM node:24-alpine AS build
WORKDIR /app

# npm workspaces resolve against every workspace's package.json even when
# installing just one workspace's dependency tree.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY admin/package.json admin/package.json
COPY e2e/package.json e2e/package.json

# The build needs devDependencies (vite, tsc, the Tailwind plugin).
RUN npm ci --workspace=admin

COPY admin admin

RUN npm run build -w admin


FROM caddy:alpine AS runtime

COPY --from=build /app/admin/dist /srv
COPY admin/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
