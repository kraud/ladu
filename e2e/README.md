# e2e — Ladu end-to-end suite

Full-stack [Playwright](https://playwright.dev) tests. Third npm workspace,
alongside `backend/` and `frontend/`. Kept separate so Playwright's Node config
and the browser binaries never enter the `frontend` workspace's `tsc -b` / Vite
build or its dependency tree.

## What it's for

**Every phase ends with a green e2e run covering that phase's vertical slice** —
this is a required gate in `.context/plans/new-repo-build-plan.md` §5, not
optional polish. MSW/Vitest tests prove units and flows in isolation; this suite
proves the real backend + real Postgres + real browser actually work together.

One spec file per phase: `tests/phase-1-auth.spec.ts`, `tests/phase-2-noun-crud.spec.ts`,
`tests/phase-3-review.spec.ts`, `tests/phase-3-5-dashboard.spec.ts`,
`tests/phase-3-9-theme.spec.ts`, `tests/phase-4-tags.spec.ts`,
`tests/phase-5-practice.spec.ts`, `tests/phase-5-5-saved-practice.spec.ts`, …
`tests/smoke.spec.ts` is the Phase 0 harness check. The two practice specs share helpers in `fixtures/practice.ts`
(register + verify through the API, seed nouns, sign in, answer cards).
`tests/onboarding-gate.spec.ts` is the first-login onboarding gate (`.context/plans/onboarding.md`, Slice 4e): it turns the
onboarding switch on, walks the flow, and checks Skip.
`tests/access-request-gate.spec.ts` is the access-requests spec (`.context/plans/access-requests.md`, Slice 4): `/request`, the admin approve and remove, and the real sign-up and sign-in that follow. It is a `-gate` spec, so it runs alone, after the other specs. `playwright.config.ts` sets `ACCESS_REQUEST_EMAIL` to empty, so no team email goes out; a value in the repo-root `.env` wins over it.
`tests/autocomplete-a-dictionary-route.spec.ts` is the autocomplete Slice A gate
(`.context/plans/autocomplete-data-source-strategy.md`).

## Prerequisites

Same as the backend Jest suite, plus a browser download:

```bash
npm run docker:up        # local Postgres (host :5433)
# the repo-root .env must exist (JWT secret, mail creds, DB URL)
npm run e2e:install      # one-time: downloads Chromium
```

No `db:migrate` step is needed. The run makes the e2e database and migrates it (see "Own ports, own database").

## Run

```bash
npm run test:e2e             # from the repo root — boots both servers, runs headless
npm run test:e2e:headed      # watch it in a real browser window
npm run test:e2e:ui          # Playwright's interactive UI mode (runs headed — see below)
npm run report -w e2e        # open the last HTML report
```

**UI mode needs `--headed`** (`test:e2e:ui` already passes it). UI mode's own
settings have no headed toggle, and its run request carries no `headed` flag, so
without `--headed` every run launches `chromium_headless_shell` — the UI window
renders the live trace, but no browser window ever opens. With `--headed`, each
worker opens a real Chromium window you can watch.

Playwright starts the backend, the app, the admin app and the two stubs itself
(see `playwright.config.ts` → `webServer`). `npm run dev` can keep running: the
suite does not use its ports or its database.

## Own ports, own database

`fixtures/env.ts` is the one place for these values. Each can be set from the outside.

| What | Default | Variable | `npm run dev` uses |
|------|---------|----------|--------------------|
| API (backend) | `http://localhost:5101` | `E2E_API_URL` | :5001 |
| App (Vite) | `http://localhost:5273` | `E2E_BASE_URL` | :5173 |
| Admin app (Vite) | `http://localhost:5274` | `E2E_ADMIN_URL` | :5174 |
| OIDC stub | `http://localhost:4500` | `OIDC_STUB_URL` | — |
| Ekilex stub | `http://localhost:4501` | `EKI_STUB_URL` | — |
| Database | `keelapp_e2e` (same server as `DATABASE_URL`) | `E2E_DATABASE_URL` | `keelapp_v2_dev` |

- **The database.** The first command of the backend `webServer` (`fixtures/ensure-db.ts`) creates `keelapp_e2e` when it is missing. Then the run migrates it, loads the lexicon fixtures and seeds the demo template. The database name must contain `e2e`: the suite deletes rows, so it refuses any other name. CI already uses the name `keelapp_e2e`.
- **The environment.** The backend loads the repo-root `.env` with `override: true`. The e2e servers set `LADU_KEEP_PROCESS_ENV=1`, which switches the override off. So the values in `playwright.config.ts` (port, database, stubs, Turnstile test keys) win over `.env`, and a real Ekilex or Turnstile key in `.env` does not matter.
- **The Vite proxy.** The app and the admin app forward `/api` to `API_PROXY_TARGET` (default `http://localhost:5001`). The config sets it to the e2e backend.
- **A stack left behind.** `reuseExistingServer` is on outside CI, so a stack started on purpose on the e2e ports is reused. A stack left over from a crashed run is reused too: stop it if a run behaves strangely (`lsof -nP -iTCP:5101 -sTCP:LISTEN`).

## Global setup

`fixtures/global-setup.ts` runs once before every run and turns the **onboarding switch off** in the e2e
database. While it is on, each spec that signs in a new account would land on `/onboarding`. Only
`onboarding-gate.spec.ts` turns it on, and it turns it off again. The switches of your dev database are not touched.

## Stub servers

Two local stubs stand in for third-party services, so no spec depends on them:

| Stub | Port | Stands in for | Used by |
|------|------|---------------|---------|
| `fixtures/oidc-stub/server.ts` (`npm run stub:oidc -w e2e`) | 4500 | Google sign-in (OIDC) | `oauth-*.spec.ts` |
| `fixtures/eki-stub/server.ts` (`npm run stub:eki -w e2e`) | 4501 | the Ekilex API (Estonian dictionary) | `autocomplete-a-dictionary-route.spec.ts` |

Playwright points the backend at them through env values in `playwright.config.ts`. These
values win over the repo-root `.env` (`LADU_KEEP_PROCESS_ENV`), and the e2e backend is never
your dev backend. The stub ports come from the `*_STUB_URL` variables in "Own ports, own database".

## Playwright MCP

`.mcp.json` at the repo root registers the `@playwright/mcp` server, so an agent
session in this repo can drive a browser interactively (explore a flow, capture a
screenshot, draft a selector) before it's written up as a spec here. The MCP
server and this suite are independent — specs run through `@playwright/test`.

## CI

Wired as the `e2e` job in `.github/workflows/ci.yml`: a Postgres service
container (database `keelapp_e2e`), `playwright install --with-deps chromium`, then `npm run test:e2e`.
The `webServer` command runs the migrations, loads the lexicon fixtures and seeds
the demo template before the backend starts, so there's no separate migrate step. Dummy `EMAIL_*` values are
set — `sendMail` (`backend/utils/sendEmail.js`) catches its own send errors
and never rejects, so registration/verification flows work without a real
mailbox; `fixtures/db.ts` reads the verification token straight from the
`tokens` table instead. On failure, the HTML report uploads as the
`playwright-report` artifact.
