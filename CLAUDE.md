# CLAUDE.md — Ladu (keelapp-v2)

Context for working in this monorepo. Read this first every session. It applies to **both** `backend/` and `frontend/`.

- **Product/domain spec:** `.context/overview.md`
- **Commands, conventions & spec index:** `.context/README.md`
- **Roadmap and phase status:** `.context/roadmap.md`

---

## Communication
All the information must be done under the standard STE100 of communication.

## 1. What Ladu is

A multilingual vocabulary manager for **polyglots** — people who already speak several languages and want to keep *all* of them alive, not just study one new pair. A **Word** is one concept (e.g. "to dance") that holds **translations in many languages at once**, each with full grammatical detail (conjugations, declensions, gender…). Stored data feeds an **adaptive exercise engine** (spaced-repetition / forgetting-curve) that generates cross-language practice.

Design commandments (from `.context/overview.md` §1.2 — honour these in every UI decision):
1. Word entry must be fast and frictionless.
2. Social features are always optional; the solo loop (words + exercises) must work fully without them.
3. Never bury access to the core dictionary.
4. All languages shown equally — never hardcode EN/ES as "primary".
5. Capture grammatical nuance without overwhelming the UI.
6. Every stored datum feeds practice + stats.
7. Mastery/progress status is always legible to the user.

Supported languages: **EN, ES, DE, EE, FR** (English, Spanish, German, Estonian, French). A Word needs translations in **≥2 languages**.

---

## 2. What this repo is (and is not)

This is a **from-scratch re-implementation**, not the live app.

- The **old app** (`../keelapp`, a separate repo/Docker stack) stays **live on the real domain** the entire time. It is the *executable specification* — when a doc can't answer "what should happen?", run the old app. We do **not** have its frontend source here on purpose: re-importing it would re-import its mistakes.
- This repo (`keelapp-v2`) is an **npm-workspaces monorepo**: `backend/` (copied from the old repo, then modified) + `frontend/` (clean slate on a new stack). It deploys to a **temporary domain**; the user switches the real domain manually once route-by-route parity is verified.
- The **backend issues were minor** — it is brought over and edited in place. The **frontend is a full rebuild**. ~70–75% of the old frontend (Redux/service boilerplate, 8,700 lines of copy-paste forms, ~100 status-watching `useEffect`s) is *not* meant to survive.

### How we work together (important — the user set these rules)

- **One feature at a time, small vertical slices.** Each slice ends with something runnable.
- **No one-shotting big features.** Prioritise changes the user can *review, understand, and commit* before moving on.
- **Each slice starts with a plain-language overview, before touching any files.** Explain what the slice does and why, and explain any tool or concept it introduces (e.g. what Ansible is, what a Vault is, what a Terraform provider is) — do not assume familiarity. This applies throughout the deployment-strategy work (`.context/guides/infrastructure-guide/deployment-strategy.md`), where learning the tooling is as much the point as shipping it.
- **Docs + tests are written alongside the feature**, not deferred.
- **Every phase ends with a green Playwright e2e run.** One spec per phase in the `e2e/` workspace, walking that phase's vertical slice against the real backend + Postgres + a browser. `npm run test:e2e` is a required gate — see `.context/roadmap.md` §6. Interactive browser driving mid-session comes from the `@playwright/mcp` server in `.mcp.json`.
- **Ask before assuming.** On any critical/ambiguous decision, check with the user — do not guess.
- **Present issues by severity, then ask how to act on each.** When a review, an investigation or a plan check finds problems, do not fix them one by one in silence. First, report all of them together:
  - **Group and sort them by severity**, most severe first:
    - **Blocker**: it cannot work as written.
    - **Major**: it works, but has a security, data-integrity or data-leak hole.
    - **Moderate**: a wrong assumption with a contained fix.
    - **Minor**: it does not break anything (inconsistencies, wording, polish).
  - **For each issue, explain** what is wrong, where (`file:line` when it applies), and why it matters. Give the facts you verified in the code, not guesses.
  - **Give a suggestion for each issue**, and mark the recommended one.
  - **Ask the user how to direct the effort** on each issue that needs a decision (use the question tool, with the recommended option first). Do not ask about issues that have one obvious fix: apply the suggestion and say so.
  - Only after the user answers, apply the changes. Record each issue and its resolution where the work is tracked (for a plan: a "Review log" table with #, severity, finding and resolution).
- **Friendships, notifications and tag sharing are deferred** (Phases 6 and 7 of `.context/roadmap.md`). The backend social redesign (§8.2/§8.3) was started earlier: its schema and routes exist, but its controllers and tests are not reconciled. Backend tests tied to friendships or `tag_shares` may be removed or left failing until we return to it — "no test there yet" is acceptable.
- **Documentation follows the folder map in `.context/README.md`.** Open work is in `plans/`; when it is done, its lasting rules go into `features/` (a document there starts with a `## Summary`; see `.context/features/README.md`) and a short record goes into `archive/`. Long evidence goes into `research/`; ideas that are not approved work go into `backlog/deferred-ideas.md`. Do not leave a finished plan in `plans/`.
