# Autocomplete and "Start from a word"

## Summary

When a learner fills a translation card, Ladu can look the word up and fill the grammar fields (cases, conjugations, gender, degrees) from a local dictionary built from Wiktionary, and from the official Estonian dictionary (Ekilex) for Estonian. A type-ahead list suggests words while the learner types. "Start from a word" goes further: the learner types one word in any language, picks one meaning, and Ladu builds a draft with the translations in all of their languages, each with its forms. The learner checks the draft and saves it as a normal word.

Live spec. The research, the evidence and every numbered decision (D1 to D34) are kept whole in `.context/research/autocomplete-data-source-strategy.md` (code cites its IDs). This file is the short contract. Built 2026-09-25 to 2026-10-24 (slices 0, A to H, G). Gates: `e2e/tests/autocomplete-*.spec.ts` (g, i, j, start-from-word). Operations: `.context/guides/infrastructure-guide/02-environments-and-databases.md`, "The autocomplete lexicon". Coverage evidence: `research/autocomplete-coverage-report.md` and `research/french-lexicon-coverage.md`.

Code map: backend `backend/routes/dictionaryRoutes.js`, `controllers/dictionaryController.ts`, `services/dictionary/` (`registry.ts` with `findAdapter` and `withPronominalFallback`, `lexicon.ts`, `translate.ts`, `draft.ts`, `eki.ts`), `lib/lexicon/` (`extract`, `ingest`, selectors per language `selectors/{de,es,en,fr}.ts`), `scripts/lexicon/` (download, extract, ingest, ingest-translations, load), `deploy/ansible/lexicon.yml` (role `lexicon`); frontend `frontend/src/features/autocomplete/`, `features/words/form-engine/AutocompleteRow.tsx` (`applyLookup`), `TypeAheadInput.tsx`, `features/words/start-from-word/`; migrations `0021` to `0026` (the `lexemes` and `lexeme_translations` tables and their indexes).

## 1. Routes

All under `/api/dictionary`, all need a signed-in learner. **The order of registration matters**: a shorter pattern would match a longer path.

| Route | Purpose |
|---|---|
| `POST /draft` | Build a draft of 1 to 4 picks (`Start from a word`). Reads and changes nothing. |
| `GET /translate/:fromLanguage?prefix=&partOfSpeech=&limit=` | Sense suggestions for the "Start from a word" list. |
| `GET /translate/sense/:partOfSpeech?english=&entry=&sense=&languages=` | One sense with its words in the asked languages. |
| `GET /translate/:fromLanguage/:partOfSpeech/:query` | The senses of a word, with the words of all languages and the noun gender. |
| `GET /:language/:partOfSpeech?prefix=` | Type-ahead list of words, with `entryId`. |
| `GET /:language/:partOfSpeech/:query?entry=` | Lookup: the fields for one word; `entry` picks one exact entry (der See and die See). |

The contract of the three "Start from a word" routes, the preview and the draft: `research/autocomplete-data-source-strategy.md`, section "Slice G".

## 2. Data and behaviour that constrain the code

- **Tables:** `lexemes` (one row per entry, a `forms` jsonb with every case the form uses, `search_key`, `entry_order`, `source`, `licence`, `source_version`) and `lexeme_translations` (one row per English entry, sense and target word; English is the internal hub). Postgres, per environment, **excluded from the nightly backup**, refilled from a versioned file by `deploy/ansible/lexicon.yml` (one run per language file; a load replaces only its own language). Re-ingest is manual, about once a quarter (D14).
- **Licence:** CC BY-SA data in separate tables with `source` and `licence` columns, credited on `landing/credits.html`, with no download for users (D1).
- **Lookup answers** `found`, `partial` or `not-found`. A miss in the lexicon falls back to the rule-based generators for German, Spanish and English, always `partial`, shown with the "not fully sure" notice (D2, D17). `is-word` is gone. A homograph returns the one entry that fills the most fields (D15); a `gender` option narrows it for German and Spanish nouns.
- **Estonian** uses the official Ekilex API only (`EKILEX_API_KEY`, 2 to 3 calls, D18). The Estonian adjective and adverb lookups read the comparison relations (`komp`, `superl`) from `api/word/details/{id}` (D20, D27).
- **Variant forms in one cell:** fill the first listed (D19).
- **Fill rules:** filling writes only **empty** fields. A pick from the type-ahead fills the card at once; typing without a pick changes nothing (D21). The list does not close by itself when a whole word is typed (D34).
- **Fixed conventions:** Spanish second person is tú and ustedes (D10); the Spanish regularity rule is D16; the German superlative is stored without "am" (D25); reflexivity is stored as a radio for German and Spanish (D31, D33) and French (`features/french.md`); verbs are stored without the reflexive pronoun (D8).
- **Pairs and ellipsis:** a translation row "weder … noch" is split by rule on lookup (`features/conjunctions-prepositions.md`, Q11).
- **Type-ahead:** the index uses `text_pattern_ops`, because the `en_US` collation cannot serve `LIKE 'co%'` with a plain B-tree.

## 3. Operations

The server steps (the Ekilex key, the backup script, loading each language file, the translation file, the checks) were all done on staging and production (confirmed by the user, 2026-11-02). To add a language, follow `guides/add-language.md` section 6; the reload commands are in the infrastructure guide, file 02.

## 4. Traps

- The Estonian e2e tests need the Ekilex stub; a dev backend on `:5001` makes Playwright reuse it, and the tests call the real service.
- A new part of speech or language needs selectors, an adapter in `registry.ts`, and an entry in the frontend `AUTOCOMPLETE_REGISTRY`.

## 5. Open items

None. Closed 2026-11-02 (confirmed by the user): the VPS checklist (section 14 of the research record). The idea "Browse all words" (Slice I) is idea I-2 in `backlog/deferred-ideas.md`.
