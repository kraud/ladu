# Glossary

Terms used throughout this guide and the deployment build log, in plain
language.

### Networking / DNS / TLS

**DNS (Domain Name System)** — the system that turns a hostname (`app.ladu.com.ar`) into an IP
address. This project's DNS is hosted at Cloudflare.

**A record / AAAA record** — a DNS record mapping a hostname to an IPv4 (A)
or IPv6 (AAAA) address.

**CDN (Content Delivery Network)** — a network of geographically distributed
servers that cache and serve content closer to the visitor, reducing latency
and absorbing traffic spikes before they ever reach the origin server (the
VPS, here). Cloudflare's proxy doubles as this project's CDN — enabled
automatically whenever a DNS record is proxied (see "Cloudflare proxy"
below), with no separate CDN service or configuration needed.

**CNAME record** — a DNS record mapping a hostname to *another* hostname
instead of directly to an IP (used here for Resend's email-verification
records).

**TXT record** — a DNS record holding arbitrary text, used here for
email-authentication data (DKIM, DMARC).

**Cloudflare proxy ("orange cloud")** — when a DNS record is *proxied*
through Cloudflare, visitors connect to Cloudflare's servers first (which
then relay to the VPS), rather than connecting to the VPS's IP directly.
This is what makes the "only accept traffic from Cloudflare's IP ranges"
firewall rule possible, and gives free DDoS protection/CDN caching as a
side effect.

**TLS / SSL** — the encryption protocol behind `https://`. This project has
*two* TLS handshakes on the way in: browser → Cloudflare (Cloudflare's own
certificate), then Cloudflare → VPS (a real Let's Encrypt certificate on the
VPS itself, required by the "Full (strict)" TLS mode setting).

**Let's Encrypt** — a free, automated certificate authority. Caddy requests
and renews certificates from it automatically.

**DNS-01 challenge** — one way to *prove* to a certificate authority that
you control a domain: by creating a specific temporary DNS TXT record it
asks for. Caddy does this automatically via the Cloudflare API (needs a
scoped Cloudflare API token for it), which is what lets it get a valid
certificate even though the VPS itself is never directly reachable from the
internet to prove domain control the more common way (serving a file over
HTTP).

**Reverse proxy** — a server that sits in front of other servers and routes
incoming requests to the right one. Caddy is this project's reverse proxy:
one process, listening on 80/443, deciding by hostname which container gets
each request.

### Containers

**Docker image** — a packaged, runnable snapshot of an application (code +
runtime + dependencies). Built once (`docker build`), then run anywhere
Docker is installed.

**Docker container** — a *running instance* of an image. Multiple containers
can run from the same image; this project runs `backend-staging` and
`backend-prod` from what were originally two separately-built images, but
could just as easily be the same image run twice with different config (see
"build once, deploy many" below).

**Docker Compose** — a tool for defining and running multiple related
containers together from one YAML file (`platform.yml`, `app.yml` here),
instead of typing `docker run` by hand for each one.

**GHCR (GitHub Container Registry)** — where this project's built images are
stored and pulled from (`ghcr.io/kraud/ladu-*`).

**"Build once, deploy many"** — build a Docker image exactly once per code
change, then deploy that *exact same* image to every environment, rather
than rebuilding separately for staging and for production. Guarantees
staging and production are never running subtly different code from the
same "release."

### CI/CD

**CI (Continuous Integration)** — automatically running tests/checks on
every code change, before it's allowed to merge. `ci.yml` here.

**CD (Continuous Deployment)** — automatically deploying every change that
passes CI, with no manual approval step. `deploy.yml` here.

**GitHub Actions** — GitHub's built-in automation system; `ci.yml` and
`deploy.yml` are both GitHub Actions "workflows."

**GitHub Environment** — a GitHub Actions feature for grouping
deployment-specific secrets and history under a name (`staging`,
`production`), separate from a repo's general secrets.

**Ruleset / branch protection** — a GitHub repository setting that blocks
certain actions on a branch (here: `main`) unless conditions are met — in
this project, "only via a merged PR, and only if every `ci.yml` check
passed."

**Concurrency group** — a GitHub Actions setting (`concurrency: deploy`)
that prevents two workflow runs in the same named group from executing at
the same time; a second merge to `main` while a deploy is in progress waits
its turn instead of racing it.

### Infrastructure as Code

**IaC (Infrastructure as Code)** — describing infrastructure (DNS records,
server configuration) as version-controlled files instead of manual
point-and-click changes, so changes are reviewable and repeatable.

**Terraform** — the IaC tool used here for **Cloudflare only** (DNS, TLS
settings, email-verification records). Describes the *desired* state; you
run `terraform plan` to preview a change and `terraform apply` to make it.

**HCP Terraform (Terraform Cloud)** — where this project's Terraform *state*
(its record of what it currently manages and its last-known values) is
stored remotely, rather than as a local file — lets `terraform apply` run
without any Cloudflare credential needing to exist on your laptop.

**Ansible** — the IaC/configuration-management tool used here for the VPS
itself (installing packages, users, firewall rules, bringing up the
platform Docker stack). Unlike Terraform, Ansible doesn't track a "state"
file — it just re-checks and re-applies a list of tasks (a "playbook")
every time it's run.

**Idempotent** — a property of a well-written Ansible task: running it
twice produces the same end state as running it once, and the second run
reports "no changes" rather than erroring or duplicating something. This
project's Ansible setup is verified idempotent — `ansible-playbook site.yml`
run twice in a row shows zero changes on the second run.

**Ansible role** — a self-contained, reusable group of related Ansible
tasks (this project has `base`, `firewall`, `docker`, `platform`, `backup`).

**Ansible playbook** — the top-level file (`site.yml`) that says which
roles run, in what order, against which hosts.

**Ansible Vault** — Ansible's built-in encryption for sensitive variables,
so secrets can live in git safely (encrypted at rest) rather than as plain
text.

### Server / OS

**VPS (Virtual Private Server)** — a virtual machine rented from a hosting
provider (Netcup, here) that behaves like a dedicated server you fully
control, as opposed to a managed platform that hides the OS from you.

**ufw (Uncomplicated Firewall)** — a friendlier interface over Linux's
`iptables` firewall, used here to restrict which IPs can reach the VPS on
which ports (SSH from anywhere; 80/443 from Cloudflare's ranges only).

**iptables / `DOCKER-USER` chain** — the lower-level Linux firewall
mechanism ufw is built on. `DOCKER-USER` is a special chain Docker provides
specifically so firewall rules can apply to Docker's *published ports* —
Docker's own networking otherwise bypasses ufw's normal rules entirely for
anything it publishes, which is why this project needs an explicit
`DOCKER-USER` rule set (regenerated on every Docker start, since Docker
clears this chain's contents each time it starts).

**fail2ban** — a service that watches for repeated failed login attempts
(SSH, here) and temporarily bans the offending IP — a defense against
brute-force password-guessing, on top of password auth already being
disabled entirely.

**systemd** — the Linux service manager responsible for starting, stopping,
and restarting background services (Docker, cron, sshd, fail2ban) on the
VPS, including automatically on boot.

**SSH key pair** — a public/private cryptographic key pair used to log into
a server without a password; the public half goes on the server
(`authorized_keys`), the private half stays secret on whichever machine
needs to connect.

### Deploys

**Health check** — an endpoint (`/api/health` here) a deploy script polls
after starting new containers, to confirm the new code is actually up and
working (including a real database query) before considering the deploy
successful.

**Smoke test** — a fast, shallow end-to-end test that exercises the most
critical user flow (here: log in, create a word, delete it) against a real
deployed environment, as a final gate before the next environment receives
the same release.

**Rollback** — reverting to a previously-working version after a failed
deploy. Here, strictly *image-level*: `deploy.sh` re-deploys the last
known-good commit SHA's containers. It never reverts a database migration.

**Expand/contract** — a migration strategy where schema changes are split
into safe steps (add the new thing → deploy code that uses it → *later*,
remove the old thing) specifically so that the previous release's code
still works correctly even after the migration has run — this is what makes
image-only rollback safe.

**SHA (commit SHA/hash)** — the unique identifier Git assigns to every
commit. Used throughout this pipeline as the "version number": Docker image
tags, the `/api/health` response, and the `deployed_sha` file on the VPS all
use the full commit SHA to unambiguously answer "which code is this."

### Security scanning

**Trivy** — a vulnerability scanner run against each built Docker image in
CI, checking every installed package for known CVEs.

**CVE (Common Vulnerabilities and Exposures)** — a standardized identifier
for a publicly known security vulnerability (e.g. `CVE-2026-27145`).

### Observability

**Sentry** — an error-tracking service. The app reports exceptions to it
(automatically for uncaught ones); Sentry groups them into "issues" and
tracks which release/environment each occurred in.

**DSN (Data Source Name)** — the project-specific URL Sentry's SDK sends
error reports to. Not a secret in the traditional sense (Sentry DSNs are
designed to be safely embedded in client-side code) but still kept out of
git here for consistency.

**Release** (Sentry concept) — a label (the commit SHA, here) attached to
every error report, letting you filter "errors from this specific deploy."

**Environment** (Sentry concept) — a label (`staging`/`prod`) separating
events from different deployments of the same project, without needing
separate Sentry projects per environment.

**Uptime monitor** (UptimeRobot) — a service that repeatedly polls a URL
from the outside and alerts when it stops responding correctly.

**Heartbeat / dead-man's-switch monitor** (Healthchecks.io) — the inverse: a
script pings the monitor *itself* on success, and the monitor alerts if an
expected ping doesn't arrive on schedule — catches "the cron job stopped
running entirely," which a normal uptime monitor can't see.

### Email deliverability

**Resend** — the transactional email service this project sends
verification/password-reset emails through, over SMTP.

**SPF (Sender Policy Framework)** — a DNS record listing which servers are
allowed to send email claiming to be from your domain.

**DKIM (DomainKeys Identified Mail)** — a DNS-published cryptographic
signature mechanism proving an email genuinely came from your domain and
wasn't altered in transit.

**DMARC** — a DNS record telling receiving mail servers what to do with
email that fails SPF/DKIM checks (here, `p=none` — report but don't reject,
a conservative starting policy).

### Backups

**B2 (Backblaze B2)** — the cloud storage service backups are pushed to.

**rclone** — a command-line tool for copying files to/from cloud storage
providers (including B2); used here by the backup script.

**pg_dump / pg_restore** — Postgres's own tools for exporting a database to
a file (`pg_dump`) and restoring one from a file (`pg_restore`). The `-Fc`
flag used here means "custom format" — compressed and restorable with
`pg_restore`, rather than a plain SQL text dump.

### Database / ORM

**Drizzle (Drizzle ORM)** — the TypeScript library this project uses to
define its database schema and generate/run migrations
(`backend/src/db/schema.ts` is the source of truth).

**Migration** — a versioned, one-way script that changes the database
schema (add a column, create a table, etc.). Generated by `drizzle-kit
generate` from schema changes, then applied by `backend/scripts/migrate.js`.
