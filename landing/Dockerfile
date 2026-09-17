# Plain static site, not an npm workspace — build context is landing/ itself:
#   docker build -f landing/Dockerfile landing/

FROM caddy:alpine

COPY index.html style.css /srv/
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
