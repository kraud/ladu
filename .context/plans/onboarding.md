# Plan: First-login onboarding (topics + level → pre-filled words)

Status: **draft, planned on 2026-10-16.** **Slice 0 done** (word lists with rank, Wiktionary
topics and WordNet supersenses; commits on 2026-10-15/16). **Slice 1 done on 2026-10-16** (topic
map; see "Slice 1 — what was built"). **Slice 2 built on 2026-10-16** (pool generator, parser,
committed `pool.tsv`). **First review pass done by Claude on 2026-10-16** (698 keep, 412 drop;
changes listed in `backend/scripts/onboarding/first-review.md`); **the user's confirmation is
open**. Decisions D1–D19 are confirmed with the user on 2026-10-16 (D11–D13 during Slice 1,
D14–D19 during Slice 2). The second opinion (`onboarding-blueprint-proposal.md`) was reviewed against
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
| D11. Verb topics | Verbs get a topic **only through WordNet verb anchors** (eat, drink, cook, travel, drive, fly, play, compete, dress, wear, buy, sell, pay, work, sleep, heal, rain, feel…). No direct verb supersense: `verb.possession` alone put have/get/take into Work & Money. All other verbs are Core vocabulary. |
| D12. Which sense decides | Only the **first** WordNet sense of a noun or verb decides its topic (a second sense put "person" into Body & Health). Anchors are checked before direct supersenses; between topics, the order of `TOPICS` decides (doctor: Body & Health before Work & Money). |
| D13. Restricted words | A word is left out of onboarding when the **first** normal sense of its first Wiktionary entry is tagged vulgar, offensive, derogatory or slur, or when it is in a short manual blocklist (ass, bitch, dick…: harmless first sense, risky in a starter set). A tag on any sense flagged mother, dog, milk and apple. |
| D14. Word count | The user chooses how many words onboarding creates: a **slider from 50 to 150** in steps, with a short text under it that changes at thresholds (e.g. "Above 100 words, more general vocabulary is added", D16). |
| D15. Topic count | The user picks **3 to 6 topics**. |
| D16. Fill rule | Words come in this order until the count is reached: picked-topic concepts of the user's band → core concepts of that band → picked-topic concepts of the next band up. Per language (D5), then merged. |
| D17. Pool file | `backend/scripts/onboarding/pool.tsv` (TSV, one concept per line; precedent `scripts/demo-template/data.json`; the Docker image already copies `scripts/`). 20 concepts per topic × band, 100 core concepts per band. Status `keep` (used), `check` (the generator found a flag, not used until set to `keep`), `drop`. The generator never overwrites the reviewed file without `--force`. |
| D18. Slider cap | The slider's maximum depends on the pool: for the chosen languages, levels and topics, the server counts the concepts that the fill rule (D16) can deliver and rounds **down to a multiple of 10** (109 → 100). A hint near the slider says "With these levels and topics, we can add up to N words." Chosen over topping up the pool (see "To evaluate after release"). |
| D19. Spanish variety | Pool words are **neutral where possible** (used in Spain and Latin America: automóvil, refrigerador, suéter); where no neutral word exists, the Spain word (ordenador, zumo, pendiente). |
| D10. Pool | The server never reads `word-lists/` (git-ignored, developer machine only). A script builds a committed pool file from the lists; a human reviews it. Vulgar, offensive and derogatory senses are removed when the lists and the pool are built, not at lexicon ingest (autocomplete keeps them). |

### Topics (D2, D3, D11)

The map is code: `backend/scripts/lexicon/onboarding-topics.ts`. This table is a summary.

| Topic | Supersenses (direct, nouns only) | Hypernym anchors (nouns, verbs) / page-topic allowlist (adjectives, adverbs) |
|---|---|---|
| Clothing | — | clothing, footwear, jewelry; v: dress, wear; adj: Clothing |
| Food & Drink | `noun.food` | v: eat, drink, cook; adj: Taste, Drinking |
| Animals | `noun.animal` | |
| Plants & Nature | `noun.plant` | geological formation, body of water, celestial body |
| Weather | — | atmospheric phenomenon; v: rain, snow, precipitate; adj: Temperature, Weather |
| Body & Health | `noun.body` | illness, injury, medicine, medical care, health professional; v: sleep, heal, cure, treat |
| Technology & Media | — | electronic equipment, computer, software, medium, publication |
| Home & Living | — | housing, room, furniture, home appliance, tableware, kitchen utensil, bedding |
| Travel & Transport | — | conveyance, road, travel, city, country; v: travel, drive, fly, ride; adj/adv: Directions |
| Sports & Hobbies | — | sport, game, athlete, musical instrument, music; v: play, compete |
| Work & Money | `noun.possession` | professional, occupation, workplace, money; v: buy, sell, pay, work; adj: Wealth, Occupations |
| Numbers & Measures | — | digit, unit of measurement |
| Time & Calendar | `noun.time` | adj/adv: Time, Days of the week |
| Feelings | `noun.feeling` | v: feel (an emotion); adj: Emotions, Fear, Love, Sadness |
| People & Family | `noun.person` | relative, family; adj: Personality, Appearance |

`noun.location`, `noun.object` and `noun.phenomenon` are anchor-only: as direct groups they held
hell/left/side, must/agent and result/effect. Anchors left out as too noisy: device (guy, gun, key),
worker (captain, general), drug (wine, beer), organization (house, family, party), diversion (show,
doctor), the general "go/move" verb (206 verbs). Colors and sizes have no topic: core vocabulary.

### Level bands (D4)

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
4. **Topics**: a grid of the 15 topics; the user picks 3 to 6 (D15).
5. **How many words**: a slider from 50 to 150 with threshold texts (D14).
6. **Create**: the server picks concepts (D5, D9, D16), creates the Words with all forms and one
   tag per picked topic (+ Core vocabulary), then the app opens the **dashboard** (D7) with a
   short summary ("60 words added in 4 topics").

## Slices (one at a time; each ends with something runnable)

| # | Slice | Ends with |
|---|---|---|
| 0 ✅ | **Word lists.** `backend/scripts/lexicon/word-lists.ts` → `word-lists/en/<pos>.tsv` (lemma, rank, page_topics, sense_domains, supersenses). | Lists rebuilt; coverage measured. |
| 1 ✅ | **Topic map.** A committed map file (supersense → topic, hypernym anchors, adjective/adverb page-topic allowlist). `word-lists.ts` adds a `topic` column and removes vulgar/offensive/derogatory senses. It prints words per topic per band. | Coverage table per topic × band, reviewed with the user. |
| 2 (built, review open) | **Onboarding pool.** A script picks candidate concepts per topic × band (English lemma + part of speech + hub sense), keeps the ones with ≥2 languages in the hub, and writes a committed pool file with attribution. The user reviews and edits it. A Jest test checks the file against the app's enums. | Committed, reviewed pool. |
| 3 | **Backend.** A `users` column for the onboarding state (pending / done / skipped), `POST /api/onboarding` (languages, levels, topics) and skip. It creates the Words, translations, forms and tags through the same services as the app. Excludes demo accounts. | Jest green. |
| 4 | **Frontend.** `/onboarding` flow, first-login redirect, skip, summary on the dashboard. Translated UI strings (EN/ES/DE/EE). | Vitest + Playwright `onboarding.spec.ts` green. |
| later | Placement test (D4); CEFR-J level column; more languages in the hub. | — |

## Open items (decide during the slices)

1. ~~How many topics, how many words~~ — decided 2026-10-16: D14, D15.
2. Which accounts see onboarding: only accounts created after the release, or also existing empty accounts.
3. Tag names: in the UI language of the user at creation time, or fixed per topic.
4. Where signup sets `languages` / `nativeLanguage` today (check in Slice 3), and what OAuth signups have.
5. ~~Pool file location and format~~ — decided 2026-10-16: D17.
6. The slider steps and the threshold texts (D14): fix in Slice 4.
7. What the slider shows when the pool can deliver fewer than 50 words for a choice (D18): fix in Slice 3/4.

## Notes for Slice 3 (from the first pool review)

- Two concepts can have the same words in every language (couch / sofa → el sofá, das Sofa):
  skip a concept whose words equal those of a Word already created in the same run.
- Some nouns are plural with no gender (Leute, vacaciones, celos): the draft lookup must accept an
  empty gender for a noun.
- The capacity count for D18 needs a small route (or a field in the onboarding options answer) that
  applies D5 + D16 to the pool for the current choice.

## To evaluate after release

- **D18 vs. topping up the pool.** Watch how often the cap is below 150 and how users react (for
  example, the maximum count chosen against the maximum offered). If small caps are common or
  confusing, revert D18 and top up the pool instead: a `--top-up` option on `onboarding-pool.ts`
  that appends the next candidates by rank, as `check` lines, to every cell under its target
  (20 keep per topic × band, 100 core per band), followed by a review round.

## Slice 1 — what was built (2026-10-16)

- `backend/scripts/lexicon/onboarding-topics.ts`: the topic map (D2, D3, D11–D13), the level bands
  and `topicFor()`. Unit test: `backend/tests/unit/onboardingTopics.test.js` (15 tests).
- `word-lists.ts` adds the columns `pos_order` (position of the part of speech on the Wiktionary
  page), `restricted` (D13), `given_name` (the page is in a Wiktionary given-name category) and
  `topic`. It reads WordNet first and stops at once if an anchor id is not a sense of its label.
  It writes `word-lists/topic-report.md` (words per topic × band, with examples).
- Known noise, left for the pool review (Slice 2): homographs that took another word's rank
  (stole, entire, doe, glad, mum, won, em; the verb "can" → Food from "to can food"), given names
  (tom, ben, henry, anna), generic `noun.person` words (sir, guy, god). Neither `pos_order` nor
  `given_name` can filter alone: "need"/"use" (verbs) are second on their page; "rose" is a name.
- Beginner band is thin for Technology & Media and Sports & Hobbies (subtitle frequencies).

## Slice 2 — what was built (2026-10-16)

- `backend/scripts/lexicon/onboarding-pool.ts`: reads the word lists, the newest translation file
  and the ES/DE/ET lexicon files; writes `word-lists/pool-candidates.tsv` and, the first time,
  `backend/scripts/onboarding/pool.tsv` (1,110 concepts). Runs in about 2 seconds.
  - Sense: the first Wiktionary sense (entry, then sense order) with a usable ES/DE/ET word.
  - Word per language: the first with only grammar tags; else a regional one (flag
    `<lang>:regional`); never rare, dated, slang, vulgar or dialect words. Gender from the hub.
  - Flags (status `check`): `sense:<e.s>` (not the first sense), `pos_order:<n>`, `given_name`,
    `es:/de:not_in_lexicon` (the draft lookup may still fill it from the library; Estonian is
    filled online by Ekilex, so it is not flagged).
- `backend/lib/onboardingPool.ts`: the columns, statuses, `parsePool()` / `readPool()` (Slice 3 uses them).
- `backend/scripts/onboarding/README.md`: how to review, the columns, the attribution (CC BY-SA 4.0).
- Jest: `tests/unit/onboardingPool.test.js` checks every line of the committed file (status, topic,
  band, part of speech, rank, English + ≥1 other language, gender values, unique ids) and the parser.
- Numbers: Spanish 1,032 / German 1,035 / Estonian 627 of 1,110 concepts; 614 have all three.
  Flags: `pos_order` 262, `de:not_in_lexicon` 81, `es:not_in_lexicon` 76, `sense` 16, regional 3.
  Short cells (fewer than 20 usable concepts): Technology beginner 6, Sports beginner 8, Weather
  intermediate 5, Clothing and Weather beginner 13 — the fill rule (D16) covers them.

## Review log — Slice 2 (2026-10-16)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| S2-1 | Moderate | A user-chosen count up to 150 (D14) cannot be filled from 20 concepts per topic cell when few topics are picked; some cells have fewer than 10. | D16 fill rule (user decision); core cell raised to 100 per band. |
| S2-2 | Moderate | The topic (WordNet first sense) and the translation (Wiktionary first sense) can describe different meanings without any flag: verb "can" is in Food & Drink (WordNet: "to can food") but translates as poder; "tea" translates as "hoja de té" (the leaves). | Human review of `pool.tsv` (D10). No data rule can catch it. |
| S2-3 | Minor | Estonian is present in only 56% of the concepts. | Expected (D9); concepts without Estonian still serve users without Estonian or with 2+ other languages. |
| S2-4 | Moderate | After the first review, some cells are small (Technology beginner 5, Sports beginner 6, Weather intermediate 4): a beginner with Sports + Technology + Weather can get about 109 concepts, less than the slider's 150. | D18: the slider maximum follows the pool (user decision); topping up is recorded under "To evaluate after release". |
| S2-5 | Minor | The first review chose Spain words where Spain and Latin America differ. | D19: neutral where possible, else Spain (user decision); 10 lines changed. |
| S2-6 | Minor | Identical translations in two concepts (couch/sofa); plural nouns with no gender. | "Notes for Slice 3". |

## Review log — Slice 1 (2026-10-16)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| S1-1 | Moderate | The restricted flag on any sense left out 1,377 words (mother, dog, milk, apple); on the first 2 senses it still caught girl and funny. | D13: first sense of the first entry + manual blocklist (451 words left out; a few false positives such as "cancer", "fat" are left for the Slice 2 review). |
| S1-2 | Moderate | A second WordNet sense decided when the first had no topic ("person" → Body & Health). | D12: only the first sense decides. |
| S1-3 | Moderate | Direct verb supersenses put core verbs into topics (have/get/take → Work, go/stop → Travel, need/use → Food, better/face/fire → Sports). | D11: verbs only through anchors (user decision). |
| S1-4 | Moderate | Homographs and given names take high ranks (stole, doe, tom, henry). | `given_name` and `pos_order` columns for the review; Slice 2 human review. |
| S1-5 | Minor | The page topic Hair put the adverb "down" into Body & Health. | Removed from the allowlist. |
| S1-6 | Minor | `noun.location` / `noun.object` / `noun.phenomenon` were noisy as direct groups. | Anchor-only (see the topics table). |

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
