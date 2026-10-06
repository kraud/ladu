# Plain static site, not an npm workspace — build context is landing/ itself:
#   docker build -f landing/Dockerfile landing/
#
# Two stages. The first runs the blog build (scripts/build.mjs): it turns the
# Markdown posts in blog/posts/ into HTML pages, a feed and a sitemap. It uses
# privacy.html as the page frame, so the blog always matches the rest of the
# site. The second stage is the same Caddy server as before; the Node stage and
# its packages are not in the final image.

FROM node:24-alpine AS build
WORKDIR /site

COPY package.json package-lock.json ./
RUN npm ci

COPY scripts scripts
COPY blog blog
COPY privacy.html ./
RUN npm run build


FROM caddy:alpine

COPY index.html privacy.html terms.html credits.html impressum.html style.css app.js favicon.svg robots.txt /srv/
COPY brand/ /srv/brand/
COPY flags/ /srv/flags/
# dist/ holds blog/ and sitemap.xml
COPY --from=build /site/dist/ /srv/
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
