# The edge proxy: builds Caddy with the Cloudflare DNS module so it can get
# certificates via the DNS-01 challenge (works behind the Cloudflare proxy,
# where the HTTP-01 challenge can't reach the server directly).
#
# Self-contained — build context is deploy/caddy/ itself:
#   docker build -f deploy/caddy/Dockerfile deploy/caddy/

FROM caddy:2-builder-alpine AS builder

RUN xcaddy build \
    --with github.com/caddy-dns/cloudflare


FROM caddy:2-alpine

COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443
