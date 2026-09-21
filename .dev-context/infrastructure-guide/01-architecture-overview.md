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
  ├─ ladu.com.ar (apex)     → landing container (still legacy Vercel today — see below)
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
  *is* rebuilt on every commit like `backend`/`web`.

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

## Why the apex domain still shows the old site

`ladu.com.ar` and `www.ladu.com.ar` still point at the legacy Vercel-hosted
landing page. This repo's own `landing/` container exists and is deployed to
the VPS, but the DNS records for the bare domain haven't been switched over
yet — that's a deliberate last step ("switch the apex domain" in the
build log), done once `landing/` has real content instead of a placeholder.
`app.` and `staging.` already point at the VPS.

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
