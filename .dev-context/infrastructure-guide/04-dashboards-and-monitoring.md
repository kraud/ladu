# Dashboards and monitoring

Seven places show you the state of this system. This file covers each: what
it is, what "normal" looks like, and what to check when it isn't.

## GitHub Actions

**What it is:** the repo's Actions tab. Every PR runs `ci.yml`; every merge
to `main` runs `deploy.yml`.

**Reading it:**
- A run is a list of jobs, each with its own log. Green check = passed,
  red X = failed, yellow dot = in progress.
- `deploy.yml` runs are the ones that matter for "is production currently
  being updated" — click into one to see which of the four jobs
  (`build-and-push` → `staging` → `smoke` → `production`) it's at or stuck on.
- **The repo's Environments page** (Settings → Environments) shows
  `staging` and `production` separately, each with its own deployment
  history and its own secret set. This is where you go to see "when did
  production last actually deploy" at a glance, independent of digging
  through workflow runs.

**Normal:** every merge produces one `deploy.yml` run that goes fully green,
four jobs deep, in a few minutes.

**Abnormal:** a red `staging` or `production` job — check
[`05-troubleshooting-playbook.md`](05-troubleshooting-playbook.md). A red
`smoke` job means staging deployed but something about the actual user flow
broke — **production was never touched**, which is the point of that gate.

## GHCR (GitHub Container Registry)

**What it is:** where built Docker images live — three public packages,
`ladu-backend`, `ladu-web`, `ladu-landing`, under the repo's Packages page.

**Reading it:** each package's tag list is a history of every commit that
ever reached `build-and-push` — the tag *is* the commit SHA, so you can
always answer "which commit is currently deployed" by cross-referencing a
tag against `git log`, or more directly by checking `/api/health` (see
below) or the `deployed_sha` file on the VPS.

**Normal:** a new tag appears in each package on every merge to `main`.
There's no cleanup job — old tags accumulate; this is harmless (images are
small and the free tier has no relevant cap) but means the tag list isn't a
"currently deployed" indicator by itself.

## `/api/health`

Not a dashboard, but the fastest way to answer "what's actually running
right now" for either environment:

```bash
curl https://app.ladu.com.ar/api/health
curl https://staging.ladu.com.ar/api/health
```

Returns `{"status":"ok","sha":"<commit sha>"}` — `status` is `"error"`
(HTTP 503) if the backend can't reach Postgres, `sha` tells you exactly
which build is live. This is also literally what `deploy.sh` itself polls
after every deploy, and what UptimeRobot's fourth monitor checks continuously.

## Cloudflare dashboard

**What it is:** DNS, TLS, and the reverse-proxy/CDN layer in front of the
VPS. Most of its config is managed by Terraform (`deploy/terraform/`), but
the dashboard is still where you *look*.

**Reading it:**
- **DNS tab** — the actual records. `app`/`staging` point at the VPS's IP
  (proxied — orange cloud); the apex/`www` still point at Vercel (see
  [`01-architecture-overview.md`](01-architecture-overview.md)).
- **SSL/TLS tab** — should show Full (strict) mode. This means Cloudflare
  requires a *valid* certificate on the VPS side too (Caddy's Let's Encrypt
  cert), not just on Cloudflare's own edge — if this ever showed anything
  else, it'd mean Terraform state and Cloudflare's actual config have
  drifted, worth investigating.
- **Analytics tab** — traffic Cloudflare saw at the edge. Useful for
  confirming "is traffic even reaching Cloudflare" when debugging something
  that looks like a DNS or connectivity issue, before assuming it's the VPS.

**Normal:** you rarely need to look here day-to-day — it's "set and forget"
infrastructure. You'll open it when changing DNS/email records (via
Terraform) or diagnosing a TLS/certificate issue.

## HCP Terraform (Terraform Cloud)

**What it is:** where Terraform's *state* lives (not the VPS — this only
manages Cloudflare). One workspace, holding the Cloudflare API token as a
workspace variable so no Cloudflare credential ever needs to live on your
laptop or in a GitHub secret.

**Reading it:** the Runs tab shows every `terraform plan`/`apply` you've
triggered locally (`cd deploy/terraform && terraform plan`) — each run shows
exactly which Cloudflare resources would change/changed. You only interact
with this when deliberately changing a DNS or email-related record.

**Normal:** `terraform plan` shows no changes when nothing's been edited.
If it ever shows *unexpected* changes with no edit on your end, someone (or
something) changed a Cloudflare setting outside Terraform — the dashboard
tab above is where to check what.

## UptimeRobot

**What it is:** external HTTP polling — the "is the site even reachable"
check, from outside your own infrastructure. Four monitors, 5-minute
interval: `https://app.ladu.com.ar`, `https://staging.ladu.com.ar`,
`https://ladu.com.ar` (apex — currently checking the *legacy* Vercel site,
not this repo), and `https://app.ladu.com.ar/api/health` specifically
(production only — staging's health is already exercised by every deploy's
own health check and the smoke e2e gate, so a dedicated monitor there adds
little).

**Reading it:** each monitor shows an uptime percentage and a response-time
graph. Green = last check succeeded. Configured to email on a state change
(up → down or down → up).

**Normal:** all four green, near-100% uptime.

**⚠️ Known gap:** the alert-firing behavior itself has never been tested end
to end — monitors have always been green so far, so nobody has confirmed an
alert email actually arrives when one goes red. See
[`05-troubleshooting-playbook.md`](05-troubleshooting-playbook.md) for how
to test this deliberately.

## Healthchecks.io

**What it is:** the inverse of UptimeRobot. Instead of *polling* something
and alerting if it's down, your own script *pings out* on success, and
Healthchecks.io alerts if a ping doesn't arrive on the expected schedule.
One check here: the weekly restore-drill heartbeat, pinged by
`deploy/scripts/restore-test.sh` (a VPS cron job, Sundays 04:00) only after
it has successfully downloaded the latest backup, restored it into a
throwaway container, and confirmed the restored data is queryable.

**Reading it:** the check's page shows "last ping" timestamp. Green/"up" if
a ping arrived within the expected window; it goes into a grace period and
then "down" (triggering an alert) if a whole week passes with no ping.

**Why this exists instead of UptimeRobot for this:** UptimeRobot's free plan
turned out not to include heartbeat/cron monitoring (discovered by trying);
Healthchecks.io's free tier is purpose-built for exactly this "did my cron
job silently stop running" pattern, which is a different failure mode than
"is my website reachable."

**Normal:** one green ping per week, Sunday morning. A missed ping means
*either* the restore test itself failed (check `/opt/ladu/backup/restore-test.log`
on the VPS) *or* cron/the script never ran at all — both are worth
investigating, since either means backups aren't proven-restorable right now.

## Sentry

**What it is:** error tracking for both the backend (Node/Express) and
frontend (React) — two separate projects, `ladu-backend` and `ladu-frontend`.
One DSN (Data Source Name — Sentry's project-specific ingest URL) per
project, shared across staging and production; each event is tagged with
`environment` (`staging`/`prod`) and `release` (the commit SHA), so you can
always filter down to "just production" or "just this specific deploy."

**Reading it:**
- The **Issues** list is the main view — one row per *distinct* error
  (grouped by stack trace/message), not one row per occurrence. Click in for
  the full stack trace, breadcrumbs, and every environment/release it's been
  seen in.
- Filter by `environment:production` to see only what's affecting real
  users; by `release:<sha>` to check "did the deploy I just shipped
  introduce anything new."
- The frontend project also captures genuinely uncaught browser exceptions
  (via `window.onerror`), not just handled `try/catch` blocks you
  explicitly report.

**Normal:** an occasional expected error (e.g. a 401 from an invalid token,
a 400 from bad user input) is fine and not something to act on reflexively —
Sentry captures anything that reaches the Express error handler or an
uncaught frontend exception, which includes plenty of "working as intended"
noise. What's worth attention is a *new* issue appearing right after a
deploy, or one whose occurrence count is climbing.

**A structural note:** the frontend's `web` image is shared between staging
and production (one build, "build once, deploy many" — see
[`01-architecture-overview.md`](01-architecture-overview.md)), so it can't
bake in an `environment` value at build time the way the backend does via an
env var. Instead, the frontend detects `staging` vs everything-else by
reading `window.location.hostname` in the browser at page-load time. Worth
knowing if a frontend event's `environment` tag ever looks wrong — it's
derived from the hostname the user was actually on, not from any deploy-time
configuration.

## Netcup control panel

**What it is:** the VPS host's own dashboard — server resource graphs
(CPU/RAM/disk), and, importantly, a **console/reboot access path that
doesn't depend on SSH working.** You go here when SSH itself is unreachable
(e.g. a firewall misconfiguration locked you out) or when you need to check
whether the VPS is out of disk or memory at the OS level, which none of the
other dashboards above can tell you.

**Normal:** rarely need to look. This is your escape hatch, not a routine
check.
