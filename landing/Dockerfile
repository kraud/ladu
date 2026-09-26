# Plain static site, not an npm workspace — build context is landing/ itself:
#   docker build -f landing/Dockerfile landing/

FROM caddy:alpine

COPY index.html privacy.html style.css app.js favicon.svg /srv/
COPY brand/ /srv/brand/
COPY flags/ /srv/flags/
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
