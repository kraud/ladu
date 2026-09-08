# CLAUDE.md — Ladu (keelapp-v2)

Context for working in this monorepo. Read this first every session. It applies to **both** `backend/` and `frontend/`.

- **Product/domain spec:** `.context/overview.md`
- **Commands, conventions & spec index:** `.context/README.md`

---

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

Supported languages: **EN, ES, DE, EE** (English, Spanish, German, Estonian). A Word needs translations in **≥2 languages**.

---

## 2. What this repo is (and is not)

This is a **from-scratch re-implementation**, not the live app.

- The **old app** (`../keelapp`, a separate repo/Docker stack) stays **live on the real domain** the entire time. It is the *executable specification* — when a doc can't answer "what should happen?", run the old app. We do **not** have its frontend source here on purpose: re-importing it would re-import its mistakes.
- This repo (`keelapp-v2`) is an **npm-workspaces monorepo**: `backend/` (copied from the old repo, then modified) + `frontend/` (clean slate on a new stack). It deploys to a **temporary domain**; the user switches the real domain manually once route-by-route parity is verified.
- The **backend issues were minor** — it is brought over and edited in place. The **frontend is a full rebuild**. ~70–75% of the old frontend (Redux/service boilerplate, 8,700 lines of copy-paste forms, ~100 status-watching `useEffect`s) is *not* meant to survive.

### How we work together (important — the user set these rules)

- **One feature at a time, small vertical slices.** Each slice ends with something runnable.
- **No one-shotting big features.** Prioritise changes the user can *review, understand, and commit* before moving on.
- **Docs + tests are written alongside the feature**, not deferred.
- **Ask before assuming.** On any critical/ambiguous decision, check with the user — do not guess.
- Immediate priority: **Phase 1 (Auth + app shell)**, then Phases 2–3 (words, form engine, Review).
- **Friendships, notifications, tags and tag-sharing are explicitly deferred until after Phases 1–3.** Prior agents started the backend social redesign (§8.2/§8.3): keep its **schema changes**, but its controllers/tests are not to be reconciled now. Backend tests tied to friendship/tag_shares may be removed or left failing for now — "no test there yet" is acceptable until we return to it.
- The user commits the working tree once **Phase 0 is agreed done** — there is one baseline commit to make, not per-change commits yet.
