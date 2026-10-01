#!/usr/bin/env bash
# Sourced by backup.sh and restore-test.sh (not run on its own). Defines
# `record_event <kind> <true|false> <detail>`, which writes one row into the
# `ops_events` table of ladu_prod. The admin dashboard's health page reads the
# newest row of each kind (.context/plans/admin-dashboard.md, slice 6).
#
# It connects as the Postgres superuser, the same way backup.sh dumps, so the
# app's own DB user needs no extra permission. The caller must have sourced
# backup.env first (POSTGRES_SUPERUSER).
#
# The values go in as psql variables (:'name'), never pasted into the SQL text,
# so a detail line with a quote in it cannot break the statement.
#
# Telemetry must never fail a backup: a write that fails only prints a warning.
record_event() {
  local kind="$1" ok="$2" detail="$3"
  if ! printf '%s\n' "INSERT INTO ops_events (kind, ok, detail) VALUES (:'kind', :'ok', :'detail');" |
    docker compose -f /opt/ladu/platform/compose/platform.yml \
      --env-file /opt/ladu/platform/.env \
      exec -T postgres psql -q -U "${POSTGRES_SUPERUSER}" -d ladu_prod -v ON_ERROR_STOP=1 \
      -v "kind=${kind}" -v "ok=${ok}" -v "detail=${detail}"; then
    echo "Warning: could not record the ${kind} event in ops_events" >&2
  fi
}
