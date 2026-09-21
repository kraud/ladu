# Development workflow

## The short version

```
feature branch → PR → ci.yml (6 checks, all required) → merge to main
   → deploy.yml runs automatically:
       1. build images, push to GHCR (tagged by commit SHA)
       2. deploy to staging, run migrations, health-check
       3. run the smoke e2e suite against real staging
       4. deploy to production, run migrations, health-check
```

There is **no manual "promote to production" button.** A successful merge to
`main` reaches real users within a few minutes, gated only by staging's
health check and the smoke test passing. This was a deliberate choice (see
`.dev-context/deployment-strategy.md` §1, "Rejected options") — the safety
net is the automated gate, not a human clicking approve.

## Step by step

### 1. Branch off `main`

`main` is protected by a GitHub ruleset: **no direct pushes, no force-pushes,
merges only through a pull request**, and all of `ci.yml`'s checks must be
green before merge is even offered. (You work alone on this project, so a
human review isn't additionally required — the checks are the gate.)

### 2. Work locally

`npm run docker:up` + `npm run db:migrate` + `npm run dev` gets you a real
backend + frontend + Postgres on your machine — this is by far the fastest
feedback loop, and where you should do almost all iteration. Write/extend
tests alongside the feature (per `CLAUDE.md`'s working rules), not after.

### 3. Open a PR

Pushing the branch and opening a PR triggers `ci.yml` — six independent jobs,
all required by the ruleset before merge is allowed:

| Job | What it checks |
|---|---|
| `lint` | ESLint, both workspaces |
| `typecheck` | `tsc --noEmit` (backend) / `tsc -b` (frontend) |
| `backend` | Jest, against a fresh ephemeral Postgres |
| `frontend` | Vitest + a real `vite build` |
| `e2e` | The full Playwright suite (every `phase-*.spec.ts`) against a real backend + frontend + fresh Postgres, all spun up inside the runner |
| `images` | Builds all three Docker images and scans each with Trivy for HIGH/CRITICAL CVEs with a known fix |

If any of these is red, the merge button is disabled — there's nothing to
argue with, just fix it and push again.

### 4. Merge

Once green, merge the PR. This is the point of no easy return — `deploy.yml`
starts immediately (`on: push: branches: [main]`), and `concurrency: deploy`
ensures only one deploy runs at a time (a second merge queues behind it
rather than racing it).

`deploy.yml`'s four jobs, in order, each depending on the last:

1. **`build-and-push`** — rebuilds `backend`, `web`, `landing` (the exact
   same Dockerfiles CI already scanned on this commit) and pushes them to
   GHCR tagged with the full commit SHA. No new Trivy scan here — that
   already happened, on this exact commit, before merge was even allowed.
2. **`staging`** — SSHes into the VPS, writes `/opt/ladu/staging/.env` from
   the `staging` GitHub Environment's secrets, and runs
   `deploy/scripts/deploy.sh staging <sha>`: pull images → run migrations →
   swap containers → poll `/api/health` for up to 60s until it reports the
   new SHA. A failed migration leaves the old containers running. A failed
   health check triggers an automatic rollback to the last known-good SHA.
3. **`smoke`** — runs `e2e/tests/deployed-smoke.spec.ts` against the real,
   now-updated `staging.ladu.com.ar`: confirms `/api/health` reports the
   right SHA, then logs in with a persistent smoke-test account, creates a
   word through the real UI, and deletes it. This is the actual gate between
   "code that passed CI" and "code that reaches real users."
4. **`production`** — identical to step 2, but for `/opt/ladu/prod` and
   `app.ladu.com.ar`. Only runs if `smoke` passed.

If any of steps 2–4 fails, later jobs simply never run — production is never
touched by a deploy whose staging leg or smoke test failed.

## "How do I test a feature branch before merging?"

This is the part that's genuinely different from the old, single-environment
workflow, and worth being explicit about: **there is no isolated,
deployed-to-a-real-URL preview environment per branch or per PR.** Staging
always tracks `main` — the only way anything reaches `staging.ladu.com.ar`
is by merging. You cannot point staging at a feature branch.

What you *do* have, in increasing order of "how close to real":

1. **`npm run dev` locally** — fastest loop, what you'll use 95% of the time.
2. **`npm run test:e2e`** — the same Playwright suite CI runs, against your
   local stack, before you even push.
3. **The CI `e2e` job itself, automatically, on every PR** — this is your
   real safety net for "does this actually work end-to-end," and it runs
   before anyone (including you) has to decide whether to merge.
4. **`deploy/compose/docker-compose.local.yml` + `local.Caddyfile`** — the
   closest thing to a real deploy without touching the VPS: builds the
   *actual* Docker images from your branch and runs the *actual* prod-style
   Compose stack (Caddy routing by hostname, migrations via the containerized
   `migrate.js`, etc.) locally over plain HTTP on a `*.localhost` domain — no
   `/etc/hosts` edit needed, no Cloudflare/ACME involved. Reach for this when
   you specifically want to rule out "works in `npm run dev` but might not
   work containerized" before merging something that touches Docker,
   env vars, or the reverse-proxy routing itself.

If a change is risky enough that you want a real, publicly-reachable URL to
test it on before it reaches production, the honest answer today is: it
doesn't exist yet. The mitigating factor is that "merge" always lands on
staging *first*, with an automated smoke test as a checkpoint before
production sees it — so even a merge is not instantly a production release,
it's "staging now, production in the next couple of minutes if staging's
smoke test passes."

## Things to watch out for before merging

- **New environment variables need updating in three places, not one** — a
  real bug hit exactly this: `EMAIL_FROM` was added to `sendEmail.js` and
  `deploy/env/app.env.example` but the `deploy.yml` heredocs that actually
  write `.env` on the VPS were forgotten, so the variable silently never
  reached staging/production. Checklist for a new backend env var:
  `deploy/env/app.env.example` (docs) → `deploy.yml`'s two `ENVFILE` heredocs
  (`staging` and `production` jobs) → the matching GitHub Environment secret,
  in both `staging` and `production`.
- **Migrations must be expand/contract-safe** (see
  [`02-environments-and-databases.md`](02-environments-and-databases.md)) —
  because automatic rollback reverts images, never the database.
- **New dependencies can fail the `images` Trivy scan** in CI — if you add a
  package with a known HIGH/CRITICAL CVE, the PR won't be mergeable until
  it's fixed or (rarely, and only with a documented reason) added to
  `.trivyignore`.
- **Outbound network calls from the backend go through a firewall rule
  scoped to Cloudflare-inbound traffic** — this doesn't block outbound calls
  today (it's scoped to the VPS's external interface only, after a real bug
  where it briefly did), but if you ever touch
  `deploy/ansible/roles/platform/templates/docker-user-firewall.sh.j2`, be
  aware this exact class of bug (inbound-only rule accidentally also
  catching outbound container traffic) has bitten this project twice
  already — see [`05-troubleshooting-playbook.md`](05-troubleshooting-playbook.md).

## Manual / emergency deploy

`deploy/scripts/deploy.sh` is a plain script, not GitHub-Actions-only — it
can be run by hand from `/opt/ladu/<env>/` on the VPS if you ever need to
deploy or roll back outside the normal pipeline (e.g. GitHub Actions itself
is down, or you need to roll back to a specific older SHA immediately):

```bash
ssh -i ~/.ssh/ladu_deploy deploy@152.53.146.206
cd /opt/ladu/staging   # or /opt/ladu/prod
./deploy.sh staging <sha>   # or: ./deploy.sh prod <sha>
```

`<sha>` must be a commit whose images already exist in GHCR (i.e., it went
through `build-and-push` at some point) — the script does `docker compose
pull`, which fails outright if the tag doesn't exist.
