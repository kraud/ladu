# Guide: Add a part of speech to Ladu

Use this guide when Ladu must store a new part of speech (PoS), or a new group of fields on a PoS that exists. Examples: conjunctions and prepositions (`.context/plans/conjunctions-prepositions.md`), the adverb gradable radio (`.context/plans/adverb-gradable-radio.md`).

Write the plan file first. Copy the shape of `adverb-gradable-radio.md`: Progress list, user decisions (Q1, Q2…), slices, review log.

## 1. Research (before any code)

Do this for **each** language that Ladu supports (EN, ES, DE and EE on 2026-10-24; the list grows, see `.context/guides/add-language.md`). Do not assume that a rule from one language is true in the others.

For each word class, answer:

1. **Effect on the sentence.** Does the word change the case of a noun, the word order, or the verb mood? Example: DE "wegen" takes the genitive; DE "weil" sends the verb to the end; ES "para que" needs the subjunctive.
2. **Inflection.** Does the word change form? (Most conjunctions do not. Some Estonian adpositions have a series: sisse / sees / seest.)
3. **Position.** Does the word come before the noun, after it, or both?
4. **Pairs.** Does the word work with a second word? (weder … noch, nii … kui ka.)
5. **Edge cases.** Words with more than one PoS (DE "doch": conjunction and adverb). Decide which PoS the user must pick.

Sources to use: EKI (Estonian), Duden (German), RAE and DLE (Spanish), Wiktionary (all), Universal Dependencies. Sources to avoid for rules: language-learning blogs and AI sites. Use them only to find a lead. Write the source for each rule in the plan.

Compare the result with the examples in `.other/` (the word list the user supplies).

## 2. Decide the fields

| Need | Use | Example |
|---|---|---|
| The word itself | `text`, required, `lowercase: true` (German nouns excepted) | `adverbEN` |
| A property with 2–3 values, all visible | `radio` | `gradableDE` |
| A property with a long list of values | `select` | Estonian governed case |
| A property with many values at one time | `multi-select` with `encode` and `decode` | German verb cases |
| A yes/no property | `checkbox` with a `caseName` (saved as "true") | `periphrasticEN` |
| A field that exists only in one branch | `visibleWhen` (use `invert` to show by default) | `hiddenWhenNonGradable` |
| A field that the form fills from another | `derivedWhen` with `store: true` | "more " + adverb |
| A field that is always locked, and follows another that can itself be locked | `derivedWhen` without `when`, with `via` (and `emptyPlaceholderKey` for the empty state) | French superlative: "le " + comparative ("le plus beau") |
| Fields side by side | `layout` (`row`, `column`) | Estonian degree row |
| Options listed one under the other | `optionsLayout: 'column'` on a `radio` or `multi-select` (default: a row that wraps, so a phone shows a column anyway) | German preposition position and cases |
| A short row that must stay one row on a phone | `layout.fitRow: true` (equal columns, no scroll, no stacking) | German contractions, Estonian direction forms |
| A row of radio groups of different heights | `layout.alignTop: true` (cells align at the top, so the labels line up; the default is the bottom edge, which suits inputs) | Noun gender and regularity (ES, DE, FR) |

Rules:

- Every form has **one required text field** for the word.
- Ask the user about every **required radio**. A required radio on an existing PoS makes old words incomplete. A new PoS has no old words, so it has no such problem.
- A property is saved on the word, so exercises and search must not treat it as a written form (section 3).
- Write the decision for each field in the plan (Q1, Q2…) with the reason.

## 3. Naming rules

- Case names are `<role><LANG>`: `adverbEN`, `governedCaseDE`. The enum goes in `frontend/src/ts/enums.ts`. The value is the exact string saved in the database.
- A **property** case name must **start with** a prefix from `PROPERTY_PREFIXES` (`backend/services/exercises/catalogue.ts`). The check is `startsWith`.
- A **written-form** case name must **not** start with any of those prefixes. Example of the trap: a written form named `prefixDE` is read as a property.
- When you add a property prefix, add it in one place only. The search filters in `wordController.ts` must read the same list (slice 1 of the conjunction plan builds this).
- Add a regression test for each new prefix: one property case and one written-form case.

## 4. Touchpoint checklist

Tick each item in the plan. The file paths are from 2026-10-24. Check them again with a search before you start.

### Frontend

- [ ] `frontend/src/ts/enums.ts`: new case enum. `PartOfSpeech` values exist for preposition and conjunction.
- [ ] `configs/types.ts` (`CaseName` union) and `ts/interfaces.ts` (five hand-written unions): add the new enum.
- [ ] New `configs/<pos>.ts` and test. Build it like `configs/adverbs.ts`: `labelKey`, error key, one builder per language.
- [ ] `configs/index.ts` (`getFormConfig`) and `configs/coverage.ts` (`ALL_POS`, `CONFIGS_BY_POS`).
- [ ] Enable the PoS in each list: `components/common/PartOfSpeechSelector.tsx` (`SHIPPED_POS`), `features/words/review/FilterBar.tsx`, `features/metrics/selectors.ts` (`CREATABLE_POS`), `features/metrics/components/charts/chartColors.ts`, `features/practice/params.ts`.
- [ ] `features/words/start-from-word/StartFromWord.tsx` and `features/autocomplete/transforms.ts`: only when autocomplete exists.
- [ ] Locales, **all four** (`frontend/public/locales/{en,es,de,ee}/`): `wordRelated.json` (`wordForm.<pos>.fields`, `wordForm.<pos>.errors`, `partOfSpeechSelector.description.<pos>`), `practice.json` (text about PoS without exercises), `common.json` and `review.json` (labels exist; check the wording).
- [ ] Tests that pin the PoS list: `PartOfSpeechSelector.test.tsx`, `completion.test.ts`, `coverage.test.ts`, `test/msw/wordHandlers.ts`.

### Backend

- [ ] `controllers/wordController.ts` `getRequiredFieldsData`: the required case per language. Without it the PoS falls to `default` and logs a warning.
- [ ] `controllers/wordController.ts` search filters (the `not ilike` lists for property cases, two places).
- [ ] `lib/wordSort.ts`: the sort case per language.
- [ ] `services/exercises/validate.ts` and `types.ts`: the PoS list.
- [ ] `services/exercises/catalogue.ts`: `PROPERTY_PREFIXES`. Add exercises only if the plan says so.
- [ ] A backend test: save a word of the new PoS and read it back.

### Lexicon and autocomplete (only when the plan includes autocomplete)

- [ ] `backend/scripts/lexicon/ingest.ts`: selectors for the Wiktionary PoS codes (`prep`, `conj`). Add to `keepLemmaOnly` when the data has no forms.
- [ ] `backend/lib/lexicon/selectors/{en,es,de}.ts`: one selector set per PoS.
- [ ] `backend/services/dictionary/registry.ts`: one adapter per language.
- [ ] `backend/lib/lexicon/translations.ts` (`TRANSLATION_POS`) and `services/dictionary/translate.ts` (`TRANSLATE_PARTS_OF_SPEECH`): so the translate, senses, sense and draft routes accept the part of speech. Rebuild the translation file (`ingest-translations.ts` + `load.js`) and add words to its `FIXTURE_WORDS`.
- [ ] `frontend/src/features/words/start-from-word/StartFromWord.tsx` (`DRAFT_PARTS_OF_SPEECH`): so the part-of-speech list of "Start from a word" offers it.
- [ ] If a selector needs a field that `extract.ts` drops (the Wiktionary `categories` were one), keep it there for the parts of speech that need it, and re-run `extract.ts` (about 2 minutes). Keep the new field in the unit-test fixtures too: `fixture.ts` reduces senses to their tags.
- [ ] A checkbox that shows other fields (`visibleWhen`) is applied first by the lookup (`lookedUpToggles` in `AutocompleteRow.tsx`); a new kind of driver field needs the same.
- [ ] Estonian: `services/dictionary/eki.ts`. Check the Ekilex PoS codes in real data first.
- [ ] Look at the real lexicon data before you write a selector. Fill a property only when the data is reliable. A missing value is not proof (see decision Q2 in the adverb plan).

### Docs and e2e

- [ ] `.context/.frontend/snapshot/data-model.md` (case names) and a `forms-<pos>.md` snapshot file.
- [ ] One e2e spec in `e2e/tests/`. `npm run test:e2e` must be green.
- [ ] The user reviews the new ES, DE and EE strings.

## 5. What needs no change

Do not search for these again:

- **Database.** `words.part_of_speech` is a `varchar`, not an enum. No migration.
- **Metrics, tags, admin.** They group by the PoS text. They work for any value.
- **Word table, search by PoS, `?pos=` filter.** They work for any value.
- **Onboarding pool and demo template.** They list PoS by hand. Change them only when the plan says so.
- **Exercises.** Adjectives and adverbs have none. A new PoS without exercises is correct until a plan adds them.

## 6. Rollout reminders

Write these in the plan, in a "Before or at the merge" section:

- Reload the lexicon per environment (EN, ES, DE) when selectors changed. The selectors run at ingest time.
- Reseed the demo template per environment when its data changed.
- Run the e2e suite. Before it: no backend on :5001, no closed access gate in the local database.
