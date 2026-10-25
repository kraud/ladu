# Ladu Word Forms — Conjunctions & Prepositions (Field Spec, v2 only)

Neither form exists in the old app. This file is the spec of the v2 forms (plan `plans/conjunctions-prepositions.md`, built 2026-10-25). Code: `frontend/src/features/words/form-engine/configs/conjunctions.ts` and `prepositions.ts`; tests next to them. The research behind the fields (EKI, Universal Dependencies, Wiktionary) is in the plan.

Rules for every field: only the word is required (conjunction: and the second part while "Paired" is on). The type, the position, the cases and the boxes are **properties**: they are saved, but search and exercises never read them as written forms.

## Conjunction (EN, ES, DE, EE)

| Field (form name) | Case name | Kind | Required | Notes |
|---|---|---|---|---|
| Conjunction (`conjunction`) | `conjunction<LANG>` | text | yes | lowercase. Row 1, first cell. |
| Second part (`secondPart`) | `secondPart<LANG>` | text | yes, while shown | Shown only while "Paired" is on. Row 1, second cell. |
| Type (`conjunctionType`) | `conjunctionType<LANG>` | radio: Coordinating / Subordinating | no | A re-click clears it. Row 2, first cell. Learners often do not know the type (Q5). |
| Paired (`correlative`) | `correlative<LANG>` | checkbox, stored as "true" | no | Row 2, second cell. |
| Verb mood (`mood`) | `moodES` | select: Indicative / Subjunctive / Depends on meaning | no | Spanish only. Shown while Type = Subordinating. Row 3. |

**Why these fields.** German word order follows from the type (subordinating: verb at the end), so German needs no extra field. Spanish "para que" always takes the subjunctive; "aunque" and "cuando" depend on meaning. English and Estonian have no grammatical effect to record. The type of a word can differ between languages ("weil" subordinating, "denn" coordinating, both "because").

## Preposition / adposition (EN, ES, DE, EE)

| Field (form name) | Case name | Kind | Languages | Notes |
|---|---|---|---|---|
| Preposition (`preposition`) | `preposition<LANG>` | text, required | all | lowercase. The Estonian PoS label is "Kaassõna" (adposition). |
| Position (`position`) | `position<LANG>` | radio: Before the noun / After the noun / Before or after the noun | all | Optional, re-click clears. Estonian words mostly follow the noun; English "ago" and German "zufolge" do too. German lists the options in a column. |
| Cases (`governedCase`) | `governedCaseDE` | multi-select: Accusative, Dative, Genitive | DE | Stored as letters in the order A, D, G ("DG"). Listed in a column, beside Position. |
| Contracts with the article (`contracts`) | `contractsDE` | checkbox | DE | Under the word. Shows three forms on **one row**, on a phone too (`fitRow`): |
| With "dem" / "der" / "das" | `withDemDE`, `withDerDE`, `withDasDE` | text | DE | zum, zur, ins. Optional. |
| Has a where-to / where-from series (`spatialSeries`) | `spatialSeriesEE` | checkbox | EE | Under the word. Shows two forms in a 50-50 row: |
| Where to / Where from | `directionToEE`, `directionFromEE` | text | EE | sisse / seest, for the word "sees". Optional. |
| Case of the noun (word before it) / (word after it) | `governedCasePreEE`, `governedCasePostEE` | select: Genitive, Partitive, Elative, Allative, Comitative, Terminative, Abessive | EE | The Pre select is hidden while Position = "After the noun", the Post select while it is "Before the noun". An empty position shows both. Optional selects have a "—" item that clears them. |

Spanish and English prepositions govern no case. Spanish "a + el = al" is a general rule, not a per-word field.

## Autocomplete (what the lookup fills)

Nothing is guessed: a fact the source does not state stays empty. Details and numbers: plan section "Slice 3 research results".

| Field | DE | EN | ES | ET |
|---|---|---|---|---|
| word | Wiktionary lexicon | Wiktionary lexicon | Wiktionary lexicon | Ekilex (`konj`, `prep`, `postp`) |
| conjunction type | when Wiktionary marks exactly one | same | same | never (Ekilex has no type) |
| pair (word, "Paired", second part) | from a headword with an ellipsis ("sowohl ... als auch"), or by rule from a pair text ("weder … noch": status partial) | same | same (rule) | rule only |
| position | `prep` / `postp` entries (both = "Before or after") | same | same | Ekilex codes |
| cases | categories "prepositions governing the ..." | – | – | Ekilex `governments` question words (mille = genitive, mida = partitive, ...) |

"Start from a word" offers both parts of speech: the English Wiktionary translation tables give the meanings and the words in the other languages; the Estonian words come from the same tables, or from Ekilex when they hold none.

## Tests

- Unit: `configs/conjunctions.test.ts`, `configs/prepositions.test.ts`, `AutocompleteRow.test.tsx`, `FieldRenderer.test.tsx` (clearable select, `optionsLayout`), `fieldLayout.test.ts` (`fitRow`); backend `lexiconSelectors{DE,EN,ES}.test.js`, `lexiconAdpositions.test.js`, `exercisesCatalogue.test.js`, `dictionary.test.js`, `words-simple.test.js`.
- e2e: `e2e/tests/autocomplete-i-conjunctions-prepositions.spec.ts`.
