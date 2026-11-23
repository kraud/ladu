# The edge proxy: builds Caddy with the Cloudflare DNS module so it can get
# certificates via the DNS-01 challenge (works behind the Cloudflare proxy,
# where the HTTP-01 challenge can't reach the server directly).
#
# Self-contained — build context is deploy/caddy/ itself:
#   docker build -f deploy/caddy/Dockerfile deploy/caddy/

# The Caddy version is pinned, in all three places below (builder tag,
# `xcaddy build` argument, runtime tag), and they must match. Without a pin,
# Docker's layer cache keeps the first binary that was built, and the proxy
# silently falls behind on security fixes. Dependabot proposes the two image
# tags; change the `xcaddy build` version by hand in the same PR.
FROM caddy:2.11.9-builder-alpine AS builder

RUN xcaddy build v2.11.9 \
    --with github.com/caddy-dns/cloudflare


FROM caddy:2.11.9-alpine

COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443
