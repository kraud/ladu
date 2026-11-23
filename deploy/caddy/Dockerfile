# The edge proxy: builds Caddy with the Cloudflare DNS module so it can get
# certificates via the DNS-01 challenge (works behind the Cloudflare proxy,
# where the HTTP-01 challenge can't reach the server directly).
#
# Self-contained — build context is deploy/caddy/ itself:
#   docker build -f deploy/caddy/Dockerfile deploy/caddy/

# The Caddy version is pinned by the two image tags below (builder and runtime),
# and they must match. Without a pin, Docker's layer cache keeps the first binary
# that was built, and the proxy silently falls behind on security fixes.
# Dependabot proposes both tags. `xcaddy build` takes no version here on purpose:
# the builder image sets CADDY_VERSION to its own tag, and xcaddy uses it. A
# second, hand-written version would not be updated by Dependabot, and a bump
# of the tags would still compile the old Caddy.
FROM caddy:2.11.9-builder-alpine AS builder

RUN xcaddy build \
    --with github.com/caddy-dns/cloudflare


FROM caddy:2.11.9-alpine

COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443
