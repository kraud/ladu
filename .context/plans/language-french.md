# Plan: Add French to Ladu (+ a reusable "add a language" guide)

Status: plan agreed on 2026-10-25. Phase 0 and Slices 0–4 done 2026-10-26. Next: Slice 5. Side task after slice 3 (agreed with the user): e2e on its own ports and its own database.

## How to start (read this first in a new session)

1. Read `CLAUDE.md` and `.context/README.md`. Follow the working rules: one small slice at a time, a plain-language overview **before** any file change, ask before assuming, docs and tests with the code. The user runs `git commit` themselves. Suggest a commit message after each slice.
2. Read `.context/guides/add-part-of-speech.md`. It is the model for the new guide, and its checklist is used again for the French parts of speech.
3. Do the slices in order. After each slice: run its checks, tick the **Progress** list with the date, add the touchpoints of the slice to `.context/guides/add-language.md`, and suggest a commit message.
4. Branch: `new-language-french`.

## Progress

- [x] Phase 0 (2026-10-26) — This plan saved in the repo; row in the `.context/README.md` index
- [x] Slice 0 (2026-10-26) — Guide skeleton `add-language.md`; row in the README index; link from `add-part-of-speech.md`
- [x] Slice 1 (2026-10-26) — Consolidate the language lists (no behaviour change): `backend/lib/languages.ts`, `LANG_SUFFIX`/`LANG_BY_KEY` in `lib/language.ts`, noun/verb/adjective config maps `Partial`. Typecheck, lint, backend (73 suites, 2850 tests), frontend (143 files, 1979 tests), build and full e2e (168 passed) are green
- [x] Slice 2 (2026-10-26) — French as a language (no forms yet): `Lang.FR`, backend table row, `UI_LANGUAGES` row, `FR.svg`, `--lang-fr` (violet), locale name keys in the 4 old locales, tests updated. Typecheck, lint, backend (73 suites, 2850 tests), frontend (143 files, 1979 tests), build and full e2e (168 passed; `phase-1-auth.spec.ts` now expects "of 5") are green
- [x] Slice 3 (2026-10-26) — French interface: 14 `fr` locale files (about 1,400 strings), `supportedLngs` and Turnstile `fr`, emails, onboarding topic names, landing page, the French line on the 404 page, the hard-coded limit of 4 translations per word (now one per language), parity tests with `fr`, e2e spec `language-french-interface.spec.ts`, review sheet `language-french-strings.md`. A new test `lib/locales.test.ts` compares all 14 files of every language with English (keys, placeholders, tags). Typecheck, lint, backend (73 suites, 2856 tests), frontend (144 files, 2046 tests), landing (48 tests), build and full e2e (170 passed) are green. Open: the native speaker reads `language-french-strings.md` (M1)
- [x] Slice 4 (2026-10-26) — Noun and adjective forms: `NounCases`/`AdjectiveCases`/`GenderFR`, registry rows, noun config, French adjective builder, locales in all five languages, gender in the words table, backend headline fields and `registeredCasesFR`, exercise slots and gender drill, `hasVowelForm` property prefix, `forms-french.md`, e2e `language-french-forms.spec.ts`. Superlative as a locked field (review-log F1). Afterwards, at the user's request: gender and regularity on one row for ES/DE/FR nouns (`fitRow` + `alignTop`) and the locked French superlative. Typecheck, lint, backend (73 suites, 2872 tests), frontend (144 files, 2061 tests), build and full e2e are green
- [ ] Slice 5 — Verb form
- [ ] Slice 6 — Adverb, conjunction and preposition forms
- [ ] Slice 7 — Forms e2e spec and the teacher review sheet
- [ ] Slice 8 — Autocomplete research (coverage check)
- [ ] Slice 9 — French lexicon and lookup
- [ ] Slice 10 — Autocomplete e2e spec
- [ ] Slice 11 — Onboarding pool and demo template
- [ ] Slice 12 — Close: finish the guide, rollout runbook, final e2e run

## Review log

| # | Severity | Finding | Resolution |
|---|---|---|---|
| M1 | Moderate | Decision L1 puts machine-made French in the interface before any review. A French user sees it at the merge. | Open: the teacher reviews the screen list from slice 3 before the merge, or the merge waits. Ask at slice 7. |
| M2 | Moderate | French elides the article (l'arbre, l'homme; but le héros, with an aspirated h). Wherever the UI joins article and noun, "le arbre" is wrong. | Open: slice 4 finds each join (Review chip, demo intro, practice). First iteration: show the gender chip apart from the noun, with no join. Teacher question. |
| M3 | Moderate | Exercises map French "past" to the imparfait, not the passé composé. | Accepted for the first iteration. Teacher question. |
| S3-1 | Major (found in slice 3) | `MAX_TRANSLATIONS = 4` was hard-coded in `CellDialog.tsx:50` and `useWordFormState.ts:31`, and the message said "maximum of 4 translations". With a fifth language a word could never get its fifth translation. | Fixed: one `MAX_TRANSLATIONS` in `lib/language.ts` (= number of languages), message with `{{max}}` in all five locales. |
| S3-2 | Minor | The overview of slice 3 promised "vous". The existing languages are informal (tú, du, imperative). | Decision R1 in `language-french-strings.md`: "tu", for one product voice. The teacher confirms. |
| S3-3 | Minor | `supportedLngs` and Turnstile `fr` were planned for slice 2. A code in `supportedLngs` without files makes i18next request missing files. | Moved to slice 3, with the files. |
| S3-4 | Minor | Running e2e needs :5001 and :5173 free; a running `npm run dev` (or its leftover `nodemon`) blocks it and restarts the backend on every backend edit. | Side task: e2e on its own ports and database (not part of the French plan). Until then: stop dev before e2e. |
| F1 | Moderate (decision in slice 4, changed by the user the same day) | Slice 4 first built no superlative field: French forms it from the comparative. The user asked for it, locked like the Estonian "kõige" field, so a learner has the form to study and exercises can compare it with languages that have superlative forms. | Done: `superlativeFR` is always locked, shows and saves `le ` + the comparative (also through the locked comparative: "le plus beau"), and shows a placeholder while there is no comparative. New in the form engine: a derivation without `when`, `via` (a source that is itself derived) and `emptyPlaceholderKey`. |
| F5 | Minor | The comparative and the superlative are stored in the male singular only. French agrees them (plus grande, les plus grands; meilleure). The form cannot store those. | Accepted: the positive's agreement forms are in the card. Teacher question: add the agreement forms later? |
| F2 | Minor | The words-table gender filter holds the article, not the language: "la" selects Spanish and French feminine nouns together. | Accepted. A fix needs the case name in the filter (`genderFR=la`); not worth it for two languages. |
| F3 | Minor (found in slice 4) | `languageToFieldName` in `wordController.ts` hard-coded the four `registeredCasesXX` names; slice 1 missed it. | Fixed: it reads the language table. Recorded in the guide. |
| F4 | Minor | The adjective "position" options are English text ("Before the noun"), the same as the preposition. They are grammar terms shown in every interface language. | Accepted, as for prepositions. Teacher question: wording of the three positions. |
| m1 | Minor | `verbGroupFR` replaces `regularityFR`, so French verbs have no regular/irregular drill. | Teacher question. Adding the radio later is one field. |

## Context

Ladu has had exactly four languages (EN, ES, DE, EE) for its whole life. The product goal is many more. French is the first new one, and the first one the user does not speak. This plan has two outcomes:

1. **French works end to end.** It is a language to learn and an interface language. It has forms for all 6 parts of speech, exercises, autocomplete from Wiktionary, an onboarding pool and a demo template.
2. **The next language is easier.** A guide `.context/guides/add-language.md` is written *while* we add French. Each slice adds the files it touched. A first refactor slice reduces the number of hand-copied language lists, so the guide is shorter.

The user trusts the first design of the French forms to the assistant. A French teacher reviews it when a working version exists. So the plan also produces a **teacher review sheet** (slice 7).

## Decisions from the user (2026-10-25)

- **L1. Full language.** French is a language to learn **and** an interface language: 14 `fr/*.json` locale files, emails, landing page. One list keeps both meanings (no split).
- **L2. Scope.** Forms first, then autocomplete (kaikki/Wiktionary) with a coverage check.
- **L3. Consolidate first.** One language module per tier before French is added (no behaviour change).
- **L4. Include the onboarding pool and the demo template** as late slices.
- **L5. Working mode.** Auto mode from phase 0 (2026-10-26). The slice rules in `CLAUDE.md` still apply: overview first, tests with the code, no commits by the assistant.

## Facts checked in the code (2026-10-25)

- **No migration.** `translations.language`, `users.languages`, `ui_language`, `native_language` and `lexemes.language` are `varchar` or `text[]` (`backend/src/db/schema.ts:196-202, 394, 881`). The backend validates no case names.
- Stored language value = the full English name (`'French'`). Case-name suffix = `FR`. i18n code `fr`. kaikki/ISO code `fr`. There is no `ee`/`et` trap like Estonian.
- Frontend: the `Lang` enum (`frontend/src/ts/enums.ts:527`) and the `UI_LANGUAGES` table (`frontend/src/lib/language.ts:24`) feed menus, flags, review, practice and onboarding. The form engine is config-driven: no new components. `getFormConfig` returns `undefined` for a missing (PoS, language) pair and `TranslationCard` shows "not available". `coverage.ts` already models partial coverage.
- `NOUN_CONFIGS`, `VERB_CONFIGS` and `ADJECTIVE_CONFIGS` are `Record<Lang>` (required). The other three are `Partial`. Each config file has its own `LANG_SUFFIX` copy.
- Backend copies of the language set: `controllers/userController.ts:67` (`SUPPORTED_LANGUAGES`), `controllers/demoController.ts:29`, `services/exercises/types.ts:9` and `validate.ts:9`, `services/dictionary/registry.ts:18` and `translate.ts:30,66`, `lib/wordSort.ts:17`, `services/exercises/catalogue.ts:57` (`LANGUAGE_SUFFIX`; `SingleLanguageCatalogue = Record<Language, …>`), `scripts/lexicon/common.ts:11`, `extract.ts:24,46`, `ingest.ts:32`, `load.js:46`, `lib/onboardingPool.ts`, `scripts/lexicon/onboarding-pool.ts:47`, `utils/resources/emailStrings.js`, `services/onboarding/labels.ts`.
- i18n: `frontend/src/i18n.ts:43` has `supportedLngs`; `fallbackLng` is `'en'`. Missing French keys show English, so the interface can land in steps. About 1,400 strings in 14 namespaces. Locale parity tests: `features/{practice,auth,demo}/locales.test.ts` and `onboarding.test.tsx`.
- No special-character palette exists. Users type accents with their own keyboard. French needs nothing extra.
- The raw Wiktionary dump `backend/scripts/lexicon/.data/raw-wiktextract-data.jsonl.gz` (2.98 GB, 2026-10-03) is on the local disk. `extract.ts` filters it to `en|es|de|et`.
- Outside the app: `landing/app.js` (`LANGS`, `STRINGS`), `landing/index.html:70`, `landing/credits.html`, `landing/flags/`, the demo intro (`DemoIntro.tsx:53`), `.github/workflows/ci.yml:150` (lexicon fixtures) and `e2e/playwright.config.ts:93`.

## French form design (first iteration; for the teacher to check)

Sources for the research: Bescherelle (conjugation), Grevisse *Le Bon Usage*, CNRTL/TLFi, Académie française, Wiktionary, Universal Dependencies. Not blogs or AI sites. Every label, heading and pronoun is in French, like the other languages (the headings in `verbs.ts` are native terms).

| PoS | Fields (case names end in `FR`) | Notes |
|---|---|---|
| **Noun** | `genderFR` radio, required: `le` / `la` / `le/la` (new `GenderFR`, same shape as `GenderES`) · `regularityFR` radio · `singularFR` required · `pluralFR` | Plural irregulars: cheval/chevaux, œil/yeux. Elision (l'arbre) is a display rule only (review log M2). |
| **Verb** | `infinitiveFR` required, pattern `/(er\|ir\|re)$/` · `verbGroupFR` radio: 1er groupe / 2e groupe / 3e groupe (replaces regularity for French) · `auxVerbFR` toggle avoir / être · `reflexivityFR` radio (pronominal: se laver) · `pastParticipleFR`, `presentParticipleFR` · grid **Indicatif**: Présent, Imparfait, Passé composé, Futur simple × Je / Tu / Il/Elle/On / Nous / Vous / Ils/Elles | Case names `indicativePresent1sFR`, `indicativeImperfect…FR`, `indicativePerfect…FR`, `indicativeSimpleFuture…FR`. The passé composé gets an adornment, like the German Perfekt (`deAdornment`, `verbs.ts:272`): ai/as/a/avons/avez/ont or suis/es/est/sommes/êtes/sont. The user types the participle per person, so être agreement (allés) fits. The reflexive hint is me/te/se/nous/vous/se, before the verb. Subjunctive and conditional are deferred (teacher question). |
| **Adjective** | `maleSingularFR` required, `femaleSingularFR` required, `malePluralFR`, `femalePluralFR` (2×2 grid like ES) · `comparativeFR` with the box `periphrasticFR` ("plus " + the male singular, saved) · `superlativeFR`, always locked ("le " + the comparative, saved) · box `hasVowelFormFR` shows `vowelFormFR` (bel, nouvel, vieil) · optional `positionFR` radio: before / after / either | **Built in slice 4.** The superlative is a locked field (review log F1). The box and the form have two names because a property needs a prefix and a written form must not have one. |
| **Adverb** | `adverbFR` required · `gradableFR` radio (required, like EN/ES/EE) · `comparativeFR`, `superlativeFR` visible when gradable, periphrastic checkbox ("plus " / "le plus ") | Irregular: bien → mieux → le mieux, beaucoup → plus. Copy the ES adverb builder. |
| **Conjunction** | The shared `buildConfig` (`conjunctions.ts:89`): `conjunctionFR`, `conjunctionTypeFR`, `correlativeFR` + `secondPartFR` (ni … ni, soit … soit) · `moodFR` select like ES (bien que, pour que → subjonctif) | |
| **Preposition** | `prepositionFR` required · `positionFR` radio (durant can follow: "sa vie durant") | au/aux/du/des are a general rule for à and de (same as ES al/del): no field. |

New property prefixes (in `PROPERTY_PREFIXES`, `catalogue.ts`): `hasVowelForm` (slice 4, done) and `verbGroup` (slice 5). Check that `beforeVowel…`, `pastParticiple…` and `presentParticiple…` start with no property prefix (regression test).

Exercises (`catalogue.ts`): nouns use `singularFR` / `pluralFR`. Verbs: present → `indicativePresent`, past → `indicativeImperfect` (the passé composé form is a participle, so it is too easy), future → `indicativeSimpleFuture`. Drills: noun gender multiple choice (le, la, le/la), verb auxiliary multiple choice (avoir, être), text input infinitive → past participle.

## Slices

One slice at a time. Each slice starts with a plain-language overview, ends runnable with its tests green, adds its touchpoints to `add-language.md`, ticks the Progress list and gets a suggested commit message.

**Slice 0 — Guide skeleton.** Create `.context/guides/add-language.md`. Sections: research template per language, decisions to take, touchpoint checklist by tier, what needs no change, rollout. Add its row to `.context/README.md`. Add a link in `add-part-of-speech.md` (its "do this for each of EN, ES, DE and EE" becomes "each language in the language table").

**Slice 1 — Consolidate the language lists (no behaviour change).**
- Backend: new `backend/lib/languages.ts`, the one table `{ name: 'German', suffix: 'DE', iso: 'de', i18n: 'de' }[]`. The lists in `userController`, `demoController`, `exercises/{types,validate,catalogue}`, `dictionary/{registry,translate}`, `wordSort`, `lexicon/translations.ts` and `scripts/lexicon/common.ts` read it. `load.js` is plain JS: it reads the table through `tsx`, or it keeps its list with a test that checks both are equal (decide in the slice overview).
- Frontend: one `LANG_SUFFIX` / key map in `lib/language.ts`, used by the six config files and by `review/{row,completion}.ts` (`LANG_BY_KEY`). The `UiLanguage['key']` and `['i18n']` unions are built from the table.
- All six `*_CONFIGS` maps become `Partial<Record<Lang, …>>`, so a language can land one PoS at a time (coverage already handles this).
- A cross-tier parity test: backend table = frontend `Lang` enum (pattern: `tests/demoTemplate.test.js:18` reads the frontend enum).
- Gate: `npm test`, `npm test -w frontend`, `npm run build`, `npm run test:e2e`.

**Slice 2 — French as a language (no forms yet).** `Lang.FR = 'French'`; a `UI_LANGUAGES` row (`FR`, `Français`, `fr`, `/FR.svg`); `public/FR.svg`; the `--lang-fr` token (light and dark, `tokens.css:51,80`); the backend table row; `common:languages.french` and `startFromWord.inLanguage.french` in the four old locales; the tests that pin the language count (`language.test.ts`, `metrics/selectors.test.ts`, `WelcomeBanner.test.tsx`, `test/msw/authHandlers.ts`, `wordHandlers.ts` …). Result: French can be picked, its card says "not available", and the interface falls back to English.

**Slice 3 — French interface.** 3a: `fr` in `supportedLngs` (`i18n.ts:43`) and in the Turnstile whitelist (`captcha/turnstile.ts:62`), moved here from slice 2 so that no file is requested before it exists; the 14 `frontend/public/locales/fr/*.json` files, and `fr` in the locale parity tests. 3b: emails (`emailStrings.js`), onboarding topic names (`services/onboarding/labels.ts`), the demo strings, and the landing page (`landing/app.js` `LANGS` and `STRINGS`, `landing/flags/FR.svg`, `index.html:70`). The strings get a review list for the teacher (by screen, not by key).

**Slice 4 — Noun and adjective forms.** Enums (`NounCases`, `AdjectiveCases`, `GenderFR`); `WordCasesData` noun rows; the `CaseName` and `interfaces.ts` unions; builders in `nouns.ts` and `adjectives.ts`; locales (`wordForm.noun|adjective.fields` and `errors.formFR` in all five); Review gender (`row.ts:33`, `FilterBar.tsx:46`, `WordCell.tsx:11` chip class for "le"); the `TranslationCard.tsx:349` gender lookup; backend `getRequiredFieldsData`, `wordSort` main case, catalogue nouns and drills; MSW `wordHandlers.ts`. Tests: config field lists, and a backend round trip of "le cheval / les chevaux". Put French back into the `LANGUAGES` list of `tests/unit/caseMapping.test.js` (explicit since slice 2).

**Slice 5 — Verb form.** `VerbCases` FR, `TenseVerbFR`, `VerbMoodFR`, the `VerbTenseData` unions (`wordCasesDataByPoS.ts:46`), registry rows, `PRONOUN_LABELS[FR]`, `buildFrConfig` (avoir/être adornment, reflexive hint), `lib/cases.ts` `TENSE_BUCKET`, catalogue `VERB_TENSES` and drills, `PROPERTY_PREFIXES` `verbGroup` with a regression test.

**Slice 6 — Adverb, conjunction and preposition forms.** `adverbs.ts` (copy ES), `conjunctions.ts` (one `buildConfig` call + mood), `prepositions.ts`.

**Slice 7 — Forms e2e spec and the teacher sheet.** `e2e/tests/language-french-forms.spec.ts`: register with French, add a noun, a verb (with être) and an adjective, see them in `/words`, answer one practice card in French. Snapshot docs (`data-model.md`, `forms-*.md` French sections). `.context/plans/language-french-review.md` for the teacher: one section per PoS with each field, its French label, two example words filled in, and the open questions. Full `npm run test:e2e` green.

**Slice 8 — Autocomplete research.** Re-extract French from the raw dump. Measure coverage per PoS (template: `autocomplete-coverage-report.md` §4 and its appendices): lemmas, forms per verb tense and person, gender on nouns, adjective feminines, translation rows for `fr`. Add the licence (Wiktionary CC BY-SA, same as now) to `licence-study.md` and to the credits. Write the results and the decisions (Q…) in this plan before any code. Check whether a frequency list `fr_50k` exists (hermitdave).

**Slice 9 — French lexicon and lookup.** `common.ts` codes + frequency URL; `extract.ts` regex + translation target `fr`; `selectors/fr.ts` (per PoS, like `es.ts`) + `lexiconSelectorsFR.test.js` + fixture; `ingest.ts` `LANGUAGES` + `FIXTURE_WORDS`; `load.js`; `registry.ts` adapters; the gender → article map in `translations.ts`; the frontend `autocomplete/transforms.ts` registry; `StartFromWord`. Rebuild locally (extract about 2 minutes, then ingest, translations, load). It may split into 9a (nouns, adjectives, adverbs, function words) and 9b (verbs) when slice 8 shows the size.

**Slice 10 — Autocomplete e2e spec.** `lexicon-fr-fixture.jsonl` in `backend/package.json` (`lexicon:load:fixture`), `e2e/playwright.config.ts:93`, `ci.yml:150`. Spec `autocomplete-j-french-lexicon.spec.ts` (pattern: `autocomplete-c-spanish-lexicon`).

**Slice 11 — Onboarding pool and demo template.** Also: the texts "four languages" in `demo.json` (five locales) and the landing word card ("dance, in four languages"), and a French row in `DemoIntro.tsx`. `pool.tsv` gets `fr` and `fr_gender` from the English-hub translations (`scripts/lexicon/onboarding-pool.ts:47,193`, `onboarding-forms.ts:24`, `lib/onboardingPool.ts`, the pool README). `pool-forms.json` is rebuilt from the French lexicon. The demo `data.json` gets French translations, and `DemoIntro.tsx:53` gets an example row. `controllers/demoController.ts` `ALL_LANGUAGES` gets French (it is explicit since slice 2). Tests and an e2e touch.

**Slice 12 — Close.** Finish `add-language.md` and check it against the real diff of this branch (`git diff main --stat`). Write the final rollout runbook. Run the final full e2e suite.

## Rollout runbook (at or after the merge)

- Load `lexicon-fr-<date>.jsonl.gz` and the **rebuilt** `translations-en-<date>.jsonl.gz` (now with French rows) per environment with `deploy/ansible/lexicon.yml`: staging first, then SQL counts, then production. The shape is the same as the conjunctions runbook in `conjunctions-prepositions.md`. The Ansible role does not depend on the language.
- Reseed the demo template per environment (`seed-demo-template.js --reset`).
- Onboarding: nothing to seed (the pool is committed).
- Server side: no new secret. Estonian has Ekilex; French has no such live source.

## Verification

- Per slice: `npm test` (backend), `npm test -w frontend`, `npm run build`. Do not pipe them through `tail` or `head`.
- Manual: `npm run dev`, register with French, add the example words of the slice on `/addWord`, switch the interface to Français.
- e2e: `npm run test:e2e` at slices 1, 7, 10, 11 and 12. Before it: no backend on :5001 (no orphan nodemon tree), and no closed access gate in the local database.
- Lexicon: SQL counts per PoS for `language = 'French'` after the local load (slice 9).
