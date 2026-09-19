#!/usr/bin/env bash
# Nightly dump of ladu_prod, pushed to Backblaze B2.
# Deployed by the Ansible `backup` role (deploy/ansible/roles/backup) --
# unlike deploy.sh/app.yml, this isn't a per-deploy artifact, so Ansible
# owns and syncs it rather than a GitHub Actions job.
set -euo pipefail

BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "${BACKUP_DIR}/backup.env"
set +a

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="${BACKUP_DIR}/ladu_prod_${TIMESTAMP}.dump"

docker compose -f /opt/ladu/platform/compose/platform.yml \
  --env-file /opt/ladu/platform/.env \
  exec -T postgres pg_dump -Fc -U "${POSTGRES_SUPERUSER}" -d ladu_prod > "${DUMP_FILE}"

rclone copy "${DUMP_FILE}" "b2:${B2_BUCKET_NAME}" --config "${BACKUP_DIR}/rclone.conf"

rm -f "${DUMP_FILE}"
echo "Backed up ladu_prod to b2:${B2_BUCKET_NAME}/$(basename "${DUMP_FILE}")"
