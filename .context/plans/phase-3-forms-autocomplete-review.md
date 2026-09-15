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
| 1 — form engine v2 | ✅ done 2026-09-12 |
| 2 — verb configs | ✅ done 2026-09-13 |
| 3 — adjective and adverb configs | ✅ done 2026-09-13 |
| 4 — autocomplete | ✅ done 2026-09-13 |
| 5 — backend: list contract | ✅ done 2026-09-13 |
| 6 — Review table core | ✅ done 2026-09-14 |
| 7 — filters, toolbar, bulk bar | ✅ done 2026-09-14 |
| 8 — cell dialog | ✅ done 2026-09-14 |
| 9 — form layout: paired rows (nouns, Spanish adjectives) | ✅ done 2026-09-15 |
| 10 — form layout: verb tense columns + width | ✅ done 2026-09-15 |
| 11 — phase gate | not started |

**Slice 0 — persist this plan.** This file.

**Slice 1 — form engine v2.** Extend `configs/types.ts`, `buildYupSchema.ts`, `FieldRenderer.tsx`
and `TranslationCard.tsx` with the seven additions above. No new configs yet. Tests cover each new
kind, conditional visibility in both directions, pattern messages, and the acronym round-trip.

### Outcome — what landed (2026-09-12)

Built to the design section above with no deviations. All seven additions landed as planned:

- **`configs/types.ts`** — `FieldKind` gained `'select'` and `'multi-select'`; `FieldConfigBase`
  gained `persisted?`, `group?`, `visibleWhen?`, `adornment?`; `TextFieldConfig` gained `pattern?`.
  New exported types: `FieldGroup { headingKey, level: 1 | 2 }`, `FieldVisibility { field, equals }`,
  `FieldPattern { regex, messageKey }`, `FieldAdornment { watchField, values }`,
  `SelectFieldConfig`, `MultiSelectFieldConfig` (the latter carrying `encode`/`decode` functions,
  not a data-only shape — the acronym mapping is config, not engine, logic). `RadioOption` is
  reused as the option type for `select` and `multi-select` too, rather than introducing a
  parallel `FieldOption` alias.
- **`buildYupSchema.ts`** — `pattern` layers one more `.matches()` onto a text field's base schema
  (chained after required/optional, before `visibleWhen`). `visibleWhen` is applied last, via
  `schema.when(visibility.field, { is, then: () => schema, otherwise: () => hiddenFallbackSchema(kind) })`
  — a hidden field always validates against an unconstrained optional schema of the right base
  shape, regardless of its own `required` flag. `select` mirrors `radio`'s required/optional split;
  `multi-select` is always `yup.array().of(yup.string()).default([])` — no consumer needs a
  required one.
- **`FieldRenderer.tsx`** — added `select` (shadcn `Select`) and `multi-select` (a checkbox group
  toggling array membership) render branches, both with `displayOnly` text variants (select: the
  matched option label; multi-select: selected labels joined with `, `). `visibleWhen` is resolved
  with a `useWatch` on the sibling field *before* the `FormField` mounts — a hidden field renders
  `null` outright, in both modes, rather than being disabled. `adornment` renders a read-only
  `<span>` before a text input's `FormControl`, sourced from a second `useWatch`; kept outside
  `FormControl` (which clones props onto its one child) so the label's `htmlFor` still targets the
  actual `<input>`. `isEmptyValue` now treats an empty array as empty, so an all-unchecked
  multi-select is gated the same way an empty text field is in `displayOnly` mode.
- **`TranslationCard.tsx`** — `fieldsToCases` and its hydration counterpart were pulled out of
  inline `useMemo` callbacks into two named exports, `fieldsToCases` and `casesToFieldValues`,
  specifically so Slice 1's encode/decode round trip and the two new drop rules (`persisted:
  false`, hidden by `visibleWhen`) could be unit-tested against hand-built configs — no real
  config exercises `multi-select` or `visibleWhen` until Slices 2–3. A third export,
  `fieldStartsGroup(fields, index)`, is the pure boundary check the render loop uses to decide
  when to print a group heading (a field's `group.headingKey` differs from the previous field's);
  extracting it gave the same direct-testability without needing a grouped config to exist yet.
  The render loop wraps each field in a `Fragment` and prints the heading (`level: 1` underlined,
  `level: 2` as a small muted eyebrow) immediately before the field that starts a new group.
- **One deviation from the plan's literal architecture table**: `adornment` (not `adornmentKey`).
  The German perfect/future prefix is the *conjugated auxiliary verb itself* (a German word,
  identical regardless of UI language), not translated UI copy — so it isn't a job for `t()`. The
  config instead supplies a small `values` lookup table straight from a sibling field's value to
  the prefix text. This still delivers the plan's "read-only prefixes on the German perfect and
  future inputs" capability; only the internal shape changed.
- **Type-checking note**: `textFieldSchema`'s two conditional branches (required vs. optional)
  produce differently-typed `yup.StringSchema` instantiations (nullable vs. not) that `tsc`
  refused to unify under an explicit `yup.StringSchema` variable annotation. Removed the
  annotation and let the ternary's result flow untyped into the `yup.AnySchema` return position
  instead — same runtime behaviour, no `as`/`@ts-ignore`.

**Tests**: `buildYupSchema.test.ts` (+12: select required/optional/invalid, multi-select
empty/non-empty, pattern reject/accept, visibleWhen required-while-matching/optional-once-not/
still-accepts-a-leftover-value); `FieldRenderer.test.tsx` (+7: select render+pick+displayOnly,
multi-select render+toggle+displayOnly-join+displayOnly-empty-hidden, visibleWhen both directions
via a two-field harness, adornment appearing once the watched sibling resolves); `TranslationCard.test.tsx`
(+17: `fieldsToCases`' four drop/keep rules, the multi-select encode/decode round trip via
`casesToFieldValues`, and `fieldStartsGroup`'s five boundary cases). A new `MultiHarness` helper in
`FieldRenderer.test.tsx` mounts several fields on one shared RHF instance for the two features that
depend on a sibling's live value.

**Verified**: `npm run build -w frontend` (tsc -b + vite) green; `npm test -w frontend`
**188 → 220** (32 new, matching the file-by-file counts above). Backend untouched — not re-run
this slice, per the same pattern Phase 2 followed for its non-backend slices.

**Slice 2 — verb configs.** `configs/verbs.ts` with the four manifests, the pronoun and tense
tables, the new `wordRelated:wordForm.verb.*` keys in all four locales (Estonian flagged for
review), and `SHIPPED_POS` widened to include Verb. Regression test pins all four field lists
against `snapshot/forms-verbs.md`.

### Outcome — what landed (2026-09-13)

Two decisions were checked with the user before implementation and both affected the engine
surface, not just `verbs.ts`:

- **Pronoun labels and tense/mood group headings are hardcoded native-language strings in
  `verbs.ts`**, not i18n keys — they're the target language's own grammatical terms (`"Yo"`,
  `"Ich"`, `"Mina"`), invariant across interface language, exactly like `nouns.ts`'s
  `GENDER_OPTIONS`/`REGULARITY_OPTIONS` already treat gender/regularity values. Only genuinely
  UI-descriptive field labels (`"Infinitive"`, `"Auxiliary verb"`...) go through
  `wordRelated:wordForm.verb.fields.*`, matching `nouns.ts`'s existing pattern — about 13 keys x 4
  locales, reconciling with the phase plan's original "~56 keys" D7 estimate.
- **Spanish keeps all three of its stacked headings** ("Modo indicativo:" / "Tiempo simple:" /
  "Presente") rather than collapsing to two — `FieldGroup` moved from a single object to an
  outer-to-inner array (`group?: FieldGroup[]`), and `TranslationCard`'s `fieldStartsGroup` became
  `groupHeadingsToPrint`, which diffs the array against the previous field's and returns only the
  changed tail (so an already-visible outer heading never reprints).

Three further engine additions, made without a separate check-in since each is either a direct
analogy to an already-approved mechanism or forced by real registry data, all flagged in the
implementation report handed back for review:

- **`FieldPattern.relaxedWhen?: FieldVisibility`** — Estonian's `-ma` infinitive pattern is
  conditionally relaxed by the `searchInEnglish` checkbox, which is neither `visibleWhen` (hides a
  field) nor a static `pattern`. `buildYupSchema.ts` branches on it the same way it already
  branches on `visibleWhen`, via `base.when(relaxedWhen.field, { is, then: () => base, otherwise:
  () => withPattern })` — the field stays required either way, only the extra `.matches()` is
  conditionally dropped.
- **`FieldVisibility.equals` widened to `string | boolean`** — forced by `relaxedWhen` watching a
  checkbox (a real `boolean` RHF value) for the first time; every existing `visibleWhen` consumer
  watches a radio/select (`string`), so this is additive.
- **`FieldConfigBase.label?: string` (a literal, non-`t()` label) and `labelKey` became optional.**
  `FieldRenderer`/`TranslationCard` always called `t()` unconditionally on `labelKey`/`headingKey`;
  routing pronoun/heading text through a missing i18n key was rejected as unsafe (this test harness
  fails on a missing key rather than rendering it literally, per Slice 1's own note on English-first
  key authoring). `label`, when present, bypasses `t()` entirely — mirroring how `RadioOption.label`
  already works. `FieldGroup.headingKey` was renamed to `heading` for the same reason and dropped
  its `t()` call in `TranslationCard`'s render loop.
- **`caseName` is optional only on `CheckboxFieldConfig`** (all other kinds keep it required) —
  needed for Estonian's `searchInEnglish`, a `persisted: false` checkbox with no backing case enum
  at all (unlike the Spanish adjective `gender` example already in the docs, which does have one).
  Keeping it required on the other four kinds meant `fieldsToCases`/`casesToFieldValues` narrow
  correctly for free after their existing `kind === 'checkbox'` branches — no runtime guard needed.

`configs/verbs.ts` follows the design almost exactly as planned, with the registry itself turning
out simpler than expected: every language's tense rows are *already* in registry declaration order
matching the old form's render order (no per-row sorting needed anywhere) — the manifest work is
entirely property-row ordering/exclusion up front, done with a `isTenseRow` type-predicate filter
(drops every property row uniformly) plus, for Spanish only, a `mood === indicativeES` filter that
excludes the conditional/imperative rows and both compound non-finite rows in one step (they carry
different `mood` values already). `regularity` is synthesized unconditionally for all four
languages via `VerbCases['regularity' + suffix]`, exactly like `nouns.ts`, regardless of whether
the registry happens to carry that row (EN/ES do, DE/EE don't).

Two intentional deltas beyond the ones D4 already lists, both cosmetic (group-heading text, never
validation): German's own heading was the untranslated English word "Indicative:" in the old form —
fixed to "Indikativ". Spanish's own Future-tense heading was likewise the untranslated English word
"Future" — fixed to "Futuro". `formDE.regularityRequired` was added (missing before — the old form's
DE regularity radio reused `formEN`'s key, a copy-paste bug); `formES.infinitiveNotMatching` was
added too (the old ES form hardcoded that message as a raw English string outside i18n entirely).

**Tests**: `configs/verbs.test.ts` (new, 7 tests) pins all four field-name lists and required-field
sets against `forms-verbs.md`, the `caseName === name + suffix` invariant (carving out
`auxiliaryVerb`/`verbCases`, whose old-app names never matched their case names mechanically, and
`persisted: false` fields), and that every conjugation field carries a non-empty pronoun label.
`buildYupSchema.test.ts` (+4: `relaxedWhen` enforced/dropped/still-required/still-accepting).
`TranslationCard.test.tsx`: `fieldStartsGroup`'s tests became `groupHeadingsToPrint`'s (same
boundary cases, plus one multi-level stack case), and a new `TranslationCard — Verb` block (+4)
exercises the full render pipeline end to end for the first time against a real config — English's
two-level stack, Spanish's three-level stack printing the changed tail only, German's select +
multi-select + live adornment (switching `auxiliaryVerb` from haben to sein flips the Perfect
adornment from "habe" to "bin"), and Estonian's checkbox-relaxed pattern (which only clears once
`infinitiveMa` itself is next blurred — a `mode: 'onBlur'` characteristic of the existing engine,
not new behaviour). `FieldRenderer.test.tsx` needed one mechanical fix: `radioField.caseName` is
now `CaseName | undefined` at the `FieldConfig` union level, so five hand-built fixtures gained a
`!`. `PartOfSpeechSelector.test.tsx` updated for Verb now being enabled (8 disabled parts of speech,
not 9).

**Verified**: `npm run build -w frontend` (tsc -b + vite) green; `npm test -w frontend`
**220 → 237** (17 new). Backend untouched — not re-run this slice, same pattern as Slice 1.

**Slice 3 — adjective and adverb configs.** `configs/adjectives.ts` (4 languages) and
`configs/adverbs.ts` (3 — there is no Estonian adverb form). Spanish adjective gender branching
and German adverb gradable branching exercise Slice 1's `visibleWhen`. `SHIPPED_POS` opens fully.
Regression tests pin all seven field lists against `snapshot/forms-adjectives-adverbs.md`.

### Outcome — what landed (2026-09-13)

Much lighter than Slice 2: no registry at all (`AdjectiveCases`/`AdverbCases` have no
`WordCasesData` entry — every field is authored directly from the enum against the snapshot), no
pronoun/tense-heading complexity, and every required field validates with the engine's plain
default rule (no consumer in this slice needed `pattern`). One engine addition, checked with the
user before implementation:

- **`FieldVisibility` gained `invert?: boolean`** — German adverb's `comparative`/`superlative` are
  visible by default and hidden only once `gradable` is explicitly set to `"Non-gradable"`, the
  first `visibleWhen` consumer that isn't a positive "show when equals" match. A new
  `matchesVisibility(visibility, value)` helper (`configs/types.ts`) centralizes the equals/invert
  comparison so `buildYupSchema.ts`, `FieldRenderer.tsx` and `TranslationCard.tsx`'s
  `fieldsToCases` — the three places that already each re-implemented the plain equals check —
  can't drift from each other now that there are two comparison modes instead of one.
- **A second, unplanned type change**: Spanish adjective's `gender` field is a `persisted: false`
  **radio**, not a checkbox — the first case-less field of a non-checkbox kind. Slice 2's tightening
  (`caseName: CaseName` required on every kind except `CheckboxFieldConfig`) didn't anticipate this,
  so `RadioFieldConfig.caseName` reverted to optional (inherited from the base) alongside an
  explicit `if (!field.caseName) continue;` / `?? ''` guard in `fieldsToCases`/`casesToFieldValues`
  — replacing the free type-narrowing Slice 2 relied on with a one-line runtime check in the two
  places that actually read `caseName`.

`configs/adjectives.ts` and `configs/adverbs.ts` both follow the design exactly as planned. Every
field name falls out mechanically from `stripLangSuffix(caseName, suffix)` — unlike verbs, there
are no naming exceptions, so neither regression test needs a carve-out list. Spanish's gender
branch is one flat field array (`gender` + all six branch fields) with `visibleWhen` doing the
branch-switching; German's `gradable` branch is the same shape with `invert` on the two hidden
fields.

Three intentional deltas, all flagged for review, none touching validation:
- **German adjective's own `positive` field label was the untranslated English word "Positive"**
  in the old form, inconsistent with its own siblings "Komparativ"/"Superlativ" — fixed to
  "Positiv", the same category of leftover-untranslated-label bug Slice 2 fixed twice for verbs.
- **Spanish gender's `oneOf` error message was the bare hardcoded string `"Required"`** in one of
  the old app's two schema branches (vs. the proper i18n key in the other) — both now use the
  existing `formES.genderRequired` key.
- **Estonian adjective's three degree-required error messages were copy-pasted from Spanish's
  wording** (`algvorreFormRequired` read "Masculine singular degree is required" in every locale
  file, describing Spanish gender concepts, not Estonian degree concepts) — rewritten to actually
  describe algvõrre/keskvõrre/ülivõrre (positive/comparative/superlative degree) in each locale.

New `wordRelated:wordForm.adjective.fields.*` / `wordForm.adverb.fields.*` keys in all four locale
files, following `nouns.ts`'s established convention exactly: each locale translates the concept
into its own words (matching `nouns.ts`'s own `singularNimetavEE`-style precedent of translating
Estonian's nimetav/omastav/osastav case names into nominative/genitive/partitive elsewhere, but
keeping them native in the Estonian locale file itself) rather than reproducing the old app's
occasionally-untranslated literal text. Radio option labels (`Neutral`/`M/F`, `Gradable`/
`Non-gradable`) stay literal/untranslated, matching `RadioOption`'s existing no-i18n convention.
Estonian translations across both new `fields` blocks are flagged for review, same as every other
slice this phase.

**Tests**: `configs/adjectives.test.ts` (new, 6 tests) and `configs/adverbs.test.ts` (new, 6 tests)
pin field-name lists and required-field sets per language against the snapshot, plus — the first
configs to need it — the *visible* subset per branch (Spanish's Neutral vs. M/F gender branches;
German's gradable/non-gradable), and the `caseName === name + suffix` invariant (no carve-outs
needed). `buildYupSchema.test.ts` (+3: `invert` visible-while-not-equal, visible-before-any-value,
hidden-once-equal). `TranslationCard.test.tsx` gained `TranslationCard — Adjective` (+1: the
Spanish gender switch end to end, asserting the dropped branch's value never reaches `onChange`)
and `TranslationCard — Adverb` (+2: the German gradable switch showing/hiding live, and the missing
Estonian adverb route falling back to the existing "language not available" card).
`PartOfSpeechSelector.test.tsx` updated for Adjective/Adverb now being enabled (6 disabled parts of
speech, not 8).

**Verified**: `npm run build -w frontend` (tsc -b + vite) green; `npm test -w frontend`
**237 → 259** (22 new). Backend untouched — not re-run this slice, same pattern as Slices 1–2.

**Slice 4 — autocomplete.** The feature module, `useDebouncedCallback`, `AutocompleteRow`, MSW
handlers for all eight endpoints, and the found/partial/not-found status. Backend fix in the same
slice: the three Estonian handlers respond 502 instead of hanging on an external-API failure.

### Outcome — what landed (2026-09-13)

No engine changes — `configs/types.ts`, `buildYupSchema.ts` and `FieldRenderer.tsx` are all
untouched this slice, as scoped. Two stale details in the plan text itself, found while
implementing, corrected here rather than in the design section above (which stays as written for
history): the mount point is `TranslationCard.tsx`'s render loop (a bare comment, not a stubbed
status row — nothing rendered there before this slice), and it had drifted to line 240, not 192.

**Backend fix.** `getVerbEE`/`getNounEE`/`getAdjectiveEE` in `autocompleteTranslationController.ts`
shared one `.then(res.json).catch(console.error)` tail with no response on failure. Extracted into
one `respondFromEstonianAPI(res, url)` helper (used by all three) that responds `502` with a
generic JSON message on rejection — including a `JSON.parse` failure inside `getDataFromAPI` itself,
which previously threw uncaught inside the `.then` and was never actually reaching the `.catch` at
all. New `backend/tests/autocomplete.test.js` coverage (+3) mocks `https.get`'s returned request
object to emit an `'error'` event and asserts `502`, not a hang — the existing "returns data" test's
own mock only ever wires the `'data'`/`'end'` events on the *response* object, so this needed its
own mock shape (the request object's `.on('error', ...)`, not the response's).

**Frontend feature module**, `features/autocomplete/{types,api,keys,transforms,hooks}.ts`, built to
the plan's four-file shape. Real deviations, all found by reading the current backend controller
directly rather than trusting the plan's framing or the old frontend's assumptions:

- **Only 4 transform functions exist, not 8.** `getVerbEN`, `getVerbES`, `getVerbDE`, `getNounDE`,
  and `getNounGenderES` (Spanish noun-gender) all share one wire envelope verified directly against
  `autocompleteTranslationController.ts` — a `found<Type>` flag plus an optional `<type>Data.cases`
  array of `{caseName, word}` — so one `transformGenericLookup` covers all five. Only the three
  Estonian endpoints (a raw external-dictionary passthrough with no such envelope) need a bespoke
  transform each. This also means the plan's "four sanitizers ported verbatim" from the old
  sibling repo's `autocompleteFormFunctions.ts` is really **three**: `sanitizeDataStructureEENoun`,
  `EEAdjective`, and `EEVerb` port over directly (as `transformEENoun`/`EEAdjective`/`EEVerb`). The
  fourth, `sanitizeDataStructureESVerb`, assumed a deeply-nested `verbData.indicative.present...`
  response shape that the *current* `getVerbES` controller does not produce — it already returns
  the same flat `{caseName, word}[]` array as every other non-Estonian endpoint (confirmed by
  reading the controller, not assumed), so Spanish verb needs no bespoke transform at all, just the
  generic one. The plan's other three "currently inline" ports (ES noun-gender, DE verb, DE noun)
  turned out to need no bespoke code either, for the same reason — verified against
  `NounFormES.tsx`/`NounFormDE.tsx`/`VerbFormDE.tsx` in the old repo, which confirmed the field
  names but nothing behavioural beyond what the generic transform already does.
- **`AutocompleteResult.cases` is a `Map<CaseName, string>`, not a `Partial<Record<CaseName, string>>`
  as sketched in the architecture section above.** `CaseName` unions four separate enums that share
  string values across each other (`NounCases.regularityEN` and `VerbCases.regularityEN` are both
  `"regularityEN"`), which breaks `tsc`'s ability to index a `Record` keyed by the union at all
  (`error TS7053: Element implicitly has an 'any' type`) — confirmed with an isolated repro before
  reaching for a workaround. `TranslationCard.tsx`'s own `casesToFieldValues` hits this identical
  shape (case name -> word) and already sidesteps it with a `Map`; this slice follows that existing
  precedent rather than introducing a second pattern for the same problem.
- **The registry keys fields by their RHF `name`, not by `CaseName`.** The Estonian `searchInEnglish`
  checkbox — the one extra field the registry needs to watch — is `persisted: false` with no
  `caseName` at all, so a `CaseName`-keyed registry couldn't reference it. `AutocompleteEndpoint`
  carries `queryFieldName`/`extraFieldName` as plain RHF field-name strings instead; `AutocompleteRow`
  separately maps a result's `CaseName` keys onto sibling fields' RHF names by scanning
  `config.fields` for a matching `caseName`, so the two naming schemes never need to unify.
- **English's query field is `simplePresent1s`, not an infinitive field — there is no stored
  English infinitive case.** Confirmed against the old repo's `VerbFormEN.tsx` (the only remaining
  file that needed reading beyond the current backend controller, since this mapping isn't
  derivable from the controller alone): the old form already used its own `simplePresent1s` input
  as the query for `GET .../english/verb/:infinitiveVerb`, debounced via the same module-global
  timer, gated on that field's own validity. This slice's registry reproduces that mapping exactly.
- **Only EE verb's registry entry has an `extraFieldName`.** The `searchInEnglish` checkbox exists
  only on the Estonian *verb* config (added in Slice 2 for its `relaxedWhen` pattern feature) — the
  Estonian noun and adjective configs never grew one in Slices 1–3, despite the backend accepting
  `?searchInEnglish=true` on all three endpoints. EE noun and EE adjective lookups therefore always
  search natively for now. Adding that checkbox to `configs/nouns.ts`/`configs/adjectives.ts` would
  be a real (if small) product-behaviour addition outside this slice's scope, not a bug fix, so it
  was left out and flagged here rather than guessed at.
- **`lib/useDebouncedCallback.ts` exports a value-debounce, not a callback-debounce** — a plain
  `useEffect`+`setTimeout` hook that returns the settled value, one timer per hook instance (the
  actual fix for the old module-global `setTimerTriggerFunction`, which a *single* shared timer id
  meant two fields debouncing at once would cancel each other's lookups). The file name matches the
  plan's reservation; the export shape doesn't, since `AutocompleteRow` only ever needs "this field's
  value, settled," and wrapping a callback would add a memoization concern with no behavioural gain.

**`AutocompleteRow`** lives beside `TranslationCard.tsx` (form-engine UI), not inside the
`features/autocomplete/` module (data/transport only), matching the engine's existing
component/feature split. It renders `null` outright for every `(language, PoS)` pair absent from
the registry (confirmed coverage: EN verb only; ES/DE verb+noun; EE verb+noun+adjective — 8 pairs
total, matching the phase plan's endpoint count). For a covered pair it watches the query field (and,
EE verb only, `searchInEnglish`) via `useWatch`, debounces the value, and fires
`useAutocompleteTranslation` automatically once the lookup is enabled — no manual "search" trigger,
per the user's decision. A status line (`loading`/`foundMatch`/`partialMatch`/`noMatch`, reusing and
extending the existing `wordForm.autocompleteTranslationButton.*` i18n keys rather than the plan's
suggested new `wordRelated:autocomplete.*` namespace — those keys already existed, unused, in all
four locale files from an earlier phase, with exactly the copy this slice needed) only shows once a
non-blank query has actually run; clearing the field back to blank hides it again rather than
leaving a stale result on screen. The **Fill** button is the one manual action — enabled only on
`found`/`partial` — and, per the user's decision, writes a looked-up case only into a field whose
current value is empty, iterating `config.fields` and skipping any field the user has already typed
into. No new UI primitive: the status text is a plain `<span>`, not a shadcn `Badge` (none exists in
`components/ui/` yet), which is a one-line, easily-swapped choice rather than a new dependency for
one slice.

**MSW handlers** — new `test/msw/autocompleteHandlers.ts`, following `wordHandlers.ts`'s
factory-returning-state pattern: `makeAutocompleteHandlers(responses)` returns `{ handlers, requests
}`, with per-endpoint response overrides and a request log for payload/query assertions, covering
all 8 routes (a bare failure marker `{ status: N }` on the three Estonian slots doubles as the
502-path fixture for future tests, though this slice's failure-path coverage lives entirely in the
new backend Jest tests).

**i18n** — three new keys added to the existing `wordForm.autocompleteTranslationButton` block
(`partialMatch`, `loading`, `fillButton`) in all four locale files, alongside the four keys already
sitting there unused since an earlier phase. Estonian copy flagged for review, same as every prior
slice this phase.

**Tests**: `features/autocomplete/transforms.test.ts` (new, 18 tests) — the three Estonian
transforms' found/not-found branches including the short-form and shared-past-perfect-form
mappings, `transformGenericLookup`'s found/partial/not-found branches and its empty-word drop rule,
and the full 8-entry registry coverage table plus each entry's `queryFieldName`/`extraFieldName`
pinned directly (the same "pin the exact list" discipline the config regression tests already use).
`features/autocomplete/hooks.test.tsx` (new, 5 tests, against the new MSW handlers): disabled for an
uncovered `(language, PoS)` pair, disabled for a blank query, a found English verb, a found Estonian
verb through its bespoke transform, and a not-found German noun. `lib/useDebouncedCallback.test.ts`
(new, 5 tests, fake timers): initial value, no update before the delay, update once it elapses, timer
reset on every intermediate change, and two hook instances never sharing a timer.
`features/words/form-engine/AutocompleteRow.test.tsx` (new, 5 tests): renders nothing for an
uncovered pair, automatic debounced fetch showing a found status, a not-found status with Fill
disabled, Fill only writing the empty sibling field, and the Estonian `searchInEnglish` checkbox
reaching the query. `TranslationCard.test.tsx` gained a `TranslationCard — Autocomplete integration`
block (+4, one per language with any registry entry): English verb typing into `simplePresent1s`
then Fill populating `simplePresent3s` ("He/She/it") while leaving nothing else touched, Spanish verb
confirming the infinitive field drives the request, German noun typing the singular nominative then
Fill checking the gender radio, and Estonian verb typing `infinitiveMa` then Fill populating
`infinitiveDa`.

**Verified**: `npm run build -w frontend` (tsc -b + vite) green; `npm test -w frontend` **259 → 296**
(37 new, matching the file-by-file counts above); `npm test` (backend) **145 → 148** (+3, the new
Estonian-failure-path tests) — the first backend run since Slice 1, unchanged otherwise.

**Slice 5 — backend: list contract.** `getWordsSimplified` gains `?cursor=&limit=` keyset
pagination and flat filter params (`pos`, `gender`, `q`) replacing the JSON `filters` array; the
tag branch is kept but re-keyed from `_id` to `id`; `getRequiredFieldsData` returns an empty
object instead of throwing so one odd row cannot 500 the list. First Jest coverage for this
endpoint: row shape per part of speech, gender and part-of-speech filtering, pagination
boundaries, and followed-tag access. Response becomes `{ items, nextCursor }`, matching the
`CursorPage<T>` type already declared and unused in `api/types.ts`.

### Outcome — what landed (2026-09-13)

Built to the design section above with no deviations. `wordController.ts`'s `getWordsSimplified`
was rewritten end to end: `parseArrayParam` normalises a repeated query key (`?pos=Noun&pos=Verb`)
or a single value to `string[]`; `pos`/`gender`/`q`/`tag` each compile to an `AND`-ed, uncorrelated
subquery `IN` condition rather than the old separate-round-trips-plus-in-memory-intersection
approach — the base access condition (`own words OR words from followed tags`) still gates every
one of them, so a `tag` filter cannot leak another user's words (pinned by a test).

Keyset pagination orders `created_at DESC, id DESC`. The cursor is base64 of
`"<ISO createdAt>|<uuid>"`; a raw `(created_at, id) < ($1, $2)` row-value comparison was tried
first but Postgres does not reliably type-infer the composite literal's parameters there, so it
silently failed to filter — the shipped predicate expands to
`created_at < $1 OR (created_at = $1 AND id < $2)` instead, with a code comment recording why. The
page query fetches `limit + 1` to detect `hasMore` without a second round trip. New migration
`0002_words_created_at_id_index.sql` adds `words_created_at_id_idx` on `(created_at, id)`; it is
ASC/ASC against a DESC/DESC scan, which Postgres satisfies by scanning the index backwards rather
than needing a second DESC-specific index.

**Tests**: new `backend/tests/words-simple.test.js` (13 tests) — row shape per part of speech
(including the two regression cases: an unrecognised language and an unrecognised part of speech
both return 200 with the offending key simply absent, not a 500); single and repeated-key `pos`;
`gender`; `q` substring match; tag inclusion and the tag-filter-cannot-leak-another-user's-words
case; pagination (a word inserted between two page requests is excluded from the already-issued
cursor, and the union of both pages equals every created id) and the malformed-cursor 400; followed-
tag access.

**Verified**: `npm test` (backend) **148 → 161** (jest run at the time; see Slice 6 below for the
count after that slice's `total` addition). Frontend untouched — not re-run this slice, per the same
pattern non-frontend slices have followed all phase.

**Slice 6 — Review table core.** `WordSimpleBE` row type, `getWordsSimplified` / `deleteMany` in
`api.ts`, `useWordsInfinite` / `useBulkDeleteWords` in `hooks.ts`, the `ReviewTable` on TanStack
Table with `getRowId` by word id, the column factory (select/owner, Type, language columns), Load
more, skeleton rows, and both empty states. Route swaps its placeholder and declares
`validateSearch`.

### Decisions taken with the user (2026-09-14)

- **D8 — `/simple` gains a `total`.** The Slice 5 response (`{ items, nextCursor }`) carries no
  count matching the filters, which the mockup's footer and the Slice 7 toolbar need. One
  `count()` query runs against the filter conditions before the cursor predicate is added, so it
  stays constant across pages of one filter set. Response becomes `{ items, nextCursor, total }` —
  `CursorPage<T>` widened to match.
- **D9 — the table is styled with ported mockup CSS, not a shadcn `table` primitive.** Continues
  the Phase 1–2 precedent (`.card`/`.chip`/`.empty`/`.skeleton` already live in `globals.css`).
- **D10 — Slice 6 reads `q`/`pos`/`gender` from the URL and sends them**, a slice earlier than the
  plan's original split, so the phase's "filters survive reload" gate is testable now; Slice 7
  only adds the UI that writes the URL.
- **D11 — no sorting in Slice 6.** `GET /api/words/simple` has no sort parameter (order is
  hardcoded `created_at DESC, id DESC`) and a client-side sort would silently sort only the pages
  already loaded. Headers ship with no sort control; a backend sort parameter is future work.
- **D12 — the completion ring's hover detail reads "N of M cases", not a percentage.** The row
  carries a bare `registeredCasesXX` count, not which cases were filled in, so an exact percentage
  is undecidable for the two configs (Spanish adjective, German adverb) that branch their whole
  field set on a `visibleWhen`-controlled sibling. The ring's arc still fills proportionally
  (clamped to 100%); only the text is a count.

### Outcome — what landed (2026-09-14)

Built to the design section above, plus one type-system finding that turned out NOT to be a
problem: the `TS7053` failure that forced `TranslationCard`'s `casesToFieldValues` onto a `Map` in
the autocomplete slice (Slice 4) was specific to `Record<CaseName, T>`, where `CaseName` unions
four enums with colliding string values. `WordSimpleBE`'s dynamic keys derive from
`'EN'|'ES'|'DE'|'EE'` (`LangKey`, an alias of `lib/language.ts`'s `UiLanguage['key']`) — a
collision-free literal union — so template-literal mapped types (`{ [K in LangKey as
\`data${K}\`]?: string }`) are fully indexable with plain property access. No `Map` needed here.

- **`WordSimpleBE`** — flat, dynamically-keyed, `tags: WordTagRef[]` (the same shape `WordBE.tags`
  already carries — not a second type). Every `data*` key is optional even when the language IS
  stored: `getRequiredFieldsData` looks up the required case via `.find()`, and when a translation
  was persisted without it the key is simply absent from the JSON. This gives a cell **three**
  states, not two — `review/row.ts`'s `hasTranslation` (reads `storedLanguages`) is the
  authoritative "is there a translation" check, deliberately separate from `headlineWord`.
- **The completion ring's denominator (`review/completion.ts`)** mirrors `TranslationCard.tsx`'s
  `fieldsToCases` drop rules (`persisted: false`, `checkbox`, no `caseName`) over
  `getFormConfig(pos, lang).fields`, with one refinement beyond a flat filtered count: a field
  gated by `visibleWhen` is evaluated against every one of its controlling sibling's own declared
  option values (not a fixed true/false guess), and only the largest resulting branch is added to
  the total — a config can only ever be on one branch at a time. This handles `invert` (German
  adverb's `gradable`) the same way it handles a positive match (Spanish adjective's `gender`)
  with one algorithm. Verified exact against every noun/verb/adjective/adverb config's pinned field
  list; returns 0 (no ring rendered) for the six unshipped parts of speech and for Estonian adverb,
  which has no config by design.
- **A real hazard found and closed by construction, not by a try/catch**: `apiClient`'s response
  interceptor clears the session on *any* 401, and `deleteManyWords` answers 401 for "User not
  authorized to delete at least one of the words". A naive bulk-delete UI over a list that includes
  followed-tag rows could hit that branch and silently log the user out. `ReviewTable`'s
  `enableRowSelection: (row) => row.original.user === userId` makes the branch unreachable from
  this UI — flagged for the user as a candidate for a narrower interceptor fix later, not fixed
  here since that's a cross-cutting change outside this slice.
- **`ReviewTable` is deliberately router- and store-free** — every input, including navigation, is
  a prop (`onAddWord: () => void`, not a `<Link>`) — found necessary, not just tidy: `test/render.tsx`'s
  `renderWithProviders` has no router context, and an internal `<Link>` crashed
  (`useLinkProps`/`TypeError: Cannot read properties of null`) the first time a test exercised the
  "no words yet" empty state. `ReviewPage` is the only place `<Link>`/`useNavigate` appear.
- **`resolveLanguageOrder(search.lang, user.languages)`** (D6): URL order wins for the keys it
  names, anything omitted or unrecognised is appended in the account's own order — a partial or
  stale `?lang=` can never lose a column. The zero-language edge case (reachable by a direct URL
  bypassing the header's own ≥2-language nav gate, since `_protected.beforeLoad` only checks the
  token) renders an `EmptyState` linking to `/user` instead of a zero-column table.
- **MSW**: `/simple` and `/deleteMany` were added *inside* the existing `makeWordHandlers` factory,
  ahead of the `:id`-parameterised routes — registering them as a second, later factory would have
  them silently swallowed by `*/api/words/:id` matching `:id === 'simple'`/`'deleteMany'` first
  (MSW matches in registration order). The fake's row simplifier hardcodes the backend's own
  primary-case table rather than reusing `lib/words.ts`'s `primaryCaseWord`, which picks the first
  `required` text field and disagrees with the backend for Spanish adjectives (`neutralSingularES`
  vs. the backend's male-first fallback). `AppHeader.test.tsx`'s existing "lets Review through"
  test needed a `makeWordHandlers` registration it didn't need before, now that `/review` mounts a
  real page that fires a real request instead of a static placeholder.
- **`review.json`** grew a `table` block (PoS abbreviations for the Type column, the owner-dot
  tooltips, the ring detail string, Add/Block a11y labels, the loaded/all-loaded footer copy) and
  an `empty` block (`noWords` / `noMatches` / `noLanguages`) in all four locales — English first.
  Estonian copy flagged for review, same as every prior slice this phase.

**Tests**: `backend/tests/words-simple.test.js` (+2, the `total` assertions: stays constant across
pages of one filter set and reflects a `pos` filter). `features/words/review/search.test.ts` (new,
18 tests) — all three array input forms, unknown `pos`/`lang` values dropped, the numeric/boolean
`q` un-coercion (the router's `qss.toValue` trap), `resolveLanguageOrder`'s four cases.
`features/words/review/completion.test.ts` (new, 21 tests) — every noun/verb/adjective/adverb
combination pinned against its config's real field list, including the Spanish-adjective and
German-adverb branch collapses, the two "no config" zero cases, and memoisation stability.
`features/words/review/row.test.ts` (new, 6 tests) — the four `LangKey` accessors, including the
stored-without-headline case. `components/common/CompletionRing.test.tsx` (new, 4 tests) — no-ring
at zero total, proportional `--pct`, the >100% clamp, the always-rendered (CSS-hidden) detail text.
`features/words/review/WordCell.test.tsx` (new, 6 tests) — all three cell states, the gender-chip
toggle, and the no-ring case. `features/words/review/ReviewTable.test.tsx` (new, 9 tests) — header
order, stable-id selection surviving a data replace, a non-owned row's checkbox disabled, skeleton
row/column counts, both empty states plus the error state, Load more gating. `features/words/pages/ReviewPage.test.tsx`
(new, 6 tests, via `renderApp`) — the placeholder is gone, a URL `pos` filter reaches the request,
`?lang=` reorders columns, Load more appends a second page (51 seeded words), both empty states.
`features/words/hooks.test.tsx` (+11) — `normalizeWordFilters` canonicalisation,
`useWordsInfinite` paging via `nextCursor` (including a 51-word two-page run), the repeatable-`pos`
query-string encoding, `useBulkDeleteWords`'s cache cleanup/invalidation and all three error
branches. `features/words/errors.test.ts` (+4, the four new mapped messages).
`components/layout/AppHeader.test.tsx` — its "lets Review through" case now registers word
handlers.

**Verified**: `npm run build -w frontend` (tsc -b + vite) green; `npm test -w frontend`
**296 → 378** (82 new); `npm test` (backend) **148 → 163** (+15 total for Slices 5+6 combined —
13 from Slice 5's new test file plus the 2 `total` assertions this slice added to it).

**Slice 7 — filters, toolbar, bulk bar.** The collapsible filter bar (gender chips, part-of-speech
chips, a language order control), the toolbar (debounced local search, Display-gender switch, row
count), and the bulk bar with View at exactly one selection and Delete at one or more behind a
`ConfirmDialog`. Every filter round-trips through the URL. Create-exercises and Assign-tag are
absent, not disabled — they arrive with Phases 5 and 4.

### Decisions taken with the user (2026-09-14)

- **D13 — the language control reorders *and* hides.** `?lang=` becomes the **visible set, in
  order**, superseding D6's "omitted keys are appended" rule from Slice 6. Implements the
  blueprint's two-container list (`ui/04-review.md:32`) and finally uses the
  `fieldLabels.activeLanguages` / `hiddenLanguages` keys that had sat unused in all four locales
  since Slice 6. A min-2 floor applies; a stale/short `?lang=` falls back to the full account order.
- **D14 — the Display-gender switch appears only when a noun is actually loaded**, reproducing the
  spirit of `review-table.md:79-81` (the old app gated on the PoS filter including Noun). Corrected
  after the first user review: gating on the *filter chip* rather than the *loaded rows* hid the
  switch even when nouns were plainly on screen in the unfiltered list — the switch now reads
  `rows.some(r => r.partOfSpeech === Noun)` instead.
- **D15 — search stays server-side.** `?q=` keeps substring-matching every stored case word
  server-side (as Slice 6 already wired), not the blueprint's "filters the visible rows
  client-side" (`ui/04-review.md:42`) — a client-side filter would only ever search pages already
  loaded, the same reasoning D11 already applied to sorting.

Three further calls made without a separate check-in, each small and reversible:

- **D16 — gender chips are per-language, not cross-language groups.** The first build grouped
  German and Spanish spellings under one chip each (`der · el`, `die · la`, `das · el/la`); user
  review asked for German (`der`/`die`/`das`) and Spanish (`el`/`la`/`el/la`) as two separate rows
  of single-value chips instead, leaving a multi-language badge for a possible future pass. Each
  chip now toggles exactly one stored case value.
- **D17 — draggable table headers are out of scope.** `ui/04-review.md:40` also wants column
  headers themselves draggable; Slice 7's own scope line names only the filter-bar control.
- **D18 — `ReviewTable.tsx` is untouched.** See "Composition" below — the toolbar and bulk bar
  mount in `ReviewPage`, not inside `ReviewTable`'s own render tree.
- **D19 — the language control has no drag-and-drop.** The first build was a two-container
  dnd-kit list (Active ⇄ Hidden); user review asked for a single flat row instead, with an eye /
  eye-slash button toggling visibility (replacing the earlier X-to-hide / +-to-show pair) and the
  existing ← / → arrows doing the reordering, unchanged. This also means `@dnd-kit/*` — installed
  since Slice 6 — has **no consumer** in the app; nothing imports it, so it never reaches the
  production bundle (confirmed by the build output shrinking after the rewrite). It stays installed
  in case a later phase wants a real drag interaction elsewhere.
- **D20 — hiding a language must not move it.** D19's first cut recomputed the flat row fresh every
  render as `[...active, ...hidden]`, so a hidden language always visually relocated to the end of
  the row (mixed in among the other hidden languages, in account order) — a second round of user
  review caught this. The control now owns a stable `order` array (local state, holding every
  account language exactly once) that visibility toggles never touch; only an explicit ← / → move
  changes a language's position. Showing a hidden language re-inserts it at its existing `order`
  slot rather than appending it, and reordering swaps two *visible* languages by value wherever
  they sit in `order`, so a hidden language sitting between them is never disturbed by that swap.

### Outcome — what landed (2026-09-14)

**Composition.** The mockup nests the toolbar and bulk bar *inside* `.main-col`, above
`.tablewrap`. But `ReviewTable` early-returns its empty/error states, replacing its whole
`.main-col` — a toolbar rendered inside it would vanish exactly when the user most needs it
(filtered to nothing, needing the search box to clear it). So `ReviewPage` now owns an outer
`.main-col` rendering `TableToolbar` → `BulkActionBar` → `<ReviewTable>` (which keeps its own inner
`.main-col`); both are `flex-direction: column; gap: 12px`, so nesting reproduces the mockup's
spacing exactly. `ReviewTable.tsx` needed no edit at all (D18) — its 9 Slice-6 tests stayed green
throughout.

**`review/search.ts`** — `resolveLanguageOrder` rewritten for D13 (visible-set-in-order, min-2
floor, full account-order fallback below that), plus a newly-exported `accountLanguageOrder`
(the pure "account order, ignoring the URL" half, needed by both `ReviewPage` — to seed the
Hidden column of the language control — and by `resolveLanguageOrder` itself). All 5 of Slice 6's
`resolveLanguageOrder` tests were rewritten for the new semantics; `hasActiveFilters` and
`reviewSearchToFilters` were untouched.

**`review/languageOrder.ts`** (new, twice-revised) — the array math behind the language control,
split out as pure functions for the same reason `row.ts`/`completion.ts` already exist. Its final
shape (D20): `initialOrder` (seeds the stable `order` state on mount — active languages first, in
their given order, then the rest of the account in account order), `reconcileOrder` (keeps `order`
in step with the account's language set, and rebuilds only when `active` changed from *outside*
this component's own actions — a direct URL edit or browser back/forward; returns `prev` by
reference, not just by value, when nothing changed, so `LanguageOrderControl`'s `setState` call can
bail out of the extra render), `hideLanguage` (unchanged — drops from `active`, floor-guarded),
`showLanguage` (re-inserts into `active` at the language's existing `order` position — the fix
D20 needed, replacing the plain-append it had before), and `moveWithinOrder` (swaps two *visible*
languages by value wherever they sit in `order`, returning both the new `order` and the new
`active` together, so a hidden language between them never moves). The drag-adapter function
(`computeDragEndChange`) and its container-id constants from the first (D19) rewrite are gone.

**`review/LanguageOrderControl.tsx`** (new, twice-revised) — a single flat row rendering the stable
`order` array (component state, not recomputed from props each render). Each chip is a ← / eye
(-slash) / → triplet: the eye toggles visibility (`hideLanguage`/`showLanguage`) without ever
calling `setOrder` — position is a separate concern from visibility by construction, not by
convention — and the arrows call `moveWithinOrder`, updating both `order` and firing `onChange`
with the derived `active`. A hidden chip's arrows are simply disabled (nothing to reorder it
relative to) and it renders slightly greyed via a `[data-hidden]` CSS hook. A `useEffect` on
`[active, allLanguages]` runs `reconcileOrder` after every change; because every one of this
component's own actions already leaves `order`'s visible subset in exact agreement with the
`active` it just passed to `onChange`, that effect is a same-reference no-op immediately after any
of them — it only does real work for a genuine external change. No `DndContext`, no sensors, no
drag state at all.

**`review/FilterBar.tsx`** (new) — the collapsible `.card.filterbar`, defaulting to expanded (the
mockup's own default). PoS chips are generic `.chip` toggles; `columns.tsx`'s private `posAbbrKey`
helper was exported so the filter chips and the Type column share one abbreviation source rather
than duplicating the PartOfSpeech→abbreviation map. Gender chips are two per-language rows (D16),
each labelled with the language's native name (`languageByKey('DE').native` = "Deutsch") and a
`FlagIcon`, never translated — consistent with how `WordCell`/`LanguagePicker` already treat
language names. No Tags group, per D1.

**`review/TableToolbar.tsx`** (new) — the debounced (500 ms) search box, built on the existing
`lib/useDebouncedCallback.ts` value-debounce, and the Display-gender `Switch`. `showSwitch` is a
plain boolean prop — `TableToolbar` itself has no opinion on what drives it; `ReviewPage` supplies
it from `rows.some(r => r.partOfSpeech === Noun)` (D14, corrected after user review — see above).
One bug found and fixed by its own test before this ever reached a real page: the naive `useEffect`
on the debounced value fires on **mount** too (React runs every effect after the first render),
which would have written a spurious `q: undefined` navigate on every single page load before any
typing happened. A `useRef` mount guard skips that first firing.

**`review/BulkActionBar.tsx`** (new) — owns its own `ConfirmDialog` state (reusing
`components/common/ConfirmDialog.tsx` unchanged) rather than pushing a `confirming` boolean up into
`ReviewPage`, matching how self-contained the rest of the review feature's small components already
are. Renders `null` at zero selection; View enabled only at exactly one; Delete calls
`useBulkDeleteWords` (Slice 6, unchanged) through `ReviewPage`'s toast/error wiring.

**`components/ui/switch.tsx`** (new) — a plain `<button aria-pressed>` with a `.track` knob
(`MOCKUPS/review.html:159-161`), not `@base-ui/react/switch` — per D9, small enough that porting the
exact mockup markup was simpler than onboarding a new base-ui primitive for its one consumer.

**CSS** — `.layout`, `.filterbar`, `.fb-body`, `.fb-group`, `.fb-collapsed`, `.active-pill`,
`.chips`, `.lang-chip`, `.toolbar`, `.switch` (+`.track`), and `.bulkbar` ported from
`MOCKUPS/review.html:9-62` into `globals.css`, translating `var(--radius)` → `var(--radius-md)`.
One real deviation from the plan's literal architecture: the bulk bar's buttons **are** shadcn
`Button` (the `.btn` family is deliberately never ported, D9), so `.bulkbar`'s button overrides are
written against `.bulkbar [data-slot="button"]` — the attribute shadcn's own `button.tsx` already
stamps on every instance — rather than requiring a marker class on every consumer.

**i18n** — new `filters.*`, `toolbar.*` and `bulk.*` blocks in all four `review.json` locales,
English authored first. Estonian copy flagged for review, as every slice this phase.

**Tests**: `features/words/review/search.test.ts` (net +9: 2 new `accountLanguageOrder` cases, the
5 `resolveLanguageOrder` cases rewritten to 7 for D13's visible-set semantics).
`features/words/review/languageOrder.test.ts` (18 tests) — every pure function's normal and
boundary cases (including the min-2 floor and the D20 fix's core claims: `showLanguage` re-inserts
at the language's existing `order` slot rather than appending, `moveWithinOrder` leaves a hidden
language sitting between two swapped visible ones untouched, and `reconcileOrder` returns the exact
same array reference when nothing changed). `features/words/review/LanguageOrderControl.test.tsx`
(11 tests) — rendering, ± reorder both directions, hide (allowed and floor-blocked), show, a hidden
chip's arrows both disabled, the `[data-hidden]` marker present only on hidden chips, and a
dedicated "hiding preserves position" block (3 tests, via a `Controlled` wrapper owning `active`
state across re-renders): hide-then-show returns a language to its exact original slot rather than
the end; hiding the first language leaves the row order otherwise unchanged; a manual reorder
survives an unrelated language's hide/show round trip. `features/words/review/FilterBar.test.tsx`
(13 tests) — collapse/expand, the active-count pill (including gender values counting
individually), both per-language gender groups rendering and toggling independently (D16), Clear's
conditional visibility, PoS toggle on/off, no Tags group. `features/words/review/TableToolbar.test.tsx`
(7 tests, fake timers) — the debounce window, timer reset on keystroke, whitespace-only mapping to
`undefined`, external-reset resync, the switch's conditional visibility (prop-driven, D14's actual
gate lives in `ReviewPage`), row count. `features/words/review/BulkActionBar.test.tsx` (5 tests) —
zero-selection null render, View's exactly-one gate, the confirm-dialog round trip, Cancel doing
nothing. `features/words/pages/ReviewPage.test.tsx` (+8, via `renderApp`/MSW): a PoS chip narrowing
the list and reaching the request, a single per-language gender chip reaching the request, a filter
surviving a real reload (a fresh `renderApp` mount at the post-filter URL, not just a client-side
re-render), hiding a language dropping its column with **zero** extra `/simple` requests (proving
`lang` truly never re-triggers the query), the Display-gender switch appearing once a noun is
loaded with no PoS filter applied and staying absent with none loaded (D14's regression test), and
both bulk-delete tests (confirm round-trip removing the rows with a pluralized success toast;
View's exactly-one gate end to end).

**Verified**: `npm run build -w frontend` (tsc -b + vite) green — and its output bundle shrank
(963 KB → ~923 KB minified) once `@dnd-kit/*` lost its only would-be consumer under D19; `npm test -w frontend`
**378 → 445** (67 net new). Backend untouched — not re-run this slice, same pattern as every
non-backend slice this phase.

### Third round of user-review fixes (2026-09-14)

Four more corrections, made after a second pass over the running app — none change the URL
contract or any backend behaviour, so all stay inside this slice rather than opening a new one:

- **D21 — the gender filter's per-language label is the 2-letter code (`DE`/`ES`), not the native
  name (`Deutsch`/`Español`).** The flag already identifies the language; the code reads faster
  next to three short case-word chips than a full native name does.
- **D22 — the Type column shrinks to its abbreviation's own width.** `.dtable`'s auto table layout
  (`width: 100%`, no explicit per-column widths) was stretching every column — including a 2–4
  character abbreviation — to share the table's leftover space evenly. `ReviewTable.tsx` now tags
  that column `.pos-col` (header and cell alike), and `globals.css` applies the standard
  auto-layout "shrink to content" trick: `width: 1%` plus `white-space: nowrap` forces the browser
  to give that column only what its content needs, leaving the freed space for the language
  columns instead. (This is the first edit to `ReviewTable.tsx` since D18 — that decision was about
  Slice 7's initial composition choice, not a permanent freeze on the file.)
- **D23 — the completion detail is a real floating `Tooltip`, not an inline CSS hover-reveal.** The
  old `.ring-wrap:hover .ring-detail { display: inline }` trick rendered the "N of M cases" text
  *inline*, next to the ring, which pushed the word text and gender chip sideways while hovering —
  exactly the layout-shift the user flagged. New `components/ui/tooltip.tsx` wraps
  `@base-ui/react/tooltip` (installed already, unused until now) in the same thin-wrapper style as
  `dialog.tsx`/`checkbox.tsx`; `CompletionRing` now renders the ring as a focusable `TooltipTrigger`
  and the detail as `TooltipContent`, portal-rendered so it floats over the table instead of
  occupying flow layout. Reachable by keyboard focus, not just hover.
- **D24 — the completion ring itself is now gated behind a new "Display progress" toolbar switch**,
  built the same way as "Display gender" but **always visible** rather than noun-gated — completion
  applies to every part of speech with a config, not just nouns. Threads through exactly the same
  chain gender already does: `ReviewPage` (new `showProgress` state, default on) →
  `TableToolbar` (new `Switch`) → `ReviewTable` → `columns.tsx`'s `BuildColumnsOptions` →
  `WordCell` (skips rendering `CompletionRing` entirely when off).

**Tests**: `FilterBar.test.tsx`'s gender-group test rewritten for the 2-letter label, scoped with
`within()` since the same code also appears in the language-order chips on the same page.
`ReviewTable.test.tsx` (+1): both the Type header and its cells carry `.pos-col`.
`CompletionRing.test.tsx`'s "always renders detail text" test replaced with two: the detail text is
absent until interaction, and `userEvent.hover` on the ring reveals it via `findByText` (exercising
the tooltip's real open delay rather than mocking it away). `WordCell.test.tsx` (+1, all call sites
gained `showProgress`): the ring disappears entirely when `showProgress` is off even though a
config exists. `TableToolbar.test.tsx` (+1): the new switch shows regardless of `showSwitch`
(unlike gender) and toggles. `ReviewPage.test.tsx` (+1): the switch is on by default and turning it
off removes every `.ring` from the page.

**Verified**: `npm run build -w frontend` (tsc -b + vite) green; `npm test -w frontend`
**445 → 450** (5 net new). Backend untouched.

**Slice 8 — cell dialog.** Clicking a filled cell opens a `Dialog` with that language's full
translation, fed by `useWord` and rendered through `TranslationCard`. Save updates the word and
refreshes the list; Delete translation is author-only and hidden unless the word keeps at least
three translations. Empty cells show Add for own words and a block icon for followed-tag words.

### Decisions taken with the user (2026-09-14)

- **D25 — the tag-wipe bug is fixed in the backend.** `updateWord` read `req.body.tags || []`,
  so a PUT that omits `tags` (every PUT this frontend sends — `UpdateWordBody` has no `tags`
  field) silently deleted every tag association on the word, including from the already-shipped
  `WordPage` edit path. Fixed with a `req.body.tags !== undefined` guard mirroring the one
  `translations` already had, plus two new Jest tests.
- **D26 — the open cell lives in local React state**, not the URL, matching `BulkActionBar`'s own
  confirm dialog. Browser Back leaves `/review` rather than closing the dialog.
- **D27 — Delete translation goes behind `ConfirmDialog`**, unlike the mockup's immediate delete —
  consistent with `WordPage`'s delete and the bulk bar, and not cheaply reversible (the backend
  destroys the translation's cases and the user's `exercise_performances` rows for it).

Three further calls made by the agent, each reversible and flagged for review:

- **D28 — the dialog is own-words-only this slice; the spec'd read-only variant is deferred to
  Phase 4.** `GET /api/words/:id` 403s a non-owner outright (its own comment says followed-tag
  read access arrives in Phase 4), and with tags deferred (D1) there is no way to even produce a
  followed-tag word in this app yet — the branch is unreachable, not merely unbuilt.
  `WordCell.tsx`'s filled-cell button gained the `isOwn` guard its empty-cell branch already had;
  a non-own row's filled cells now render an inert `<span>` instead of a button that would 403.
- **D29 — the save payload is built from the fetched `WordBE` directly, not through
  `useWordFormState`'s `filterTranslationsByUserLanguages`.** That helper drops any translation in
  a language the account no longer lists — correct for the compose form, wrong here, since the
  backend deletes a translation by omission (`diffTranslations`) and a case by omission too. The
  dialog always sends the word's complete stored translation set with exactly one language's cases
  changed, and always sends that language's complete case set.
- **D30 — the dialog reuses the repo's `Dialog`/`DialogHeader`/`DialogFooter` primitives** (only
  `max-w-[640px]` overridden to match the mockup's `dialog.wide`), not the mockup's own
  `.dlg-head`/`.dlg-body`/`.dlg-foot` bands — consistent with `WordForm`'s existing add-language
  dialog.

### Outcome — what landed (2026-09-14)

Built to the design section above with no further deviations.

- **`review/CellDialog.tsx`** (new) — router- and store-free like every other file in `review/`.
  Keyed `${wordId}:${langKey}` by `ReviewPage` so switching cells remounts it, since
  `TranslationCard` hydrates from `initialCases` at mount only (the same reason `WordPage`'s
  `editKey` exists). Three states fall out of one `existingIndex = word.translations.findIndex(...)`
  lookup: edit (`TranslationCard` pre-filled), add (`initialCases={[]}`, no Delete button), and a
  guarded add-at-cap (a hint replaces the card once a word already holds `MAX_TRANSLATIONS` — 4 —
  stored languages, reachable only when one of them is outside the account's current language
  list). A query-error `useEffect` toasts and calls `onClose()`, mirroring `WordPage`'s own
  pattern exactly rather than toasting inline during render.
- **`review/WordCell.tsx`** — the filled-cell branch now checks `isOwn` the same way the empty-cell
  branch already did (D28): an own cell stays a `<button>`; a non-own cell renders a plain `<span>`
  carrying the same `blockedTranslation` title the empty-cell glyph uses.
- **`pages/ReviewPage.tsx`** — a `cellTarget` state (`{ wordId, langKey } | null`) plus a
  `useCallback`-wrapped `onOpenCell` (load-bearing, not tidiness — it sits in `ReviewTable`'s own
  `columns` `useMemo` dep array, so an inline arrow would rebuild every column on every render).
  `CellDialog` mounts as a sibling of `.layout`, matching `BulkActionBar`'s own `ConfirmDialog`
  ownership pattern (D26).
- **`backend/controllers/wordController.ts`** — `updateWord`'s tag-diff block now runs only inside
  `if (req.body.tags !== undefined)` (D25).
- **`review.json`** grew a `cellDialog` block (`title`, `deleteTranslation`,
  `confirmDeleteTitle`/`Description`, `savedToast`, `removedToast`, `maxTranslations`) in all four
  locales, English first. `readOnlyHint`/`addTitle` from the original plan sketch were dropped as
  unneeded once D28 made the read-only path unreachable and the add case reused the edit dialog's
  own title format. Estonian copy flagged for review, as every prior slice this phase.

**Tests**: `review/CellDialog.test.tsx` (new, 10 tests) — the loading skeleton (queried via
`[data-slot="skeleton"]`, asserted on the synchronous first render before the query settles); an
edit prefilled from the fetched word; Save disabled while hydrated-but-clean, disabled again once
dirtied into an empty required field, enabled once valid again; the D29 payload claim itself,
asserted against the MSW request log — every translation present, only the edited language's cases
changed; a successful save's toast + `onClose`; the add case appending a third language rather than
replacing either existing one, with no Delete button rendered for it; Delete hidden at 2 stored
translations, shown at 3, and its confirm round trip sending the set minus that language (asserting
the native-language toast text, not the English word — same convention `WordCell` already follows);
a failed fetch closing the dialog and toasting the mapped error message.
`review/WordCell.test.tsx` (+2): a non-own filled cell renders no button and never calls
`onOpenCell`; an own filled cell still does. `pages/ReviewPage.test.tsx` (+3, via `renderApp`):
clicking a filled cell opens the dialog pre-filled with that language's stored cases; saving closes
it, toasts, and the row's headline word updates with no manual refresh (proving the existing
`useUpdateWord` invalidation edge reaches the Review list); clicking an empty cell's Add button
opens the same dialog empty. `backend/tests/words.test.js` (new `PUT /api/words/:id - Update Word`
describe block, +2 — the first tests this endpoint had at all): a `tags`-omitting PUT preserves the
word's existing tag association; an explicit `tags: []` still clears it, pinning the guard's
intended behaviour didn't regress.

**Verified**: `npm run build -w frontend` (tsc -b + vite) green; `npm test -w frontend`
**450 → 469** (19 new); `npm test` (backend) **163 → 165** (+2).

### Fourth round of user-review fixes (2026-09-14)

One more correction, caught in a final pass before the phase gate — touches Slice 7's
`FilterBar.tsx`, not Slice 8's own files, but landed in this working session so it's recorded here
rather than reopening Slice 7:

- **D31 — the filter bar's show/hide toggle button is now a fixed part of one persistent header
  row, present in both collapsed and expanded states, always first/leftmost.** Previously the
  button changed both position and DOM parent between states — first element of a
  collapsed-only `.fb-collapsed` strip vs. the last element of the expanded `.fb-body`, after a
  `grow` spacer inside a `flex-wrap` row (so at narrower widths, where the filter groups wrap onto
  a second line, it wasn't even reliably anchored to a corner). This is a **deviation from
  `MOCKUPS/review.html`**, which has the identical layout (`review.html:101-144`) — confirmed
  before fixing that the mockup itself carries the bug, not just this port of it. Presented to the
  user as three options (persistent header with the toggle pinned left, pinned right, or leave
  as-is matching the mockup exactly); the user picked pinned-left, matching the collapsed state's
  already-correct layout. `.fb-collapsed` (CSS) renamed to `.fb-header` and now renders in both
  states; only the icon (caret down/up) and two collapsed-only fragments (the active-filter hint
  and the language-order summary) change between states — the toggle button, the "Filters" eyebrow,
  and the active-count pill are now always present and always in the same position. `.fb-body`
  (the filter groups themselves) gained a top border + margin to visually separate it from the
  header when expanded, and lost its own trailing `grow` + button. No prop or behavioural contract
  change — `FilterBar.test.tsx`'s 13 existing tests (all behaviour-based: button accessible names
  and visible text, not DOM position) passed unmodified.

**Verified**: `npm run build -w frontend` (tsc -b + vite) green; `npm test -w frontend` **469 → 469**
(no net change — no new tests needed, existing coverage already pins the toggle's two accessible
names and the conditional content around it). Backend untouched.

**Slice 9 — form layout: paired rows (nouns, Spanish adjectives).** User feedback after Slice 8:
the form engine's behaviour is correct but every `TranslationCard` renders `config.fields` as one
flat vertical list, wasting the horizontal space the screen already has — a German noun is 8
stacked case inputs, a German verb 24. Nouns should pair each grammatical case's singular and
plural onto the same row; Spanish adjectives should pair singular/plural, with the M/F branch
stacking male above female (2 rows x 2 columns). Verbs (tense-as-column) and the width changes
they need are Slice 10 — this slice only touches configs with no `layout` conflicts today, so
verb rendering is provably unchanged.

### Decisions taken with the user (2026-09-15)

- **D32 — verb forms get room from a wide shell + full-width verb cards**, not a fixed dialog
  width or horizontal scroll. The word routes will opt into `AppShell`'s existing (currently dead)
  `wide` prop for `max-w-7xl`; verb cards render one per row while other parts of speech keep the
  2-up card grid. (Applies to Slice 10.)
- **D33 — the cell dialog widens only for verbs** (~960px), staying 640px for nouns, adjectives
  and adverbs. (Applies to Slice 10.)
- **D34 — field labels do not change.** Pairing fields onto a row does not introduce column
  captions or shortened per-field labels for nouns/adjectives (verbs do get column captions —
  they already exist today as `group` headings, just repositioned) — no new i18n keys, no risk to
  `getByLabel` selectors.
- **D35 — the grid layout applies in read-only mode too** (word detail page, dialog view mode), so
  viewing and editing look the same. Empty optional fields are already hidden in `displayOnly`
  (`FieldRenderer`'s existing rule); the layout engine excludes them before measuring rows/columns
  so a sparse word collapses cleanly instead of leaving gaps.

### Outcome — what landed (2026-09-15)

- **`configs/types.ts`** — new `FieldLayout` (`row`, `column`, optional `columnHeading`), attached
  as `layout?: FieldLayout` on `FieldConfigBase`. Purely presentational, like `FieldGroup`: never
  read by `buildYupSchema`, `fieldsToCases`, or `casesToFieldValues`.
- **New `form-engine/fieldLayout.ts`** — `buildLayoutItems(fields)` groups an already-filtered
  `FieldConfig[]` into the sequence `TranslationCard` renders: a field with no `layout` stays a
  standalone item; a maximal run of consecutive `layout`-bearing fields sharing the same `group`
  stack becomes one grid block (rows/columns derived from `layout.row`/`layout.column` in
  first-appearance order, `cells[r][c]` left `undefined` where no field claims that pairing).
  Callers must pre-filter to what will actually render — a hidden field inside a block would
  otherwise leave a blank row/column. `isHiddenInDisplayOnly` (the `displayOnly` half of that
  filter; `visibleWhen` already had `matchesVisibility`) moved here from `FieldRenderer.tsx`'s
  private `isEmptyValue`, so both call sites share one rule.
- **`TranslationCard.tsx`** — computes `visibleFields` (config fields minus `visibleWhen` misses
  and, in `displayOnly`, empty non-required fields) via `useMemo` off the existing `watched`
  state, then `buildLayoutItems(visibleFields)` instead of mapping `config.fields` directly.
  `groupHeadingsToPrint` now diffs against `visibleFields` (previously the unfiltered
  `config.fields`) — a no-op for every config today (adjectives/nouns carry no `group` at all;
  verb tense fields have no `visibleWhen`), kept for a hidden field between two same-heading
  siblings, a case Slice 10 could introduce. A grid block renders as one `display:grid` div
  (`gridTemplateColumns` sized to its column count); row-major DOM order plus native grid
  auto-placement needs no explicit `gridRow`/`gridColumn` styles, so field order inside a block
  still matches config order.
- **`FieldRenderer.tsx`** — its private `isEmptyValue` and inline displayOnly-hidden check are
  now the shared `isEmptyValue`/`isHiddenInDisplayOnly` imports from `fieldLayout.ts`; no
  behavioural change.
- **`configs/nouns.ts`** — `toTextField` adds `layout: { row: row.declination, column:
  row.plurality }` for real case rows (`NounData`); property rows (EE's `shortForm`) get no
  layout and stay full-width.
- **`configs/adjectives.ts`** — Spanish only: `degreeField` gained an optional `layout` param;
  the neutral/male/female branch fields each get `{ row: 'neutral'|'male'|'female', column:
  'Singular'|'Plural' }`. English, German, Estonian and every adverb config: untouched.

**Tests**: new `fieldLayout.test.ts` (18 tests) — standalone-field passthrough, 1x2 and multi-row
grid derivation, first-appearance row/column ordering, `columnHeadings` emission, undefined cells
for un-paired positions, a new block starting when the `group` stack changes, the Spanish-adjective
shape collapsing to just the surviving branch once hidden fields are pre-filtered, and
`isEmptyValue`/`isHiddenInDisplayOnly` directly. `configs/nouns.test.ts` and
`configs/adjectives.test.ts` gained `layout` assertions per language/branch. Every pre-existing
`TranslationCard`, `FieldRenderer`, `WordForm`, `WordPage` and `CellDialog` test passed
**unmodified** — they are label/role-based, which is the regression signal that this stayed
presentational.

**Verified**: `npx tsc --noEmit -p frontend` clean; `npx vitest run -w frontend` **469 → 491**
(+22: 18 in new `fieldLayout.test.ts`, 3 in `nouns.test.ts`, 1 in `adjectives.test.ts`) — full
suite green, no regressions, no existing test edited. Browser (manual, via a throwaway
registered+verified+deleted account against the local dev stack): German noun shows 4 declension
rows of Singular/Plural side by side; Spanish adjective shows the M/F branch as 2 rows x 2 columns
(male above female) and collapses to 1 row x 2 columns back on Neutral. Backend untouched.

**Slice 10 — form layout: verb tense columns + width.** Moves each verb tense's `group` entry
into `layout.column`/`layout.columnHeading` (mood stays in `group`, printed once above the
block); the four width changes from D32/D33 (`app/router.tsx` `staticData.wide` on the word
routes, `protected-layout.tsx` reading it, a shared `translationGridClass(pos)` for the
`WordForm.tsx`/`WordPage.tsx` card grids, `CellDialog.tsx`'s verb-dependent max width).

### Outcome — what landed (2026-09-15)

Built to the design section above with no further deviations. The Slice 9 `fieldLayout.ts`/
`TranslationCard.tsx` machinery needed **zero JS changes** to support verbs — only the verb
configs changed, confirming it was built generically enough the first time.

- **`configs/verbs.ts`** — a new `tenseLayout(row, columnHeading)` helper returns
  `{ row: slotOf(row), column: row.tense, columnHeading }`; every language's tense-row loop now
  sets `layout: tenseLayout(row, ...)` and trims its own `group` array down to the outer stack
  only (`[EN_TOP_GROUP]`; `[ES_MOOD_GROUP, ES_SIMPLE_TENSE_GROUP]`; `[DE_TOP_GROUP]`;
  `[EE_TOP_GROUP]`). German's `deAdornment(row)` call is untouched — the adornment is keyed off
  the field's own `name`/`caseName`, not its position in `group` or `layout`.
- **`app/router.tsx`** — a `declare module '@tanstack/react-router' { interface
  StaticDataRouteOption { wide?: boolean } }` augmentation, then `staticData: { wide: true }` on
  `addWordRoute` and `wordRoute`.
- **`routes/protected-layout.tsx`** — `useMatches()` plus `matches.some((m) =>
  m.staticData.wide)`, passed to `AppShell`. `AppShell.tsx`'s docstring (which claimed Review was
  the `wide` consumer — never true, `wide` was dead code before this slice) corrected to describe
  the real read path.
- **New `TranslationCard.translationGridClass(pos?)`** — `'grid grid-cols-1 gap-4'` for
  `PartOfSpeech.verb`, the existing `'grid grid-cols-1 gap-4 sm:grid-cols-2'` otherwise (including
  when `pos` is omitted, for `WordPage`'s loading skeleton, which doesn't know the PoS yet).
  Replaces the hardcoded class at `WordForm.tsx`'s card grid and both of `WordPage.tsx`'s
  (skeleton and read-only view).
- **`review/CellDialog.tsx`** — a local `dialogMaxWidthClass(pos?)` (`max-w-[960px]` for verbs,
  the existing `max-w-[640px]` otherwise) replaces both hardcoded `DialogContent` widths (the
  loading skeleton, called with no `pos`, and the loaded dialog, called with `word.partOfSpeech`).

**Tests**: `configs/verbs.test.ts` gained a `layout` describe block (4 new tests) — EN's tense
becomes the (captioned) column and pronoun slot the row while the outer "Simple" heading stays in
`group`; ES's outer two-level group stack is unchanged; DE's auxiliary adornment survives the
move; EE's three tenses resolve to three distinct columns. Every pre-existing `TranslationCard`,
`FieldRenderer`, `WordForm`, `WordPage`, `CellDialog` and `app/router` test passed **unmodified**.

**Verified**: `npx tsc --noEmit -p frontend` clean; `npx vitest run -w frontend` **491 → 495**
(+4, all in `verbs.test.ts`) — full suite green, no regressions, no existing test edited. Browser
(manual, via a throwaway registered+verified+deleted account against the local dev stack): German
verb renders 4 tense columns (Präsens/Perfekt/Futur I/Präteritum) x 6 pronoun rows inside the wide
(`max-w-7xl`) shell, with the `habe`/`hast`/.../`werde`/`wirst`/... auxiliary adornments still
showing per-cell in the Perfekt/Futur I columns; Spanish verb renders "Modo indicativo" once above
"Tiempo simple" once above its own 4 tense columns; opening the German verb's cell from `/review`
renders the dialog at `max-w-[960px]` (confirmed via `DialogContent`'s computed class) with the
same 4x6 grid comfortably inside it. Backend untouched.

### Fifth round of user-review fixes (2026-09-15)

The property fields ahead of each verb's tense grid still rendered as a plain vertical list —
untouched by Slice 10, which only regrouped the tense grid itself. The user asked for three more
groupings before Slice 11: Spanish's infinitive/gerund/participle onto one row; German's
infinitive/auxiliaryVerb/prefix onto one row and regularity/verbCases onto a second; Estonian's
`-ma`/`-da` infinitives onto one row. English needs no change (it only ever had `regularity`
ahead of the grid).

- **`configs/types.ts`** — `FieldLayout` gains an optional `block?: string`. Two adjacent
  `layout`-bearing fields merge into one grid only when this matches (`undefined` merges with
  `undefined`, so every existing config is unaffected by default). Needed because
  `buildLayoutItems` merges *any* run of consecutive `layout`-bearing fields sharing a `group`
  stack, regardless of whether their `row`/`column` vocabularies actually overlap — harmless for
  nouns/adjectives/verb-tenses (each row in those blocks reuses the same column set), but German's
  two new meta rows share no columns at all, so without `block` they'd merge into one sparse 2x5
  grid (3 real cells in row 1, 2 in row 2, the other 5 positions blank) instead of two clean rows.
- **`fieldLayout.ts`** — `groupStackKey` is now wrapped by a `blockKey` helper that appends
  `layout.block` (defaulting to `''`) before comparing; `buildLayoutItems`'s merge condition uses
  `blockKey` instead of the bare group-stack key.
- **`configs/verbs.ts`**:
  - **Spanish** — `infinitiveNonFiniteSimple`/`gerundNonFiniteSimple`/`participleNonFiniteSimple`
    (already contiguous, immediately followed by the non-`layout` `regularity` field) each get
    `layout: { row: 'nonFinite', column: <name> }`. No reorder, no `block` needed.
  - **Estonian** — `infinitiveMa`/`infinitiveDa` (already contiguous) get
    `layout: { row: 'infinitives', column: 'ma' | 'da' }`. Same reasoning.
  - **German (D36 — intentional field-order change)** — `regularity` moved to sit *after*
    `auxiliaryVerb`/`prefix` instead of right after `infinitive`, so both target rows become
    physically contiguous: `[infinitive, auxiliaryVerb, prefix, regularity, verbCases]`, up from
    `[infinitive, regularity, auxiliaryVerb, prefix, verbCases]`. `infinitive`/`auxiliaryVerb`/
    `prefix` get `layout: { row: 'meta1', column: <name>, block: 'verbMeta1' }`; `regularity`/
    `verbCases` get `layout: { row: 'meta2', column: <name>, block: 'verbMeta2' }`. This is a
    deliberate deviation from the old app's field order (like D4's validation fixes) — it changes
    nothing about validation, persistence or values, only where two fields sit in `config.fields`.
  - `requiredTextField` gained an optional trailing `layout` parameter (used by Spanish and
    Estonian above); `regularityField(Lang.DE)`'s return is spread with an added `layout` at the
    German call site rather than threading a parameter through a helper shared by all four
    languages.

**Tests**: `configs/verbs.test.ts`'s pinned German field-name-order test updated to the new order
(with a comment pointing at D36); its Estonian `layout` test narrowed from `f.layout` to `f.group`
so the `-ma`/`-da` infinitives' own row doesn't leak into the tense-column assertion; a new "layout
— property-row groupings" describe block (4 tests) pins the Spanish row, the German two-row split
including that the two `block` ids differ, the Estonian row, and that English's `regularity` still
carries no `layout`. Every other pre-existing test passed unmodified.

**Verified**: `npx tsc --noEmit -p frontend` clean; `npx vitest run -w frontend` **495 → 499**
(+4, all in `verbs.test.ts`) — full suite green. Browser (throwaway registered+verified+deleted
account, all four languages): German renders exactly two rows ahead of the tense grid (Infinitive/
Auxiliary verb/Prefix, then Regularity/Verb case) with no blank gaps; Spanish's three non-finite
fields sit on one row; Estonian's two infinitives sit on one row. Backend untouched.

### Sixth round of user-review fixes (2026-09-15)

German verb's `verbCases` checkbox group (Accusative/Dative/Genitive) still stacked its three
options vertically inside its own field — a different concern from every fix above, which only
ever arranged *separate fields* into rows via `layout`. This is the first (and, today, only)
`multi-select` field in the engine, so the fix is a plain CSS change local to `FieldRenderer.tsx`,
nothing to do with `fieldLayout.ts`'s block/row/column machinery.

- **`FieldRenderer.tsx`** — the multi-select branch's option wrapper changes from
  `flex flex-col gap-1.5` to `flex flex-row flex-wrap gap-x-4 gap-y-1.5`, matching the row-based
  spacing already used elsewhere (`gap-x-4` between the field's own row-mates via `fieldLayout`'s
  grid). `flex-wrap` keeps it correct if a future multi-select ever has more options than fit on
  one line.

**Tests**: none needed — `FieldRenderer.test.tsx`'s multi-select tests assert `getByRole('checkbox', {name})` and `toBeChecked()`, never DOM layout, so all passed unmodified.

**Verified**: `npx tsc --noEmit -p frontend` clean; `npx vitest run -w frontend` still **499/499**
green (no test count change). Browser: German verb's Accusative/Dative/Genitive checkboxes render
on one row next to the "Verb case" label. Backend untouched.

**Slice 11 — phase gate.** `e2e/tests/phase-3-review.spec.ts`, doc updates, full green run.

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
- **D36 (Slice 10, fifth round of fixes)** — German verb's `config.fields` order changes from
  `[infinitive, regularity, auxiliaryVerb, prefix, verbCases, ...]` to `[infinitive,
  auxiliaryVerb, prefix, regularity, verbCases, ...]`, so the two property rows the user asked for
  (infinitive/auxiliaryVerb/prefix; regularity/verbCases) are each contiguous. Values, validation
  and persistence are unaffected — only the array position of two fields moved.

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
