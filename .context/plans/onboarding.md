# Plan: First-login onboarding (topics + level → pre-filled words)

Status: **draft, planned on 2026-10-16.** **Slice 0 done** (word lists with rank, Wiktionary
topics and WordNet supersenses; commits on 2026-10-15/16). Decisions D1–D10 are confirmed with the
user on 2026-10-16. The second opinion (`onboarding-blueprint-proposal.md`) was reviewed against
the data and the code; the findings and their resolutions are in "Review log (2026-10-16)" at the end.

## What this is (plain-language overview)

A new user opens an empty dictionary. There is nothing to practise, so the first minutes do not
show what Ladu can do. Onboarding fixes that. At the first login, a short flow asks three things:
which languages the user manages, their level in each language, and which topics interest them.
Ladu then creates a small set of real Words (each one concept, with its translations and full
grammar in the user's languages), tags them by topic, and opens the dashboard. The user can skip
the flow and start with an empty account.

The words come from data we already have: the autocomplete lexicon (forms) and the translation
hub (`lexeme_translations`, English as the internal key). A script on a developer machine builds a
small, **committed** and human-reviewed "onboarding pool" of concepts, each with a topic and a
frequency band. The server only reads that pool.

## Goal

- A new user can go from first login to a dashboard with useful, tagged words in under a minute.
- The flow is skippable at every step (design rules 1 and 2).
- All languages are equal (rule 4): English is only an internal key, never shown as "primary".
- Every created Word is a normal Word: editable, practisable, counted in the statistics (rule 6).

## Decisions (made with the user on 2026-10-16)

| # | Decision |
|---|---|
| D1. Topic source | WordNet supersenses (Open English WordNet 2025, CC BY 4.0), not Wiktionary page topics alone: supersenses belong to a meaning, page topics to a whole page. |
| D2. Topic list | 15 user-pickable topics (below) + a non-pickable **Core vocabulary** (common verbs, adjectives, adverbs by level) that every onboarding gets. |
| D3. Mapping method | Clean supersenses map directly. Broad supersenses (`noun.artifact`, `noun.act`, `noun.group`, `noun.communication`, `noun.cognition`, `noun.state`) only map through **WordNet hypernym anchors** (the word's main sense is under a fixed synset, e.g. `clothing`, `vehicle`). Adjectives and adverbs map through a short **allowlist of Wiktionary page topics** (Taste, Temperature, Weather, Time, Colors…). Everything else gets no topic. |
| D4. Level | Per language. **Self-assessment only in v1**: Beginner / Intermediate / Advanced, mapped to frequency-rank bands. The placement test is a later slice (it needs its own item bank and endpoint; the exercise engine works on the user's stored words only). |
| D5. Level → concepts | **Per-language bands, union.** Each language takes concepts from its own band; the word count is split between the languages. Every created Word still gets all of the user's languages that the hub has. |
| D6. Skip | Skip gives an **empty account** and opens the dashboard. It does **not** clone the demo template. |
| D7. End of the flow | The flow ends on the **dashboard**, not in a practice session. |
| D8. Languages step | Shows `users.languages` and `users.nativeLanguage` (`backend/src/db/schema.ts:173`, `:179`) already filled in; the user confirms or changes them. No new language concept. |
| D9. Translation gaps | A concept is only used when the hub has words in **at least 2** of the user's languages; concepts with all of them come first. There is no "needs translation" badge and no community/AI lookup. |
| D10. Pool | The server never reads `word-lists/` (git-ignored, developer machine only). A script builds a committed pool file from the lists; a human reviews it. Vulgar, offensive and derogatory senses are removed when the lists and the pool are built, not at lexicon ingest (autocomplete keeps them). |

### Topics (D2, D3)

| Topic | Supersenses (direct) | Hypernym anchors / page-topic allowlist (draft, fixed in Slice 1) |
|---|---|---|
| Food & Drink | `noun.food`, `verb.consumption` | adj: Taste, Smell |
| Animals | `noun.animal` | |
| Plants & Nature | `noun.plant`, `noun.object` | landforms; adj: Colors |
| Weather | `noun.phenomenon`, `verb.weather` | adj: Weather, Temperature |
| Body & Health | `noun.body`, `verb.body` | illness, medicine, health professional |
| People & Family | `noun.person` | relative, kin; `noun.group`: family |
| Feelings | `noun.feeling`, `verb.emotion` | adj: Emotions |
| Time & Calendar | `noun.time` | adv/adj: Time |
| Home & Living | — | furniture, room, building, household appliance, container, kitchen utensil |
| Clothing | — | clothing, garment, footwear, jewelry |
| Travel & Transport | `noun.location`, `verb.motion` | vehicle, conveyance, way/road, travel |
| Technology & Media | — | device, electronic equipment, computer, communication medium, publication |
| Work & Money | `noun.possession`, `verb.possession` | occupation, worker, organization, money |
| Sports & Hobbies | `verb.competition` | sport, game, musical instrument, music |
| Numbers & Measures | `noun.quantity` | unit of measurement, number |

`noun.person` and `noun.location` hold some generic words ("guy", "place", "side"); the review in
Slice 2 removes them from the pool.

### Level bands (D4, draft — tuned in Slice 2 with the coverage report)

| Level | Frequency rank |
|---|---|
| Beginner | 1–2,000 |
| Intermediate | 2,001–6,000 |
| Advanced | 6,001–15,000 |

Limits: the rank comes from film subtitles and belongs to the spelling, not the part of speech
(noun "can" gets rank 34 from the modal verb). The pool review removes such words.

## Data facts that shape the design (measured 2026-10-15/16)

- `word-lists/en/`: nouns 20,510, verbs 7,150, adjectives 8,390, adverbs 1,348 (ranked lemmas only).
- Supersense coverage in the top 5,000 ranks: nouns 87%, verbs 82%. The words without one are
  mostly junk (pronouns, fillers, inflected forms), so "has a supersense" is a filter.
- Adjectives and adverbs only get generic supersenses (`adj.all`, `adj.pert`, `adv.all`).
- WordNet sense order is by corpus frequency; the first sense is not always the everyday one
  (bank #1 = river bank). The lists keep the first 3 senses' supersenses.
- Translation hub coverage, top 5,000 English lemmas (`backend/scripts/lexicon/.data/measure-translations.md`):
  ES/DE ≈ 57% of verbs and 70% of nouns; **ET 12.7% of verbs, 46.2% of nouns**. Users with
  Estonian will get fewer verbs (D9).
- Level: no open source has CEFR levels. Candidate for later: CEFR-J (English A1–B2; licence to
  confirm on cefr-j.org).

## User flow (v1)

1. **First login** of an account that has not done onboarding → `/onboarding`. Every step has
   **Skip** (D6) → empty account → dashboard.
2. **Languages**: the account's languages and native language, filled in (D8). At least 2.
3. **Level**: one Beginner / Intermediate / Advanced choice per language (D4).
4. **Topics**: a grid of the 15 topics; the user picks some (the number is fixed in the plan
   review, see "Open items").
5. **Create**: the server picks concepts (D5, D9), creates the Words with all forms and one tag
   per picked topic (+ Core vocabulary), then the app opens the **dashboard** (D7) with a short
   summary ("24 words added in 3 topics").

## Slices (one at a time; each ends with something runnable)

| # | Slice | Ends with |
|---|---|---|
| 0 ✅ | **Word lists.** `backend/scripts/lexicon/word-lists.ts` → `word-lists/en/<pos>.tsv` (lemma, rank, page_topics, sense_domains, supersenses). | Lists rebuilt; coverage measured. |
| 1 | **Topic map.** A committed map file (supersense → topic, hypernym anchors, adjective/adverb page-topic allowlist). `word-lists.ts` adds a `topic` column and removes vulgar/offensive/derogatory senses. It prints words per topic per band. | Coverage table per topic × band, reviewed with the user. |
| 2 | **Onboarding pool.** A script picks candidate concepts per topic × band (English lemma + part of speech + hub sense), keeps the ones with ≥2 languages in the hub, and writes a committed pool file with attribution. The user reviews and edits it. A Jest test checks the file against the app's enums. | Committed, reviewed pool. |
| 3 | **Backend.** A `users` column for the onboarding state (pending / done / skipped), `POST /api/onboarding` (languages, levels, topics) and skip. It creates the Words, translations, forms and tags through the same services as the app. Excludes demo accounts. | Jest green. |
| 4 | **Frontend.** `/onboarding` flow, first-login redirect, skip, summary on the dashboard. Translated UI strings (EN/ES/DE/EE). | Vitest + Playwright `onboarding.spec.ts` green. |
| later | Placement test (D4); CEFR-J level column; more languages in the hub. | — |

## Open items (decide during the slices)

1. How many topics can the user pick, and how many words onboarding creates in total (the demo uses 30).
2. Which accounts see onboarding: only accounts created after the release, or also existing empty accounts.
3. Tag names: in the UI language of the user at creation time, or fixed per topic.
4. Where signup sets `languages` / `nativeLanguage` today (check in Slice 3), and what OAuth signups have.
5. Pool file location and format (precedent: `backend/scripts/demo-template/data.json`, checked by Jest).

## Review log (2026-10-16)

Review of `onboarding-blueprint-proposal.md` (second opinion) against the data and the code.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| B1 | Blocker | The server reads `word-lists/en/` at runtime (proposal §2 step 5). The folder is git-ignored and exists only on a developer machine. | D10: a committed, reviewed pool file; the server reads only that. |
| B2 | Blocker | `noun.weather` does not exist. Weather nouns (rain, snow, wind, storm, sun, cloud) are `noun.phenomenon`; only `verb.weather` exists. | Weather = `noun.phenomenon` + `verb.weather` + adjective page topics Weather/Temperature. |
| M1 | Moderate | Skip clones the demo template. | D6: skip gives an empty account (user decision). |
| M2 | Moderate | The flow ends in a practice session. | D7: it ends on the dashboard (user decision). |
| M3 | Moderate | Level is per language, but a Word is one concept for all languages; the proposal does not say which level picks the concepts. | D5: per-language bands, union. |
| M4 | Moderate | The placement test "uses the existing exercise engine", but the engine works on the user's stored words and performance; a new user has none. | D4: self-assessment only in v1; the test is a later slice with its own item bank. |
| M5 | Moderate | A new language step duplicates `users.languages` / `users.nativeLanguage`. | D8: the step shows them filled in. |
| M6 | Moderate | Translation gaps are larger than assumed (ET: 12.7% of top verbs); the "Needs Translation" badge and community/AI lookup do not exist; a Word needs ≥2 languages. | D9: only concepts with ≥2 of the user's languages; full coverage first. |
| M7 | Moderate | Noisy topic groups: `noun.person` unmapped; `noun.location` under Nature; `noun.state` under Health; `noun.cognition` under Emotions; `noun.communication` + `noun.act` and `noun.group` + `verb.social` as grab-bags; `daily_actions` / `descriptors` / `science_ideas` are not interests; adjective/adverb topics had no WordNet source. | D2/D3: merged list of 15 topics + Core vocabulary; broad supersenses only via hypernym anchors; adjectives/adverbs via a page-topic allowlist. |
| m1 | Minor | Filtering vulgar words "during ingestion" would also remove them from autocomplete. | D10: filter only when building the lists and the pool. |
| m2 | Minor | `noun.tops` is spelled `noun.Tops`. | Not used (dropped with `science_ideas`). |
| m3 | Minor | The number of created words is not given. | Open item 1. |
