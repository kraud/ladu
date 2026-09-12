# Phase 3 — Form engine completion + autocomplete + Review table

## Context

Phase 2 shipped and merged: backend 145, frontend 188, e2e 9, build green. The config-driven form
engine works end to end but only for **Nouns**. `getFormConfig` returns `undefined` for the other
three parts of speech, `PartOfSpeechSelector` enables one radio, and there is still **no way to list
words** — `/word/:id` is reachable only by typing the URL and `/review` is a placeholder.

Phase 3 closes that loop. It is three subsystems, which is why it is the largest phase in the
roadmap:

1. **Form engine completion** — Verb, Adjective and Adverb configs, so all four parts of speech
   can be created and edited.
2. **Autocomplete** — the eight dictionary-lookup endpoints that pre-fill case fields, plus the
   status row already stubbed inside every translation card.
3. **Review table** — the word list: browsing, filtering, sorting, server pagination, stable-id
   row selection, and per-cell translation editing.

Outcome: a user can create a word of any part of speech, have most of its cases filled by a
lookup, then find, filter, inspect, edit and bulk-delete every word they own from `/review`.

## Decisions taken with the user (2026-09-12)

- **D1 — tags stay deferred.** Review ships with select/owner, Type, and the language columns
  only. No Tags column, no tag filter, no chip-click filtering, no Assign-tag bulk action. The
  column factory and filter bar are structured so Phase 4 appends tags without restructuring.
  This overrides the Tags parts of `snapshot/review-table.md` §3.4/§4.3 and `snapshot/ui/04-review.md`.
- **D2 — the in-cell translation editor ships in Phase 3**, as the last functional slice so it can
  be cut if pace slips.
- **D3 — no header global search in Phase 3.** Review keeps its own local search box. The shell's
  word/tag global search belongs with Phase 4, which supplies the tag half.
- **D4 — field lists are reproduced exactly; broken validation is fixed.** The regression tests
  pin field names and order against the snapshot transcriptions. Contradictory or misbound yup
  rules are normalized, each one listed under "Intentional deltas" below.

Three further calls made by the agent rather than asked, each reversible:

- **D5 — Review's filter bar is a collapsible bar above the table**, not a left sidebar.
  `MOCKUPS/review.html` is authoritative for visual design per `.context/README.md`; the sidebar
  sketch in `snapshot/ui/04-review.md` is the older layout. Same controls either way.
- **D6 — Review's language order lives in the URL**, defaulting to `user.languages` order.
  Dragging a column reorders this view, it does not silently rewrite the account preference.
  The Account page stays the only writer of `users.languages`.
- **D7 — verb, adjective and adverb labels are composed, not enumerated.** Per-caseName label
  keys would mean 444 new verb strings. Instead conjugation fields take their label from a
  pronoun table and their group heading from a tense table, both keyed off the registry's own
  `person` / `plurality` / `tense` fields. About 56 verb keys and 30 adjective/adverb keys per
  locale instead of 444.

## What the exploration established

Findings that shape the work, all verified against source:

- **The registry is a superset of the forms, and is also missing rows.** `WordCasesData.Verb` has
  111 entries: EN 21 (exactly the EN form), ES 42 (the form renders 28 — conditional, imperative
  and compound non-finite rows are never shown), DE 28 and EE 20 (both **missing** the
  `regularityDE` / `regularityEE` rows their forms do render). So verb configs need a per-language
  render manifest layered over the registry, not a naive filter like `nouns.ts` uses.
- **There is no Adjective or Adverb registry at all.** `WordCasesDataByPoS` has only `Noun` and
  `Verb` keys, so those seven configs are authored from the `AdjectiveCases` / `AdverbCases`
  enums against the snapshot transcription. They are small and flat: 3 to 8 fields each.
- **`FieldConfig` cannot express the verb and adjective forms.** It has three kinds
  (`text`/`radio`/`checkbox`), no grouping, no conditional visibility, no per-field pattern, and
  no select. Verbs need a select (German auxiliary verb and prefix), a multi-select whose value
  is serialized to an acronym string (German verb cases), tense group headings, and read-only
  prefixes on the German perfect and future inputs. Spanish adjectives branch their whole field
  set on a gender radio that is not a persisted case. German adverbs hide comparative and
  superlative when non-gradable. This is real engine work, not just data.
- **`GET /api/words/simple` has no pagination and no tests.** It returns the full list as
  `{ amount, partsOfSpeechIncluded, words }`, takes filters as a JSON array of objects whose tag
  entries are keyed by `_id`, and throws on an unrecognised language or part of speech, which
  would 500 the whole list for one bad row.
- **Autocomplete needs no combobox.** It is a button plus a status badge that fills empty fields
  from a lookup, not a typeahead. No new dependency, no popover primitive.
- **The three Estonian endpoints can hang.** Their handlers call `.catch(console.error)` without
  sending a response, so an external-API failure leaves the request open until timeout.

## Architecture

### Form engine v2

`FieldConfig` gains, in `form-engine/configs/types.ts`:

| Addition | Consumed by |
|---|---|
| `kind: 'select'` with `options` | German auxiliary verb, German prefix |
| `kind: 'multi-select'` with `options` and an `encode`/`decode` pair | German verb cases, stored as the acronym string in `caseTypeDE` |
| `group?: { headingKey, level }` | Tense blocks in all four verb forms |
| `visibleWhen?: { field, equals }` | Spanish adjective gender branch, German adverb gradable branch |
| `pattern?: { regex, messageKey }` | Spanish `ar/er/ir`, German `en/ern/eln`, Estonian `ma` |
| `adornmentKey?` | German perfect and future auxiliary prefixes |
| `persisted: false` | Estonian `searchInEnglish`, Spanish adjective `gender` — form state that drives validation and lookups but is never written as a case |

`buildYupSchema` grows conditional rules (`yup.when`) for `visibleWhen` and `pattern`; fields
hidden by `visibleWhen` validate as optional and are dropped on save. `FieldRenderer` grows the
two new kinds and the adornment. `TranslationCard` renders `group` headings and keeps its existing
contract otherwise. `getFormConfig` gains three branches.

### Verb configs

`configs/verbs.ts` follows `nouns.ts`: derive from `WordCasesData.Verb`, filter by language, then
apply a per-language manifest that declares the render order, the excluded registry rows, the
synthesized rows the registry lacks, and the required set. Required is per-language data for
verbs, not a structural rule the way it was for nouns — English requires only present 1s, Spanish
requires the three non-finites, German requires the infinitive, Estonian requires both infinitives.

Conjugation labels come from a `getVerbPronoun`-style lookup over the four pronoun enums already in
`ts/enums.ts`, keyed by `person` + `plurality` from the registry row. Group headings come from a
tense table keyed by the row's `tense`.

### Autocomplete

New `features/autocomplete/` per the standard feature anatomy: `api.ts` (the eight endpoints),
`keys.ts` (`['autocompleteTranslation', lang, pos, query]`), `transforms.ts` (the four shared
Estonian and Spanish-verb sanitizers ported verbatim, plus the four currently inline in old form
components), `hooks.ts` (`useAutocompleteTranslation`, `enabled` only on a valid query). A new
`AutocompleteRow` component drops into the mount point already reserved at
`TranslationCard.tsx:192`. Debounce is a new per-instance `lib/useDebouncedCallback.ts`, replacing
the old module-global timer. Filling only ever writes **empty** fields, never overwrites typed
values.

### Review

New `features/words/review/` with `ReviewTable`, `columns.tsx`, `FilterBar`, `TableToolbar`,
`BulkActionBar`, `CellDialog`, and `pages/ReviewPage.tsx`. Row selection is keyed by word id via
TanStack Table's `getRowId`. Filters live in typed search params on the route, following the
hand-rolled `validateSearch` pattern the login route already establishes. Two new shared pieces:
`components/ui/switch.tsx` and `components/common/CompletionRing.tsx`.

## Slices

Each ends runnable; the user commits and re-confirms between them.

| Slice | Status |
|---|---|
| 0 — persist this plan | ✅ done |
| 1 — form engine v2 | not started |
| 2 — verb configs | not started |
| 3 — adjective and adverb configs | not started |
| 4 — autocomplete | not started |
| 5 — backend: list contract | not started |
| 6 — Review table core | not started |
| 7 — filters, toolbar, bulk bar | not started |
| 8 — cell dialog | not started |
| 9 — phase gate | not started |

**Slice 0 — persist this plan.** This file.

**Slice 1 — form engine v2.** Extend `configs/types.ts`, `buildYupSchema.ts`, `FieldRenderer.tsx`
and `TranslationCard.tsx` with the seven additions above. No new configs yet. Tests cover each new
kind, conditional visibility in both directions, pattern messages, and the acronym round-trip.

**Slice 2 — verb configs.** `configs/verbs.ts` with the four manifests, the pronoun and tense
tables, the new `wordRelated:wordForm.verb.*` keys in all four locales (Estonian flagged for
review), and `SHIPPED_POS` widened to include Verb. Regression test pins all four field lists
against `snapshot/forms-verbs.md`.

**Slice 3 — adjective and adverb configs.** `configs/adjectives.ts` (4 languages) and
`configs/adverbs.ts` (3 — there is no Estonian adverb form). Spanish adjective gender branching
and German adverb gradable branching exercise Slice 1's `visibleWhen`. `SHIPPED_POS` opens fully.
Regression tests pin all seven field lists against `snapshot/forms-adjectives-adverbs.md`.

**Slice 4 — autocomplete.** The feature module, `useDebouncedCallback`, `AutocompleteRow`, MSW
handlers for all eight endpoints, and the found/partial/not-found status. Backend fix in the same
slice: the three Estonian handlers respond 502 instead of hanging on an external-API failure.

**Slice 5 — backend: list contract.** `getWordsSimplified` gains `?cursor=&limit=` keyset
pagination and flat filter params (`pos`, `gender`, `q`) replacing the JSON `filters` array; the
tag branch is kept but re-keyed from `_id` to `id`; `getRequiredFieldsData` returns an empty
object instead of throwing so one odd row cannot 500 the list. First Jest coverage for this
endpoint: row shape per part of speech, gender and part-of-speech filtering, pagination
boundaries, and followed-tag access. Response becomes `{ items, nextCursor }`, matching the
`CursorPage<T>` type already declared and unused in `api/types.ts`.

**Slice 6 — Review table core.** `WordSimpleBE` row type, `getWordsSimplified` / `deleteMany` in
`api.ts`, `useWordsInfinite` / `useBulkDeleteWords` in `hooks.ts`, the `ReviewTable` on TanStack
Table with `getRowId` by word id, the column factory (select/owner, Type, language columns), Load
more, skeleton rows, and both empty states. Route swaps its placeholder and declares
`validateSearch`.

**Slice 7 — filters, toolbar, bulk bar.** The collapsible filter bar (gender chips, part-of-speech
chips, dnd-kit language order), the toolbar (debounced local search, Display-gender switch, row
count), and the bulk bar with View at exactly one selection and Delete at one or more behind a
`ConfirmDialog`. Every filter round-trips through the URL. Create-exercises and Assign-tag are
absent, not disabled — they arrive with Phases 5 and 4.

**Slice 8 — cell dialog.** Clicking a filled cell opens a `Dialog` with that language's full
translation, fed by `useWord` and rendered through `TranslationCard`. Save updates the word and
refreshes the list; Delete translation is author-only and hidden unless the word keeps at least
three translations. Empty cells show Add for own words and a block icon for followed-tag words.

**Slice 9 — phase gate.** `e2e/tests/phase-3-review.spec.ts`, doc updates, full green run.

## Files

Most-touched, by area:

- **Engine**: `frontend/src/features/words/form-engine/configs/{types,index,verbs,adjectives,adverbs}.ts`,
  `buildYupSchema.ts`, `FieldRenderer.tsx`, `TranslationCard.tsx`,
  `frontend/src/components/common/PartOfSpeechSelector.tsx` (the `SHIPPED_POS` line).
  `nouns.ts` is the template to follow and should not need changes.
- **Autocomplete**: new `frontend/src/features/autocomplete/{api,keys,hooks,transforms,types}.ts`,
  new `frontend/src/lib/useDebouncedCallback.ts`,
  `backend/controllers/autocompleteTranslationController.ts` (the three Estonian handlers).
- **Backend list**: `backend/controllers/wordController.ts` (`getWordsSimplified`,
  `getRequiredFieldsData`, `getWordsByTagFiltering`), new `backend/tests/` coverage alongside
  `words.test.js`.
- **Review**: new `frontend/src/features/words/review/*`, new
  `frontend/src/features/words/pages/ReviewPage.tsx`, `frontend/src/features/words/{api,hooks,types}.ts`,
  `frontend/src/app/router.tsx`, new `frontend/src/components/ui/switch.tsx` and
  `frontend/src/components/common/CompletionRing.tsx`.
- **i18n**: `frontend/public/locales/{en,es,de,ee}/wordRelated.json` and `review.json`. Everything
  new goes into the English file first, because the test harness loads English statically and a
  missing key fails a test rather than rendering the key name.

Existing helpers to reuse rather than rewrite: `lib/words.ts` (`primaryCaseWord`,
`partOfSpeechLabelKey`, `filterTranslationsByUserLanguages`), `lib/language.ts` (`langTint`,
`langKeyByLabel`), `lib/toast.tsx` (the loading-toast trio), `lib/avatar.ts` (owner initials),
`components/common/ConfirmDialog.tsx`, `features/words/errors.ts`, and `test/msw/wordHandlers.ts`
as the pattern for the new handler factories.

## Intentional deltas

Beyond D1 to D7, the validation fixes D4 authorizes:

- English verb past, future and conditional 1s become explicitly optional. They were plain
  `Yup.string()` with no required and no nullable, which already behaved as optional.
- Estonian adjective `keskvorre` and `ulivorre` resolve to **required**. They were both nullable
  and required, a contradiction; the error keys `keskvorreFormRequired` and `ulivorreFormRequired`
  already exist in every locale, so required is the intent.
- Spanish adjective `femaleSingular` keeps its required rule with the strict no-numbers regex.
  Its empty-allowing regex was dead under `.required()`.
- The two regularity radios bound to `errors.auxiliaryVerb` are fixed by construction —
  `FieldRenderer` binds errors by field name.
- The Estonian adjective autocomplete gates on its own `algvorre` field, not on an unrelated
  verb field key.
- The stale `TableWordData` type is not ported. The row type is written against the live
  controller response.

## Verification

Per slice, before handing back for commit:

```bash
npm run build -w frontend     # tsc -b + vite
npm test -w frontend          # vitest
npm test                      # backend jest (slices 4, 5, 9)
```

End to end after Slice 8:

```bash
npm run docker:up && npm run db:migrate
npm run dev                   # backend :5001 + vite
npm run test:e2e
```

In the browser: add one word of each part of speech, letting autocomplete fill a German noun and
an Estonian verb; open `/review`; filter by part of speech and reload to confirm the filter
survives in the URL; drag a language column; select one row and use View; select several and
delete them; click a cell and edit a case; click an empty cell and add a translation.

The Phase 3 e2e spec walks: create words across parts of speech through the real engine, apply a
filter, reload and see it still applied, page in the next batch with Load more, click a row after
a filtered refetch and land on the correct word, and run one autocomplete lookup that populates
fields.

Gate: all four commands green, plus `grep -rn "setTimerTriggerFunction" frontend/src` empty and
row selection asserted to survive a filter change in a test.

## Risks

- **Engine over-abstraction.** Seven config additions is a lot at once. Mitigation: each is driven
  by a named form that needs it, and Slice 1 lands them with tests before any config consumes them.
- **Verb manifests drifting from the old forms.** Mitigation: the regression tests pin names and
  order per language, the same mechanism that guarded nouns.
- **Estonian copy for roughly 86 new keys.** Flagged for the user to check, as in Phase 2.
- **Scope.** Ten slices is the largest phase so far. Slice 8 is the designated cut line; Slices 1
  to 7 plus 9 still deliver a usable Review page.
- **Direct-URL back navigation.** Phase 2's `useCanGoBack` lesson applies to Review deep links and
  the cell dialog's close path. Both get the same treatment.
