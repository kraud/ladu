# Word form engine, word pages and the Review table

## Summary

A learner adds a word once and fills in its translations in several languages. Each part of speech has its own grammar fields (for example cases or conjugations), and one form draws them from configuration. The same form edits a word, and the word page shows it. This file also holds the decisions of the first version of the Review table.

Live spec. It replaces two finished plans (archive records: `.context/archive/2026-09-phase-2-noun-crud.md`, `2026-09-phase-3-forms-review.md`). Built 2026-09-10 to 2026-09-15. Gates: `e2e/tests/phase-2-noun-crud.spec.ts`, `phase-3-review.spec.ts`. The word tables as they are today (pagination, selection, clone) are in `features/words-list.md`. Autocomplete is now the dictionary route of `plans/autocomplete-data-source-strategy.md`.

Code map: `frontend/src/features/words/` (`form-engine/` with `configs/`, `buildYupSchema.ts`, `FieldRenderer.tsx`, `TranslationCard.tsx`, `useWordFormState.ts`, `WordForm.tsx`; `pages/` `AddWordPage`, `WordPage`; `review/`), `frontend/src/ts/` (`enums.ts`, `interfaces.ts`, `wordCasesDataByPoS.ts`, ported from the old app), `frontend/src/lib/`. Field lists and yup rules of the old forms: `.context/.frontend/snapshot/forms-*.md`.

## 1. The form engine

One subsystem replaces about 8,700 lines of copy-paste forms. Config is data; one renderer draws it.

- `configs/index.ts`: `getFormConfig(pos, lang)` returns a `TranslationFormConfig { pos, lang, fields }`. Noun and verb configs derive from the `WordCasesData` registry (Noun 21 entries, Verb 111). Adjective and adverb configs are authored from the `AdjectiveCases` and `AdverbCases` enums: the registry has no Adjective or Adverb key. **No Estonian adverb form exists.**
- `FieldConfig` kinds: `text`, `radio`, `checkbox`, `select` (German auxiliary verb and prefix), `multi-select` with `encode`/`decode` (German verb cases, stored as the acronym string in `caseTypeDE`). Options: `group` (tense heading), `visibleWhen { field, equals }`, `pattern { regex, messageKey }`, `adornmentKey` (read-only prefixes), `persisted: false` (state that drives validation or lookups but is never stored as a case: Estonian `searchInEnglish`, Spanish adjective `gender`).
- `buildYupSchema(config, t)` builds the schema. A field hidden by `visibleWhen` validates as optional and is dropped on save.
- Verb configs are layered on the registry by a per-language manifest (render order, excluded rows, synthesized rows, required set). The registry is a superset of the forms and also misses rows (DE and EE lack `regularityDE` and `regularityEE`). Required is per-language data for verbs: EN needs only present 1s; ES the three non-finites; DE the infinitive; EE both infinitives.
- Labels are composed, not enumerated (D7): conjugation labels come from a pronoun table and group headings from a tense table, both keyed by the registry row's `person`, `plurality` and `tense`. Noun labels are keyed by `caseName` under `wordRelated:wordForm.noun.fields.*` (F-4).
- `useWordFormState` holds the cards, the part of speech and the clue. State is **derived**: no `recently*` flag machine. Save needs at least 2 slots, all present translations complete, and something dirty.
- **Observable contract:** create success morphs the "Saving…" toast into a success toast with a "See details" action, goes to `/word/:id`, then resets the form and stays on `/addWord`. Update success shows a toast, locks the fields, stays on the word. Delete success shows a toast and goes to `/`. Errors show a toast and keep the form. Blank case values are dropped on save (never stored as empty rows). On edit hydration, translations whose language is not in `user.languages` are dropped.
- **Regression guard:** `getFormConfig(pos, lang)` yup field lists must equal the old forms' lists and order (`snapshot/forms-*.md`). This is the one place old and new are diffed mechanically.
- Autocomplete rules that stay: filling writes only **empty** fields, never typed values; the debounce is per instance (`lib/useDebouncedCallback.ts`); the Estonian and Spanish-verb sanitizers are query transforms.
- Invalidation: `createWord`, `updateWord`, `deleteWord` invalidate `['words']`, `['words', id]` and `['metrics']`.

## 2. Decisions

Phase 2 (taken 2026-09-10):

| ID | Decision | Status |
|---|---|---|
| F-1 | Pagination deferred to the Review phase. | Done (`words-list.md`). |
| F-2 | Clue only, no tags in the first form. | Superseded: tags are in the form (`tags.md`). |
| F-3 | `GET /api/words/:id` returns 403 for a non-owner; the read-only view waits for tags. | Superseded by `words-list.md` (readable through a followed or Public tag). |
| F-4 | Noun field labels are i18n-keyed (`wordRelated:wordForm.noun.fields.*`). | Kept. |

Phase 3 (D1 to D7 taken 2026-09-12; the rest during the build). Only the decisions that still constrain the code are listed. D18 to D20, D22, D30, D31, D33 to D35, D37, D38 and D43 were layout or copy details; they are in the code and in `.context/design/`.

| ID | Decision | Status |
|---|---|---|
| D1 | Tags stay out of Review at first (no tags column or filter). | Superseded in Phase 4. |
| D2 | The in-cell translation editor ships last so it can be cut. | Done. |
| D3 | No header global search in Review; Review has its own search box. | Deferred: a future A/B test (user, 2026-11-02). |
| D4 | Field lists are reproduced exactly; broken validation is fixed and listed under "Intentional deltas". | Kept. |
| D5 | The filter bar is a collapsible bar above the table. | Superseded by the sidebar layout (`design/04-layout.md`). |
| D6 | The language order lives in the URL (default `user.languages`). Reordering a column does not rewrite the account preference. The Account page is the only writer of `users.languages`. | Kept. |
| D7 | Labels are composed from pronoun and tense tables (about 56 verb keys and 30 adjective or adverb keys per locale instead of 444). | Kept. |
| D8 | `/simple` has a `total` (one `count()` before the cursor predicate). | Kept. |
| D9 | The table uses ported mockup CSS, not a shadcn `table`. | Kept. |
| D10 | `q`, `pos` and `gender` live in the URL. | Kept. |
| D11 | No sorting at first. | Superseded: `?sort=EN|ES|DE|EE&dir=` exists (`lib/wordSort.ts`). |
| D12 | The completion ring's hover detail reads "N of M cases", not a percentage (the row carries a count, not which cases). | Kept. |
| D13 | `?lang=` is the visible set of languages, in order. The control reorders and hides, with an eye button and arrows (no drag and drop). Hiding a language must not move it. | Kept. |
| D14 | The Display-gender switch appears only when a noun is loaded. | Kept. |
| D15 | Search is server-side (a client filter would search only loaded rows). | Kept. |
| D16 | Gender chips are per language (DE `der|die|das`, ES `el|la|el/la`), labelled with the 2-letter code. | Kept. |
| D17 | Draggable table headers are out of scope. | Open, not planned. |
| D24, D42 | The completion ring is behind a "Display progress" toolbar switch. It starts off. | Kept. |
| D25 | `updateWord` must not wipe tags when `tags` is missing (guard `!== undefined`). Later `PUT /api/words/:id` stopped accepting `tags` at all (`tags.md`). | Done. |
| D26 | The open cell dialog lives in local state, not the URL. Back leaves the page. | Kept. |
| D27 | Delete translation goes behind `ConfirmDialog` (the backend destroys the cases and the user's performance rows for it). | Kept. |
| D28 | The cell dialog was own-words only at first. | Closed: read-only cells of followed words (`words-list.md`). |
| D29 | The cell dialog builds its save payload from the fetched `WordBE`, not from `useWordFormState`'s language filter. The backend deletes a translation or a case by omission (`diffTranslations`). | Kept. |
| D32 | Verb cards are one per row in a wide shell (`max-w-7xl`). Other parts of speech use the 2-up grid. | Kept. |
| D36 | The German verb `config.fields` order is `[infinitive, auxiliaryVerb, prefix, regularity, verbCases, …]`. Only the array position moved; values and validation did not. | Kept. |
| D39 | "Change word type" asks for confirmation only when there is something to lose (`useWordFormState.hasContent`). Create mode only: the part of speech is immutable after creation. | Kept. |
| D40 | A collapsed card shows the headline word and "N of M cases". | Kept. |
| D41 | The Review cell dialog opens read-only when a translation exists, with an Edit button. An empty cell opens in edit mode. | Kept. |
| D44 | Row selection is reset on every filter change, so a selected id never targets a word that left the view. A test asserts the reset, not survival. | Kept. |

## 3. Intentional deltas from the old forms

- English verb past, future and conditional 1s are explicitly optional.
- Estonian adjective `keskvorre` and `ulivorre` are **required** (they were both nullable and required; the error keys already exist).
- Spanish adjective `femaleSingular` keeps the strict no-numbers regex.
- The two regularity radios bound to `errors.auxiliaryVerb` are fixed: `FieldRenderer` binds errors by field name.
- The Estonian adjective lookup gates on its own `algvorre` field.
- The stale `TableWordData` type is not ported. Row types follow the live controller response.

## 4. Traps

- `WordPage` back navigation: `router.history.back()` does nothing useful on a direct landing (bookmark or `page.goto`) and can unload the page with the toast. Use `useCanGoBack()` and fall back to `navigate({ to: '/' })`. Review deep links and the cell dialog's close path need the same.
- `e2e/fixtures/db.ts` keeps a pg `Pool` per worker process, and each spec's `afterAll` calls `closePool()`. With `--workers=1` (the CI shape) one spec would kill the pool for the others. The pool is lazy and re-created, so that case is fixed. Keep it lazy.
- shadcn primitives can lack `forwardRef` under React 18 with RHF `Controller`: wrap them.
- The three Estonian dictionary endpoints of the old app could hang (they logged an error and sent no response). Estonian lookups now go through the single dictionary route (see the autocomplete strategy).
- Engine over-abstraction was the main risk. Keep each addition driven by a named form that needs it.

## 5. Open items

Closed 2026-11-02 (confirmed by the user): the review of the ES, DE and EE texts of Phase 2 and 3 (about 86 Estonian keys).

Open: none. D3 (a global word and tag search in the header) is deferred. It will be part of a future A/B test. Ignore it for now (user, 2026-11-02).
