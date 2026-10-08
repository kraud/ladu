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
source "${BACKUP_DIR}/record-event.sh"

# A failed run is recorded too, so the admin health page can show it. (If the
# database itself is what failed, this write fails as well; it only warns.)
trap 'record_event backup false "failed at line ${LINENO}"' ERR

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="${BACKUP_DIR}/ladu_prod_${TIMESTAMP}.dump"

# The autocomplete lexicon (table `lexemes`) is reference data rebuilt from a versioned file, not
# user data: the dump keeps its table definition but skips its rows. After a restore, reload it
# (infrastructure guide 02, "The autocomplete lexicon").
docker compose -f /opt/ladu/platform/compose/platform.yml \
  --env-file /opt/ladu/platform/.env \
  exec -T postgres pg_dump -Fc --exclude-table-data=public.lexemes -U "${POSTGRES_SUPERUSER}" -d ladu_prod > "${DUMP_FILE}"

rclone copy "${DUMP_FILE}" "b2:${B2_BUCKET_NAME}" --config "${BACKUP_DIR}/rclone.conf"

rm -f "${DUMP_FILE}"
echo "Backed up ladu_prod to b2:${B2_BUCKET_NAME}/$(basename "${DUMP_FILE}")"
record_event backup true "$(basename "${DUMP_FILE}")"
