# Architecture overview

## The one-paragraph version

One small VPS runs everything. Cloudflare sits in front of it as a combined
DNS host, CDN, and TLS terminator, and only lets Cloudflare's own IP ranges
reach the server at all. On the VPS, a reverse proxy (Caddy) looks at the
hostname of each incoming request and routes it to one of several Docker
containers — one set for staging, one set for production, sharing a single
Postgres server (with separate databases) and a single edge proxy. Code goes
from a GitHub pull request to a built Docker image to both staging and
production automatically, with no manual "click deploy" step anywhere.

## The building analogy

Think of the VPS as an apartment building with two tenants — **staging** and
**production** — plus some shared building infrastructure:

- **The building's utilities (water, electricity)** = the *platform stack*:
  one Postgres server and one Caddy reverse proxy, provisioned once and left
  running. Both tenants draw from the same Postgres server, but each has
  their own locked room inside it (a separate database + a separate database
  user that can't see the other tenant's data).
- **Each tenant's apartment** = the *app stack*: one `web` container
  (serves the built frontend) and one `backend` container (the API), deployed
  independently per environment.
- **The building's front door and doorman** = Cloudflare + the firewall: the
  only way in from the internet is through Cloudflare, and the VPS's firewall
  refuses connections from anyone claiming to be a visitor but not arriving
  through Cloudflare's known IP ranges.
- **The building directory in the lobby** = Caddy: it reads which tenant a
  visitor asked for (`app.ladu.com.ar` vs `staging.ladu.com.ar`) by hostname
  and sends them to the right door. There's no separate load balancer or
  DNS trick per environment — it's all one IP address, split by hostname.

## Request path, end to end

```
Browser
  │  https://app.ladu.com.ar/...
  ▼
Cloudflare (DNS, TLS to the browser, CDN/proxy, DDoS filtering)
  │  only Cloudflare's own IPs are allowed past this point (see the firewall notes below)
  ▼
VPS :443 → Caddy ("edge" container)
  │  reads the Host header
  ├─ app.ladu.com.ar        /api/* → backend-prod:5001   else → web-prod:80
  ├─ staging.ladu.com.ar    /api/* → backend-staging:5001 else → web-staging:80
  ├─ ladu.com.ar (apex)     → landing container
  └─ www.ladu.com.ar        → redirects to the apex
  ▼
web-prod / web-staging (Caddy serving the built frontend, SPA fallback)
backend-prod / backend-staging (Node/Express API)
  ▼
postgres (one server, two databases: ladu_prod, ladu_staging)
```

Everything after Cloudflare lives on **Docker networks that publish no ports
except Caddy's 80/443** — `web` and `backend` containers are unreachable
directly from the internet even if someone had the VPS's IP.

## The two Docker Compose stacks

This is the part that trips people up most: there are **two separate Compose
projects**, not one.

### `platform.yml` — one instance, for the whole VPS

Brought up once by Ansible (not part of the per-commit deploy pipeline).
Contains:

- **`postgres`** — one Postgres 15 server for both environments.
- **`edge`** — the Caddy reverse proxy, built locally from `deploy/caddy/`
  (not pulled from a registry — it changes rarely).
- **`landing`** — the static marketing site at `landing/`, a singleton like
  postgres/edge (there's no staging/prod split for it), even though its image
  *is* rebuilt on every commit like `backend`/`web`. It is **not** deployed
  per commit: Ansible's `platform` role pulls `ghcr.io/kraud/ladu-landing:latest`
  (see "Publishing a change to the landing page" below).

### `app.yml` — one instance per environment

The same file is used twice — once with `ENVIRONMENT=staging`, once with
`ENVIRONMENT=prod` — each time producing a differently-named Compose project
(`ladu-staging`, `ladu-prod`) with its own containers (`web-staging` /
`backend-staging`, `web-prod` / `backend-prod`). This is what
`deploy/scripts/deploy.sh` runs on every merge to `main` (see
[`03-development-workflow.md`](03-development-workflow.md)). Neither service
publishes a port — both join the `edge` Docker network that `platform.yml`
created, which is how Caddy (and only Caddy) can reach them.

**"Build once, deploy many"**: `backend`, `web`, and `landing` images are
built exactly once per commit (tagged with the full commit SHA) and pushed to
GHCR. The *same* image is then deployed to staging first and production
second — staging never runs different code than what production is about to
run.

## The apex domain and Vercel

`ladu.com.ar` and `www.ladu.com.ar` point at the VPS, like `app.` and
`staging.`. Vercel hosted the first version of the site. It is not used any
more, and no Cloudflare record points at it. There is also no wildcard
(`*.ladu.com.ar`) record: every hostname needs its own record in
`deploy/terraform/dns.tf`, and an unknown subdomain does not resolve.

### Publishing a change to the landing page

The landing page does not deploy with the app. To publish a change:
1. Merge it to `main`. `deploy.yml` builds the image and moves the `latest` tag.
2. Run `ansible-playbook site.yml`. The playbook is idempotent, and the
   `platform` role pulls `latest` again and recreates the `landing` container
   if the image changed.

## The toolchain: which tool owns what, and how they hand off

Four tools do the actual work — Terraform, Ansible, Caddy, and Docker
Compose (driven both by Ansible and by GitHub Actions) — and the part worth
internalizing is that **they almost never talk to each other directly.**
Each owns one layer; the "connection" between layers is usually just "the
previous tool's output is a value this one was configured to expect," not
any live integration.

```
Terraform                Ansible                        GitHub Actions
   │                        │                                  │
   ▼                        ▼                                  ▼
Cloudflare DNS/TLS   Installs Docker, sets up the        Runs deploy.sh,
(who does the         firewall, creates the deploy        which drives
 domain point at)      user, and — as one of its           Docker Compose
                        tasks — builds + starts             for app.yml
                        Caddy and Postgres                   only (web +
                        (deploy/compose/platform.yml)        backend)
                              │
                              ▼
                        Caddy (the "edge" container)
                        reverse-proxies to whatever
                        app.yml's containers started
```

- **Terraform** manages exactly one thing: Cloudflare. DNS records, TLS
  mode, email-verification records. It has never heard of the VPS, Docker,
  or Ansible — as far as Terraform's state is concerned, `app.ladu.com.ar`
  is just "an A record pointing at this IP address," a plain string
  (`var.vps_ipv4`) typed into a `.tf` file. It has no idea what's actually
  listening on that IP, or whether it's even up.
- **Ansible** manages the VPS itself — OS packages, the firewall, the
  `deploy` user — and, as part of that, builds the Caddy image and starts
  it (along with Postgres) via `platform.yml`. This is the one place two
  tools' output *does* meet: Caddy needs a Cloudflare API token to prove
  domain ownership for its certificate (the DNS-01 challenge — see the
  glossary), and Ansible supplies that token from its own Vault — a
  **separate, narrower-scoped** Cloudflare credential from the one
  Terraform uses, created independently in Cloudflare's dashboard.
  Terraform's DNS records and Ansible's Caddy config both have to agree on
  the VPS's IP address, but nothing keeps them in sync automatically — if
  the VPS were ever replaced, you'd update both by hand.
- **Caddy** isn't something you invoke directly — it's a piece of software
  Ansible packages into a custom Docker image (via `xcaddy`, a build tool
  that compiles Caddy together with the `caddy-dns/cloudflare` plugin it
  needs for the DNS-01 challenge) and starts as the `edge` container. It's
  the thing every hostname Terraform created actually gets routed *to* —
  Caddy itself has no awareness that Terraform exists; it just answers
  whatever hostname shows up in the request.
- **Docker Compose** is the mechanism both Ansible and GitHub Actions use to
  start containers, but each owns a **different Compose project** (see
  above): Ansible brings up `platform.yml` as project `ladu-platform`;
  `deploy.sh` — run by GitHub Actions, on every merge — brings up `app.yml`
  as `ladu-staging`/`ladu-prod`. `deploy.sh` never touches `platform.yml`,
  and Ansible's `platform` role never touches `app.yml` — the two projects
  only meet at the Docker network level (`app.yml`'s containers join the
  `edge` network `platform.yml` already created).

**The practical implication:** which tool to reach for depends on *which
layer* a symptom is in. A DNS/TLS problem is Terraform's domain (or the
Cloudflare dashboard). "The VPS itself is misconfigured" (a wrong firewall
rule, Docker not installed right) is Ansible's. "The wrong code is running"
is GitHub Actions/`deploy.sh`'s. Running the wrong tool for a given symptom
— e.g. re-running Ansible to fix a bad application deploy — usually does
nothing, because that tool doesn't own that layer. See
[`05-troubleshooting-playbook.md`](05-troubleshooting-playbook.md) for
symptom-specific guidance.

## Directory map: what each piece of `deploy/` is for

| Path | What it does | Who runs it, when |
|---|---|---|
| `deploy/terraform/` | Cloudflare DNS records, TLS settings, Resend email-verification records | You, by hand, only when DNS/email records need to change. Remote state in HCP Terraform. |
| `deploy/ansible/` | Server setup: users, SSH hardening, firewall, Docker install, the platform stack, backups | You, by hand (`ansible-playbook site.yml`), only when server *configuration* changes — not on every deploy. |
| `deploy/compose/platform.yml` | The shared Postgres + Caddy + landing stack | Brought up by the Ansible `platform` role. |
| `deploy/compose/app.yml` | The per-environment web + backend stack | Brought up by `deploy.sh`, on every deploy. |
| `deploy/caddy/` | Caddy's own Dockerfile + `Caddyfile` (routing rules) | Built as part of `platform.yml`. |
| `deploy/scripts/deploy.sh` | Pulls images, runs migrations, swaps containers, health-checks, rolls back on failure | GitHub Actions, automatically, on every merge to `main`. |
| `deploy/scripts/backup.sh` / `restore-test.sh` | Nightly backup, weekly restore drill | A cron job on the VPS (installed by Ansible), not GitHub Actions. |
| `deploy/env/app.env.example` | Documents every env var `app.yml`'s `backend` service needs | Reference only — never contains real values. |

The distinction that matters: **Ansible changes the server itself** (rare,
manual); **`deploy.sh` changes what's running** (every merge, automatic).
Terraform is off to the side, only touching Cloudflare — it has no idea the
VPS's containers exist.

## Why one VPS for both environments, and whether that's a problem

Both environments compete for the same 2 vCPU / 4 GB RAM box. In practice
this is fine at this project's scale — a Node backend idles at ~150 MB, and
the RAM budget was checked to comfortably fit two of everything plus
Postgres plus three Caddy instances. The tradeoff being made deliberately:
staging is not a true "prod-like capacity" rehearsal, it's a **correctness
and pipeline** rehearsal — the smoke e2e gate exists to catch broken code and
broken deploys, not to load-test. If that ever stops being enough, the
natural next step (not done) is a second, smaller VPS just for staging.
