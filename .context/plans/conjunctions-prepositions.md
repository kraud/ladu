# Plan: Conjunctions and prepositions in Ladu (+ a reusable "add a part of speech" guide)

Status: plan agreed on 2026-10-24. All slices done (2026-10-25). Open: the user's review of the strings (see "Open at the end"), review-log items #5, #7 and #8, and the per-environment reload ("Rollout runbook").

## How to start (read this first in a new session)

1. Read `CLAUDE.md` and `.context/README.md`. Follow the working rules: one small slice at a time, a plain-language overview **before** any file change, ask before assuming, docs and tests with the code. The user runs `git commit` themselves. Suggest a commit message after each slice.
2. Read `.context/guides/add-part-of-speech.md`. It is the checklist for this work.
3. Do the slices in order. After each slice: run its checks, tick the **Progress** list with the date, and suggest a commit message.

## Progress

- [x] Slice 0 (2026-10-24) — Docs: the process guide, this plan file, the README index
- [x] Slice 1 (2026-10-25) — Conjunction form (frontend + backend property rules). Open: no browser check yet; the e2e spec in slice 4 covers it
- [x] Slice 2 (2026-10-25) — Preposition form. Open: the user reviews the Estonian case list and the new strings; no browser check yet
- [x] Slice 3 research (2026-10-25) — see "Slice 3 research results"; decisions Q8–Q10
- [x] Slice 3a (2026-10-25) — Estonian: Ekilex adapter for Conjunction and Preposition (word, position, governed case). Open: the Estonian e2e stub gets `kuigi` and `pärast` in slice 4
- [x] Slice 3b (2026-10-25) — DE/EN/ES lexicon: `extract.ts` keeps categories, selectors for `conj`/`prep`/`postp`, `prep` + `postp` merged into one row, re-extracted, re-ingested, re-loaded locally. Staging and production still need the reload (see "Rollout runbook")
- [x] Slice 3c (2026-10-25) — Translations (`conj`/`prep`/`postp` in the translation file: 483 conjunction and 1,190 preposition rows), the translate/senses/sense/draft routes, the "Start from a word" part-of-speech list, and a pair split for ellipsis words. Staging and production need the translation file loaded too (see "Rollout runbook")
- [x] Slice 4 (2026-10-25) — e2e spec `autocomplete-i-conjunctions-prepositions.spec.ts` (6 tests), the Ekilex stub words, snapshot docs (`forms-conjunctions-prepositions.md`, `data-model.md`), the string table. Full `npm run test:e2e`: 168 passed, 0 failed. Open: the user reviews `conjunctions-prepositions-strings.md`

## Review log

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Moderate | The two search filters in `wordController.ts` skipped only 4 prefixes (`gender`, `gradable`, `reflexiv`, `periphrastic`). The exercise list had 7 and no `reflexiv`. Two lists would drift with each new PoS. | Fixed in slice 1: one exported `PROPERTY_PREFIXES` (`catalogue.ts`), read by `isPropertyCase` and by `writtenFormOnly()` in the controller. |
| 2 | Moderate (behaviour change) | The one list is wider than the old search filters. A word search no longer matches the property values `regularity`, `auxVerb`, `caseType` and `prefix` (for example, searching "haben" no longer finds a verb through its auxiliary). | Accepted: these are properties, not written forms. Tell the user. Covered by the new `words-simple` test for conjunction properties. |
| 4 | Minor | The plan named the Estonian direction cases `latEE` / `ablEE`. The names say little. | Renamed `directionToEE` / `directionFromEE` in slice 2. |
| 5 | Moderate | The Estonian governed-case list (Genitive, Partitive, Elative, Allative, Comitative, Terminative, Abessive) comes from search results (University of Tartu course pages, EKI), not from a full grammar check. A user cannot enter a case that is not in the list. | Open: the user or slice 4 checks the list against the EKI grammar. Adding a value is a one-line change in `configs/prepositions.ts`. |
| 6 | Minor | The completion ring counts every visible non-checkbox field, so the optional position and the case selects raise the ring's denominator (same as the optional conjunction type). | Accepted; same behaviour as the German adverb radio. |
| 7 | Moderate | A live check of the 3a adapter (2026-10-25) shows a lexeme that carries both codes (`postp` + `prep`) and one government gives the same case to both positions. "peale" returns Genitive before and after the noun, but the grammar has the partitive before the noun ("peale sööki") and the genitive after it ("laua peale"). Wiktionary lists the two as separate entries (peale: prep partitive, postp elative; the elative there is also doubtful). "üle" has the same shape. | Accepted for 3a: a wrong case before the noun is a suggestion the user can change, and the rule is documented in `eki.ts`. Better data needs a second source. Review with the user; a possible fix is to drop the case for a both-codes lexeme and fill it only from single-position lexemes. |
| 8 | Minor | Two Ekilex government values have no option in the Estonian case select: adessive ("millel") and ablative ("millelt"), plus the nominative ("mis"). They fill nothing. | Open: add Adessive and Ablative to `CASE_OPTIONS_EE` if the user wants them (one line each, plus the mapping in `eki.ts`). |
| 9 | Moderate (fixed in slice 3b, test in `AutocompleteRow.test.tsx`) | `applyLookup` applied radios first, so the fields a radio shows were filled in the same pass, but a checkbox that shows fields ("Paired" shows the second part; "Contracts with the article" shows the three forms) was applied in field order. The hidden field was skipped, and the lookup filled the box but not the field. | Checkboxes that other fields depend on (`visibleWhen`) are now applied first, like the radios (`lookedUpToggles`). |
| 10 | Minor | "weil" carries both a coordinating and a subordinating category (the second is for an obsolete sense), so it gets no type. The most common German conjunction stays empty. | Accepted (Q8: fill only when the data is clear). A curated list would fix it; the user declined it in Q8. |
| 11 | Minor | The EN lexicon holds noise entries that Wiktionary lists as conjunction or preposition ("an", "de"). They are real Wiktionary entries and a lookup needs the exact word, so they do no harm, but the type-ahead may show them. | Checked in slice 3c: the word type-ahead orders by frequency, so common words come first; the noise shows at low ranks. One visible case: English "an" as a conjunction (rank 81, Wiktionary lists it as dialect "if"). Accepted. The sense type-ahead reads the translation table, which has no such noise. |
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
- **Q8 (2026-10-25).** Conjunction type from the data: fill only when Wiktionary marks it (category or sense tag). No curated list, no guess.
- **Q9 (2026-10-25).** Pairs: fill "Paired" and "Second part" only from a headword with an ellipsis ("sowohl ... als auch", "neither … nor"). A slash is not a pair marker.
- **Q10 (2026-10-25).** Slice 3 is split: 3a Estonian (Ekilex), 3b DE/EN/ES lexicon, 3c translations and "Start from a word".
- **Q11 (2026-10-25).** The translation table writes a pair with an ellipsis ("weder … noch"), but the lexicon stores "weder" alone. A conjunction lookup that finds nothing, for a text that is a pair, is split by rule (first part, "Paired", second part) and answers `partial`. Same marker as Q9; it applies to typed text and to draft picks, in all four languages (`withPairSplit` in `registry.ts`).
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
- e2e: `npm run test:e2e` (own ports and own database since 2026-10-26; see `e2e/README.md`).
- Do not pipe test commands through `tail`/`head`.

## Slice 3 research results (2026-10-25)

Method: one pass over the raw Wiktionary dump (`raw-wiktextract-data.jsonl.gz`, `conj`, `prep`, `postp`, `prep_phrase`, `circumpos` entries of de/en/es/et, with the categories, tags and header templates that `extract.ts` drops), plus a read-only probe of Ekilex for six Estonian words. "Frequent" means the lemma is in the first 5,000 lines of the frequency list of its language.

**Entries in the dump**

| | conj | prep | postp |
|---|---|---|---|
| DE | 117 | 189 | 19 |
| EN | 380 | 882 | 3 |
| ES | 172 | 263 | – |
| ET (Wiktionary) | 21 | 16 | 56 |

**1. Conjunction type (coordinating / subordinating): the data rarely says it.** Wiktionary marks it through a category ("German subordinating conjunctions") or a sense tag. Marked among the frequent conjunctions: DE 20 of 56, EN 20 of 65, ES 1 of 28, ET 0 of 19. The marked ones are right, but common words are missing: DE obwohl, denn, weder, während, nachdem; ES porque, aunque, pero, y. Ekilex has no sub-type for `konj` either. A missing marker is not proof of anything. Result: a fill from the data would be correct but sparse (about a third in DE and EN, almost none in ES and ET).

**2. Paired conjunctions: the user's idea works only for the ellipsis, and only for 5 entries.**
- A headword with an ellipsis ("…" or "...") is a reliable pair: DE "sowohl ... als auch"; EN "neither … nor", "either … or", "both … and", "not only … but also". ES and ET have none.
- A slash is **not** a pair marker. The slash entries are alternative writings: "and/or", "y/o", "und/oder", "b/c".
- The usual way Wiktionary stores a pair is the first word alone, with the partner only in the gloss text: DE weder "neither (only with noch)", entweder "either (only with oder)", ES tanto "both ... and (introduces the first of two linked elements)", EN neither "Not either (used with nor)". The gloss wording is free text, so a parser would be brittle.
- Result: fill "Paired" and "Second part" only from an ellipsis headword. Everything else stays manual.

**3. German governed case: reliable.** 173 of 189 DE prepositions carry a category "German prepositions governing the dative / accusative / genitive". Among the 55 frequent ones, 50 are marked. Unmarked: in, auf (two-way prepositions, which is a known gap), ob and abbreviations. Both cases show as two categories (an, unter, vor = accusative + dative). Note: `wegen`, `trotz`, `während` come as genitive + dative, which matches the usage but is wider than a textbook "genitive". EN and ES prepositions govern no case.

**4. Position.** Wiktionary lists German adpositions under `prep`, `postp` or both: 175 prep only, 8 postp only, 11 both (nach, über, gegenüber, entlang, gemäß, zufolge ...). Both = "Before or after the noun" (this fits the user's example "nach"). EN has 3 postpositions (ago, apart, notwithstanding-type words). ES has none.

**5. Estonian: Ekilex is much better than Wiktionary.**
- Wiktionary (`et`) states the case only in 16 of 72 adposition entries ("Governs the genitive"), and misses common words (pärast, eest, jaoks, kohta).
- Ekilex word details give `pos` codes `konj`, `prep`, `postp`, and a `governments` list per lexeme with a question word: "mille" / "kelle/mille" = genitive, "mida" / "keda/mida" = partitive (other question words stand for the other cases).
- Probe: pärast = postp "mille" + prep "keda/mida"; enne = prep "mida"; üle = prep "mille" + postp "mille"; sest, kuigi, ega = `konj` with no sub-type. This reproduces the textbook rule (pärast sööki, partitive, before the noun; kolme tunni pärast, genitive, after it) and fills both Estonian case selects and the position.

**What this means for the build**

| Field | DE | EN | ES | ET |
|---|---|---|---|---|
| word (lemma) | yes | yes | yes | yes (Ekilex `konj`/`prep`/`postp`) |
| position | yes (prep / postp) | yes (3 words) | – | yes (Ekilex pos) |
| governed case | yes (categories) | – | – | yes (Ekilex governments) |
| conjunction type | sparse (about a third) | sparse (about a third) | almost none | none |
| paired + second part | ellipsis headwords only | ellipsis headwords only | – | – |
| mood (ES) | – | – | none in the data | – |

**Cost.** `extract.ts` must keep `categories` for these parts of speech (a re-extract of the 3 GB dump, about 2 minutes, then re-ingest and re-load per language). Estonian needs a live Ekilex adapter (no file). The translation file needs the `conj` and `prep` entries so "Start from a word" works.

## Open at the end (2026-10-25)

- [ ] The user reviews the ES, DE and EE strings: `conjunctions-prepositions-strings.md` (one table, all four languages side by side).
- [ ] Review-log #5: check the Estonian case list against the EKI grammar. #7: decide whether a lexeme with both codes (`prep` + `postp`) keeps its case for both positions ("peale"). #8: add Adessive and Ablative to the Estonian case select, or not.
- [x] After the last merge to main (PR #109): reload the EN/ES/DE lexicon and the translation file per environment (see "Rollout runbook"). Done by the user with Ansible: staging, checked, then production, checked. Safety copy `/opt/ladu/lexicon.before-conj-prep` made first; every load and every count matched.
- [x] Delete the safety copy on the VPS a few days after production works (runbook step 6). Done 2026-10-25.

## Deferred ideas (another PR, not this one; agreed with the user 2026-10-25)

- **Modal verbs.** The verb forms store modal verbs (German können, müssen, dürfen, sollen, wollen, mögen; English can, must, should, may) as ordinary verbs. They have no modal marker (checked 2026-10-25). Idea: a "Modal verb" checkbox on the verb forms (a stored property, so it needs a `PROPERTY_PREFIXES` entry), and fields for what the form cannot say today: German takes a bare infinitive and uses the double infinitive in the perfect ("ich habe gehen können"); English modals are defective (no infinitive, no "-s", missing tenses). Check Estonian (võima, tohtima, pidama, saama, tahtma) in the EKI grammar first. Also: **pre-add the modal verbs** to the account of a user who uses German or English, like the onboarding pool does (`.context/plans/onboarding.md`). Needs its own plan: research per language, field decisions, pool content.

## Rollout runbook (reload of the reference data; written 2026-10-25)

**Status: done (staging and production), with the checks of steps 4 and 5 passed. Step 6 (delete the safety copy) is done too, 2026-10-25.**

**What and why.** The conjunction and preposition rows (DE, EN, ES), the translation rows for both parts of speech, and the adverb values of the adverb plan exist only in the local database. Staging and production get them only through `deploy/ansible/lexicon.yml`. The data is reference data (tables `lexemes` and `lexeme_translations`); no user data changes. Estonian needs no reload (the Eesthetic file did not change, and Ekilex is live).

**When.** Once, right after the LAST merge of this branch to `main` has reached staging and production (the merge deploys both by itself, guide 03). Not before: the translation rows list conjunctions and prepositions under "Any type", and the old backend answers 400 when a user picks one. After the merge and before the reload, the lookups say "Sorry, we don't know this word" for the new parts of speech, which is harmless. If a later feature of the branch changes a selector, `extract.ts` or the translation rows, rebuild first (below).

**1. Rebuild, only if a lexicon-related file changed after 2026-10-25** (from `backend/`):

```bash
npx tsx scripts/lexicon/extract.ts                 # only if extract.ts changed (about 2 minutes)
npx tsx scripts/lexicon/ingest.ts de && npx tsx scripts/lexicon/ingest.ts es && npx tsx scripts/lexicon/ingest.ts en
npx tsx scripts/lexicon/ingest-translations.ts
```

Files built on 2026-10-25 are ready in `backend/scripts/lexicon/.data/out/`: `lexicon-{de,es,en}-2026-10-03.jsonl.gz` (3.5, 3.3, 13.2 MB) and `translations-en-2026-10-03.jsonl.gz` (5.7 MB). The date in the name is the Wiktionary dump date, so the names do not change.

**2. Safety copy on the VPS (optional).** The copy overwrites the files of the same name in `/opt/ladu/lexicon/`, which a database restore reloads. The new files are a superset, so a restore still works, but the old content is gone. To keep it: `cp -a /opt/ladu/lexicon /opt/ladu/lexicon.before-conj-prep` on the VPS.

**3. Staging first** (from `deploy/ansible/`; one command per file; each copies the file, then runs `load.js` in `backend-staging` in one transaction):

```bash
ansible-playbook lexicon.yml -e lexicon_file=../../backend/scripts/lexicon/.data/out/lexicon-de-2026-10-03.jsonl.gz -e '{"lexicon_environments": ["staging"]}'
ansible-playbook lexicon.yml -e lexicon_file=../../backend/scripts/lexicon/.data/out/lexicon-es-2026-10-03.jsonl.gz -e '{"lexicon_environments": ["staging"]}'
ansible-playbook lexicon.yml -e lexicon_file=../../backend/scripts/lexicon/.data/out/lexicon-en-2026-10-03.jsonl.gz -e '{"lexicon_environments": ["staging"]}'
ansible-playbook lexicon.yml -e lexicon_file=../../backend/scripts/lexicon/.data/out/translations-en-2026-10-03.jsonl.gz -e '{"lexicon_environments": ["staging"]}'
```

**4. Check staging** (SQL shell as in guide 02, "Check what is loaded"):

```sql
SELECT language, part_of_speech, count(*) FROM lexemes
 WHERE part_of_speech IN ('Conjunction', 'Preposition') GROUP BY 1, 2 ORDER BY 1, 2;
SELECT part_of_speech, count(*) FROM lexeme_translations
 WHERE part_of_speech IN ('Conjunction', 'Preposition') GROUP BY 1;
```

Expected (the 2026-10-25 build): German 117 conjunctions and 194 prepositions; Spanish 169 and 261; English 375 and 880; translations 483 conjunction rows and 1,190 preposition rows. Then, at `staging.ladu.com.ar`, try the examples: `nach`, `wegen`, `sowohl ... als auch`, `weil` (no type), `weder … noch` (partial), English `because` and `neither … nor`, Spanish `para que`, and Estonian `pärast` (Ekilex, needs no load). In "Start from a word", pick Conjunction and type `because`. Also check an adverb: German `oft` (Gradable, from the adverb plan).

**5. Production**: the same four commands with `-e '{"lexicon_environments": ["prod"]}'` (or without the restriction, which loads staging again and then prod). Repeat the SQL and one or two lookups on `ladu.com.ar`.

**6. Delete the safety copy, a few days after production works** (it is about 26 MB and nothing deletes it by itself):

```bash
ansible vps -b -m ansible.builtin.file -a "path=/opt/ladu/lexicon.before-conj-prep state=absent"   # from deploy/ansible/
```

The safety copy in step 2 is made with `ansible vps -b -m ansible.builtin.command -a "cp -a /opt/ladu/lexicon /opt/ladu/lexicon.before-conj-prep creates=/opt/ladu/lexicon.before-conj-prep"`.

**Cautions.** A load replaces a language (a translation load replaces all translations) in one transaction: a failed load changes nothing, and the old rows stay. Space: a reload keeps the old rows until autovacuum frees them (guide 02). The whole reload is the same for the adverb plan: its first reload step is done by this run.

**Separate, from the adverb plan (done 2026-10-25):** the demo template was reseeded per environment with `seed-demo-template.js --reset`. Not part of this runbook.

