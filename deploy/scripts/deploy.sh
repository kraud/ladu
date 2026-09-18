#!/usr/bin/env bash
# deploy.sh <staging|prod> <sha> — see .dev-context/deployment-strategy.md §3.
#
# Copied to /opt/ladu/<env>/ on every deploy, alongside that environment's
# app.yml (also copied fresh each deploy) and .env (written separately by
# the GitHub Environment deploy job from that environment's secrets — not
# touched by this script). Run it from that directory:
#   cd /opt/ladu/staging && ./deploy.sh staging <sha>
#
# Migrations run as their own step, before the container swap (expand/
# contract rule — see the doc). A failed migration leaves the previous
# release running untouched. A failed health check after the swap rolls
# back to whatever SHA was last recorded as successfully deployed.
set -euo pipefail

ENVIRONMENT="${1:?Usage: deploy.sh <staging|prod> <sha>}"
IMAGE_TAG="${2:?Usage: deploy.sh <staging|prod> <sha>}"

cd "$(dirname "$0")"

export ENVIRONMENT
export IMAGE_TAG

compose() {
    docker compose -f app.yml --env-file .env "$@"
}

# BASE_URL (e.g. https://staging.ladu.com.ar) is already in .env — reusing
# it here instead of hardcoding the per-environment hostname a second time.
BASE_URL="$(grep -m1 '^BASE_URL=' .env | cut -d= -f2-)"
HEALTH_URL="${BASE_URL%/}/api/health"
DEPLOYED_SHA_FILE="deployed_sha"

echo "==> Deploying $ENVIRONMENT @ $IMAGE_TAG"

echo "==> Pulling images"
compose pull

echo "==> Running migrations"
if ! compose run --rm backend node scripts/migrate.js; then
    echo "Migration failed — leaving the previous release running." >&2
    exit 1
fi

echo "==> Starting containers"
compose up -d

echo "==> Waiting for $HEALTH_URL to report sha=$IMAGE_TAG (up to 60s)"
attempt=0
until curl -fsS "$HEALTH_URL" 2>/dev/null | grep -q "\"sha\":\"$IMAGE_TAG\""; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then
        echo "Health check did not report the new SHA in time." >&2
        if [ -f "$DEPLOYED_SHA_FILE" ]; then
            PREVIOUS_SHA="$(cat "$DEPLOYED_SHA_FILE")"
            echo "==> Rolling back to $PREVIOUS_SHA" >&2
            IMAGE_TAG="$PREVIOUS_SHA" compose up -d
        else
            echo "No previous deployed_sha on record — nothing to roll back to." >&2
        fi
        exit 1
    fi
    sleep 2
done

echo "$IMAGE_TAG" > "$DEPLOYED_SHA_FILE"
echo "==> Deployed $ENVIRONMENT @ $IMAGE_TAG"
