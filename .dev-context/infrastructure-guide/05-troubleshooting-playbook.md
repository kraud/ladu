# Troubleshooting playbook

Symptom-first. Each entry: what you'd see, what's actually going on, and what
to do. Several of these are real incidents hit while building this pipeline —
the same root causes are worth checking first if the symptom matches.

---

### "A `deploy.yml` run failed on the `staging` or `production` job, at the migration step"

**What happened:** `deploy.sh` ran `docker compose run --rm backend node
scripts/migrate.js` and it exited non-zero. **The previous release is still
running** — this step happens *before* the container swap, so nothing user-
facing broke.

**Check:** the failed job's log in GitHub Actions shows the migration
script's output directly (it logs both Drizzle's own error and the
underlying Postgres error via `err.cause`).

**Common causes seen before:** a migration assumes it owns something it
doesn't (Postgres 15 stopped auto-granting `CREATE` on the `public` schema
to non-owners — already fixed for the standard case, but a *new* schema or
unusual grant could hit the same class of issue); a migration that isn't
actually expand/contract-safe against what's currently deployed.

**Fix:** fix the migration (or the underlying grant) and merge a new commit
— do not hand-edit a migration that has already been attempted against a
real environment. Re-running `deploy.sh` for the same commit is safe if the
failed migration's own transaction rolled back cleanly (Drizzle wraps each
migration run in one transaction).

---

### "A `deploy.yml` run failed on the `staging` or `production` job, at the health-check step"

**What happened:** containers were swapped to the new image, but
`/api/health` never reported the new SHA within 60 seconds.
**`deploy.sh` automatically rolled back** to whatever SHA was last recorded
as successfully deployed, then exited the job non-zero.

**Check:**
```bash
ssh -i ~/.ssh/ladu_deploy deploy@152.53.146.206
docker logs backend-staging   # or backend-prod
```
Look for a crash on startup (bad env var, code error, DB connection
failure). Also confirm the rollback actually happened:
```bash
curl https://staging.ladu.com.ar/api/health   # should show the OLD sha
```

**Fix:** find and fix the actual startup failure, then merge again — the
next successful deploy naturally supersedes the rollback. There's no state
to manually clean up.

---

### "Smoke e2e failed, so production never deployed"

**What happened:** staging deployed fine, but the real login → create word
→ delete word flow against real staging broke. **This is the gate working
as intended** — better to catch it here than in production.

**Check:** the `smoke` job's uploaded Playwright report (attached as a CI
artifact on failure) shows exactly which step failed and a trace/screenshot.

**Fix:** most often this is a real UI regression — fix it locally, verify
with `npm run test:e2e:smoke` pointed at staging
(`BASE_URL=https://staging.ladu.com.ar npm run test:e2e:smoke` from `e2e/`,
with `SMOKE_TEST_EMAIL`/`SMOKE_TEST_PASSWORD`/`EXPECTED_SHA` set), then
merge the fix. Occasionally the flakiness is in the test's own selectors if
UI text changed — same fix path either way, just in the spec instead.

---

### "UptimeRobot sent an alert" (or: testing that it would)

**What to do immediately:** confirm whether the site is actually down before
assuming UptimeRobot is wrong:
```bash
curl -I https://app.ladu.com.ar
ssh -i ~/.ssh/ladu_deploy deploy@152.53.146.206 "docker ps"
```
If a container is missing/restarting, check its logs (`docker logs
backend-prod`). If everything looks fine from the VPS itself, check
Cloudflare's dashboard (Analytics tab) for an edge-level issue instead.

**Deliberately testing the alert (the open gate mentioned in the README):**
```bash
ssh -i ~/.ssh/ladu_deploy deploy@152.53.146.206
docker stop backend-staging
# wait ~5-6 minutes, confirm an alert email arrives
docker start backend-staging
```
Use `backend-staging`, not a production container, for this drill.

---

### "Emails aren't arriving" (registration/password-reset)

Three real bugs have hit this exact symptom before — check them in order:

1. **Was the `.env` change actually picked up?** `docker restart` does
   *not* reload environment variables — only `docker compose up -d`
   (recreating the container) does. Confirm with
   `docker exec backend-staging printenv EMAIL_FROM` (or whichever var).
2. **Is `EMAIL_FROM` actually set?** It must be a real address on the
   verified domain (`staging@ladu.com.ar` / `noreply@ladu.com.ar`) —
   `EMAIL_USER` is the SMTP *username* (`"resend"`, literally), not a
   sender address, and using it as `from` fails with `550 Invalid from
   field`.
3. **Is the port right?** Must be `2465`, not the standard `465` — Netcup
   blocks outbound 465/587/25 by default as an anti-abuse policy. Confirm
   with a raw connect test from the VPS itself:
   ```bash
   ssh -i ~/.ssh/ladu_deploy deploy@152.53.146.206
   timeout 3 bash -c '</dev/tcp/smtp.resend.com/2465' && echo OK
   ```
4. Check **Resend's own dashboard → Logs tab** — if a send attempt shows up
   there at all, the problem is downstream of your infrastructure (bounce,
   spam filter, etc.); if it's empty, the request never left the VPS —
   points back to #1–#3 above.

Registration/password-reset themselves never *block* on the email actually
sending (fixed deliberately — `sendMail(...)` is fire-and-forget with its
own error handling), so a broken email pipeline won't make those endpoints
hang or 500; it'll just mean no email shows up.

---

### "Backend can't reach an external API" (Sentry, the Eesti dictionary API, or similar)

**Symptom:** an outbound HTTPS call from inside `backend-prod`/
`backend-staging` times out (`ETIMEDOUT`/`ENETUNREACH`), even though the VPS
*host itself* can reach the same URL fine via `curl`.

**What this has meant before:** the `DOCKER-USER` iptables chain (installed
by the `platform` Ansible role to keep non-Cloudflare traffic out of
published ports) had a DROP rule with no interface restriction, so it also
caught containers' own *outbound* connections on port 443 — not just
inbound traffic to published ports. This has already been fixed (the DROP
rule is now scoped to the VPS's external interface only), but if it
resurfaces after any change to
`deploy/ansible/roles/platform/templates/docker-user-firewall.sh.j2`, this
exact symptom is the tell.

**Check:**
```bash
ssh -i ~/.ssh/ladu_deploy deploy@152.53.146.206
sudo iptables -L DOCKER-USER -v -n
docker exec backend-prod curl -v https://<the-external-host>
```

**Fix:** re-run `ansible-playbook site.yml` if the template was reverted; if
it's a genuinely new outbound-blocking rule, scope it to `-i
{{ ansible_default_ipv4.interface }}` the same way the existing DROP rule
is, so it only affects *inbound* traffic to the VPS, not container egress.

---

### "TLS certificate errors, or Caddy won't start"

**Check:** `docker logs <edge container name>` on the VPS for ACME
(Let's Encrypt) errors.

**Common cause:** Let's Encrypt rate-limits duplicate certificates for the
same hostname (5/week). This is why `platform.yml` uses **persistent**
`caddy_data`/`caddy_config` volumes — recreating the `edge` container
(config or image change) should *not* lose the existing certificate/ACME
account state. If those volumes were ever accidentally removed, expect to
hit this rate limit on the next few certificate requests, with no fast fix
except waiting it out or requesting from Let's Encrypt's staging environment
first.

---

### "Backup or restore-test cron job seems to have stopped" (Healthchecks.io went red)

**Check the logs directly on the VPS:**
```bash
ssh -i ~/.ssh/ladu_deploy deploy@152.53.146.206
tail -50 /opt/ladu/backup/backup.log
tail -50 /opt/ladu/backup/restore-test.log
```

**Run either script manually to reproduce/verify a fix:**
```bash
/opt/ladu/backup/backup.sh
/opt/ladu/backup/restore-test.sh
```

**Known sharp edges (already fixed once, worth knowing if they recur):**
a wrong B2 bucket name causes `rclone` to fail outright rather than write to
the wrong place; `pg_restore` needs both `--no-owner` *and* `--no-privileges`
against a throwaway container that has none of the real roles; the restore
container's readiness check must wait for Postgres's "ready to accept
connections" log line **twice**, since the official image briefly starts and
stops Postgres once for `initdb` on a fresh, volume-less container before
starting it for real — a single `pg_isready` can be fooled by that first,
short-lived window.

---

### "It works locally / in CI, but not on staging or production"

Almost always an environment-variable mismatch. Checklist, in order:

1. Compare `deploy/env/app.env.example` (what *should* be set) against the
   actual `staging`/`production` GitHub Environment secrets (Settings →
   Environments) — is the var even defined there?
2. Compare against `deploy.yml`'s two `ENVFILE` heredocs (`staging` and
   `production` jobs) — is the var actually being *written* to `.env` on
   the VPS? (A real bug: a new var was added everywhere except here.)
3. Confirm what's actually running on the VPS reflects the latest write:
   `docker exec backend-staging printenv <VAR>` — remember the
   restart-vs-recreate gotcha above.

---

### "I need to manually roll back right now"

See [`03-development-workflow.md`](03-development-workflow.md)'s "Manual /
emergency deploy" section — `./deploy.sh <env> <known-good-sha>` from
`/opt/ladu/<env>/` on the VPS, using a SHA you know exists in GHCR (check the
Packages page, or `git log`, or the environment's own `deployed_sha` file
next to `deploy.sh`).
