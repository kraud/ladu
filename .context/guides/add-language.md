# Guide: Add a language to Ladu

Use this guide when Ladu must support a new language. The first use is French (`.context/plans/language-french.md`). The guide is written while that plan runs.

**Status of this guide (2026-10-26): skeleton.** Items marked `(unverified)` come from a code search on 2026-10-26. A slice of the French plan confirms each one, fixes the path if needed, and removes the mark. Check every path again with a search before you start.

Write the plan file first. Copy the shape of `language-french.md`: Progress list, user decisions, slices, review log, rollout runbook.

## 0. Words used here

| Term | Meaning | Example (French) |
|---|---|---|
| Name | The value stored in the database and in the `Lang` enum | `French` |
| Suffix | The two letters at the end of every case name | `FR` |
| i18n code | The code of the interface locale folder | `fr` |
| Wiktionary code | The code in the kaikki dump | `fr` |

Check that the four codes are really the same. Estonian is the trap: the suffix is `EE`, the i18n code is `ee`, and the Wiktionary and HTML code is `et`.

## 1. Decisions to take before any code

Ask the user. Write each answer in the plan (L1, L2…) with the reason.

1. **Learnable only, or interface too?** One list (`UI_LANGUAGES`) means both. An interface language needs 14 locale files (about 1,400 strings), emails, onboarding topic names and the landing page. Missing keys fall back to English, so the interface can land in steps.
2. **Scope.** Forms first, then autocomplete? Which parts of speech?
3. **Who reviews?** The user may not speak the language. Plan a native-speaker review sheet (one section per part of speech: fields, labels, two filled examples, open questions).
4. **Onboarding pool and demo template.** Include them, or add them later?

## 2. Research (before any code)

Answer for **each part of speech**. Do not copy a rule from another language.

1. **Noun.** Gender (how many values, which article)? Plural rule and irregular plurals? Cases (declension)? Does the article change before a vowel (elision)? Is there a form that the learner must know and the form cannot show?
2. **Verb.** Conjugation groups? Tenses and moods to store (and which to leave out)? Persons (are there forms the language merges)? Auxiliary verb choice? Reflexive verbs? Participles and other non-finite forms? Does the past tense need an auxiliary shown in the input (German Perfekt pattern)?
3. **Adjective.** Does the adjective agree (gender, number)? Comparison: with endings, with a helper word, or both? Special forms (before a vowel)? Position in the sentence?
4. **Adverb.** Is it gradable? Comparison forms? Irregular forms?
5. **Conjunction.** Coordinating or subordinating? Pairs? Does it need a mood (subjunctive)?
6. **Preposition (or adposition).** Does it govern a case? Position? Contractions with the article?
7. **Characters.** Which letters does a learner type? (Ladu has no special-character palette; users use their keyboard.) Is there a rule for capitals (German nouns)?
8. **Pronouns for the verb grid.** Which labels? (Spanish uses tú/ustedes, no vos/vosotros: decision D10.)

Sources to use: a national academy or reference grammar, a conjugation reference, Wiktionary, Universal Dependencies. Sources to avoid for rules: language-learning blogs and AI sites. Use them only to find a lead. Write the source for each rule in the plan.

## 3. Naming rules

Same as `add-part-of-speech.md` section 3. In short:

- Case names are `<role><SUFFIX>`: `singularFR`, `genderFR`.
- A **property** case name must **start with** a prefix from `PROPERTY_PREFIXES` (`backend/services/exercises/catalogue.ts`). A **written-form** case name must **not**.
- A language-specific property needs a new prefix (French: `verbGroup`). Add a regression test: one property case and one written-form case.

## 4. Touchpoint checklist

Tick each item in the plan. `(unverified)` means: not yet confirmed by a slice.

### Database

- [ ] None. `language` and `part_of_speech` columns are `varchar` or `text[]`. No migration. `(unverified for French; true for the schema on 2026-10-25)`

### Backend: the language list

Verified in slice 1 of the French plan (2026-10-26). The language set lives in **one table**: `backend/lib/languages.ts` (`LANGUAGE_INFO`: name → `suffix`, `wiktionary` code). Add one row there. These files read it, so they need no edit:

- `controllers/userController.ts` (`isSupportedLanguage`), `controllers/demoController.ts`, `services/exercises/{types,validate,catalogue}.ts`, `services/dictionary/{registry,translate}.ts`, `lib/wordSort.ts`, `lib/lexicon/translations.ts`, `lib/onboardingPool.ts` (suffix), `scripts/lexicon/load.js` (accepted languages and translation targets).

These lists stay explicit **on purpose** (a language joins them when its data exists). Edit them in the slice named:

- [ ] `scripts/lexicon/common.ts` (`LANG_CODES`: the languages of the lexicon pipeline), `extract.ts` (prefilter regex at line 24, translation targets at line 46), `ingest.ts` (`LANGUAGES`, `FIXTURE_WORDS`). Slice 9 for French.
- [ ] `scripts/lexicon/onboarding-pool.ts` (`LANGUAGES`) and the pool columns in `lib/onboardingPool.ts`. Slice 11.
- [ ] `scripts/seed-pagination-words.ts`, `scripts/bench-exercises.ts`: developer scripts with their own language lists. Optional.
- [ ] `tests/unit/languages.test.js` checks the table against the frontend `Lang` enum. If it fails, the two lists differ.

### Backend: language behaviour

- [ ] `lib/wordSort.ts` `MAIN_CASE_NAMES`: the case names a `?sort=` reads. Its type is `Record<LanguageName, …>`, so the compiler asks for the entry.
- [ ] `controllers/wordController.ts` `getRequiredFieldsData`: the required case for each part of speech. `(unverified)`
- [ ] `services/exercises/catalogue.ts`: noun slots, verb tenses, single-language drills, `PROPERTY_PREFIXES`. `(unverified)`
- [ ] `utils/resources/emailStrings.js`: a block for the new language (without it, emails fall back to English). `(unverified)`
- [ ] `services/onboarding/labels.ts`: topic tag names in the new language. `(unverified)`
- [ ] Tests that pin the set: `tests/unit/caseMapping.test.js`, `tests/demoTemplate.test.js` (its `SUFFIX` map). `(unverified)`

### Frontend: the language

Verified in slice 1 (2026-10-26). The `Lang` enum **key** is the two-letter suffix (`Lang.EN`), and it is the only place that defines it. `frontend/src/lib/language.ts` derives from it: `LangKey`, `LANG_BY_KEY` (`"EN"` → `Lang.EN`), `LANG_SUFFIX` (`Lang.EN` → `"EN"`). Do not write a local suffix map in a config file. The `i18n` code of a `UI_LANGUAGES` row is a plain string.

- [ ] `frontend/src/ts/enums.ts`: `Lang` member (key = suffix); per-language enums (gender, tenses, moods, pronouns). `(unverified)`
- [ ] `frontend/src/lib/language.ts`: `UI_LANGUAGES` row (display order), `TINT_VAR_BY_KEY` (typed `Record<LangKey, string>`, so the compiler asks for it).
- [ ] `frontend/src/i18n.ts`: `supportedLngs`. `features/captcha/turnstile.ts`: the whitelist. `(unverified)`
- [ ] `frontend/public/locales/<code>/*.json`: all 14 files. The locale parity tests compare them with English. `(unverified)`
- [ ] The key blocks that every old locale needs: `common:languages.<name>`, `wordRelated:startFromWord.inLanguage.<name>`. `(unverified)`
- [ ] Review table: `review/row.ts`, `review/completion.ts`, `FilterBar.tsx` (gender filter), `WordCell.tsx` (gender chip class). `(unverified)`
- [ ] `features/demo/components/DemoIntro.tsx` (hardcoded example row), `locales/*/demo.json` (the sentence that lists the languages). `(unverified)`

### Frontend: forms (per part of speech)

- [ ] Case enums (`NounCases`, `VerbCases`, `AdjectiveCases`, `AdverbCases`, `ConjunctionCases`, `PrepositionCases`), then `configs/types.ts` (`CaseName`) and `ts/interfaces.ts` (five unions). `(unverified)`
- [ ] `ts/wordCasesDataByPoS.ts`: registry rows (nouns and verbs only). `(unverified)`
- [ ] One entry in each `configs/<pos>.ts` map, and its test. Verbs need a hand-written builder (tense headings, pronoun labels, adornments). `(unverified)`
- [ ] Locales for the form: `wordForm.<pos>.fields` and `errors.form<SUFFIX>`, in all languages. `(unverified)`
- [ ] `lib/cases.ts` (`TENSE_BUCKET` for new tense names). `(unverified)`
- [ ] Test mocks: `test/msw/authHandlers.ts`, `test/msw/wordHandlers.ts`. `(unverified)`

### Lexicon and autocomplete (only when the plan includes autocomplete)

- [ ] Coverage research first: re-extract the language from the dump and measure each part of speech (template: `.context/plans/autocomplete-coverage-report.md`). `(unverified)`
- [ ] `backend/scripts/lexicon/common.ts` (language codes, frequency list URL), `extract.ts` (prefilter regex, translation targets), `ingest.ts` (`LANGUAGES`, `FIXTURE_WORDS`), `load.js` (`LANGUAGES`, `TRANSLATION_TARGETS`). `(unverified)`
- [ ] `backend/lib/lexicon/selectors/<code>.ts`, its unit test and fixture (`tests/unit/lexiconSelectors<SUFFIX>.test.js`). `(unverified)`
- [ ] `services/dictionary/registry.ts`: one adapter per part of speech. `(unverified)`
- [ ] `frontend/src/features/autocomplete/transforms.ts` (`AUTOCOMPLETE_REGISTRY`) and `StartFromWord`. `(unverified)`
- [ ] Licence: add the source to `.context/licence-study.md` and to `landing/credits.html`. `(unverified)`
- [ ] Fixture for CI and e2e: `lexicon-<code>-fixture.jsonl`, `backend/package.json` (`lexicon:load:fixture`), `e2e/playwright.config.ts`, `.github/workflows/ci.yml`. `(unverified)`

### Onboarding and demo (only when the plan includes them)

- [ ] Pool: `backend/scripts/onboarding/pool.tsv` (new columns), `scripts/lexicon/onboarding-pool.ts` (`LANGUAGES`), `onboarding-forms.ts` (`GENDER_CASE`), `lib/onboardingPool.ts`, `pool-forms.json`, the pool README. `(unverified)`
- [ ] Demo template: `scripts/demo-template/data.json`. `(unverified)`

### Landing page and docs

- [ ] `landing/app.js` (`LANGS`, `STRINGS`, `HTML_LANG`), `landing/flags/<SUFFIX>.svg`, `landing/index.html` (language line). `(unverified)`
- [ ] `CLAUDE.md` and `.context/overview.md`: the list of supported languages. `(unverified)`
- [ ] `.context/.frontend/snapshot/` (`data-model.md`, `forms-*.md`): a section for the language. `(unverified)`
- [ ] One e2e spec in `e2e/tests/`. `npm run test:e2e` must be green. `(unverified)`
- [ ] The native-speaker review of the forms and the strings.

## 4b. Tip: let the compiler list the touchpoints

After the first edit (the `Lang` member and the backend table row), run `npm run typecheck -w backend` and `npm run typecheck -w frontend`. Every `Record<Lang, …>` or `Record<LanguageName, …>` that has no entry for the new language is an error, and each error is a touchpoint. The six form-config maps (`NOUN_CONFIGS` and the others) are `Partial<Record<Lang, …>>` on purpose: a language can get its parts of speech one slice at a time, and the registration tile shows what exists (`configs/coverage.ts`). Tests with a fixed count of languages or a hard-coded list fail on purpose too; update them (for example `lib/language.test.ts`, which also pins that `fr` falls back to English).

## 5. What needs no change

Do not search for these again. `(unverified for a new language; confirm in slice 2)`

- **Database.** No migration (section 4).
- **Metrics, tags, admin.** They group by the language text.
- **The form renderer.** It is config-driven. A new language needs configs, not components.
- **The Ansible lexicon role** and `deploy/scripts/backup.sh`. They do not depend on the language.

## 6. Rollout reminders

Write these in the plan:

- Load the new lexicon file and the rebuilt translations file per environment (`deploy/ansible/lexicon.yml`): staging, SQL counts, then production. Runbook model: `conjunctions-prepositions.md`.
- Reseed the demo template per environment when its data changed.
- Run the e2e suite. Before it: no backend on :5001, no closed access gate in the local database.
