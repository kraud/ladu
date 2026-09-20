# Deployment Strategy — Ladu v2

> Status: **Phases 0, A, B, C, D done** (2026-09-19). Staging live at `staging.ladu.com.ar`, production live at `app.ladu.com.ar` — automated CI/CD, proven rollback, real transactional email on both. Phase E (backups and monitoring) is next. Last revised 2026-09-19.
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
5. Free accounts (no card): HCP Terraform, Resend, Backblaze B2, UptimeRobot, Sentry, Healthchecks.io (added mid-Phase E — UptimeRobot's heartbeat/cron monitoring turned out to be paid-plan only).
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

Broken into sub-slices, same pattern as Phase C's 8a–8d:

- **D-a** — CI image build + scan gate. **✅ done (2026-09-19).**
- **D-b** — GHCR publishing on merge to `main`. **✅ done (2026-09-19).**
- **D-c** — SSH deploy key + `deploy/scripts/deploy.sh`, tested by hand against staging. **✅ done (2026-09-19).**
- **D-d** — Staging job in `deploy.yml`, GitHub `staging` Environment + secrets. **Code done (2026-09-19), gate pending a real merge.**
- **D-e** — Smoke e2e gate (`deployed-smoke.spec.ts`, staging smoke account) between staging and production. **Code done, verified against real staging (2026-09-19), CI wiring pending the same merge as D-d.**
- **D-f** — Production job, `concurrency: deploy`, rollback proven with a deliberately broken health check. **✅ done (2026-09-19).**
- **D-g** — Resend cutover: verify the domain, confirm `EMAIL_*` secrets in both environments, confirm real delivery. **✅ done (2026-09-19) — Phase D complete.**

- **Gate (whole phase):** a merge to `main` deploys to staging and production with no manual step. A deploy with a broken health check rolls back to the previous SHA. Verification and password-reset emails from `app.` arrive and do not go to spam.

#### D-a — CI image build + scan gate — ✅ done

Added the `images` job to `ci.yml` (§3 described this job from Phase A onward, but it was never actually added — this closes that gap). Matrix over the three Dockerfiles (`backend`, `web` from `frontend/Dockerfile`, `landing`), each built with `docker/build-push-action` (`push: false`, `load: true` — the same step D-b extends with `push: true`) and scanned with `aquasecurity/trivy-action`, failing on HIGH/CRITICAL findings that have a fix (`ignore-unfixed: true`).

Scanning locally before wiring this into CI (`docker build` + a local `aquasec/trivy` container, matching the exact flags the CI step uses) surfaced three real, unrelated issues — fixed rather than worked around:

- `jsonwebtoken@8.5.1` → `^9.0.3` (breaking major bump; fixed a signature-validation-bypass advisory). Only two call sites in the whole backend (`userController.ts` sign, `authMiddleware.ts` verify), both plain HS256 with a shared secret. Also added an explicit `algorithms: ['HS256']` to the `jwt.verify()` call — the actual defense against algorithm-confusion attacks, independent of package version. Verified: `tsc --noEmit` clean, full Jest suite (176 tests) green.
- `nodemailer@^6.9.14` → `^10.0.10` (breaking major bump; fixed 11 advisories, mostly SMTP/header injection and SSRF-adjacent issues). `@types/nodemailer` stayed at its old `^8.0.1` pin — harmless, since nothing in `.ts` imports nodemailer's types; only `sendEmail.js` (plain JS, `require`) touches it. Verified: `tsc --noEmit` clean, full Jest suite green.
- `backend/Dockerfile` runtime stage now strips the npm CLI the `node:24-alpine` base image bundles (`/usr/local/lib/node_modules/npm` and `corepack`, plus their `/usr/local/bin` symlinks) — the container never runs `npm`/`npx` (`CMD` is `node api/index.js`; migrations run via `node scripts/migrate.js`), so npm's own vendored sub-dependencies (`tar`, `ip-address`, `brace-expansion`) were dead code that also happened to carry CVEs. Removing them is a real fix, not an ignore — and shrinks the image.

One class of finding couldn't be fixed locally: 15 HIGH findings (14 CVE IDs + one GHSA-only advisory, `GHSA-hrxh-6v49-42gf`) against `/usr/bin/caddy` in both the `web` and `landing` images — Go-stdlib/gRPC-Go CVEs baked into the `caddy:alpine` base image. Confirmed `caddy:alpine`, `caddy:2-alpine` and `caddy:2.11-alpine` all resolve to the same digest (Caddy v2.11.4) — no rebuilt upstream image exists yet with a patched Go toolchain. Added root `.trivyignore` (read via the trivy-action `trivyignores` input) listing exactly these IDs with a comment explaining why and when to remove each (when it stops appearing in a scan). The backend image carries none of these — the shared ignore file is a no-op for it.

**Gate:** ✅ Verified 2026-09-19 — all three images build locally exactly as the CI step builds them (same `docker build` invocation), and a local Trivy scan with the same flags CI uses (`--severity HIGH,CRITICAL --ignore-unfixed --exit-code 1`, plus `--ignorefile .trivyignore` for web/landing) exits 0 for all three. `ci.yml` YAML validated. Input names for both pinned actions (`docker/build-push-action@v7.4.0`, `aquasecurity/trivy-action@v0.36.0`) confirmed against their `action.yml` at the pinned commit via the GitHub API, rather than assumed.

#### D-b — GHCR publishing on merge to `main` — ✅ done

New `deploy.yml`, triggered only on `push: branches: [main]` (PRs stay on `ci.yml`), with `concurrency: {group: deploy, cancel-in-progress: false}` so a second merge can't race an in-flight deploy — set up now even though D-b is the only job in the file so far, since D-d/D-f append jobs to this same workflow rather than starting a new one. One job, `build-and-push`: logs into `ghcr.io` with `docker/login-action` using the ambient `GITHUB_TOKEN`, then rebuilds the same three images `ci.yml`'s `images` job already built and Trivy-scanned on this exact commit (no need to scan again here) — this time with `push: true` instead of `load: true`, tagged `ghcr.io/kraud/ladu-<image>:<full 40-char commit SHA>`. The repo's default `GITHUB_TOKEN` permissions are read-only (`gh api repos/kraud/ladu/actions/permissions/workflow` → `"default_workflow_permissions":"read"`), so the job declares `permissions: {contents: read, packages: write}` explicitly.

**GHCR package visibility — turned out to need no manual step.** Before the first real push, GitHub's own docs (Packages REST reference + the container-registry visibility guide) said newly published packages default to private and can only be flipped to public through the web UI — no REST endpoint for it. That turned out to be stale or inapplicable: after this workflow's first real run, all three packages (`ladu-backend`, `ladu-web`, `ladu-landing`) showed up already **public** — confirmed directly in each package's own Settings → Danger Zone ("This package is currently public"), not just assumed. Current GHCR behavior, at least for a package a `GITHUB_TOKEN` push links to a public repo, appears to inherit that repo's visibility automatically. Net effect is still the one from the original slice-D decision (public packages, no pull token needed on the VPS) — it just didn't need the manual click I'd planned for.

**Gate:** ✅ Verified 2026-09-19 — PR #24 merged, `deploy.yml` ran on the merge commit (`b5c9fb0b`) and pushed all three images to GHCR, each already public as described above.

#### D-c — SSH deploy key + `deploy/scripts/deploy.sh` — ✅ done

A dedicated `ed25519` keypair (`~/.ssh/ladu_ci_deploy`) rather than reusing the Ansible admin key (`~/.ssh/ladu_deploy`) — narrower purpose (only ever needs to SSH in and run `deploy.sh`), and it's the half that eventually becomes a GitHub secret in D-d, so it shouldn't be the same key that has full server-config access from a developer's machine. Its public half is installed by a new task in the `base` role (`ci_deploy_public_key_path` in `group_vars/all/vars.yml`), added via a plain `authorized_key` task alongside the existing one — not `exclusive`, so it only adds, never replaces the admin key.

`deploy/scripts/deploy.sh <env> <sha>` implements §3 exactly: `docker compose pull` → `docker compose run --rm backend node scripts/migrate.js` (a failure here exits before touching running containers) → `docker compose up -d` → poll `${BASE_URL}/api/health` (read straight out of that environment's already-present `.env`, rather than re-deriving the per-environment hostname a second time) for up to 60s until the body contains `"sha":"<sha>"` → on success, record `<sha>` in `deployed_sha` next to the script; on failure, `up -d` again with whatever SHA `deployed_sha` last recorded, then exit non-zero. Matches the doc's own description of the script's lifecycle: copied to `/opt/ladu/<env>/` fresh on every deploy (alongside `app.yml`, also copied fresh — neither is Ansible-managed like `platform.yml`, since both are inherently per-deploy artifacts, not one-time infra), while `.env` persists across deploys and is only ever rewritten, not touched by this script.

Server prep done by hand (VPS-modifying commands go through the user, not me — see below):
- `ansible-playbook site.yml` installed the new key — one `changed` task, everything else `ok`, same idempotent pattern as every Phase C gate. Verified working: `ssh -i ~/.ssh/ladu_ci_deploy deploy@<host>` succeeds.
- `/opt/ladu/staging/.env` written with real values: `DATABASE_URL` (real `ladu_staging` password, read from the encrypted vault — `ansible-vault view group_vars/all/vault.yml`, not something I can read myself), a freshly generated throwaway `JWT_SECRET` (`openssl rand -hex 32` — disposable, since D-d's job always rewrites `.env` from real GitHub secrets on every deploy anyway), `BASE_URL=https://staging.ladu.com.ar`, `URL_EESTI_LANG_API=https://api.sonapi.ee/v2` (pulled from the local dev `.env` — same real API both environments use). `EMAIL_*` are placeholders (real Resend credentials are D-g's job) — safe, because the health check never touches email and `sendEmail.js` swallows send errors rather than throwing.
- `app.yml` and `deploy.sh` copied to `/opt/ladu/staging/`, `deploy.sh` made executable.

`deploy.sh`'s first real step (`docker compose pull`) needed an image to actually exist at `ghcr.io/kraud/ladu-<image>:<sha>`, so the live run waited for D-b's PR (#24) to merge and publish the first real images, then ran `deploy.sh staging <sha>` against them — one run closing both D-b's and D-c's gates together, against the actual artifact the pipeline uses going forward. (Two VPS-touching checks were blocked by the local permission classifier along the way — re-running Ansible, and a direct `psql` connectivity check — and intentionally not worked around; the user ran those steps directly instead.)

**A real bug, not a scripting mistake, on the very first live run.** Migration failed on the first `CREATE TABLE` in `public`: `Migration failed: Failed query: CREATE TABLE "exercise_performance_cases" (...)`. Root cause: **PostgreSQL 15 stopped granting `CREATE` on the `public` schema to everyone by default** — only the schema's owner gets it automatically. The `platform` role's DB-provisioning (sub-slice 8b/8c) creates each environment's database as `postgres_superuser` (`ladu_admin`), making *it* the owner of `public`, then only grants `ladu_staging`/`ladu_prod` database-level privileges (`GRANT ALL PRIVILEGES ON DATABASE ...`) — which covers connecting and creating new schemas, but not creating objects inside the pre-existing `public` schema they don't own. Never caught before because local dev and CI sidestep it entirely: both use a single Postgres role (`keelapp_user`) as both the bootstrap superuser *and* the app's connecting user, so it already owns everything.

Two fixes, both applied and verified against the real failure:
- `platform` role: new task, `Grant each environment's user rights on its database's public schema` — `psql -U {{ postgres_superuser }} -d {{ item.db_name }} -c "GRANT ALL ON SCHEMA public TO {{ item.db_user }}"`. Must target `-d {{ item.db_name }}` specifically — schemas are per-database, so omitting it would grant on whichever database `psql` defaults to, not the one that matters. `changed_when: false`, matching the sibling database-level grant task right above it (Ansible can't detect whether a `GRANT` changed anything).
- `backend/scripts/migrate.js`: the failed run's own error output was incomplete — `err.message` is Drizzle's wrapper (just the failed query text), and the actual Postgres reason lives in `err.cause`, which the catch block never logged. Now logs both.

Confirmed safe to retry with no cleanup: `drizzle-orm`'s Postgres migrator (`node_modules/drizzle-orm/pg-core/dialect.js`) wraps every pending migration file in one `session.transaction(...)`, so the failed run rolled back completely — `ladu_staging` was still fully empty in `public` before the retry. (It does create its own `drizzle.__drizzle_migrations` tracking schema/table *before* that transaction starts, which succeeded — creating a new schema makes the creator its owner, unlike pre-existing `public`, so that part isn't affected by the same restriction.)

After the Ansible fix was applied for real (`ok`, not `failed`, for both `ladu_staging` and `ladu_prod`), the exact same `deploy.sh staging b5c9fb0b0acea1475925f8e03c4b5897f59ced3e` command succeeded outright: images pulled, migrations applied, containers started, health check reported the right SHA within the 60s budget.

**Gate:** ✅ Verified 2026-09-19 — `deploy.sh staging b5c9fb0b0acea1475925f8e03c4b5897f59ced3e` completed successfully end to end. Independently confirmed with a plain `curl https://staging.ladu.com.ar/api/health` (not a privileged VPS action) → `{"status":"ok","sha":"b5c9fb0b0acea1475925f8e03c4b5897f59ced3e"}`. The `migrate.js`/Ansible fixes that made this succeed went out in their own small PR, merged separately before D-d started.

#### D-d — Staging job in `deploy.yml` — code done, gate pending

New `staging` job in `deploy.yml`, `needs: build-and-push`, gated behind a GitHub **`staging` Environment** (deploy history on the repo's Environments page, its own secret set, no protection rules — the doc calls for fully automatic promotion, no manual approval). It automates exactly the D-c manual sequence: write `/opt/ladu/staging/.env` from the Environment's secrets over SSH, `scp` a fresh `app.yml`/`deploy.sh` (same reasoning as D-c — both are per-deploy artifacts, not Ansible-managed), then run `deploy.sh staging ${{ github.sha }}`.

Plain `ssh`/`scp` in `run:` steps rather than a third-party SSH action — one fewer dependency to pin/vet, consistent with `deploy.sh` itself being a plain script. Needed **three repository secrets** (shared with the future `production` job, per §2's own secrets table — only the app-level env vars are per-Environment): `VPS_HOST`, `VPS_DEPLOY_SSH_KEY` (private half of `~/.ssh/ladu_ci_deploy`), and `VPS_HOST_KEY`. That last one is an addition beyond what §2 originally listed: rather than trust-on-first-connect (blindly accepting whatever host key the runner sees), the workflow pins the VPS's real host key in `known_hosts` up front — fetched once via `ssh-keyscan -t ed25519 152.53.146.206` (safe, read-only, just a public key) and handed to the user to paste in, since it's not sensitive. The **`staging` Environment secrets** are the same set D-c used manually, minus `EMAIL_SERVICE` (dropped — always empty in practice, and `sendEmail.js` treats an unset var the same as an empty one, so no functional difference and one fewer secret).

Verified before handing off: extracted the exact resolved `run:` script text with Ruby's YAML parser (not just eyeballing the file) to confirm GitHub's block-scalar indentation-stripping leaves both heredoc terminators (`KEY`, `ENVFILE`) at column 0 — required for a plain (non-`<<-`) heredoc to match, and easy to get subtly wrong inside an indented YAML block without checking. All secret values that could touch credential material (the SSH private key, `DATABASE_URL`, `JWT_SECRET`) were read and entered by the user directly in the GitHub UI, never passed through a tool call here.

**Gate:** pending — this only exercises for real on an actual push to `main`, same as D-b. All repository and `staging` Environment secrets are now set.

#### D-e — Smoke e2e gate — code done, verified against real staging

New `e2e/playwright.deploy.config.ts` (no `webServer`, `baseURL` from `BASE_URL`, `testMatch` limited to `deployed-smoke.spec.ts`) and `e2e/tests/deployed-smoke.spec.ts`, run via a new `npm run test:e2e:smoke`. Deliberately its own config rather than reusing `playwright.config.ts` — that one always boots local dev servers, which is wrong for a spec whose entire point is hitting a real deployed environment.

Steps, matching §3 exactly: `/api/health` reports the just-deployed SHA (`EXPECTED_SHA`, passed as `${{ github.sha }}`) -> log in with the persistent smoke account -> dashboard loads -> create a word through the real add-word form -> delete it through the real `WordPage` sidebar -> confirm-dialog flow. That last part needed care: Radix's `AlertDialog` renders `role="alertdialog"`, distinct from a plain `dialog` role, and both the sidebar's delete trigger and the dialog's own confirm action render the same accessible text ("Delete", from `common:buttons.delete` in `frontend/public/locales/en/common.json`) — found by reading `WordPage.tsx`/`ConfirmDialog.tsx` directly rather than guessing, then scoped the second click to `page.getByRole('alertdialog').getByRole('button', { name: 'Delete' })` to disambiguate.

No DB fixture access (`fixtures/db.ts` is dev-DB-only, and CI can't reach staging's), so the smoke account itself needed one-time manual setup rather than the throwaway-per-run accounts other specs create:
- Registered via a plain `curl POST /api/users` against the live site (`smoke-test@ladu.test`, matching the `@ladu.test` convention other specs already use for synthetic addresses) — this hung for ~100s and Cloudflare returned a `524` timeout, but the account was actually created: `userController.ts`'s `register` handler inserts the `users` and `tokens` rows *before* its `await sendMail(...)` call, so the DB write had already succeeded by the time the slow/placeholder-credentialed SMTP attempt to Resend finally gave up. Confirmed by a second registration attempt with the same email, which returned instantly with `"Email already in use"`.
- **Real bug surfaced by this, not yet fixed — flagged for D-g:** registration (and password reset, same `await sendMail(...)` pattern in `userController.ts`) blocks the HTTP response on the full email send finishing. Harmless right now only because nothing is actually listening on the placeholder Resend credentials' other end long enough to matter for testing — but once D-g wires up real credentials, any slowness or hiccup on Resend's side will make registration *appear* to hang or fail for real users the same way it just did here, even though the write already succeeded. Fix: stop awaiting the send before responding (fire-and-forget with its own error handling). Deliberately not fixed as part of D-e — unrelated to the smoke gate itself, and D-g is precisely where this stops being masked.
- No DB access for me to flip `verified = true` either (blocked by the same read/write restriction as D-c's connectivity check) — the user ran that one `UPDATE` by hand over SSH.
- Two more `staging` Environment secrets beyond D-d's set: `SMOKE_TEST_EMAIL`, `SMOKE_TEST_PASSWORD`.
- **TODO, not yet done:** `SMOKE_TEST_PASSWORD` is still the throwaway value (`REPLACE_ME_TEMP_PW_123!`) used for the one-off `curl` registration while setting this up — chosen for expediency, not meant to be the password long-term. Rotate it (update the account's password, then the GitHub secret to match) before this is relied on as a real gate rather than a just-verified one-off.

**Gate:** ✅ Verified 2026-09-19 — ran `npm run test:e2e:smoke` locally (`BASE_URL=https://staging.ladu.com.ar`) against the real, already-deployed staging site: both tests passed (health SHA check, and the full login → create → delete flow) in under 5 seconds. The `deploy.yml` `smoke` job that runs this automatically in CI is unverified until the same merge that verifies D-d/D-b.

**Follow-up caught after D-d/D-e merged:** `ci.yml`'s `e2e` job (the local-dev-stack suite, unrelated to `deploy.yml`) started failing — `playwright.config.ts`'s default `testDir: './tests'` globs every `*.spec.ts`, so it picked up `deployed-smoke.spec.ts` too and failed immediately for missing env vars that only `deploy.yml`'s `smoke` job ever sets. Fixed with `testIgnore: 'deployed-smoke.spec.ts'` on the main config — `playwright.deploy.config.ts` still targets it exclusively via its own `testMatch`. Small follow-up commit on the same PR, caught by CI itself before merge.

#### D-f — Production job — ✅ done

New `production` job in `deploy.yml`, `needs: smoke`, gated behind a GitHub **`production` Environment** — otherwise identical to `staging`'s job (same SSH setup, same `.env`-write-then-`scp`-then-`deploy.sh` sequence), just pointed at `/opt/ladu/prod`, `ladu_prod`, and `app.ladu.com.ar`. Shares `staging`'s repository secrets (`VPS_HOST`, `VPS_DEPLOY_SSH_KEY`, `VPS_HOST_KEY`) — only the app-level env vars are per-Environment, per §2's own secrets table. `production`'s `JWT_SECRET` is a separate freshly generated value, not reused from staging.

`concurrency: deploy` already covers this — it was set once at the workflow level in D-b and applies to every job in the file, so `build-and-push` → `staging` → `smoke` → `production` always serialize as one unit; nothing new needed for that part of D-f's stated scope.

The real merge (PR #31) produced the first production deploy, giving `deployed_sha=9926732...` as a known-good baseline to roll back to. The rollback proof itself: built a `backend` image locally with `--build-arg GIT_SHA=deliberately-wrong-sha-for-rollback-test`, pulled the real already-deployed `web` image and re-tagged it (its content is irrelevant to this test — only the backend's `/api/health` response is what `deploy.sh` polls), pushed both under `ghcr.io/kraud/ladu-{backend,web}:rollback-test`, then ran `deploy.sh prod rollback-test` for real over SSH.

Two real snags along the way, both resolved rather than worked around:
- Pushing to GHCR needed registry auth I don't have (`docker push` is blocked by the local permission classifier as `[Production Deploy]`, correctly) — the user built nothing, but did the actual `docker login`/`push`/`deploy.sh` steps themselves, same boundary as every other VPS/production-touching action this whole phase.
- `gh auth token` (used for the first `docker login` attempt) turned out to carry no `write:packages` scope, and the user's `gh` CLI is authenticated via an ambient `GITHUB_TOKEN` env var rather than its own stored credentials, so `gh auth refresh` couldn't fix it either. Resolved with a one-off classic PAT (`write:packages` only, named `ghcr-manual-push`), used directly for `docker login` instead — didn't touch the existing `gh`/env-var setup at all.
- The first `deploy.sh prod rollback-test` attempt failed immediately, before even reaching the health check: `no matching manifest for linux/amd64/v4`. The `backend` image had been built locally on an Apple Silicon Mac without an explicit `--platform`, so Docker built it for `arm64` — confirmed via `docker image inspect --format '{{.Architecture}}'`. Every other image that had ever reached the VPS came from GitHub Actions' `ubuntu-latest` (x86_64) runners; this was the first one built locally by a human. Rebuilt with `--platform linux/amd64` explicitly, re-pushed, re-ran.

**Gate:** ✅ Verified 2026-09-19 — `deploy.sh prod rollback-test` ran the full real sequence: pulled both images, ran migrations (a harmless no-op re-run against already-migrated `ladu_prod`), swapped both containers, polled `https://app.ladu.com.ar/api/health` for 60s, correctly never saw a matching SHA (impossible by construction), rolled back to `99267327...`, and exited non-zero. Independently confirmed afterward with a plain `curl https://app.ladu.com.ar/api/health` → `{"status":"ok","sha":"99267327abd5df57899d523f99881d3a51d57eb0"}` — production undisturbed. `rollback-test`-tagged images are still sitting in GHCR, harmless and clearly labeled; not cleaned up, optional.

#### D-g — Resend cutover — ✅ done

Real bug fixed, found back in D-e: `userController.ts`'s `register` and `requestPasswordReset` handlers both `await sendMail(...)` before responding. `sendEmail.js` already catches its own send errors internally and never rejects (`.then()/.catch()` around `transporter.sendMail`, always resolves) — so awaiting it was never about error handling, only ever added latency, and with a slow/unreachable mail provider that latency is the full SMTP timeout (the ~100s Cloudflare 524 seen in D-e). Fixed by not awaiting it at either call site — `sendMail(...).catch(...)`, response sent immediately after the DB write. `requestPasswordReset`'s `try/catch` (only ever there to turn a `sendMail` rejection into a 500, which per the above could never actually fire) was removed entirely, matching `register`'s existing style of trusting `asyncHandler` for real errors.

Second real bug, same discovery: `sendEmail.js`'s `mailData.from` was set to `process.env.EMAIL_USER` — for Resend, that's the literal SMTP auth username `"resend"`, not an email address. Invisible until now because local dev's `.env` still uses the old Gmail setup, where `EMAIL_USER` happens to already be a real address. Fixed with a new `EMAIL_FROM` variable, separate from `EMAIL_USER` — `staging@ladu.com.ar` for staging, `noreply@ladu.com.ar` for production (both added as that environment's own GitHub secret). `deploy/env/app.env.example` and `ci.yml`'s `e2e` job env updated to match; local dev's real `.env` is the user's own git-ignored file, left untouched — they add `EMAIL_FROM` there by hand.

Domain verification itself needed no new work — confirmed already "Verified" in Resend's dashboard from Phase C's Terraform-managed DKIM/CNAME/DMARC records. New: a Resend API key (`ladu-transactional-email`, sending-only access), set as `EMAIL_PASS` in both `staging` and `production` Environment secrets (one shared key across both — simpler, reasonable for a project this size).

The first real merge (with the fixes above) deployed cleanly and returned fast — but no email arrived, and Resend's own dashboard Logs tab was completely empty, meaning the request never reached Resend at all. Diagnosed live rather than guessed at:

- Backend container logs (`docker logs backend-staging`) showed nothing at first — traced to `docker restart` not reloading `.env` (container env vars are fixed at *creation*, not read again on a plain restart; needed `docker compose up -d` to actually recreate the container with the changed file).
- Once that was fixed, the real error surfaced: `Error: Connection timeout ... code: 'ETIMEDOUT', command: 'CONN'` — the container's outbound TCP connection to `smtp.resend.com:465` never completes. Ruled out `DOCKER-USER` (only scopes inbound 80/443, confirmed by reading `docker-user-firewall.sh.j2` directly) and `ufw` (`Default: deny (incoming), allow (outgoing)`, confirmed via `ufw status verbose`) — neither blocks this. Root cause confirmed by testing raw TCP connectivity from the VPS host itself (`/dev/tcp` against several ports): 465/587/25 all timed out, but Resend's documented alternates 2465/2587 connected immediately. **Netcup blocks outbound SMTP ports by default** — a common anti-abuse policy for new VPS accounts, upstream of anything in this repo. Fixed: `EMAIL_PORT=2465` (still implicit TLS, `EMAIL_SECURE` unchanged) — documented in `app.env.example` with the diagnosis inline so it isn't a mystery again later.
- With the port fixed, a new error: `550 Invalid \`from\` field` from Resend's own SMTP server. Checked the running container's actual env (`docker exec backend-staging printenv EMAIL_FROM`) — empty. Checked the `.env` file itself on the VPS — no `EMAIL_FROM` line at all. Root cause: **`deploy.yml`'s heredoc that writes `.env` was never updated to include `EMAIL_FROM`** when that variable was introduced earlier in this same slice — it went into `sendEmail.js`, `app.env.example`, and `ci.yml`, but not the one place that actually mattered. A real oversight, not a mystery — fixed by adding `EMAIL_FROM=${{ secrets.EMAIL_FROM }}` to both the `staging` and `production` jobs' heredocs.

Verified each fix live against staging before touching the GitHub secrets (faster iteration): manually edited `/opt/ladu/staging/.env`, recreated just the `backend` container (`ENVIRONMENT=staging IMAGE_TAG=<current sha> docker compose -f app.yml --env-file .env up -d backend`), retested. Once the send itself completed with no logged error, the user re-registered on staging with a real inbox and confirmed: email arrived, not in spam, verified the account successfully. `EMAIL_PORT` updated to `2465` in both Environments' GitHub secrets afterward, so the next real deploy carries the fix forward without relying on the manual VPS patch.

**Gate:** ✅ Verified 2026-09-19 on both environments — registration → real inbox → verified account, on both `staging.ladu.com.ar` (`staging@ladu.com.ar` sender) and `app.ladu.com.ar` (`noreply@ladu.com.ar` sender, confirmed after the `deploy.yml` heredoc fix merged and production's container showed the correct `EMAIL_PORT=2465`/`EMAIL_FROM` via `docker exec ... printenv`). Same real inbox used for both — staging and production are separate databases (`ladu_staging`/`ladu_prod`), so no conflict registering the same address on each.

**Phase D is now complete.** Every sub-slice (D-a through D-g) done and gate-verified for real against the live VPS: automated build/scan on every PR, automated publish + deploy to staging and production on every merge to `main`, a smoke e2e gate between them, a proven rollback path, and real transactional email delivery on both environments.

### Phase E — Backups and monitoring (½ day)

Broken into sub-slices, same pattern as Phase D's D-a–D-g:

- **E-a** — B2 bucket + a new Ansible `backup` role: nightly `pg_dump -Fc ladu_prod` inside the `postgres` container → `rclone copy` to the bucket, timestamped filenames, a lifecycle rule that deletes files 30 days after upload. Staging has no backup (reproducible from the deploy pipeline, not worth the cost).
- **E-b** — `deploy/scripts/restore-test.sh` + a weekly cron via the `backup` role: download the latest dump → restore it into a throwaway `postgres:15-alpine` container (`docker run --rm`, no persistent volume) → run a row count as a sanity check → remove the container → ping a **Healthchecks.io** heartbeat monitor on success. Heartbeat monitors are the reverse of a normal uptime check: the script pings *out* on success, and the monitor alerts when a ping fails to arrive on schedule — the standard way to catch a cron job that silently stopped running. (UptimeRobot's free plan doesn't include heartbeat/cron monitoring — discovered when actually trying to create one — so this one piece uses Healthchecks.io's free tier instead; UptimeRobot still covers E-c's plain HTTP monitors.)
- **E-c** — UptimeRobot HTTP monitors: `app.`, `staging.`, apex, and `/api/health` specifically (the last one catches "200 but the DB is unreachable," since the health endpoint runs `SELECT 1`).
- **E-d** — Sentry: two projects (`ladu-backend`, Express/Node SDK; `ladu-frontend`, React SDK), each project's single DSN shared across staging and production and distinguished at runtime by the `environment` tag, plus `release` = the same git SHA already baked into `/api/health`.

Decisions made:
- The restore test runs as a VPS cron job owned by the `backup` role, not a scheduled GitHub Actions workflow — it keeps the B2 credentials in one place (Ansible Vault) instead of also needing them as GitHub secrets, and matches how Phase C already grouped "`backup`: see Phase E" under that role.
- One Sentry DSN per platform (backend, frontend) rather than four (one per platform per environment) — `environment: staging|production` in the SDK config does the separation Sentry's dashboard needs, and the free tier's event quota is shared either way.

**Gate:** one restore test completes end to end and pings the heartbeat monitor. A stopped backend causes an UptimeRobot alert within 5 minutes.

#### E-a/E-b — Backup role + restore test — ✅ done

New `deploy/ansible/roles/backup/` (added to `site.yml` after `platform`): installs `rclone` (Debian's packaged version, using rclone's native `b2` backend -- account + key, not the S3-compatible endpoint -- since that's simpler and is what Backblaze's own rclone docs recommend) and `cron` (not guaranteed present on a minimal image), lays out `/opt/ladu/backup/`, syncs `deploy/scripts/backup.sh` and `restore-test.sh` from git (Ansible-managed, unlike `deploy.sh`/`app.yml` -- these don't vary per commit, so there's no reason for a GitHub Actions job to own them), writes `backup.env` (the two non-secret values the scripts need: `POSTGRES_SUPERUSER`, `B2_BUCKET_NAME`) and `rclone.conf` (the B2 credentials) as their own `0600` files rather than piggybacking on `platform/.env` -- keeps each stack's env file owned by the role that actually consumes it. Two `cron` module entries: nightly backup (03:00), weekly restore test (Sundays 04:00). A `logrotate.d` entry caps the two log files.

`backup.sh`: `pg_dump -Fc` the `ladu_prod` database (via `docker compose exec -T postgres`, matching `postgres_superuser`'s existing DB-owner permissions from the `platform` role) → `rclone copy` to B2 → delete the local dump. `restore-test.sh`: find the newest dump in B2 (`rclone lsf`, sorted) → download it → restore into a throwaway `postgres:15-alpine` container (`docker run`, no volume, always removed via a `trap` even on failure) → `SELECT count(*) FROM words` as a proof-of-life query (not a hard "must be non-zero" check -- an early-stage prod DB may genuinely have few rows; the check is "the restored schema is queryable," not "it has data") → `curl` the Healthchecks.io ping URL only on success.

New vault secrets (added by hand via `ansible-vault edit`, not by me -- same boundary as every other credential in this repo): `vault_b2_key_id`, `vault_b2_application_key`, `vault_healthchecks_ping_url`. Wired non-secret-side in `group_vars/all/vars.yml` (`b2_bucket_name`, plus pass-throughs for the three vault values), same pattern as `postgres_superuser_password`/`cloudflare_dns_token`.

**UptimeRobot's heartbeat/cron monitoring turned out to be a paid-plan-only feature** -- discovered when actually trying to create one, not from its docs beforehand. Swapped to Healthchecks.io (free tier, purpose-built for this exact dead-man's-switch pattern) for this one piece; UptimeRobot is unaffected and still covers E-c's plain HTTP monitors.

Three real bugs surfaced by the first live run, each fixed and re-verified rather than worked around:
- `b2_bucket_name` was hardcoded to `ladu-backups`, but the bucket the user actually created (and scoped the application key to) is named `ladu-db-backups` -- `rclone` failed outright (`you must use bucket "ladu-db-backups" with this application key`) rather than silently writing to the wrong place. Fixed by correcting the var to match the real bucket.
- `pg_restore -U postgres -d ladu_prod --no-owner` still failed on `GRANT ALL ON SCHEMA public TO ladu_prod` (the schema grant the `platform` role sets up on the real server) -- `--no-owner` only skips ownership commands, not privilege ones. Added `--no-privileges` alongside it, since the scratch container has no `ladu_prod` role at all.
- The readiness wait used a single `pg_isready` check, which raced the official `postgres` image's documented double-start behavior on a fresh (volume-less) container: it briefly starts Postgres for `initdb`-time setup, stops it, then starts it again for real. `pg_isready` caught the container in that first, short-lived window and `createdb` then failed against a socket that had already disappeared. Fixed per the image's own docs: wait for the "database system is ready to accept connections" log line to appear twice before proceeding.

**Gate:** ✅ Verified 2026-09-20 -- `ansible-playbook site.yml` ran clean against the real VPS (idempotent re-runs confirmed along the way while fixing the above). `backup.sh` produced a real dump, confirmed present in the B2 console. `restore-test.sh` restored that dump into a throwaway container and printed `Restore test passed: ladu_prod_20260919T225757Z.dump restored, 0 rows in 'words'` (an empty `words` table is expected at this stage -- the check proves the restore is queryable, not that it's non-empty) and pinged Healthchecks.io, which reported the check green.

#### E-c — UptimeRobot HTTP monitors — configured, alert-firing not yet verified

Four HTTP(s) monitors created by hand in the UptimeRobot dashboard (no Terraform provider for this -- Terraform here is Cloudflare-only, per the Decisions table), 5-minute interval: `https://app.ladu.com.ar`, `https://staging.ladu.com.ar`, `https://ladu.com.ar` (apex -- still the legacy Vercel landing page, not this repo's `landing/` yet), and `https://app.ladu.com.ar/api/health` specifically. That last one is production-only, not duplicated for staging -- staging's health is already exercised on every deploy by the CI/CD pipeline's own health check and the smoke e2e gate, so a dedicated monitor adds the least value there.

**Gate:** not yet verified. Monitors are live and showing green, but the phase's actual stated gate -- "a stopped backend causes an UptimeRobot alert within 5 minutes" -- hasn't been tested yet (stop `backend-staging` for ~5-6 minutes, confirm an alert email arrives, start it back up). Deferred, not forgotten.

#### E-d — Sentry (backend + frontend) — code done, gate pending

`@sentry/node` initialized in `backend/api/index.js`, gated on `SENTRY_DSN` actually being set -- `Sentry.init()` patches Node's `http`/`https` modules for its default integrations regardless of whether a DSN is configured, which is exactly the kind of global side effect environments with no DSN (tests, CI) don't want; calling `Sentry.captureException()` (via `Sentry.setupExpressErrorHandler(app)` in `app.js`, unconditional) is a documented no-op when the SDK was never initialized, so skipping `init()` entirely is safe. `environment` comes from a new `ENVIRONMENT` var threaded through `deploy/compose/app.yml`'s `backend` service straight from the shell variable `deploy.sh` already exports for container naming -- no new secret needed, deliberately `"staging"`/`"prod"` (not `"production"`) to match this repo's own naming everywhere else (`ladu_prod`, `/opt/ladu/prod`), even though GitHub's own Environment feature is confusingly named `production`. `release` reuses the existing `GIT_SHA` env var `/api/health` already reads.

`@sentry/react` initialized in `frontend/src/main.tsx`, reading from `frontend/src/env.ts` (the module that already owns all `import.meta.env` access in this codebase -- followed its existing convention rather than reading `import.meta.env` directly). `release`/`sentryDsn` are baked in at image build time (`frontend/Dockerfile` gained `GIT_SHA`/`SENTRY_DSN` build args, exposed to Vite as `VITE_GIT_SHA`/`VITE_SENTRY_DSN`) -- unavoidable, since the `web` container is just Caddy serving static files with no runtime templating. `environment` can't be a build-time value the same way, though, since one built image serves both staging and production (frontend/Dockerfile's own top comment) -- it's read from `window.location.hostname` (`staging.` vs anything else) at page-load time instead.

`SENTRY_DSN_FRONTEND` had to become a plain **repository** secret rather than a per-Environment one like the backend's `SENTRY_DSN` -- not a style choice, a hard GitHub Actions constraint: `deploy.yml`'s `build-and-push` job builds the one shared `web` image before either environment's job runs, and has no `environment:` context of its own to read Environment-scoped secrets from. `ci.yml`'s `images` job (PR-time, scanned and discarded, never deployed) only gets `GIT_SHA` in its build-args, no DSN -- Sentry no-ops harmlessly without one, and that image never sees real traffic anyway.

One real bug found and fixed along the way, unrelated to the intent of this change but caused by installing `@sentry/node`: its tracing integrations eagerly `require()` several `@sentry/server-utils` subpaths (`orchestrion`, `orchestrion/register`, ...) that Jest's resolver can't follow, even though Node's own `require.resolve` handles every one of them correctly -- the same class of bug `backend/jest.config.js` already documents and works around for `drizzle-orm`. A static `moduleNameMapper` entry per subpath proved to be a losing game (fixing one immediately surfaced the next), so this was fixed once and robustly with a small custom Jest resolver (`backend/tests/sentryServerUtilsResolver.js`) that delegates just that one package to Node's own resolution algorithm instead of Jest's. Also caught and fixed: gating `Sentry.init()` on `SENTRY_DSN` (see above) was needed to keep the backend test suite's open-handle count from jumping 1 -> 7 (confirmed via `git stash` against `main` as the baseline) -- `Sentry.init()`'s global `http`/`https` patching, not `require('@sentry/node')` itself, was the cause.

Verified locally before handing off: backend (`typecheck`, `lint`, all 176 Jest tests) and frontend (`typecheck`, `lint`, all 611 Vitest tests) all green, plus a real `vite build` with test `VITE_GIT_SHA`/`VITE_SENTRY_DSN` values confirmed present in the built bundle by grepping `dist/assets/*.js` directly.

**Gate:** pending -- needs a real merge/deploy (the `SENTRY_DSN`/`SENTRY_DSN_FRONTEND` GitHub secrets are set, but nothing has exercised them yet) and then one deliberate error triggered against staging, on both backend and frontend, confirmed to show up in their respective Sentry projects tagged with the right `environment`/`release`.

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
| GitHub Actions + GHCR (public repo), Cloudflare, HCP Terraform, Resend, B2 (10 GB, cap $0), UptimeRobot, Healthchecks.io, Sentry (free plans) | €0 |
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
