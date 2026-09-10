# e2e — Ladu end-to-end suite

Full-stack [Playwright](https://playwright.dev) tests. Third npm workspace,
alongside `backend/` and `frontend/`. Kept separate so Playwright's Node config
and the browser binaries never enter the `frontend` workspace's `tsc -b` / Vite
build or its dependency tree.

## What it's for

**Every phase ends with a green e2e run covering that phase's vertical slice** —
this is a required gate in `.context/.frontend/new-repo-build-plan.md` §5, not
optional polish. MSW/Vitest tests prove units and flows in isolation; this suite
proves the real backend + real Postgres + real browser actually work together.

One spec file per phase: `tests/phase-1-auth.spec.ts`, `tests/phase-2-noun-crud.spec.ts`, …
`tests/smoke.spec.ts` is the Phase 0 harness check.

## Prerequisites

Same as the backend Jest suite, plus a browser download:

```bash
npm run docker:up        # local Postgres (host :5433)
npm run db:migrate       # schema -> keelapp_v2_dev
# backend/.env must exist (JWT secret, mail creds, DB URL)
npm run e2e:install      # one-time: downloads Chromium
```

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

Playwright starts `npm run dev -w backend` and `npm run dev -w frontend` itself
(see `playwright.config.ts` → `webServer`). If you already have `npm run dev`
running, it reuses those servers locally.

## Playwright MCP

`.mcp.json` at the repo root registers the `@playwright/mcp` server, so an agent
session in this repo can drive a browser interactively (explore a flow, capture a
screenshot, draft a selector) before it's written up as a spec here. The MCP
server and this suite are independent — specs run through `@playwright/test`.

## CI

Not wired yet — e2e is a **local** phase gate for now (needs Postgres + both
servers + browsers). A GitHub Actions `e2e` job is a documented follow-up once
the suite has a few phases' worth of specs and is stable.
