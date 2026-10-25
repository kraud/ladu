# Plan: Conjunctions and prepositions in Ladu (+ a reusable "add a part of speech" guide)

Status: plan agreed on 2026-10-24. Slices 0, 1 and 2 done. Slice 3 next.

## How to start (read this first in a new session)

1. Read `CLAUDE.md` and `.context/README.md`. Follow the working rules: one small slice at a time, a plain-language overview **before** any file change, ask before assuming, docs and tests with the code. The user runs `git commit` themselves. Suggest a commit message after each slice.
2. Read `.context/guides/add-part-of-speech.md`. It is the checklist for this work.
3. Do the slices in order. After each slice: run its checks, tick the **Progress** list with the date, and suggest a commit message.

## Progress

- [x] Slice 0 (2026-10-24) — Docs: the process guide, this plan file, the README index
- [x] Slice 1 (2026-10-25) — Conjunction form (frontend + backend property rules). Open: no browser check yet; the e2e spec in slice 4 covers it
- [x] Slice 2 (2026-10-25) — Preposition form. Open: the user reviews the Estonian case list and the new strings; no browser check yet
- [ ] Slice 3 — Autocomplete (lemma, and the properties that are clear)
- [ ] Slice 4 — e2e spec, snapshot docs, review of ES/DE/EE strings

## Review log

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Moderate | The two search filters in `wordController.ts` skipped only 4 prefixes (`gender`, `gradable`, `reflexiv`, `periphrastic`). The exercise list had 7 and no `reflexiv`. Two lists would drift with each new PoS. | Fixed in slice 1: one exported `PROPERTY_PREFIXES` (`catalogue.ts`), read by `isPropertyCase` and by `writtenFormOnly()` in the controller. |
| 2 | Moderate (behaviour change) | The one list is wider than the old search filters. A word search no longer matches the property values `regularity`, `auxVerb`, `caseType` and `prefix` (for example, searching "haben" no longer finds a verb through its auxiliary). | Accepted: these are properties, not written forms. Tell the user. Covered by the new `words-simple` test for conjunction properties. |
| 4 | Minor | The plan named the Estonian direction cases `latEE` / `ablEE`. The names say little. | Renamed `directionToEE` / `directionFromEE` in slice 2. |
| 5 | Moderate | The Estonian governed-case list (Genitive, Partitive, Elative, Allative, Comitative, Terminative, Abessive) comes from search results (University of Tartu course pages, EKI), not from a full grammar check. A user cannot enter a case that is not in the list. | Open: the user or slice 4 checks the list against the EKI grammar. Adding a value is a one-line change in `configs/prepositions.ts`. |
| 6 | Minor | The completion ring counts every visible non-checkbox field, so the optional position and the case selects raise the ring's denominator (same as the optional conjunction type). | Accepted; same behaviour as the German adverb radio. |
| 3 | Minor | `reflexiv` was missing from the exercise property list. | Added to `PROPERTY_PREFIXES`. |

## Context

`.other/other-words-temp.md` lists words that the form engine cannot store today: 9 conjunctions (weil, wenn, obwohl, sondern, denn, sowohl, weder, weder–noch, entweder–oder) and 4 prepositions (nach, wegen, zufolge, laut). The user wants forms for these two parts of speech (PoS) in EN, ES, DE and EE. Indefinite pronouns are out of scope.

The user also wants a process document, so that the next new PoS (or a new field such as the adverb radio) starts from a checklist and not from scratch.

Facts checked in the code (2026-10-24):
- `PartOfSpeech.preposition` and `.conjunction` already exist (`frontend/src/ts/enums.ts:498-499`), with labels and table abbreviations in all four locales. The /addWord selector shows them as disabled (`PartOfSpeechSelector.tsx:21-26`, `SHIPPED_POS`).
- `words.part_of_speech` is `varchar` (`backend/src/db/schema.ts:367`). **No migration.**
- The form engine already has every field kind we need: `text`, `radio`, `checkbox`, `select`, `multi-select` (with `encode`/`decode`, used by German verb cases `verbs.ts:283-308`), `toggle`, `visibleWhen` (+`invert`), `derivedWhen`, `layout`.
- No exercises exist for adjectives and adverbs either (`catalogue.ts:76-121`). The new PoS follow that: stored, searchable, counted in stats, no exercise yet.

## Research result (with sources)

### Is the "applies to Estonian too" assumption correct?

- **Conjunctions (sidesõnad): yes.** Estonian has coordinating (ja, ning, aga, kuid, ega, või, vaid) and subordinating (et, sest, kuna, kui, kuigi, ehkki, kuni) conjunctions, and correlative pairs (nii … kui ka, ega … ega, kas … või, mitte … vaid). They do not inflect. (EKI teatmik "Sõnaliigid"; UD Estonian SCONJ/CCONJ.) Difference: Estonian has no fixed verb-final rule like German and no mood choice like Spanish.
- **Prepositions: only partly.** Estonian uses **adpositions (kaassõnad)**. Most are **postpositions** (laua all, maja sees, tunni pärast). Prepositions are few (enne, keset, piki, ilma, kuni). Some are both, and then the case changes with the position: *pärast sööki* (prep + partitive) / *kolme tunni pärast* (postp + genitive); also mööda, üle, ümber, läbi. Many spatial adpositions have a **three-form series**: where to / where / where from (*sisse : sees : seest*, *alla : all : alt*, *ette : ees : eest*). (EKI teatmik; Taskutark "Kaassõnad"; EKI käsiraamat.)
- So the PoS stays `Preposition` in the code, but the Estonian label is "Kaassõna" and the Estonian form has a position radio. German also has a few postpositions (zufolge, gegenüber; entlang both), so German gets the same radio.

### Fields per language (recommended)

Common rule: one required text field for the word itself. Multi-word entries are allowed ("because of", "a causa de", "con tal de que").

**Conjunction**

| Field | EN | ES | DE | EE | Kind |
|---|---|---|---|---|---|
| word (`conjunction{L}`) | ✓ | ✓ | ✓ | ✓ | text, required |
| type (`conjunctionType{L}`): Coordinating / Subordinating | ✓ | ✓ | ✓ | ✓ | radio, **optional** (Q2 changed, Q5) |
| paired (`correlative{L}`) | ✓ | ✓ | ✓ | ✓ | checkbox |
| second part (`secondPart{L}`): nor / ni / noch / ega | ✓ | ✓ | ✓ | ✓ | text, visible when paired is on, required then |
| mood (`mood ES`): Indicative / Subjunctive / Depends on meaning | – | ✓ | – | – | select, visible when Subordinating |

Why: German word order follows from the type (subordinating → verb at the end; coordinating → no change; *denn* is coordinating), so DE needs no extra field — the form shows a short hint. Spanish *para que* always takes the subjunctive, *cuando/aunque* depend on meaning, *porque* takes the indicative. EN and EE have no grammatical effect to record.

**Preposition (adposition)**

| Field | EN | ES | DE | EE | Kind |
|---|---|---|---|---|---|
| word (`preposition{L}`) | ✓ | ✓ | ✓ | ✓ | text, required |
| position (`position{L}`): Before the noun / After the noun / Before or after the noun | ✓ | ✓ | ✓ | ✓ | radio, **optional** (Q3: EN "ago", "notwithstanding"; Q6) |
| governed case DE (`governedCaseDE`): Accusative, Dative, Genitive | – | – | ✓ | – | multi-select (two-way = A+D, laut = G+D) |
| governed case EE, before the noun (`governedCasePreEE`) | – | – | – | ✓ | select (Genitive, Partitive, Elative, Comitative, Terminative, Abessive, other) — visible for Before/Both |
| governed case EE, after the noun (`governedCasePostEE`) | – | – | – | ✓ | select, same options — visible for After/Both |
| spatial series EE (`spatialSeriesEE` checkbox + `directionToEE` / `directionFromEE` text): where to / where from | – | – | – | ✓ | checkbox reveals two fields in a row with the main word (sees) in the middle |
| DE contractions: checkbox `contractsDE` ("Contracts with the article") reveals `withDemDE` (zum, im, am, vom, beim), `withDerDE` (zur), `withDasDE` (ins, ans, aufs) | – | – | ✓ | – | checkbox + 3 optional text fields in one row (Q3) |

EN and ES prepositions do not govern a case on the noun (ES *a+el = al*, *de+el = del* is a general rule, not per word). ES needs no extra field.

## Decisions from the user (2026-10-24)

- **Q1.** Paired conjunctions: a "Paired" checkbox reveals a required "second part" field ("weder" + "noch").
- **Q2.** ~~The conjunction type radio is required in all four languages.~~ **Changed 2026-10-25 (Q5):** the type radio is optional. Learners often do not know the type. A re-click clears it.
- **Q3.** Preposition extras: the EE spatial series, the DE article contractions, and the position radio in **all four** languages.
- **Q5 (2026-10-25).** Conjunction layout, in all four languages: the word and the second part share row 1; the type radio and the "Paired" checkbox share row 2; the Spanish mood select has row 3. The mood still shows only for "Subordinating". Done in `configs/conjunctions.ts` (grid `layout`: rows `word`, `meta`, `mood`; columns `first`, `second`). The error key `typeRequired` became `typeInvalid`.
- **Q6 (2026-10-25).** The preposition position radio is optional in all four languages (same reason as Q5). The Estonian case selects show unless the position rules them out, so they stay usable while the position is empty.
- **Q7 (2026-10-25).** Form engine: `optionsLayout` (`row` or `column`) on radio and multi-select fields, and `layout.fitRow` for a row that stays one row on a phone. German preposition: the contractions box and its three forms (one row) sit under the word; position and cases follow, listed in a column. Estonian: the series box and the two direction forms (50-50) sit under the word; then position and the case selects.
- **Q4.** Scope: slices 0–4 (guide, two forms, autocomplete, e2e). Exercises, onboarding pool and demo template are deferred.

Open, to confirm in the slice overview (not blocking): ES *al/del* is the only Spanish contraction; no field (a general rule). Contraction fields are written forms, not properties — only `contracts*` goes to `PROPERTY_PREFIXES`.

## Approach

### Slices (one at a time; each ends runnable, tested, with a suggested commit message)

**Slice 0 — Docs first: the process guide and the plan file.**
- New `.context/guides/add-part-of-speech.md`: the reusable checklist (see "Process guide" below).
- New `.context/plans/conjunctions-prepositions.md`: this plan, with Progress list, decisions Q1…, review log table (same shape as `adverb-gradable-radio.md`).
- Add both to the spec index in `.context/README.md`.

**Slice 1 — Conjunction form (frontend + backend property rules).**
- `frontend/src/ts/enums.ts`: new `ConjunctionCases` enum (`<role><LANG>` naming, like `AdverbCases:44-74`). Add it to `CaseName` (`configs/types.ts:4`) and the five hand-written unions in `ts/interfaces.ts`.
- New `configs/conjunctions.ts` + test, built like `configs/adverbs.ts` (helpers `labelKey`, `errorKey`, one builder per language). Register in `configs/index.ts` (`getFormConfig`) and `configs/coverage.ts` (`ALL_POS`, `CONFIGS_BY_POS:23-24`).
- Ship the PoS: `PartOfSpeechSelector.tsx` `SHIPPED_POS`, `review/FilterBar.tsx:26-32`, `metrics/selectors.ts:26-32` `CREATABLE_POS`, `chartColors.ts:11-16`, `practice/params.ts:17-22` (selectable, no exercises — reuse `onlyPartsWithoutExercises`), `StartFromWord.tsx:42` only when autocomplete exists.
- Locales (4 files): `wordForm.conjunction.{fields,errors.form{EN,ES,DE,EE}}`, real copy for `partOfSpeechSelector.description.conjunction`, `practice.json:83,89` wording.
- Backend: `wordController.ts:127-219` `getRequiredFieldsData` (primary case per language); `lib/wordSort.ts:26-29`; `services/exercises/validate.ts:10` + `types.ts:10`.
- Property cases: **refactor once** so one list rules everything — export `PROPERTY_PREFIXES` from `services/exercises/catalogue.ts:124` and build the `not ilike` filters in `wordController.ts:412-424` and `:1059-1082` from it. Add `conjunctionType`, `correlative`, `mood`. Regression test: `secondPart*` is a written form, `conjunctionType*` is a property.
- Tests: config field lists, live show/hide (paired → second part; subordinating → ES mood), required checks, a backend round trip of a "weder – noch" word. Update `PartOfSpeechSelector.test.tsx:19`, `completion.test.ts:48-53`, `coverage.test.ts`.

**Slice 2 — Preposition form.** Same pattern with `PrepositionCases` and `configs/prepositions.ts`. German `governedCase` reuses the `multi-select` + `encode`/`decode` of `verbs.ts:283-308`. Position radio in all four languages. EE position drives the two case selects; EE spatial checkbox reveals the row (`layout`, like the EE adverb degree row). DE contractions checkbox reveals the three-field row. Property prefixes: `position`, `governedCase`, `spatialSeries`, `contracts`. Check that `withDem*`, `direction*` start with no property prefix (done; `positiveEN` is not a property either, covered by a test). Estonian PoS label "Kaassõna" in `ee/common.json`.

**Slice 3 — Autocomplete (lemma only + a few properties).** Lexicon has lemmas only (`autocomplete-coverage-report.md:334-369`: DE 99 prep / 67 conj, EN 143/70, ES 39/32).
- `scripts/lexicon/ingest.ts:31-34,137`: selectors for `prep`/`conj` in `selectors/{en,es,de}.ts`, add to `keepLemmaOnly`. `registry.ts:39-71`: lexicon adapters. `lib/lexicon/translations.ts:13` `TRANSLATION_POS` + `prep`/`conj` so "Start from a word" works; `services/dictionary/translate.ts:31`.
- **Research (user, 2026-10-25): can the data fill the conjunction type?** Check the lexicon data of each language (kaikki tags/categories for EN, ES, DE; Ekilex for EE: look for `coordinating` / `subordinating` or the Estonian terms `rinnastav` / `alistav` in tags, senses or categories). Fill the radio only when the data says it clearly. Leave it empty otherwise (a missing value is not proof; see the adverb plan, Q2).
- **Research (user, 2026-10-25): can the data fill the "Paired" checkbox and the second part?** Check whether paired entries always have a separator between the two parts in the headword or the translation: a slash "/", an ellipsis "…" or "...", or a hyphen as in "weder-noch" in `.other/other-words-temp.md`. If the pattern is reliable, the autocomplete sets `correlative` and splits the entry into the word and `secondPart`. Count the real entries per language first (how many have the separator, how many false hits) and write the result in this plan before coding.
- German governed case from kaikki tags/senses ("with dative") — verify in the data first; fill only when the tag is clear.
- Estonian via Ekilex (`services/dictionary/eki.ts:242-251`): verify the Ekilex PoS codes for conjunction / pre- / postposition before coding; fill the position radio from them. Update `tests/dictionary.test.js:301` (`ja` is no longer "not found" for Conjunction).
- `AUTOCOMPLETE_REGISTRY` (`autocomplete/transforms.ts:35-68`), `StartFromWord.tsx:42`.

**Slice 4 — e2e + string review.** One spec `e2e/tests/conjunctions-prepositions.spec.ts`: add "weder – noch / neither – nor / ni – ni / ega – ega", add "wegen / because of / a causa de / pärast", check the hidden/visible fields, check the word in `/words`. `npm run test:e2e` green. Update `.context/.frontend/snapshot/data-model.md` and a new `snapshot/forms-conjunctions-prepositions.md`. The user reviews ES/DE/EE strings.

Out of scope (recorded in the plan as deferred): exercises for these PoS, onboarding pool (WordNet has no conj/prep, `word-lists.ts:47`), demo template, indefinite pronouns.

### Process guide — `.context/guides/add-part-of-speech.md`

Content (STE100 style):
1. **Research template** per language: what does the word change in the sentence (case, word order, mood)? Does it inflect? Paired forms? Position? Sources to use (EKI, Duden, RAE, Wiktionary) and to avoid (AI learning sites).
2. **Decide the fields**: rules — one required text field for the word; a property is a radio/select/checkbox; a dependent field uses `visibleWhen`; a derived field uses `derivedWhen` + `store`; ask the user about every required radio (it changes completion of old words).
3. **Naming rules**: `<role><LANG>`; a property case name must start with a prefix in `PROPERTY_PREFIXES`; a written-form case name must not start with one (startsWith trap: `prefix…`).
4. **Touchpoint checklist** (frontend, backend, lexicon, locales, docs, tests, e2e) — the file lists from this plan, with what to change.
5. **What needs no change** (DB varchar, metrics, tags, admin) so nobody searches again.
6. **Rollout reminders** (lexicon reload per env, demo reseed).
Also link it from `CLAUDE.md` working rules? — no: link from `.context/README.md` only.

## Verification

- Frontend: `npm test -w frontend` and the typecheck/build (`npm run build`).
- Backend: `npm test` (catalogue property test, word round trip, dictionary). Tests use `require('./request')`.
- Manual: `npm run dev`, add each test word from `.other/other-words-temp.md` on `/addWord`.
- e2e: `npm run test:e2e`; before it, no orphan backend on :5001 and no closed access gate.
- Do not pipe test commands through `tail`/`head`.

## Deferred ideas (another PR, not this one; agreed with the user 2026-10-25)

- **Modal verbs.** The verb forms store modal verbs (German können, müssen, dürfen, sollen, wollen, mögen; English can, must, should, may) as ordinary verbs. They have no modal marker (checked 2026-10-25). Idea: a "Modal verb" checkbox on the verb forms (a stored property, so it needs a `PROPERTY_PREFIXES` entry), and fields for what the form cannot say today: German takes a bare infinitive and uses the double infinitive in the perfect ("ich habe gehen können"); English modals are defective (no infinitive, no "-s", missing tenses). Check Estonian (võima, tohtima, pidama, saama, tahtma) in the EKI grammar first. Also: **pre-add the modal verbs** to the account of a user who uses German or English, like the onboarding pool does (`.context/plans/onboarding.md`). Needs its own plan: research per language, field decisions, pool content.

## Before merge

- Reload the EN/ES/DE lexicon per environment after slice 3 (same reminder as the adverb plan).
