#!/usr/bin/env bash
# Weekly proof that the latest backup actually restores.
# Deployed by the Ansible `backup` role.
#
# Downloads the newest dump from B2, restores it into a throwaway
# postgres:15-alpine container (no persistent volume, always removed at
# the end -- even on failure, via the trap below), runs a sanity-check
# query, then pings UptimeRobot's heartbeat URL. This is a dead-man's
# switch: silence -- no run, or a run that fails before the ping -- is
# exactly what the heartbeat monitor alerts on.
set -euo pipefail

BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "${BACKUP_DIR}/backup.env"
set +a

LATEST_DUMP="$(rclone lsf "b2:${B2_BUCKET_NAME}" --config "${BACKUP_DIR}/rclone.conf" | sort | tail -n1)"
if [ -z "${LATEST_DUMP}" ]; then
  echo "Restore test failed: no dump found in b2:${B2_BUCKET_NAME}" >&2
  exit 1
fi

LOCAL_DUMP="${BACKUP_DIR}/restore-test-${LATEST_DUMP}"
rclone copyto "b2:${B2_BUCKET_NAME}/${LATEST_DUMP}" "${LOCAL_DUMP}" --config "${BACKUP_DIR}/rclone.conf"

CONTAINER_NAME="ladu-restore-test-$$"
docker run -d --name "${CONTAINER_NAME}" -e POSTGRES_PASSWORD=restoretest postgres:15-alpine >/dev/null
trap 'docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true; rm -f "${LOCAL_DUMP}"' EXIT

for _ in $(seq 1 30); do
  if docker exec "${CONTAINER_NAME}" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec "${CONTAINER_NAME}" createdb -U postgres ladu_prod
docker exec -i "${CONTAINER_NAME}" pg_restore -U postgres -d ladu_prod --no-owner < "${LOCAL_DUMP}"

ROW_COUNT="$(docker exec "${CONTAINER_NAME}" psql -U postgres -d ladu_prod -tAc "SELECT count(*) FROM words")"
if ! [[ "${ROW_COUNT}" =~ ^[0-9]+$ ]]; then
  echo "Restore test failed: could not read a row count from 'words' after restore" >&2
  exit 1
fi

echo "Restore test passed: ${LATEST_DUMP} restored, ${ROW_COUNT} rows in 'words'"
curl -fsS -m 10 --retry 3 "${UPTIMEROBOT_HEARTBEAT_URL}" >/dev/null
