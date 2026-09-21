# Infrastructure guide — index

Ladu v2's deployment architecture (Phases 0–E of `.dev-context/deployment-strategy.md`)
is fully built and live. This guide is the **operator's manual** for it: how the
pieces fit together, how to read each dashboard, what the development workflow
looks like now that there's a real staging + production pipeline, and what to
do when something breaks.

`.dev-context/deployment-strategy.md` stays as-is — it's the **build log**
(decisions, what was tried, what broke, what fixed it, phase by phase). This
guide is the **reference** you come back to day-to-day once the building is
finished. Where this guide says "why," it's the short version; the full story
with dates and root-causes is in the build log if you want it.

## Start here

| If you want to... | Read |
|---|---|
| Understand how all the pieces connect, in plain language | [`01-architecture-overview.md`](01-architecture-overview.md) |
| Know which database is which, and how to open a `psql` shell on any of them | [`02-environments-and-databases.md`](02-environments-and-databases.md) |
| Know the actual steps to ship a feature, and what happens after you merge | [`03-development-workflow.md`](03-development-workflow.md) |
| Understand a dashboard (GitHub Actions, Sentry, UptimeRobot, Cloudflare...) | [`04-dashboards-and-monitoring.md`](04-dashboards-and-monitoring.md) |
| Diagnose something that's broken, using a symptom → fix table | [`05-troubleshooting-playbook.md`](05-troubleshooting-playbook.md) |
| Find where a password/token/key lives, or rotate one | [`06-secrets-and-access.md`](06-secrets-and-access.md) |
| Look up a term you don't recognize | [`07-glossary.md`](07-glossary.md) |

## Quick facts

| | |
|---|---|
| Domain | `ladu.com.ar` (real domain, live now — no temporary domain was used) |
| Production | `https://app.ladu.com.ar` |
| Staging | `https://staging.ladu.com.ar` |
| Apex (`ladu.com.ar`, `www.`) | This repo's `landing/` page (`www.` redirects to the apex). Vercel is no longer used — see the switch runbook in `deployment-strategy.md` |
| Server | 1 Netcup VPS (`152.53.146.206`), hosts staging + production together |
| DNS/CDN/TLS termination | Cloudflare (proxied) |
| Container registry | GHCR, `ghcr.io/kraud/ladu-{backend,web,landing}`, tagged by commit SHA (`landing` also has a moving `latest` tag) |
| Cost | ≈ €6.81/month total (the VPS; everything else is on a free tier) |

## Known open items (as of 2026-09-21)

These are **gaps, not blockers** — the architecture works without them, but
they're unfinished:

1. **UptimeRobot's alert-firing gate has never been tested.** The 4 HTTP
   monitors are live and green, but nobody has stopped `backend-staging` for
   ~5 minutes to confirm an alert email actually arrives. See
   [`04-dashboards-and-monitoring.md`](04-dashboards-and-monitoring.md#uptimerobot) and
   [`05-troubleshooting-playbook.md`](05-troubleshooting-playbook.md).
2. **The staging smoke-test account's password is still a throwaway value**
   (`REPLACE_ME_TEMP_PW_123!`), set during one-off manual setup and never
   rotated. Low risk (staging-only, no real user data behind it) but should
   be replaced. See [`06-secrets-and-access.md`](06-secrets-and-access.md#smoke-test-account).

Both are tracked as their own memory entries and in
`.dev-context/deployment-strategy.md`'s Phase E section — update those (and
this file) once done.
