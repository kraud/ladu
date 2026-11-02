# First-login onboarding

## Summary

A new account opens an empty dictionary, so there is nothing to practise. At the first sign-in, a short full-screen flow asks which level the person has in each language and which topics interest them (at least 4). Ladu then creates 50 to 150 real words, each with its translations and forms, tags them by topic, and opens the dashboard. The person can skip at every step. The owner turns the feature on or off in the admin panel, with no deploy.

Live spec. It replaces the finished plan `onboarding.md` (archive record: `.context/archive/2026-10-onboarding.md`). Built 2026-10-16 to 2026-10-19 (slices 0 to 4, pool refresh). Gate: `e2e/tests/onboarding-gate.spec.ts` (a `-gate` spec: it turns the switch on). The word pool and its decisions: `.context/research/onboarding-word-pool.md`.

Code map: backend `backend/controllers/onboardingController.ts`, `routes/onboardingRoutes.js` (mounted at `/api/onboarding`), `services/onboardingService.ts`, `services/onboarding/` (`select.ts`, `labels.ts`), `lib/onboardingPool.ts`; scripts `backend/scripts/onboarding/` (`pool.tsv`, `pool-forms.json`), `backend/scripts/lexicon/onboarding-pool.ts`, `onboarding-forms.ts`, `onboarding-topics.ts`; frontend `frontend/src/features/onboarding/` (`OnboardingShell`, `OnboardingRail`, `ResultCard`, steps); migration `0031_onboarding_switch.sql` and a status column on `users`.

## 1. Decisions (taken with the user on 2026-10-16, changed 2026-10-19)

| ID | Decision |
|---|---|
| D1 | Topics come from WordNet supersenses (Open English WordNet 2025, CC BY 4.0), not from Wiktionary page topics alone: a supersense belongs to a meaning, a page topic to a whole page. |
| D2 | 15 pickable topics plus a **Core vocabulary** (common verbs, adjectives, adverbs by level) that every onboarding gets. |
| D3 | Clean supersenses map directly. Broad ones (`noun.artifact`, `noun.act`, …) map only through WordNet hypernym anchors. Adjectives and adverbs map through a short allowlist of Wiktionary page topics. The map is code: `onboarding-topics.ts`. |
| D4 | Level is per language, by self-assessment: Beginner (rank 1 to 2,000), Intermediate (2,001 to 6,000), Advanced (6,001 to 15,000). A placement test is a later idea. |
| D5 | Per-language bands, union. Each language takes concepts from its own band; the count is split between languages. A created Word keeps all the user's languages that the hub has. |
| D6 | Skip gives an empty account. It does not clone the demo template. |
| D7 | The flow ends on the dashboard, not in a practice session. |
| D8 | The languages step shows `users.languages` and `nativeLanguage`, already filled in. At least 2. |
| D9 | A concept is used only when the hub has words in at least 2 of the user's languages. No "needs translation" badge and no AI lookup. |
| D10 | The server never reads `word-lists/` (git-ignored). A script builds the committed pool; a human reviews it. Vulgar and offensive senses are removed at pool build, not at lexicon ingest. |
| D11, D12 | Verbs get a topic only through WordNet verb anchors. Only the first WordNet sense of a noun or verb decides its topic. Anchors are checked before direct supersenses; between topics, the order of `TOPICS` decides. |
| D13 | A word is left out when the first normal sense of its first Wiktionary entry is vulgar, offensive, derogatory or a slur, or when it is on a short manual blocklist. |
| D14 | The user picks the word count with a slider from 50 to 150, in steps of 10. A text under it changes above 70 and above 100 words. |
| D15 | At least **4 topics, no maximum** (changed 2026-10-19; first it was 3 to 6). |
| D16, D24 | Fill order: picked topics of the user's band, core of that band, picked topics of the next band up, core of the next band, topics of the band below, core of the band below. Per language, then merged. |
| D17 | Pool file `pool.tsv` (one concept per line). Status `keep`, `check` or `drop`. The generator never overwrites the reviewed file without `--force`. |
| D18, D25 | The slider maximum is the capacity: the server counts what D16 can deliver and rounds **down to a multiple of 10**. Under 50 words, the slider minimum becomes the capacity and a hint explains it. The server accepts any step of 10 up to the capacity (`checkCount`). Chosen over topping up the pool. |
| D19 | Spanish pool words are neutral where possible (Spain and Latin America); else the Spain word. |
| D20 | Forms of every `keep` concept are looked up once on a developer machine and committed as `pool-forms.json`. Onboarding makes no lookups at runtime. A translation is kept only if its lookup found it and it has the key cases. Re-run after every `pool.tsv` edit (Jest fails while they disagree). |
| D21 | New accounts only (email and Google sign-up after the release) get `onboarding_status = 'pending'`. Existing and demo accounts have NULL and never see it. |
| D22 | Core is **20 %** of the count; when the picked topics run out, more core fills the gap. |
| D23 | One **Private** tag per picked topic and one for Core, named in the UI language at creation time (a 4-language name table in the backend). Renamable and deletable like any tag. A name that exists gets "Label (2)". |
| D26 | An admin **Onboarding** on/off switch (`access_settings.onboarding_enabled`, off by default; audit `access.onboarding_configure`). New accounts are `pending` either way; the routes work (else 403 `onboarding_disabled`) only while it is on. It is a rollout switch with no deploy. It also keeps the other e2e specs that register accounts on their path. |
| D27 | Full screen, no app header: logo, a progress line ("Step 2 of 4"; the welcome is not counted), the question, Back and Next, Skip in the corner. |
| D28 | After Create, the dashboard shows a dismissible card: "N words added in M topics", one link per new tag, a "Start practising" link, a close button (stays until closed, per browser). |

## 2. API

All three need a session (`protect`), refuse a demo account (403) and answer 403 `onboarding_disabled` while the switch is off, then **409 `onboarding_not_pending`** when the account is not `pending`. Errors are 400 with a `code`.

| Route | Body | Answer |
|---|---|---|
| `POST /api/onboarding/capacity` | `{ levels, topics }` | 200 `{ capacity }` (multiple of 10, at most 150) |
| `POST /api/onboarding` | `{ levels, topics, count }` | 201 `{ words, tags: [{ id, label, topic, words }] }` |
| `POST /api/onboarding/skip` | none | 200 `{ onboardingStatus: 'skipped' }` |

`levels` has one level for each learning language (account languages minus the native one). `topics` has at least 4 ids. `count` is 10 to 150 in steps of 10 and is checked against the capacity (`count_over_capacity`).

`createOnboarding` runs in one transaction: it locks the user row (`FOR UPDATE`), checks `pending`, creates the tags, the Words (newest first = first chosen), translations (German nouns capitalised as `setWord` does) and cases, inserts in chunks of 5,000 rows (150 words in 4 languages pass Postgres's parameter limit), links the tags, and sets `done`. A double submit gives one 201 and one 409.

Admin: `PUT /api/admin/access/onboarding` `{ enabled, reason? }` (owner, `access.manage`); `GET /api/admin/access` has `onboardingCounts: { pending, done, skipped }` and `GET /api/access` has `onboarding: { enabled }`. The Access page has an Onboarding tab.

## 3. Pool facts that constrain the code

- The pool was refreshed on 2026-10-19: 583 concepts, a concept can have several topics, topic limits as in D15. Details and the applied record: `research/onboarding-word-pool.md`.
- Plural-only English nouns (`pants`, `clothes`, `news`, `data`, `stairs`) have no lexicon noun entry; `onboarding-forms.ts` builds their forms from the word.
- A concept whose topics include `core` counts as core in the 20 % share. Tag word counts count a concept in each of its topics, so their sum can exceed the word count.
- Two concepts with the same words in every language (couch and sofa) are skipped when a Word with those words was already created in the same run.
- Estonian has fewer verbs (the hub covers about 13 % of verbs and 46 % of nouns for the top 5,000 English lemmas), so Estonian learners may get a lower capacity.
- French: the pool has `fr` and `fr_gender` columns (558 of 583 concepts; 25 empty), added by `onboarding-pool.ts --add-french`.

## 4. Traps

- The onboarding e2e spec is a `-gate` spec and changes global state (the switch). It runs last.
- A concept with a repeated English lemma but a different part of speech is a different concept.
- The locale folder for Estonian is `ee`, not `et`.

## 5. Open items

Closed 2026-11-02 (confirmed by the user): the review of the ES, DE and EE topic names and texts, the rollout (switch on per environment), and the "after release" evaluation note (watch how often the capacity is under 150; if small caps are common, top up the pool with a `--top-up` option on `onboarding-pool.ts` instead of the D18 cap). The file `backend/scripts/onboarding/first-review.md` was deleted.

None open.
