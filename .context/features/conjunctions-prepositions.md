# Conjunctions and prepositions

## Summary

A learner can store conjunctions (weil, because, porque, sest) and prepositions or postpositions (nach, wegen, laua peal) as words, in English, Spanish, German and Estonian (French was added later, see `features/french.md`). The forms ask only for what the grammar of each language needs: the type and pairs of a conjunction, the position and the governed case of a preposition. Autocomplete fills what the data states reliably. The work also produced the checklist for adding any new part of speech.

Live spec. It replaces a finished plan (archive record: `.context/archive/2026-10-conjunctions-prepositions.md`). Built 2026-10-24 to 2026-10-25 (slices 0 to 4), merged as PR #109; the reference data was reloaded on staging and production. Gate: `e2e/tests/autocomplete-i-conjunctions-prepositions.spec.ts` (6 tests). The checklist: `.context/guides/add-part-of-speech.md`. Field lists and rules: `.context/features/word-forms/forms-conjunctions-prepositions.md`.

Code map: form configs `frontend/src/features/words/form-engine/configs/conjunctions.ts` and `prepositions.ts`; `PROPERTY_PREFIXES` in `backend/services/exercises/catalogue.ts`; lexicon selectors `backend/lib/lexicon/selectors/{de,en,es}.ts` (`conj`, `prep`, `postp`; `prep` and `postp` are merged into one row); the Estonian adapter in `backend/services/dictionary/eki.ts`; the translation file with `conj` and `prep` entries; `extract.ts` keeps categories for these parts of speech. No migration (`words.part_of_speech` is `varchar`).

## 1. Decisions (taken with the user on 2026-10-24 and 2026-10-25)

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

## 2. Fields per language

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

## 3. Findings and decisions

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Moderate | The two search filters in `wordController.ts` skipped only 4 prefixes (`gender`, `gradable`, `reflexiv`, `periphrastic`). The exercise list had 7 and no `reflexiv`. Two lists would drift with each new PoS. | Fixed in slice 1: one exported `PROPERTY_PREFIXES` (`catalogue.ts`), read by `isPropertyCase` and by `writtenFormOnly()` in the controller. |
| 2 | Moderate (behaviour change) | The one list is wider than the old search filters. A word search no longer matches the property values `regularity`, `auxVerb`, `caseType` and `prefix` (for example, searching "haben" no longer finds a verb through its auxiliary). | Accepted: these are properties, not written forms. Tell the user. Covered by the new `words-simple` test for conjunction properties. |
| 4 | Minor | The plan named the Estonian direction cases `latEE` / `ablEE`. The names say little. | Renamed `directionToEE` / `directionFromEE` in slice 2. |
| 5 | Moderate | The Estonian governed-case list (Genitive, Partitive, Elative, Allative, Comitative, Terminative, Abessive) comes from search results (University of Tartu course pages, EKI), not from a full grammar check. A user cannot enter a case that is not in the list. | **Closed 2026-11-02 (the user checked the list against the EKI grammar).** The list stays as it is. |
| 6 | Minor | The completion ring counts every visible non-checkbox field, so the optional position and the case selects raise the ring's denominator (same as the optional conjunction type). | Accepted; same behaviour as the German adverb radio. |
| 7 | Moderate | A live check of the 3a adapter (2026-10-25) shows a lexeme that carries both codes (`postp` + `prep`) and one government gives the same case to both positions. "peale" returns Genitive before and after the noun, but the grammar has the partitive before the noun ("peale sööki") and the genitive after it ("laua peale"). Wiktionary lists the two as separate entries (peale: prep partitive, postp elative; the elative there is also doubtful). "üle" has the same shape. | **Decided 2026-11-02: keep one case for both positions, as it is.** The grammar has two cases ("peale sööki", "laua peale"), but the form stores one. |
| 8 | Minor | Two Ekilex government values have no option in the Estonian case select: adessive ("millel") and ablative ("millelt"), plus the nominative ("mis"). They fill nothing. | **Decided 2026-11-02: not added.** The checked case list of Estonian adpositions has no adessive or ablative, so no real word needs them. Idea I-7 in `research/deferred-ideas.md`: add them (one line each) if a real adposition governs them. |
| 9 | Moderate (fixed in slice 3b, test in `AutocompleteRow.test.tsx`) | `applyLookup` applied radios first, so the fields a radio shows were filled in the same pass, but a checkbox that shows fields ("Paired" shows the second part; "Contracts with the article" shows the three forms) was applied in field order. The hidden field was skipped, and the lookup filled the box but not the field. | Checkboxes that other fields depend on (`visibleWhen`) are now applied first, like the radios (`lookedUpToggles`). |
| 10 | Minor | "weil" carries both a coordinating and a subordinating category (the second is for an obsolete sense), so it gets no type. The most common German conjunction stays empty. | Accepted (Q8: fill only when the data is clear). A curated list would fix it; the user declined it in Q8. |
| 11 | Minor | The EN lexicon holds noise entries that Wiktionary lists as conjunction or preposition ("an", "de"). They are real Wiktionary entries and a lookup needs the exact word, so they do no harm, but the type-ahead may show them. | Checked in slice 3c: the word type-ahead orders by frequency, so common words come first; the noise shows at low ranks. One visible case: English "an" as a conjunction (rank 81, Wiktionary lists it as dialect "if"). Accepted. The sense type-ahead reads the translation table, which has no such noise. |
| 3 | Minor | `reflexiv` was missing from the exercise property list. | Added to `PROPERTY_PREFIXES`. |

## 4. What the data gives (research of 2026-10-25)

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

## 5. Traps

- `PROPERTY_PREFIXES` is one exported list read by `isPropertyCase` and `writtenFormOnly()`. A new part of speech with a property field needs an entry, or a search matches the property value (finding 1, 2).
- `applyLookup` must apply radios first, then checkboxes that reveal fields, in that order, or the revealed field is skipped (finding 9).
- The translation table writes a pair with an ellipsis ("weder … noch") but the lexicon stores "weder" alone. The lookup splits the pair by rule and answers `partial` (Q11).
- Reloading the reference data (the lexicon and the translation file) needs `deploy/ansible/lexicon.yml` per environment. The steps are in `guides/add-language.md` section 6 and the infrastructure guide, file 02.

## 6. Open items

Closed 2026-11-02 (confirmed by the user): the review of the ES, DE and EE strings (the review sheet was removed afterwards; the locale files are the truth), the check of the Estonian case list (finding 5), the decision on "peale" (finding 7), and the decision on adessive and ablative (finding 8).

Deferred, not planned: the **modal verbs** idea (a checkbox and special fields, and pre-adding them to accounts). It is idea I-1 in `research/deferred-ideas.md`.
