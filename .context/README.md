# Reference

Commands, conventions, and reference material moved out of `CLAUDE.md` (which keeps the product intro and repo/working rules). Start with `CLAUDE.md` for "read this first" context; `.context/overview.md` is the product/domain spec.

---

## Folders of `.context/`

A piece of work starts in `plans/`. When it is done, its lasting rules go into `features/`, a short record goes into `archive/`, and the plan file is removed.

| Folder | Purpose | A file enters when… | A file leaves when… |
|---|---|---|---|
| root (`README.md`, `overview.md`, `roadmap.md`) | The index (commands, conventions, one table of every live file), the product and domain spec, and the roadmap of the rebuild. | It is the map, the product spec or the roadmap. | Never. The README changes whenever a file moves. |
| `features/` | One live spec for each finished feature area: invariants, API and schema contracts, numbered decisions (with the rejected option), known defects, open items. Code cites these files. The word forms (`word-forms/`) are a sub-folder. The format is in `features/README.md`. | A feature is built and its plan is folded in. | The feature is removed. A spec changes together with the code. |
| `plans/` | Work that is **not finished**: in progress, or planned and approved. Only this. | Work is agreed. | It is done: fold into `features/`, write a record, delete the plan. |
| `archive/` | The history of finished plans, 30 lines or fewer each: status, PRs, decisions kept, plan versus built, traps, and the `git log` line. Not a source of current truth. See `archive/README.md`. | A plan is finished and folded. | Never edited after that. |
| `research/` | Long evidence kept **whole**: measurements, studies, decision Q&A, build records, review sheets. Other documents or code cite them. `social-old-app/` holds the old social behaviour for the deferred phases. `deferred-ideas.md` holds ideas that are not plans yet. | A document is mostly analysis, and a 30-line record would lose data. | Its inputs change (re-run it), or its feature closes. |
| `guides/` | Procedures and rules to follow: add a language, add a part of speech, the layout rules of `frontend/src/`, and the operator manual (`infrastructure-guide/`) with the deployment build log. | It is a checklist or a how-to, not the spec of one feature. | The process changes. |
| `design/` | The design system: principles, colour, type, layout, components, icons, motion, plus the mood board and screenshots. The authority for how the UI looks (the code wins on a conflict). | It describes look and feel. | The design changes. |

**Where does a new file go?**

1. Is the work still open? → `plans/`.
2. Is it the lasting rules of something built? → `features/` (or `design/` if it is about look).
3. Is it a procedure? → `guides/`.
4. Is it evidence or analysis that is too long for a record? → `research/`.
5. Is it the history of a finished plan? → `archive/`, 30 lines.

An idea that is not approved work goes into `research/deferred-ideas.md`, not into `plans/`.

---

## Commands

```bash
npm run docker:up            # local Postgres (keelapp_dev + keelapp_test)
npm run db:migrate           # apply Drizzle migrations to dev DB
npm run db:migrate:test      # apply to test DB
npm run dev                  # backend (:5001) + frontend (Vite) concurrently
npm run dev:admin            # backend (:5001) + admin UI (Vite, :5174) — staff tool, .context/features/admin.md
npm test -w admin            # admin Vitest
npm test                     # backend Jest suite (workspace: backend)
npm test -w frontend         # frontend Vitest
npm run build                # frontend production build
npm run db:studio            # Drizzle Studio

npm run e2e:install          # one-time: download Chromium for Playwright
npm run test:e2e             # full-stack Playwright e2e suite (own ports :5101/:5273/:5274 and own database keelapp_e2e: npm run dev can keep running)
                             # specs named *-gate.spec.ts change the access gates (global state): they run last, each in its own project, one after the other
npm run test:e2e:headed      # same, in a visible browser window
```

**e2e prerequisites:** `docker:up` + the repo-root `.env` plus `e2e:install` once. The run creates and
migrates its own database `keelapp_e2e`. Details: [`e2e/README.md`](../e2e/README.md).

---

---

## Conventions

- **Commits/PRs:** commit or push only when the user asks; the user creates branches and runs `git commit` (Claude drafts the message). End a commit message with the attribution line that Claude Code gives for the session (the form is `Co-Authored-By: Claude <noreply@anthropic.com>`; do not add a session URL). PR descriptions end with: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- Code follows English naming. Strict TS both tiers. No `@ts-ignore`, no non-null assertions in the frontend.
- When a spec is unclear, run the old app or ask — don't invent behaviour.
- Keep `CLAUDE.md` current when architecture decisions or phase status change.
- **Every phase ends with a green Playwright e2e run** covering that phase's vertical slice — a required gate, not optional polish. One spec per phase (`e2e/tests/phase-N-*.spec.ts`), written alongside the feature like the unit tests. MSW/Vitest proves flows in isolation; the e2e suite proves the real backend + Postgres + browser work together. See `.context/roadmap.md` §6.
- **Documentation:** every `.md` change follows the folder map below. A plan that is done is folded into `features/` and archived (see `archive/README.md`); do not leave a finished plan in `plans/`.

---

## Where the specs live

> **How to read the specs:** `features/` and `design/` describe what is built, `plans/` what is still open, and `research/` holds evidence and the old-app reference for the deferred social phases.

### Product and roadmap

| Path | What it is | Authority |
|------|-----------|-----------|
| `.context/overview.md` | Product/domain spec, feature requirements, workflows | **Authoritative** |
| `.context/roadmap.md` | **The roadmap of the rebuild** (its old name was new-repo-build-plan): phases 0 to 8 with their status, architecture decisions, invariants, the testing strategy, risks, the deferred social design and the Phase 8 deltas annex. Phases 6 to 8 are open. | **Authoritative** |

### Features (`features/`)

| Path | What it is | Authority |
|------|-----------|-----------|
| `.context/features/README.md` | The rules for a feature document: a `## Summary` first (2 to 4 sentences), then the header line, the code map, and the body in a fixed order. | **Authoritative for the format** |
| `.context/features/access-control.md` | **Access gates**: closed, open or limited registration and login, an invite list, an allowed-accounts list, translated banners, and a "sign everyone out" panic button. It also holds the **request-access flow** (`/request`, a request list, Approve and Remove, a team email). Built and merged 2026-10-01 (PRs #63 to #65). | **Authoritative for access gates** |
| `.context/features/admin.md` | **The admin dashboard ("Ladu Admin")**: staff accounts and roles, user list and actions (ban, delete, restore, purge, force logout, emails), health page, staff and audit log, overview statistics, and account badges with reserved names. Built 2026-09-30 to 2026-10-07; all parts merged and rolled out. Known defects and open items are in its §6 and §7. | **Authoritative for the admin area** |
| `.context/features/adverb-gradability.md` | **Adverb gradability**: the required Gradable / Non-gradable radio in every language, the "more / most", "más", "kõige", "plus" boxes that fill and lock the degree fields, and the autocomplete and pool rules. Built 2026-10-24. Open: a review of the new ES/DE/EE strings and of 10 pool entries. | **Authoritative for adverb degrees** |
| `.context/features/auth-and-shell.md` | **Auth and app shell**: register, verify, login, reset, the session store, `ProtectedRoute`, the shell, profile editing. Built 2026-09-08 to 2026-09-10. | **Authoritative for auth and the shell** |
| `.context/features/autocomplete.md` | **Autocomplete and "Start from a word"**: the dictionary routes, the lexicon tables, the Estonian adapter, the fill rules and the draft. The research, evidence and decisions D1 to D34 are in `research/autocomplete-data-source-strategy.md` (kept whole). Built 2026-09-25 to 2026-10-24. | **Authoritative for autocomplete** |
| `.context/features/captcha.md` | **Captcha (Cloudflare Turnstile)** on the demo, registration, password reset and access request; the admin switch; the keys; the outage rule. Built 2026-10-19 (PR #95). | **Authoritative for the captcha** |
| `.context/features/conjunctions-prepositions.md` | **Conjunctions and prepositions**: forms in EN, ES, DE and EE (type, pairs, position, governed case), the Estonian Ekilex adapter, the lexicon data, 13 findings. Built 2026-10-24 to 2026-10-25 (PR #109). The checklist is `guides/add-part-of-speech.md`. | **Authoritative for conjunctions and prepositions** |
| `.context/features/dashboard.md` | **Dashboard and user metrics**: stat cards, hand-rolled charts, unpracticed-words coverage. Built 2026-09-16, changed 2026-10-23. | **Authoritative for the dashboard** |
| `.context/features/demo.md` | **Demo access**: "Try the demo" makes a throw-away account with sample data, limited in time, words and tags, deleted on expiry; the admin Demo tab, statistics and the template. Built 2026-10-15 (PR #89). The template is still a placeholder set. | **Authoritative for the demo** |
| `.context/features/french.md` | **French, the fifth language**: interface and learnable language, forms for all six parts of speech, Wiktionary autocomplete, onboarding pool and demo. Built 2026-10-25 to 2026-10-26 (PR #110). The review sheets for the French teacher are in `research/language-french-review.md` and `research/language-french-strings.md`. Open: V10 (`plans/french-pronominal-type-ahead.md`). | **Authoritative for French** |
| `.context/features/landing-and-legal.md` | **Landing site and legal pages**: Terms, Privacy, Impressum, Credits, the Markdown blog, the registration consent note, third-party notices. Built 2026-10-06. The licence study is in `research/licence-study.md`. | **Authoritative for the landing site** |
| `.context/features/oauth-login-strategy.md` | **Sign in with Google** (OIDC with PKCE, state tokens, linking, the stub issuer for tests). Done 2026-09-24. Code cites its phases and section names. | **Authoritative for OAuth sign-in** |
| `.context/features/onboarding.md` | **First-login onboarding**: a full-screen flow (levels, at least 4 topics, 50 to 150 words) that creates tagged words with their forms; the admin switch; the API; the pool rules. Built 2026-10-16 to 2026-10-19 (PR #94). The pool decisions are in `research/onboarding-word-pool.md`. | **Authoritative for onboarding** |
| `.context/features/practice.md` | **Practice (exercises and performance)**: Part A is the knowledge base (parameters, exercise catalogue, answer checking, knowledge math, known defects); Part B the decisions and the architecture; Part C the functional requirements of the process. Section numbers are cited by code. Built 2026-09-29 to 2026-09-30. The slices are in `research/practice-build-record.md`. | **Authoritative for practice** |
| `.context/features/saved-practice.md` | **Saved practice**: saved configurations (named settings, words or tags) and saved sessions (leave and resume), private to the owner. Built 2026-09-30, extended 2026-10-04 and 2026-10-11. | **Authoritative for saved practice** |
| `.context/features/tags.md` | **Tags**: the resource API, follow, clone, link and unlink, `TagSummary`, the `/tags` and `/tag/$tagId` pages, the word-editor tags section. Built 2026-09-27 to 2026-09-28. Tag sharing UI is deferred. | **Authoritative for tags** |
| `.context/features/theme-and-language.md` | **Light and dark theme**, the `?lng=&theme=` handoff from the landing page, the login carry-over. Built 2026-09-25 to 2026-09-26. | **Authoritative for the theme** |
| `.context/features/word-form-engine.md` | **Word form engine, word pages and the Review table**: configs, `FieldConfig`, the observable contract, the decisions D1 to D44 with their status. Built 2026-09-10 to 2026-09-15. | **Authoritative for the form engine** |
| `.context/features/word-forms/data-model.md` | Enums and interfaces (a transcription of `ts/enums.ts` and `ts/interfaces.ts`) with per-form notes. Still edited when a language or field is added. | **Live spec** |
| `.context/features/word-forms/forms-adjectives-adverbs.md`, `forms-conjunctions-prepositions.md`, `forms-french.md` | Field lists, yup rules and field order of those forms. The last two describe v2 only. Form tests and the add-language guide cite them. | **Live spec** |
| `.context/features/word-forms/forms-nouns.md`, `forms-verbs.md` | Field lists and yup rules of the old noun and verb forms. `nouns.test.ts` and `verbs.test.ts` use them as the oracle for old behaviour. | **Test oracle. Stop date:** the Phase 8 cutover |
| `.context/.frontend/` (removed 2026-11-02) | The folder was dissolved. `frontend-structure.md` went to `guides/`, the word-form files to `features/word-forms/`, the social files to `research/social-old-app/`. `pages-word-flow.md` and `ui/00-global.md` were removed (old React and Redux code; their rules are in the code, `features/` and the annex of the roadmap). Earlier removals: `ui/01` to `ui/05`, `pages-auth-shell`, `pages-review-practice`, `exercise-flow`, `review-table`, `general-use-functions`, `word-cases-data`, `autocomplete`. Read the old text with `git log -- <path>`. | **Removed** |
| `.context/features/words-list.md` | **The word tables `/words` and `/tag/$tagId`**: numbered pagination (offset mode on `GET /api/words/simple`), selection across pages, the Owner filter, action bar rules, row click, view-only words of followed tags, single-word clone, the no-duplicates rule, and saved practice lists. Built 2026-10-12 to 2026-10-14 (PR #87). | **Authoritative for the word tables** |

### Guides (`guides/`)

| Path | What it is | Authority |
|------|-----------|-----------|
| `.context/guides/add-language.md` | **Checklist for adding a language** to Ladu: decisions to take, research template per part of speech, naming rules, every file to touch by tier (backend, frontend, forms, lexicon, onboarding, landing page), what needs no change, rollout. Built slice by slice while French is added; items marked `(unverified)` are not confirmed yet. Read it before any new-language plan. | **Authoritative for the process** |
| `.context/guides/add-part-of-speech.md` | **Checklist for adding a part of speech** (or a new field group) to Ladu: research template, field rules, naming rules, every file to touch, what needs no change, rollout reminders. Read it before any new-PoS plan. | **Authoritative for the process** |
| `.context/guides/frontend-structure.md` | The rules for the layout of `frontend/src/`: decisions D1 to D5, the principles, the shape of a feature folder, the conventions. The directory tree of the first proposal was removed (the code is the truth). | **Authoritative for FE file structure** |
| `.context/guides/infrastructure-guide/` | Operator's manual (9 files): architecture, environments and databases, development workflow, dashboards, troubleshooting, secrets, glossary, and the build log `deployment-strategy.md` (Phases 0 to E, all done). Moved here from `.dev-context/` on 2026-11-01. | **Authoritative for operations** |

### Design (`design/`)

| Path | What it is | Authority |
|------|-----------|-----------|
| `.context/design/README.md` | **Design system and mood board** (2026-10-29): principles, colour tokens, typography, layout, component patterns, icons, motion and states, an agent checklist, and `mood-board.html` with real screenshots in `assets/`. Read it before you build or change any UI. | **Authoritative for UI look** (the code wins on a conflict; then fix the document) |

### Plans in flight (`plans/`)

| Path | What it is | Authority |
|------|-----------|-----------|
| `.context/plans/french-pronominal-type-ahead.md` | Fix plan V10: the French type-ahead does not offer "se laver". Written 2026-10-27, not built. | **Planned** |
| `.context/plans/manual-production-release.md` | Manual production releases (tags, GitHub Releases, approval gate). Research done 2026-10-12; not started. | **Working record** |

### Research (`research/`)

| Path | What it is | Authority |
|------|-----------|-----------|
| `.context/research/autocomplete-coverage-report.md` | Slice 0 research for autocomplete (2026-10-08): go for DE, ES and EN; go with an online fallback for EE. | **Done** (research report, kept whole: other docs quote its figures) |
| `.context/research/deferred-ideas.md` | **Deferred ideas**: ideas that are not plans yet, each with why and what to investigate first (modal verbs, browse all words, lawyer check, header search, placement test, and more). Add an idea here; move it to `plans/` when it is ready. | **Working record** |
| `.context/research/social-old-app/pages-social-account.md`, `social-endpoints.md`, `social-screens.md` | Old Account, notification, friend and tag-share behaviour; the social routes (today and in the old app); the redesigned social screens. Input for Phases 6 and 7. | **Reference for the deferred social phases. Stop date:** when the social phases ship |
| `.context/research/french-lexicon-coverage.md` | Coverage research of the French lexicon (slice 8, 2026-10-26): fill rates per part of speech, the shape of a French entry, translations, size. | **Done** (research report) |
| `.context/research/language-french-review.md`, `language-french-strings.md` | The two review sheets for the French teacher (word forms and practice; interface strings). The teacher reviews them later; each answer is a small follow-up. | **Working record** (until the review) |
| `.context/research/licence-study.md` | **Licence study** (2026-10-06): can Ladu go online, what changes with a paid tier, a table per dependency (licence, use, duty, risk), actions A1 to A6, questions for a lawyer, and how to re-run it (§8). Code, the landing Terms page and the build scripts cite it. | **Done** (research report; re-run when dependencies change) |
| `.context/research/onboarding-word-pool.md` | **Onboarding word pool**: the analysis, the 32 questions with the user's answers, the German, Spanish and Estonian value decisions, the senses, and "Applied in code" (2026-10-19). Merged from three files. The applied pool is `backend/scripts/onboarding/pool.tsv`. | **Working record** (until the onboarding feature closes) |
| `.context/research/practice-build-record.md` | The slices (with their "as built" notes), the file list and the verification of the Phase 5 plan. Code comments that cite "Slice 3" or "Slice 9" of practice mean this file. | **Done** (build record) |

### Outside `.context/` (git-ignored, local only)

| Path | What it is | Authority |
|------|-----------|-----------|
| `MOCKUPS/` | HTML/CSS mockups of the first design pass (`index.html`, `auth/`, `word-editor.html`, `review.html`, `assets/`) and `DESIGN-HANDOFF.md`. **Not tracked by git** (`.gitignore`), so they exist only on the machine that has them. Many code comments cite them as the origin of a design. | **Historical visual reference.** `design/` and the code win on a conflict |
| `word-lists/` | Ranked English word lists with WordNet supersenses, the input of the onboarding pool generator (`new-onboarding-values.md`, `pool-candidates.tsv`, `topic-report.md`). **Not tracked by git.** The server never reads it. | **Local input** (the committed result is `backend/scripts/onboarding/pool.tsv`) |

---

## Target stack

### Frontend (`frontend/`) — clean slate
Vite 5 · React 18 · **TypeScript 5 strict** (`noImplicitAny`, `noUnusedLocals/Parameters` already on; `@ts-ignore` and non-null assertions `!` are banned) · Tailwind v4 (`@tailwindcss/vite`) + shadcn/Base UI + Phosphor icons · **TanStack Query v5** (all server state) · **TanStack Router** (typed routes) · **Zustand** (session + `selectedPoS` + UI state only) · react-hook-form + yup · @tanstack/react-table · @dnd-kit · i18next (locale JSONs copied verbatim) · react-toastify · axios (one client, request interceptor, 401→logout — no refresh endpoint exists) · react-error-boundary per route · Vitest + MSW (unit + flow tests) · Dashboard charts are hand-rolled inline SVG, no chart library (`c3`/`d3` were installed unused and dropped in Phase 3.5).

### Backend (`backend/`) — copied + modified
Node/Express (`.js` routes) → **TypeScript controllers loaded via `tsx`** · **Drizzle ORM on PostgreSQL** (`backend/src/db/schema.ts` is the source of truth) · JWT auth (`protect` middleware) · bcryptjs · Nodemailer · Jest + ts-jest + supertest (integration tests import `require('./request')`, never `supertest` directly: it keeps one server per test file — a server per request cycles macOS's ephemeral ports and causes random `socket hang up` failures in full runs) · drizzle-kit for migrations. Local DB via Docker Compose (Postgres 15: `keelapp_dev`, `keelapp_test`).

### e2e (`e2e/`) — full-stack tests
Third npm workspace (alongside `backend/`, `frontend/`). **Playwright** (`@playwright/test`) drives Chromium against the *real* backend + frontend dev server on their own ports (:5101, :5273) and their own database (`keelapp_e2e`) — `webServer` in `e2e/playwright.config.ts` boots them (`e2e/fixtures/env.ts` holds the values). One spec per phase (`e2e/tests/phase-N-*.spec.ts`); green run is a required per-phase gate (build plan §5/§6). Kept out of the `frontend` workspace so Playwright's Node config + browser binaries never touch the Vite build or FE dep tree. Interactive browser driving during a session comes from the `@playwright/mcp` server registered in `.mcp.json`. CI job deferred — local gate for now.

---

---

## Frontend invariants (enforce from commit one)

1. **No server state outside TanStack Query.** No loading/success/error status booleans anywhere — mutations expose `isPending / isError / data` + `onSuccess / onError`. Every cross-cutting flow becomes mutation callbacks + cache-invalidation edges, never chained `useEffect` flag machines.
2. **One invalidation graph**, declared in `frontend/src/app/query-client.ts` and extended per phase.
3. **Config-driven form engine.** One renderer + per-PoS/language configs. Noun & Verb configs derive from the `WordCasesData` registry (`frontend/src/ts/wordCasesDataByPoS.ts`); Adjective & Adverb are enum-driven fixed schemas (`AdjectiveCases`/`AdverbCases` in `features/word-forms/data-model.md`). Field lists + yup rules + order per form: `features/word-forms/forms-{nouns,verbs,adjectives-adverbs}.md`. `ts/enums.ts` + `ts/interfaces.ts` are ported verbatim. The 15 hand-rolled forms of the old app (about 8,700 lines) became configs of about 2,000 lines.
4. **`<ProtectedRoute>` from the first commit.** The old app leaves Practice, Account, NotificationHub, DisplayTag unguarded — fix that immediately, don't reproduce it.
5. **URL is state** (Review filters live in `searchParams`), **stable-id row selection** (never index), stable React keys everywhere, session persisted via Zustand `persist` with a guarded parse (no raw `JSON.parse(localStorage['user'])`).
6. Strict TS; zero non-null assertions (lint rule); `react-error-boundary` per route.

---

---

## Backend copy rules and the §8 deficiency fixes

**Copy rules:** keep TS controllers/routes/Drizzle schema/Jest tests; **drop every legacy Mongoose `.js` controller/model** (deleted). Apply §8.5 hygiene (CORS allowlist via `CORS_ORIGIN` — done in `app.js`; stable error codes instead of leaking `err.stack`).

**`id` only — `_id` is a MongoDB artifact (standing rule; `.context/roadmap.md` §4).** The Drizzle/Postgres schema has no `_id` column; every `_id` in a response is a hand-written alias kept for the *old* frontend, which runs against its own separate backend — nothing here needs it. New FE code and types use `id` exclusively (no `_id`, no `raw.id ?? raw._id` fallback). Backend `_id` aliases are stripped **per-slice, by whatever slice touches that controller/serializer** (responses + test assertions), not in one refactor; the affected docs are corrected in the same slice.

**TODO routes:** **delete** `GET /api/words/getAllWordDataByWord` (no consumer). (`GET /api/tags/filterTags` — along with the rest of the legacy tag route surface — was itself deleted in Phase 4's tag-API rebuild; see `features/tags.md`.)

**§8 redesigns land in the phase that consumes them, one at a time.** State on 2026-11-02:

| Fix | What | State |
|-----|------|-------|
| §8.1 Notifications | Keep polling but make it visibility-aware; `?unreadOnly=&since=`; a display-only inbox; notification rows created server-side in the same transaction as the domain action. | Not built (Phase 6). Design: `roadmap.md`, "Design for the deferred social phases". |
| §8.2 Friendships | `friendships` with `requesterId`, `addresseeId`, a `status` enum, partial-unique indexes, one action per endpoint, a decline action. | Schema and routes exist; controllers, tests and frontend are not reconciled (Phase 6). |
| §8.3 Tag share and clone | `tag_shares`, share, accept and decline endpoints; a transactional clone that keeps translations and cases; `canViewTag`; `createTag` sets `authorId`; `visibility` enum. | The authorisation, the transactional clone and the enum are built (`features/tags.md`). The share flow: schema and routes exist, no frontend (Phase 7). |
| §8.4 Pagination | `GET /api/words/simple` has a cursor mode and an offset mode, the `owner` filter, and the no-duplicates rule; `GET /api/words/:id` has an ownership check and `myCloneId`; `POST /api/words/:id/clone`. | Built. The contract is `features/words-list.md` §2. |


---

## Domain model cheat-sheet

```
Word (partOfSpeech: Noun | Verb | Adjective | Adverb | Conjunction | Preposition; tags; clue; isCloned/originalCreator)
  └── Translation  (one per Lang: EN | ES | DE | EE | FR)
        └── Case    (WordItem: caseName → value string; valid caseNames per PoS×Lang defined by enums)
```

- **Word rules:** ≥2 language translations always; `partOfSpeech` is immutable after creation; users edit/delete only words they authored; words from *followed* tags are read-only (a single word can be cloned into an own copy).
- **Tags:** `label` + `description` + `visibility` (`Private` / `Friends-Only` / `Public`; the UI offers Private and Public). **Follow** = words appear read-only in your list/practice. **Clone** = independent editable copies.
- **Exercises:** two entry modes (pre-selected words from the table, or random/automated). Card types: Text Input, Multiple Choice, Mixed. Multi-language (prompt in A → answer in B) or single-language (grammatical prompt → answer in same language). Options: target languages, PoS filter, exclude native language, adaptive (forgetting-curve) vs random ordering, MC distractor levels 0–3, text-input strictness levels. Per-answer feedback + last-4-attempts indicator; manual `master` / `revise` overrides. Performance stored per translation-case.
- Full details: `features/word-forms/data-model.md`, `frontend/src/ts/wordCasesDataByPoS.ts`, `features/practice.md` Part A, `features/word-form-engine.md`, `features/autocomplete.md`.

---

## Phased roadmap (`.context/roadmap.md` §5 and §9)

| # | Phase | State |
|---|-------|-------|
| 0 to 5.5 | Scaffold, auth and shell, word form engine, autocomplete and Review, dashboard, dark mode, tags, practice, saved practice | ✅ done (2026-09-10 to 2026-09-30) |
| D | Deployment pipeline (staging and production) | ✅ done |
| O | OAuth login (Google) | ✅ done |
| — | Built after the roadmap: admin dashboard, access gates and request access, account badges, word tables, onboarding, demo, captcha, French, conjunctions and prepositions, adverb gradability, landing and legal pages | ✅ done (see the table above) |
| 6 | Social: friendships + notifications + users | open |
| 7 | Tag shares + Account + polish | open |
| 8 | Route-parity checklist + intentional-deltas annex + manual cutover | open |
