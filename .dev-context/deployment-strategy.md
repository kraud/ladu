# Deployment Strategy — Ladu v2

> Status: **Phases 0, A, B, C done** (2026-09-18). Phase D (deploy workflow) is next. Last revised 2026-09-18.
> Goal: run v2 on the real domain **now**, and ship each later feature phase
> through a real CI/CD pipeline (staging → production).
> Cost limit: ≤ ~€7/mo. No service may charge by usage without a hard cap.

---

## 1. Decisions

| Topic | Decision |
|---|---|
| Host | **Netcup VPS 500 G12**, no-commitment contract: 2 vCore x86, 4 GB RAM, 128 GB NVMe, IPv4+IPv6, €6.81/mo incl. VAT |
| Domain | Real domain (`mydomain.com.ar`) is used now. No temporary domain. The legacy app is not kept. |
| DNS | Cloudflare (free), managed with Terraform |
| Environments | `staging` and `production`, on the same VPS |
| Deploy flow | Automatic: merge to `main` → staging → smoke e2e → production. No manual approval. |
| Artifacts | Docker images in GHCR, tagged with the commit SHA. The same image goes to staging and production ("build once, deploy many"). |
| Server config | Ansible (replaces a bash bootstrap script) |
| IaC | Terraform, **Cloudflare provider only**. State in HCP Terraform (free tier). |
| Email | Resend (free tier, no card) over SMTP with the existing `nodemailer`. Replaces Gmail. |
| Migrations | A separate deploy step before the container swap. Removed from backend startup. |
| Node | 24 (same as local) in CI, Dockerfiles and `.nvmrc` |
| Postgres | 15 (same as local and CI) |

### Rejected options

| Option | Reason |
|---|---|
| Hetzner | CX22 discontinued; CX23 unavailable (2026-09-16) |
| IONOS VPS | No API, 2× price after 12 months, cancellation by phone only |
| AWS (Free plan, 6-month hard cap) | Possible at €0, but the target jobs (fullstack, owning delivery end to end) do not require it. Add later only if a job requires AWS. |
| Netcup Terraform provider (`hornc-greedy/netcup`) | Too new, few users, cannot create servers. Ansible covers the server. |
| k3s / Kubernetes | Too much work for the value now. Later, only if a job requires it. |
| Railway / Render / Fly / Vercel | Hands-off hosting teaches no new skills |
| Manual approval before production | You chose automatic promotion. The smoke e2e on staging is the gate. |

---

## 2. Architecture

### Hostnames

| Hostname | Serves | When |
|---|---|---|
| `mydomain.com.ar` (+ `www` → redirect) | `landing/` (static) | Points at Vercel (legacy) until `landing/` is ready, then at the VPS |
| `app.mydomain.com.ar` | Production: frontend + `/api` | First deploy |
| `staging.mydomain.com.ar` | Staging: frontend + `/api` | First deploy |

Rules:
- Use only **one subdomain level**. Cloudflare's free certificate covers `*.mydomain.com.ar`, not `*.app.mydomain.com.ar`.
- The API uses the **same origin** (`/api/*`). This removes CORS problems. The frontend needs no build-time API URL, so one image works in both environments.

### Containers on the VPS

```
Internet → Cloudflare (proxy, TLS) → VPS :443 (only Cloudflare IPs allowed)
                                        │
                                   edge (Caddy)
          ┌────────────────┬────────────┴───────────┬────────────────┐
     apex → landing   app → web-prod        staging → web-staging
                        /api → backend-prod    /api → backend-staging
                                   │                   │
                                   └──── postgres ─────┘
                              (DB ladu_prod, DB ladu_staging,
                               one user per DB)
```

- **Platform stack** (`deploy/compose/platform.yml`, one instance): `edge` + `postgres`. They share a Docker network (`edge`).
- **App stack** (`deploy/compose/app.yml`, one instance per environment): `web` + `backend`. Compose project names `ladu-staging` and `ladu-prod`. Settings: `IMAGE_TAG` and an env file.
- **Edge Caddy** is a custom image built with `xcaddy` and the `caddy-dns/cloudflare` module. It gets certificates with the DNS-01 challenge, so certificates work behind the Cloudflare proxy.
- The **`web` image** is Caddy serving `frontend/dist`: SPA fallback to `index.html`, `index.html` not cached, hashed assets cached as immutable. There is no nginx.
- **Only `edge` publishes ports** (80/443). Docker bypasses ufw for published ports, so no other service may publish one.
- RAM budget: 2× Node (~150 MB each) + Postgres + 3× Caddy is well below 4 GB.

### Environments and databases

| Environment | Database | Purpose |
|---|---|---|
| Local dev | Docker Postgres `keelapp_v2_dev` (port 5433) | Daily work, local e2e |
| Local test | `keelapp_test` (same container, from `init-test-db.sh`) | Jest |
| CI | Temporary `postgres:15-alpine` service container | Jest + e2e on each PR |
| Staging | `ladu_staging` on the VPS | Automatic deploy target, smoke e2e |
| Production | `ladu_prod` on the VPS | Real users |

Rules:
- Each environment has its own DB user and password. The staging user cannot read `ladu_prod`.
- Migrations: `drizzle-kit generate` in dev. Never edit a migration that has already run.
- **Expand/contract rule:** the previous release must still work after a migration runs, so that a rollback is safe. Example: add a column → deploy code that uses it → remove the old column in a later release.
- Staging sends real emails through Resend with a `staging@` sender. Traffic is small, so the free tier is enough.

### Secrets

| Secret | Where it is stored |
|---|---|
| App env (`DATABASE_URL`, `JWT_SECRET`, `EMAIL_*`, `BASE_URL`, `URL_EESTI_LANG_API`) | GitHub **Environments** `staging` and `production`. The deploy job writes `/opt/ladu/<env>/.env` (mode 600). |
| SSH deploy key, VPS host | Repository secrets |
| Postgres superuser, DB user passwords, Cloudflare DNS token for Caddy | Ansible Vault (encrypted, in git) |
| Cloudflare API token for Terraform | HCP Terraform workspace variable |
| Staging smoke-test account | `staging` Environment secrets |

The DB user passwords are stored twice: in Ansible Vault (to create the users) and in the `DATABASE_URL` secrets. If you change a password, change it in both places.

---

## 3. Pipeline

```
PR ──► ci.yml: lint · typecheck · Jest · Vitest · e2e · build · docker build (no push) · Trivy
         │  (a ruleset requires all of these checks to pass before merge)
         ▼
merge to main ──► deploy.yml
   1. build backend, web, landing images → GHCR  (tag: <sha>)
   2. staging: migrate → up -d → health check (SHA must match)
   3. smoke e2e against staging.mydomain.com.ar
   4. production: migrate → up -d → health check
   5. if step 2 or 4 fails: deploy the previous SHA again → the workflow fails
```

### `ci.yml` (extends the current `test.yml`)

1. `lint`: ESLint in `backend` and `frontend` (new scripts)
2. `typecheck`: `tsc --noEmit` / `tsc -b`
3. `backend`: Jest with a Postgres service (exists)
4. `frontend`: Vitest + `vite build` (exists)
5. `e2e`: Postgres service + `playwright install --with-deps chromium` + `npm run test:e2e -- --workers=1`
6. `images`: `docker build` for each Dockerfile (no push) + Trivy scan (fail on HIGH/CRITICAL that have a fix)

Everywhere: Node 24 from `.nvmrc`, npm cache, third-party actions pinned to a commit SHA.

### `deploy.yml`

- Trigger: `push` to `main`. `concurrency: deploy` (never two deploys at the same time).
- Jobs `staging` and `production` use GitHub Environments with the same names. This gives deploy history on the repo page and a separate secret set for each environment.
- Each deploy job: SSH to the VPS as `deploy` → write `.env` → run `deploy/scripts/deploy.sh <env> <sha>`.
- `deploy.sh` (in git, copied to the server on each deploy, can also run manually):
  1. `docker compose pull`
  2. `docker compose run --rm backend node scripts/migrate.js`. If this fails, stop. The old containers keep running.
  3. `docker compose up -d`
  4. Poll `https://<host>/api/health` until `sha == <sha>`, max ~60 s
  5. On success: write `<sha>` to `/opt/ladu/<env>/deployed_sha`. On failure: run `up -d` again with the previous SHA, then exit with an error.
- Rollback reverts **only the images**. It does not revert migrations (see the expand/contract rule).

### Smoke e2e (`e2e/tests/deployed-smoke.spec.ts`)

- Runs against `BASE_URL`. It has **no DB access** (the current specs read the dev DB with `fixtures/db.ts`, and CI cannot reach the staging DB).
- Steps: `/api/health` returns the expected SHA → log in with the staging smoke account → dashboard loads → create a word → delete it.
- The smoke account is created once on staging (Ansible task or manual). Its credentials are `staging` Environment secrets.

### GitHub repository settings

- Ruleset on `main`: merge only through a PR, all CI checks required, no force-push. (You work alone, so do not require a review.)
- `.github/dependabot.yml`: npm (weekly, grouped), GitHub Actions, Docker base images.
- CodeQL default setup, secret scanning, push protection (all free for public repos).
- PR template with a short checklist (tests, docs, migration follows expand/contract).

---

## 4. Phases

Total effort: about 3–4 days. After Phase D, each feature phase (5–7) goes through this pipeline.

### Phase 0 — Accounts and DNS (½ day + DNS wait)

1. Run `dig NS mydomain.com.ar +short` to find the current DNS host (probably Vercel).
2. Cloudflare: add the zone. Check the imported records (Vercel A/CNAME records; any MX/TXT records).
3. At **nic.ar**: change the nameserver delegation to the two Cloudflare nameservers. Wait until Cloudflare shows the zone as "Active". The legacy app stays online during the move.
4. Netcup: order VPS 500 G12 with the "0 months" contract. Before you pay, check the notice period and that there are no traffic charges. Pay with SEPA or PayPal.
5. Free accounts (no card): HCP Terraform, Resend, Backblaze B2, UptimeRobot, Sentry.
   - B2: set **Caps & Alerts to $0** for every category.
   - For any service that asks for a card: do not use it unless it has a hard cap.

### Phase A — CI hardening (½ day) — ✅ done

- `.nvmrc` = 24. Add `engines` to the root `package.json`.
- ESLint (flat config) in `backend` and `frontend`. Add `lint` scripts. Fix or suppress the current errors.
- `typecheck` scripts (`tsc --noEmit` backend, `tsc -b` frontend). Backend also needed `"moduleDetection": "force"` in `tsconfig.json` (require()-only `.ts` files were being treated as global scripts, so same-named top-level `const`s collided across files) and `: typeof import(...)` annotations on `require()` calls that were silently typed `any` (`db`, `wordService`, etc.) — that surfaced real bugs (e.g. a `wordController.ts` insert that could receive `tagId: undefined`), now fixed.
  - **Deferred:** `controllers/tagController.ts`, `friendshipController.ts` and `notificationController.ts` are excluded from the backend typecheck gate (`tsconfig.json` `exclude`) — ~40 pre-existing `noImplicitAny`/type errors there, left for when friendships/notifications/tags/tag-sharing come off the deferred list (see CLAUDE.md). Fix and re-include then.
- Rename `test.yml` → `ci.yml`. Add the `lint`, `typecheck` and `e2e` jobs (see §3).
- Ruleset, Dependabot, CodeQL, secret scanning, PR template.
- **Gate:** a test PR shows all checks green, and the ruleset blocks a merge while a check is red. ✅ Verified 2026-09-17 — ruleset active on `main`, all 5 `ci.yml` jobs (lint, typecheck, backend, frontend, e2e) required and green.

### Phase B — Containers (½–1 day) — ✅ done

Code changes:
- `backend/scripts/migrate.js`: runs the Drizzle `migrate()` (logic moved out of `api/index.js`). Dev still runs migrations with `npm run db:migrate`, and the e2e `webServer` must call it before it starts the backend.
- `backend/api/index.js`: load `../../.env` only when `NODE_ENV !== 'production'`.
- `GET /api/health`: runs `SELECT 1` and returns `{ status, sha }` (`sha` from the build arg `GIT_SHA`).
- `backend/utils/sendEmail.js`: `secure: process.env.EMAIL_SECURE === 'true'` (now the string `"false"` gives `true`).
- `app.set('trust proxy', …)` so that Express reads the client IP and protocol correctly behind Cloudflare + Caddy.

New files:
- `backend/Dockerfile`: `node:24-alpine`, `npm ci --omit=dev` for the backend workspace, non-root user, `HEALTHCHECK`. The backend still runs `.ts` through `tsx`, so `tsx` must be a runtime dependency.
- `frontend/Dockerfile`: multi-stage, Node build → `caddy:alpine` with `dist/` + a small Caddyfile.
- `landing/`: static site (HTML/CSS, no framework for now — real content is still future work) + `landing/Dockerfile` (`caddy:alpine`).
- `deploy/caddy/Dockerfile` (`xcaddy` + Cloudflare DNS module) and `deploy/caddy/Caddyfile` (host routing, `/api` → backend, security headers, `www` → apex redirect).
- `deploy/compose/platform.yml`, `deploy/compose/app.yml`, `deploy/env/app.env.example`.
- `.dockerignore` files: one at the repo root (build context for `backend`/`frontend`, which need the shared npm-workspaces lockfile) plus one each in `landing/` and `deploy/caddy/` (self-contained build contexts of their own).
- **Two decisions the plan left open, resolved while building this phase:**
  - `landing` lives in `platform.yml` alongside `edge`/`postgres` (not `app.yml`) — it's a singleton with no staging/prod split, even though CI builds it per-commit like `backend`/`web` (§3).
  - `edge` is built locally (`build:` in `platform.yml`), not pulled from GHCR — it's absent from §3's CI image-build list and changes rarely, so it doesn't need the per-commit pipeline.
- **Gate:** the full stack runs locally with the prod compose files (with `tls internal` or a local override), and the e2e suite passes against it. ✅ Verified 2026-09-17 — `deploy/compose/docker-compose.local.yml` + `deploy/compose/local.Caddyfile` (local-testing only, never used by `deploy.sh`/Ansible) build all five images and run them together over plain HTTP on a `*.localhost` domain (loopback with no `/etc/hosts` edit, per RFC 6761) instead of Cloudflare ACME. Confirmed: migrations apply via the containerized `migrate.js`; edge routes apex/`www`/`app.`/`staging.` correctly, including proxying `staging.` to a distinct (absent) upstream; SPA fallback, security headers, and the health endpoint's baked-in `GIT_SHA` all check out; all 12 existing e2e tests (every prior phase's spec, unmodified) pass through a real browser against the real containers. `platform.yml`'s edge `ports` were parametrized (`${EDGE_HTTP_PORT:-80}` / `${EDGE_HTTPS_PORT:-443}`) so the local override can redirect them — Compose merges `ports` lists by concatenation across `-f` files, not replacement.

### Phase C — Server and DNS as code (½–1 day) — ✅ done

`deploy/ansible/` (inventory, `site.yml`, roles, Vault file):
- `base`: `deploy` user (SSH key only), `PermitRootLogin no`, `PasswordAuthentication no`, unattended-upgrades, fail2ban, timezone, swap file (1 GB).
- `firewall`: ufw default deny. Allow 22. Allow 80/443 **only from Cloudflare IP ranges** (the role downloads the ranges).
- `docker`: Docker Engine + Compose plugin (installed via `deb822_repository`, not the now-deprecated `apt_repository`). Add `deploy` to the `docker` group. Note: this gives `deploy` root-level access, which is acceptable for this project.
- `platform`: `/opt/ladu/{platform,staging,prod}`, platform `.env` from Vault, `platform.yml` up (via `community.docker.docker_compose_v2`), create DBs and users (via `community.docker.docker_container_exec`, since postgres publishes no port), log rotation for Docker. Also renders Caddy's `trusted_proxies` list (the TODO Phase B left) from the same live Cloudflare range fetch the `firewall` role uses, mounted in rather than baked into the image. Adds persistent `caddy_data`/`caddy_config` volumes so recreating `edge` doesn't burn Let's Encrypt's duplicate-certificate rate limit. Closes the "Docker bypasses ufw" gap with a `docker.service.d` drop-in that reapplies Cloudflare-only `DOCKER-USER` rules after every Docker start (Docker discards that chain's contents each time). `landing` is deliberately excluded from `platform.yml up` — no image exists in GHCR until Phase D's first deploy — Caddy still starts and gets its certificate fine; only the apex route would 502 until then, and the apex isn't part of this gate.
- `backup`: see Phase E.

`deploy/terraform/` (Cloudflare provider, HCP Terraform backend):
- Imported the existing records via declarative `import` blocks (Terraform 1.5+), not the `terraform import` CLI command — lets applies run remotely on HCP Terraform with no local Cloudflare credentials at all.
- Records: apex + `www` untouched (still Vercel — switched later, see below), `app`, `staging` (A **and** AAAA, proxied).
- Zone settings: SSL **Full (strict)**, Always Use HTTPS, minimum TLS 1.2.
- Resend records: DKIM TXT + two CNAMEs (Resend's current verification flow — not the older raw MX+SPF-TXT pattern this doc originally assumed) + DMARC (`p=none`).
- Scoped API tokens: the Terraform token itself was created manually in Cloudflare's dashboard (bootstrap — Terraform can't hand itself its own credential) and lives only as an HCP Terraform workspace variable; the Caddy DNS-01 token (`Zone:DNS:Edit` on this zone only) *is* Terraform-managed.
- **Gate:** ✅ Verified 2026-09-18 — `ansible-playbook site.yml` (all four roles) runs twice with zero changes on the second run. `terraform plan` shows no changes. `https://staging.ladu.com.ar` and `https://app.ladu.com.ar` present real per-hostname Let's Encrypt certificates (confirmed by connecting directly to the VPS's IP, bypassing Cloudflare) — they 502 rather than showing a placeholder page, since Caddy correctly reverse-proxies to `web-staging`/`backend-staging` containers that don't exist until Phase D deploys `app.yml`; the certificate is what this gate is actually about, and that's real. Also confirmed the DOCKER-USER fix live: direct-IP access to the VPS times out post-fix, Cloudflare-proxied access is unaffected.

### Phase D — Deploy workflow (½–1 day)

- `deploy.yml`, `deploy.sh`, GitHub Environments + secrets, `deployed-smoke.spec.ts`, staging smoke account.
- Move email to Resend: verify the domain, set the `EMAIL_*` secrets for both environments.
- **Gate:** a merge to `main` deploys to staging and production with no manual step. A deploy with a broken health check rolls back to the previous SHA. Verification and password-reset emails from `app.` arrive and do not go to spam.

### Phase E — Backups and monitoring (½ day)

- `backup` role: nightly `pg_dump -Fc ladu_prod` → `rclone` → B2 bucket (lifecycle: keep 30 days). Staging has no backup.
- **Weekly restore test** (cron): download the latest dump → restore it into a temporary Postgres container → run a row count → remove the container. Send the result to an UptimeRobot heartbeat monitor. If the test does not run or fails, you get an alert.
- UptimeRobot: HTTP monitors for `app.`, `staging.`, apex, and `/api/health`.
- Sentry: backend (Express SDK) + frontend (React SDK). `environment` = staging/production, `release` = SHA.
- **Gate:** one restore test completes. A stopped backend causes an alert within 5 minutes.

### Later: switch the apex domain

When `landing/` is ready: in Terraform, point the apex and `www` records at the VPS and remove the Vercel records. Then archive the legacy Vercel projects.

---

## 5. Directory layout (target)

```
.github/
  workflows/ci.yml, deploy.yml
  dependabot.yml, pull_request_template.md
backend/Dockerfile, backend/scripts/migrate.js
frontend/Dockerfile
landing/            static site + Dockerfile
deploy/
  caddy/            Dockerfile, Caddyfile, .dockerignore
  compose/          platform.yml, app.yml, docker-compose.local.yml + local.Caddyfile (local-testing only)
  env/              *.env.example
  scripts/          deploy.sh, backup.sh, restore-test.sh
  ansible/          inventory, site.yml, roles/, group_vars/ (Vault)
  terraform/        main.tf, dns.tf, variables.tf, versions.tf
e2e/tests/deployed-smoke.spec.ts
.nvmrc
```

---

## 6. Cost

| Item | Cost |
|---|---|
| Netcup VPS 500 G12 (no contract) | €6.81/mo |
| GitHub Actions + GHCR (public repo), Cloudflare, HCP Terraform, Resend, B2 (10 GB, cap $0), UptimeRobot, Sentry (free plans) | €0 |
| **Total** | **€6.81/mo** |

Check the free-tier limits at signup. They can change.

---

## 7. Skills this plan shows (CV)

1. Docker and Compose in production: multi-stage images, non-root users, health checks, image scanning
2. GitHub Actions CI/CD: required checks, build once / deploy many, staging → production promotion, automatic rollback
3. IaC: Terraform (Cloudflare DNS, TLS, email records, remote state, importing existing resources) + Ansible (idempotent server configuration, Vault)
4. Linux operations: SSH hardening, firewall, reverse proxy, TLS, a firewall that accepts only Cloudflare traffic
5. Database operations: migrations as a deploy step, the expand/contract rule, backups with a scheduled restore test
6. Observability: uptime and heartbeat monitors, error tracking by release
7. Email deliverability: SPF, DKIM, DMARC

### Stretch tasks (after Phase E)

| Task | What it teaches |
|---|---|
| Grafana Cloud (free) + node_exporter / OpenTelemetry | Metrics and dashboards |
| release-please | Semantic versions, changelog, release tags |
| Postgres 15 → 17 upgrade | Major-version upgrade with dump/restore |
| AWS Free plan lab (6 months, no charges) | Only if a target job requires AWS |

---

## 8. Sources

- Netcup VPS lineup and G12 prices: netcup.com/en/server/vps (checked 2026-09-16)
- Hetzner June 2026 price change and CX23 availability: docs.hetzner.com (checked 2026-09-16)
- Check these at signup: Netcup contract terms, Resend / B2 / Sentry / HCP Terraform free-tier limits, Cloudflare IP ranges (cloudflare.com/ips)
