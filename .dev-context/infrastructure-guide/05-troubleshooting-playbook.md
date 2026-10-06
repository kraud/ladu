# Troubleshooting playbook

Symptom-first. Each entry: what you'd see, what's actually going on, and what
to do. Several of these are real incidents hit while building this pipeline —
the same root causes are worth checking first if the symptom matches.

---

### "A user did not get the verification or reset email"

A support person can send the email again from the admin panel. Open the user,
then press **Resend verification email** (only for an account that is not
verified) or **Send password reset** (only for an account with a password).
Each button needs the `users.email` permission (support, admin, owner). The
same email to the same user is refused for 5 minutes.

A user who asks for a reset on the public page gets the same answer for any
address, and only one reset email per account every 5 minutes (a link that
support sent also starts that window). If the user says "I asked and nothing
came", the account may not exist or the 5 minutes may not be over.

The admin panel cannot know if the email arrived. It only knows that the mail
service accepted it. To see what happened, open the **Resend dashboard, Logs
tab** and search for the user's address. If the log is empty, the email never
left the VPS: use "Emails aren't arriving" below.

Each send writes an audit row (`user.resend_verification` or
`user.send_password_reset`). The row has the address and the language. It never
has the token or the link.

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
with `SMOKE_TEST_EMAIL`/`SMOKE_TEST_PASSWORD`/`EXPECTED_SHA`/`GOOGLE_CLIENT_ID`
set), then merge the fix. Occasionally the flakiness is in the test's own
selectors if UI text changed — same fix path either way, just in the spec
instead.

---

### "Smoke e2e failed on 'Google sign-in wiring', so production never deployed"

**What happened:** the login/create-word smoke passed, but the Google check
failed. That check has nothing to do with the smoke account: it asks staging's
`/api/auth/google/start` for the redirect to Google, then opens it and sees
what Google says.

**Check:** the failure message tells you which step broke.

| Failure | Meaning | Fix |
|---|---|---|
| `Google rejected the request (redirect_uri_mismatch)` | The callback URL the backend sends (`${BASE_URL}/api/auth/google/callback`) is not in the OAuth client's list. Usually a changed `BASE_URL` secret. | Google Cloud Console → APIs & Services → Credentials → the OAuth client → **Authorized redirect URIs**: add the exact URL from the message, or correct `BASE_URL`. |
| `Google rejected the request (invalid_client)` | Google does not know this client ID. The `GOOGLE_CLIENT_ID` secret is wrong or the client was deleted. | Compare the secret with the client ID in the Console. Fix the secret in **both** Environments, then redeploy. |
| `client_id` or `redirect_uri` assertion fails, before Google is contacted | The two do not match what the test expects — for example `GOOGLE_CLIENT_ID` differs between the `staging` Environment and what the backend was deployed with. | Check the deploy `.env` was written from the same secret. |
| Status is not 302, or the redirect is not to `accounts.google.com` | The backend has no Google provider (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` missing on the server) or is down. | Check both secrets exist in the Environment, then redeploy. |
| Lands on a captcha or "unusual traffic" page (no error path) | Google blocked GitHub's runner. Not a config problem. | Keep the URL assertions and drop the page load (step 3) in `deployed-smoke.spec.ts`. |

Console changes to redirect URIs can take a few minutes to apply — re-run
the job after waiting.

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

### "I need to create the first admin owner, or I am locked out of the admin dashboard"

Staff accounts are not in the learner `users` table, and nobody can sign in
until one exists. Create an `owner` on the VPS, inside the backend container,
with a terminal (`-it`) so the password prompt is hidden and stays out of the
shell history:

```bash
docker exec -it backend-prod node scripts/create-staff.js you@example.com "Your Name"
# staging:
docker exec -it backend-staging node scripts/create-staff.js you@example.com "Your Name"
```

The script asks for a password (at least 12 characters) twice. A second run
with the same email fails with "already exists". If the only owner forgot the
password, make another owner this way, then disable the old one from the Staff
page.

Everyone after the first owner is added on the **Staff** page (owners only).
The owner types or generates a temporary password and tells the person in
private. At the first sign-in the person must choose their own password before
they can use anything else.

### "Nobody can register or sign in" (or: I closed a gate and want to open it again)

The owner controls who can register, and who can sign in, on the **Access** page
of the admin panel (owners only). Each of the two gates, **Registration** and
**Login**, has three states:

- **Open:** anybody can do it. This is the default.
- **Closed:** nobody can. The page shows a banner and turns the form and the
  Google button off.
- **Limited:** only some can.
  - Registration: only emails on the **invite list**. An email leaves the list
    when that person registers. Any other email gets one message, so the list
    does not leak.
  - Login: only accounts on the **allowed list**. The list holds accounts, not
    emails, so it still works after a person changes their email. Add accounts by
    pasting emails on the Access page, or tick them in the **Users** list (the
    bar "Allow to sign in" works on many at once).

To open a gate again, choose **Open** and press **Save**. The change works at
once. Staff are never blocked by a gate, so an owner can always sign in to do
this. Each change writes an audit row: `access.registration_mode`,
`access.invite_add`, `access.invite_remove`, `access.login_mode`,
`access.login_allow`, `access.login_disallow`. When an invite is used, the system
writes `access.invite_used`.

Things to know about the login gate:

- It stops **new** sign-ins only. A person who is already signed in stays signed
  in (a session lasts 30 days). To end sessions, use "Emergency: sign everyone
  out" below.
- A wrong password still says "Invalid credentials". The gate answers only after
  a correct password, so it never shows which accounts exist.
- Registration open and login limited is allowed, but a new account is never on
  the allowed list. The person can register and verify the email, and then cannot
  sign in until the owner adds the account. The Access page says this.
- A person who opens the email link while login is closed or limited gets "Your
  email is verified" and no session.

If a person says "I cannot sign in", look at the Login state first, then at the
Allowed accounts table or at the user's own page (section "Sign-in access").

**If the admin panel does not work**, open both gates with one line of SQL in a
`psql` shell (see `02-environments-and-databases.md`):

```sql
UPDATE access_settings
   SET registration_mode = 'open', registration_note = '',
       login_mode = 'open', login_note = '';
```

The change works at once, with no restart. The table always has exactly one row.
To read the state: `SELECT registration_mode, login_mode FROM access_settings;`.

---

### "Emergency: sign everyone out"

Use this when you think accounts are in danger (for example a leaked token or a
stolen password list). It is on the **Access** page, in the red section at the
bottom, and it needs the owner role.

1. Press **Sign everyone out…**.
2. Type a reason (it goes in the audit log).
3. Type the phrase `SIGN OUT EVERYONE`.
4. Press the red button. The page says how many users were signed out.

What happens: one statement adds 1 to `users.token_version` for every account.
The app compares that number with the one in each learner's token on every
request, so each learner gets a 401 at their next request and goes back to the
login page. Nothing new runs on each request. Staff are **not** signed out. The
change cannot be undone, but people can sign in again.

To keep out everyone except some people, set **Login** to **Limited** first (add
the accounts that must be able to sign back in), then press the button. Only
allowed accounts can sign back in. To open the door again, set Login to **Open**.

The audit row is `access.sign_out_everyone`, with the reason and the number of
accounts. If the admin panel does not work, this is the same effect in `psql`:

```sql
UPDATE users SET token_version = token_version + 1;
```

---


### "A staff member forgot their password"

An owner opens **Staff**, clicks **Reset password** on that person, and gives
them the new temporary password. Their old password and all their open sessions
stop at once, and they must choose a new password at the next sign-in. An owner
cannot reset their own password there. The owner who forgot their own password
needs another owner to do it; if there is only one owner, use the script above
to make a second owner.

### "admin.ladu.com.ar shows 'Cannot reach the server', or loops on the Cloudflare login"

Two different locks can be the cause:

- **The Cloudflare Access page** (a Cloudflare-branded page asking for an
  email): this is the first lock working. Enter an address from the
  `admin_access_emails` variable. If the code never arrives, check that
  address is in the list and that "One-time PIN" is an enabled login method in
  the Zero Trust dashboard (Settings → Authentication).
- **"Cannot reach the server" inside the admin app**: the Access session
  (8 hours) ended while the page was open, so Cloudflare answered an API call
  with its login page. Reload the page; Access asks for a code again.
- **A 503 from `/api/admin/auth/login`**: `ADMIN_JWT_SECRET` is missing in that
  environment's `.env`. Add the GitHub Environment secret and redeploy.
- **A 404 on the whole host**: Caddy does not know the host yet. Run
  `ansible-playbook site.yml` from an up-to-date checkout of `main`. The
  `platform` role copies `deploy/caddy/` to the VPS and rebuilds the `edge`
  image (the Caddyfile is copied into the image, so a change needs a rebuild,
  not only a reload). If you must do it by hand on the VPS:
  `cd /opt/ladu/platform/compose && docker compose -f platform.yml --env-file ../.env up -d --build edge`.

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

### "A deploy failed at 'Pulling images' with `denied` or `unauthorized`"

**Cause:** `ladu-backend` and `ladu-admin` are private GHCR packages. The VPS
pulls them with the `deploy` user's Docker login, and that login no longer works.
Most likely the token expired (it has a 1 year expiry), or someone revoked it.

**Check:** on the VPS, as `deploy`:

```bash
docker pull ghcr.io/kraud/ladu-backend:<a recent sha>
cat ~/.docker/config.json    # shows a ghcr.io entry if a login exists (the value is the token, do not paste it anywhere)
```

**Fix:** create a new token and rotate it. Steps are in
[`06-secrets-and-access.md`](06-secrets-and-access.md), section "GHCR pull token".
The failed deploy left the previous release running, so there is no outage
(`deploy.sh` stops before the container swap).

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
