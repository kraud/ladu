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
- [x] `controllers/wordController.ts` `getRequiredFieldsData`: add a `case "<Name>"` for each part of speech: the headline word (`data<SUFFIX>`) and, for nouns, the gender (`gender<SUFFIX>`). Without it the part of speech falls to `default` and logs a warning. `languageToFieldName` (the `registeredCases<SUFFIX>` field) reads the language table since slice 4; it was a hard-coded map that slice 1 missed, and without it the table shows no case count for the new language. Verified for French nouns and adjectives; the other parts of speech follow with their forms.
- [x] `services/exercises/catalogue.ts`: noun slots (`singular`/`plural` nominative), single-language drills (`SingleLanguageCatalogue` is `Record<Language, …>`: use `noDrills` until the forms exist), `PROPERTY_PREFIXES` (a new property needs a prefix and two regression cases in `tests/unit/exercisesCatalogue.test.js`). Verb tenses come with the verb form. Verified for French nouns.
- [x] `utils/resources/emailStrings.js`: a block for the new language, with the same keys as English (without it, emails fall back to English). `tests/email-templates.test.js` checks the keys and the language list.
- [x] `services/onboarding/labels.ts`: topic tag names in the new language. They must equal `topics.names` in the frontend `onboarding.json`; `tests/unit/onboardingSelect.test.js` checks this for every language.
- [x] Tests that pin the set. A test that uses the new language's name or code as its example of an *unknown* language fails: change the example (to `Klingon`, `XX`, `xx`). Found for French: `words-simple.test.js` (`sort=FR`), `exercisesSessionValidate.test.js`, `lexiconTranslations.test.js` (`fr` as a skipped language), frontend `lib/language.test.ts`, `lib/handoff.test.ts`, `practice/search.test.ts`. Tests that count languages: `metrics/selectors.test.ts`, `WelcomeBanner.test.tsx` (the greeting cycle has one step more), `AccountPage.test.tsx` and `e2e/tests/phase-1-auth.spec.ts` ("2 of 5 selected"), `dictionary.test.js` (the translate routes return an empty list for the new language until its data is loaded).
- [x] Lists that stay explicit until the language has data: `controllers/demoController.ts` (`ALL_LANGUAGES`: a demo account gets these languages; add the new one when the demo template has its words) and `tests/unit/caseMapping.test.js` (the languages that must have exercise slots; add the new one with its noun forms).

### Frontend: the language

Verified in slice 1 (2026-10-26). The `Lang` enum **key** is the two-letter suffix (`Lang.EN`), and it is the only place that defines it. `frontend/src/lib/language.ts` derives from it: `LangKey`, `LANG_BY_KEY` (`"EN"` → `Lang.EN`), `LANG_SUFFIX` (`Lang.EN` → `"EN"`). Do not write a local suffix map in a config file. The `i18n` code of a `UI_LANGUAGES` row is a plain string.

- [x] `frontend/src/ts/enums.ts`: `Lang` member (key = suffix). Per-language enums (gender, tenses, moods, pronouns) come with the forms: `(unverified)`.
- [x] `frontend/src/lib/language.ts`: `UI_LANGUAGES` row (display order), `TINT_VAR_BY_KEY` (typed `Record<LangKey, string>`, so the compiler asks for it).
- [x] `frontend/public/<SUFFIX>.svg` (flag, viewBox `0 0 513 342` like the others). `frontend/src/styles/tokens.css`: `--lang-<code>`, light and dark. Pick a hue that differs from the other languages in charts; it need not come from the flag.
- [ ] `frontend/src/i18n.ts`: `supportedLngs`. `features/captcha/turnstile.ts`: the whitelist. Do this **together with the locale files**, not before: a code in `supportedLngs` without files makes i18next request files that do not exist. Without the code, the language falls back to English cleanly. `(unverified)`
- [x] `frontend/public/locales/<code>/*.json`: all 14 files, same keys and key order as English. Rules found with French (2026-10-26):
  - Plural keys follow the CLDR categories of the language (`_one`, `_other`; Estonian and French have no `_two` or `_few`). Where English has a count without a plural key, the new language may need both forms.
  - Keep `{{placeholders}}` and the `<terms>`/`<privacy>`/`<b>` tags exactly. The parity tests check them.
  - `common.json` `notFound.lines` is a list with one line per language, **identical in every locale**: add the new language's line to all locales, and to `FALLBACK_LINES` in `routes/not-found.tsx`.
  - `frontend/src/lib/locales.test.ts` reads every folder in `public/locales/` and compares all 14 files with English (keys, placeholders, tags). A new folder is covered with no edit. Also add the language to the older, narrower tests: `features/auth/locales.test.ts`, `features/demo/locales.test.ts` (twice, the second one flags text left in English), `features/practice/locales.test.ts`, `features/onboarding/onboarding.test.tsx`, `features/captcha/turnstile.test.ts`.
  - Avoid sentences that put a variable (a part of speech, a language name) after an article: gender and elision break them. Rewrite with a colon or parentheses.
  - Write the typography of the language (French: no-break space before `: ; ? !` and inside `« »`, `’`). A draft with a marker for the special characters and a small script that builds the JSON and checks it against English saves time.
  - Write a review sheet for a native speaker: `language-french-strings.md` is the model (decisions, glossary, where each text lives).
- [x] A hard-coded count of languages is a bug. Found for French: `MAX_TRANSLATIONS = 4` in `CellDialog.tsx` and `useWordFormState.ts` (a word could never get a fifth translation). Now `MAX_TRANSLATIONS` in `lib/language.ts` (= the number of languages), and the message `review:cellDialog.maxTranslations` takes `{{max}}`. Search for `4`, `four` and `4 ` in strings when you add a language; the demo and landing texts say "four languages" until their data has the new language.
- [x] The key blocks that every old locale needs: `common:languages.<name>` (the registration tiles and the language menus read it) and `wordRelated:startFromWord.inLanguage.<name>`, in each existing locale. Alphabetical in `languages`, in display order in `inLanguage`.
- [x] Gender in the words table (when the language has noun gender): `features/words/types.ts` (`gender<SUFFIX>?` on `WordSimpleBE`), `review/row.ts` (`genderValue`), `review/FilterBar.tsx` (`GENDER_BY_LANGUAGE`), `review/WordCell.tsx` (`GENDER_CLASS`: the article of the masculine → `gender-m`), `form-engine/TranslationCard.tsx` (the gender field a draft fills). Known limit: the gender filter holds the article, not the language, so "la" selects Spanish and French feminine nouns together.
- [ ] `features/demo/components/DemoIntro.tsx` (hardcoded example row), `locales/*/demo.json` (the sentence that lists the languages). `(unverified)`

### Frontend: forms (per part of speech)

- [x] Case enums (`NounCases`, `AdjectiveCases` verified for French; `VerbCases`, `AdverbCases`, `ConjunctionCases`, `PrepositionCases` `(unverified)`) and the gender enum (`GenderFR`). `configs/types.ts` (`CaseName`) and `ts/interfaces.ts` list the enums, not their members: no edit for new members.
- [x] `ts/wordCasesDataByPoS.ts`: registry rows (nouns and verbs only). The noun config is built from them; the regularity radio is not in the registry (the config adds it).
- [x] One entry in each `configs/<pos>.ts` map, and its test. Nouns: add the gender options to `GENDER_OPTIONS` and the entry to `NOUN_CONFIGS`. Adjectives: a hand-written builder (French: the agreement grid like Spanish, the stored `plus` derivation like the English adverb, a box that shows a field like German contractions). Verbs need a hand-written builder (tense headings, pronoun labels, adornments) `(unverified)`. Also add the language to the `coverage.test.ts` expectation.
- [x] Locales for the form: `wordForm.<pos>.fields` and `errors.form<SUFFIX>`, in **all** locales (the other locales show the labels of the new language's cards too). Copy the values from the closest language (French nouns from the `…ES` keys in each locale) and add the few new ones. A text-based insert tool is safer than a JSON round-trip, which reformats unrelated lines.
- [ ] `lib/cases.ts` (`TENSE_BUCKET` for new tense names). `(unverified)`
- [x] Test mocks: `test/msw/wordHandlers.ts` (the headline word per part of speech). `authHandlers.ts` read the language list in slice 2.

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

- [x] `landing/app.js` (`LANGS`, `STRINGS` with the same keys as English, `HTML_LANG`), `landing/flags/<SUFFIX>.svg` (copy of the app flag), `landing/index.html` (the line `English · Español · …`), and the language lists of three tests: `landing/scripts/{app-links,demo-link,notice}.test.mjs`. The word card of the home page ("dance, in four languages") changes with the demo data. The legal pages and the blog are English only in every language.
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
