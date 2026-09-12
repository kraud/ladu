# Phase 2 — Noun create / view (form engine v1)

## Context

Phase 1 is complete (backend 144, frontend 98, e2e 7, clean on `main`). The frontend has
auth, the app shell, the design system, `features/auth` + `features/account`, and
`features/metrics` (welcome-banner Home only). `features/words` does not exist;
`/addWord` and `/word/$wordId` are placeholder routes in `app/router.tsx`.

Phase 2 is the **second vertical slice** and the first to exercise the **read path**
(`useQuery` for a single word). It builds the config-driven **form engine** — the
subsystem that replaces ~8,700 lines of copy-paste forms (`new-repo-build-plan.md` §4
invariant 3) — but delivers only the **Noun** part of speech. Verb / Adjective / Adverb
configs, autocomplete, and the Review table are Phase 3. Per `CLAUDE.md`, tags / friends /
notifications stay deferred until after Phase 3.

Design priority set by the user: **clean architecture and reusable component structure**,
so Phase 3 adds the other three parts of speech as *configs*, not new components.

**Decisions taken with the user (2026-09-10):**

1. **D1 — pagination deferred to Phase 3.** `new-repo-build-plan.md` §5 Phase 2 text says
   `getWordsSimplified` gains cursor pagination here; the README roadmap table says Phase 3
   (list) / Phase 2 (`:id` check). The Review table — its only consumer, plus
   `useInfiniteQuery` — is Phase 3, so pagination has no consumer in Phase 2. Phase 2
   backend work is the `GET /api/words/:id` ownership check + the `_id` strip only.
2. **D2 — clue field only, no tags.** `CLAUDE.md` defers tags until after Phases 1–3, which
   overrides the "tags + clue fields" line in §5. No tag picker, and no `tags` key in the
   create / update payload. The tags field slots into `WordForm` in Phase 4 (it needs
   `searchTags` / `getTags`).
3. **D3 — `GET /api/words/:id` returns 403 for a non-owner** in Phase 2 (matches the e2e
   "is refused"). Phase 4 relaxes it to *owner OR follows a tag containing the word*.
   `FieldRenderer` still takes a `displayOnly` prop from day one so Phase 4 only has to
   wire it. **The non-owner read-only `/word/:id` view is deferred to Phase 4** — `WordPage`
   gets no non-owner branch in Phase 2 (the state is unreachable while D3 holds).
4. **D4 — noun field labels are i18n-keyed.** Add `wordRelated:wordForm.noun.fields.*`
   (keyed by `caseName`) in all four locales; Estonian strings flagged for the user to
   check. The old app hard-coded English labels; this honours commandment 4 (all languages
   shown equally).

Work proceeds in **seven slices** (0–6), each independently runnable. The user commits
between slices and confirms before each new slice starts.

---

## Form engine design (built for 4 PoS, shipped for Noun)

`features/words/form-engine/`:

```
configs/
  types.ts     FieldConfig (discriminated: 'text' | 'radio' | 'checkbox'),
               TranslationFormConfig { pos, lang, fields: FieldConfig[] }
  nouns.ts     4 configs (EN/ES/DE/EE) derived from WordCasesData.Noun filtered by
               language + the structural fields (regularity always; gender ES/DE).
               required: singular*/gender.  lowercase: all text cases except DE.
  index.ts     getFormConfig(pos, lang) -> TranslationFormConfig
               (Phase 3 adds verbs.ts from WordCasesData.Verb, adjectives.ts / adverbs.ts
                from the AdjectiveCases / AdverbCases enums — no EE adverb form)
buildYupSchema.ts   (config, t) -> yup object  (noNumbers regex, required message keys)
FieldRenderer.tsx   one FieldConfig -> shadcn form control (text input / radio group /
                    checkbox); honours a `displayOnly` prop (read-only render, empty
                    fields hidden — old getDisabledInputFieldDisplayLogic)
TranslationCard.tsx one language slot: tinted top border (--lang-*), header (flag +
                    native name), config-driven body, Clear / Remove (disabled at 2
                    slots), [autocomplete row — empty mount point in Phase 2, filled
                    Phase 3], empty-case filtering on push-up
useWordFormState.ts translations[] add / remove / clear-slot, partOfSpeech, clue;
                    per-slot completion + dirty; save gating (>= 2 slots complete AND
                    something dirty). DERIVED state — no `recently*` flag machine; the
                    snapshot documents the observable contract to reproduce, not the
                    mechanism.
WordForm.tsx        orchestrator: PoS gate -> translation grid -> "+ Add language"
                    (disabled at 4 / none left) -> clue textarea -> sticky Save bar.
                    props: { mode: 'create' | 'edit', initialWord?, onSubmit, onDelete? }
```

**Observable contract to preserve** (`snapshot/pages-word-flow.md` §WordForm, §2):
create success -> morph "Saving…" toast into success with a "See details" action ->
`/word/:id`, then reset the form and stay on `/addWord`; update success -> success toast,
re-lock fields, stay on the word; delete success -> toast -> navigate `/`; errors ->
error toast, form state preserved; submit disabled unless >= 2 translations, all present
translations complete, something dirty; blank case values dropped on save (never persisted
as empty rows); on edit-mode hydration, drop translations whose language is not in
`user.languages`.

**Regression test** (`new-repo-build-plan.md` §6): `getFormConfig('Noun', lang)` -> yup
field list must equal the old `NounForm{EN,ES,DE,EE}` field lists from `forms-nouns.md`.
This is the one place old and new are diffed mechanically; it stays as the engine's guard
when Phase 3 adds the other parts of speech.

`WordData` / `TranslationItem` / `WordItem` are already ported and `id`-only in
`ts/interfaces.ts` — `features/words/types.ts` imports them and adds only the
request / response specifics.

---

## Slice 0 — Persist this plan

This plan is tracked at `.context/plans/phase-2-noun-crud.md` (this file). It is
the record the finished work is diffed against at the phase gate.

---

## Slice 1 — Backend: `_id` strip on word responses + `:id` ownership check ✅ done (2026-09-10)

### Outcome — what landed, and where it diverged from the plan below

- **`services/wordService.ts`** — `_id` dropped from both `WordResponse` and
  `AssembledTranslation` (interfaces + the `assembleWord` object + the
  `fetchTranslationsMap` entry). The word-response surface is now `id`-only.
- **`controllers/wordController.ts`** — `getWordById` gains the ownership check
  (**403 "User not authorized"** when `wordData.user !== req.user.id`; a comment flags
  that Phase 4 widens it to owner-OR-followed-tag). `simplifyWord`'s `word._id` -> `word.id`
  and the `deleteWord` response `{ id, _id }` -> `{ id }`.
- **Divergence — one extra controller touched.** `exerciseController.fetchWordsWithData`
  reads `w._id` / `t._id` off `WordResponse` / `AssembledTranslation` to build its *own*
  internal legacy `WordWithData` shape (which the exercise-generation helpers depend on).
  Rather than ripple `id` through those helpers, `fetchWordsWithData` now remaps
  (`_id: w.id`, and maps translations to `{ _id: t.id, language, cases }`) — the exercise
  controller keeps its internal `_id` shape untouched. `exercisePerformanceController` and
  `tagController` were checked: their `word._id` reads are on **request-body** input, not
  the response serializer, so they were left alone (Phase 4 / 6 scope).
- **Tests:** `words.test.js` (`_id`->`id` on word-id reads at the create/get/delete/bulk
  sites; `not.toHaveProperty('_id')` on create + get; translation-`id` assertions on
  create; `deleteWord` asserts `{ id }` exactly; **new** "fails with 403 when the word
  belongs to another user"). Also touched: `exercises.test.js`, `snapshots.test.js`,
  `tags.test.js` (word-id reads only — tag-response `_id` left, that's Phase 4),
  `unit/wordService.test.js` (`makeTranslation` mock -> `id`; the `assembleWord` test now
  asserts `not.toHaveProperty('_id')`). Full backend suite **145/145** green.
- **Docs:** `snapshot/endpoints.md` Words section corrected (the `:id` 403, the response
  shape `_id` removal, the "no ownership check" gap note). `data-model.md` §2.1 needed no
  change — it transcribes the FE `interfaces.ts` model, which is already `id`-only and
  carries the standing `_id -> id` note.

**Verified:** `npm test` (backend) green; targeted re-run of `words` / `tags` / `exercises`
/ `snapshots` / `unit/wordService` = all green.

---

## Slice 2 — `features/words` data layer (no visible UI) ✅ done (2026-09-10)

### Outcome — what landed, and where it diverged from the plan below

- **`features/words/types.ts`** — `WordBE` (word + `TranslationBE` + `WordTagRef`,
  `id`-only, ISO-string dates), `CreateWordBody` / `TranslationInput` / `UpdateWordBody`
  (`extends CreateWordBody` + `id`), `DeleteWordResponse` (`{ id }`). Pinned against the
  post-Slice-1 controller; the tag shape is a raw Drizzle `tags` row (**not** the
  `ts/interfaces.ts` form-model `TagData`), stubbed because Phase 2 never renders tags.
  The form-local model (`WordData` / `TranslationItem` from `ts/interfaces.ts`) is not
  imported here — it belongs to the form engine (Slice 3).
- **`features/words/api.ts`** — `getWords`, `getWordById`, `createWord`, `updateWord`,
  `deleteWord`. `updateWord` sends the id in both the path and the body (old-contract
  parity; the controller only reads `req.params.id`). No `simple` / `searchWord` /
  `deleteMany` (Phase 3).
- **`features/words/keys.ts`** — `wordKeys` = `{ all: ['words'], list(filters?), detail(id) }`.
  **Divergence:** the leaf keys are namespaced — `detail(id)` → `['words','detail',id]`,
  `list()` → `['words','list', …]` — not the schematic `['words', id]` in the plan, so a
  word UUID can never collide with a Phase-3 filters object at the same position.
  `app/query-client.ts`'s invalidation-graph comment updated to match and marked ACTIVE.
- **`features/words/hooks.ts`** — `useWord(id)` (query; `enabled: id !== ''`),
  `useCreateWord` / `useUpdateWord` / `useDeleteWord` (mutations). **Divergence: no toasts
  and no navigation in the hooks.** They only run the invalidation graph — invalidate
  `wordKeys.all` + `['metrics']` on every mutation; `useUpdateWord` also `setQueryData`s
  the detail key, `useDeleteWord` `removeQueries` it. The success UX (create → morph
  toast + "See details" → `/word/:id`; update → relock; delete → `/`) and the backend
  message → i18n-key mapping (`errors.ts` + a `wordRelated:apiErrors.*` block) move to
  **Slice 4** with the first page, since they vary per call site — this matches
  `useUpdateProfile`, not `useLogin`. Pages pass `{ onSuccess, onError }` to `mutate()`.
- **No `useWords` list hook** — `getWords` (the api fn) exists, but nothing in Phase 2
  renders a list, so the list hook is deferred to Phase 3's `useWordsInfinite`.
  Invalidation is proved in tests by spying on `queryClient.invalidateQueries`.
- **`test/msw/wordHandlers.ts`** — `makeWordHandlers({ callerId, seed })` factory
  (mirrors `makeAuthHandlers`). Bearer token not verified — tests set `callerId`
  directly. `GET /:id` non-owner → 403; **`PUT` / `DELETE` non-owner → 401** (faithful:
  only `getWordById` got the 403 in Slice 1). Captures `POST` / `PUT` bodies in
  `.requests` for payload-shape assertions; drops blank case values like the controller.
- **`api/types.ts`** — `CursorPage` doc note corrected ("lands in Phase 2" → "Phase 3").

**Verified:** `npm run build -w frontend` (tsc -b + vite) green; `npm test -w frontend`
**98 → 105** (7 new hook tests: `useWord` owned / 403 / empty-id-idle; `useCreateWord`
exact nested payload + invalidation, and the < 2-translations error; `useUpdateWord`
detail-cache write + invalidation; `useDeleteWord` cache removal + invalidation).
Backend untouched since Slice 1 (145/145).

---

## Slice 3 — Form engine core: config + renderer + `TranslationCard` ✅ done (2026-09-11)

### Outcome — what landed, and where it diverged from the plan below

- **Five shadcn/Base UI primitives added**: `radio-group.tsx`, `checkbox.tsx`, `dialog.tsx`,
  `alert-dialog.tsx` (all hand-authored against `@base-ui/react/{radio-group,radio,checkbox,
  dialog,alert-dialog}`, following `sheet.tsx`'s pattern of aliasing the primitive's own
  `Root`/`Trigger`/`Portal`/`Backdrop`/`Popup`/`Title`/`Description`/`Close` parts), plus
  `textarea.tsx` (no Base UI primitive exists for it — a plain native `<textarea>` styled
  like `input.tsx`). All wrapped in `React.forwardRef` per the Phase 1 lesson.
- **`form-engine/configs/{types,nouns,index}.ts`** — `NOUN_CONFIGS` is derived from
  `WordCasesData.Noun` (`ts/wordCasesDataByPoS.ts`) filtered by language, plus two
  structural fields the registry does not carry at all: `regularity` (all four languages)
  and `gender` (ES/DE, anchored on the registry's own gender rows). **Key mechanical
  finding**: the old app's per-language RHF field name (`"singular"`,
  `"singularNominativ"`...) is exactly `caseName` with the trailing language code
  stripped (`NounCases.singularNominativDE` → `"singularNominativ"`) — this holds for
  all 25 noun cases across all four languages, so `FieldConfig.name` is derived
  mechanically rather than hand-listed, and doubles as the regression test's mechanism.
  `required` is likewise derived structurally (`plurality === Singular && declination ===
  Nominative`, or `isNounProperty` for gender) rather than hand-flagged per field.
  **Divergence**: `FieldConfig` also carries `requiredMessageKey` / `invalidMessageKey`
  (i18n keys for the yup messages), set by `nouns.ts` from the existing
  `wordRelated:wordForm.noun.errors.form*` block — keeps `buildYupSchema.ts` fully
  generic (no PoS/language-specific key-naming knowledge), which the plan's prose didn't
  spell out but follows from "config is data."
- **`buildYupSchema.ts`** — generic over any `TranslationFormConfig`; reads validation
  messages off the config, not off `pos`/`lang`.
- **`FieldRenderer.tsx`** — `displayOnly` gating rule turned out to be a single clean
  predicate, not a per-field flag: **hidden only when non-required AND empty**. Checked
  against every field in `forms-nouns.md` — every gated field there is non-required, every
  required field (including ES/DE gender) is never gated — so no extra config field was
  needed to reproduce the old per-field `getDisabledInputFieldDisplayLogic` behaviour.
  displayOnly renders as static text (radio fields show the matched option's label).
- **`TranslationCard.tsx`** — owns its own `useForm` + yup resolver per card (mirrors the
  old app's per-language forms pushing `{language, cases, ...}` up independently, rather
  than one shared giant form). Accepts `initialCases` (hydration), `displayOnly`,
  `onRemove`/`onClear`/`removeDisabled`; the "push up to parent state" wiring
  (`useWordFormState`) is Slice 4. Autocomplete row is a comment-marked mount point only.
- **`lib/language.ts`** — added `langTint(keyOrLabel)`, resolving to
  `var(--lang-{gb,de,es,ee})` (English keyed `gb`, matching the flag convention already in
  `FlagIcon`).
- **i18n (D4)** — `wordRelated:wordForm.noun.fields.*` added in all four locales (25 keys:
  one per `NounCases` value), plus a new `wordRelated:wordForm.noun.errors.form*.
  regularityRequired` key in all four locales — `forms-nouns.md` documents this yup
  message for the noun regularity field, but only the *verb* error block had it; reused
  the verb block's already-translated string per locale rather than inventing new copy.
  **EE flagged for the user to check**: singular/plural/case-name glossary terms for
  fields belonging to *other* languages (e.g. what "Singular accusative" reads as when
  the UI is Estonian) used the Estonian linguistic loanwords (`Akusatiiv`, `Genitiiv`,
  `Daativ`, `Partitiiv`) rather than Estonian's own native case names, to avoid confusing
  them with EE's own `nimetav`/`omastav`/`osastav` fields — a judgment call, not a
  transcription.
- **Test-infra fix, not scoped to this slice but required by it**: jsdom ships no
  `PointerEvent` constructor; Base UI's Radio/Checkbox/Dialog click handlers construct one
  to re-dispatch a click carrying modifier keys, which threw "is not a constructor" the
  first time a test clicked one. Added a minimal `MouseEvent`-based polyfill to
  `test/setup.ts` — this was going to be needed the first time *any* Base UI control got
  a click-interaction test (Slice 4's Checkbox, Slice 5's AlertDialog), not noun-specific.

**Tests**: `configs/nouns.test.ts` (the config → old-field-list regression test, all four
languages, names + order + `required` flags + the `caseName = name + suffix` invariant);
`buildYupSchema.test.ts` (required/optional, noNumbers, regularity oneOf, gender
required+oneOf, per language); `FieldRenderer.test.tsx` (one render per kind, displayOnly
gating in both directions, a real radio click); `TranslationCard.test.tsx` (one mount per
language + native name, hydration from `initialCases`, Clear/Remove visibility and
`removeDisabled`).

**Verified**: `npm run build -w frontend` (tsc -b + vite) green; `npm test -w frontend`
**105 → 133** (28 new: 5 config, 6 yup, 8 FieldRenderer, 5 TranslationCard, minus test-count
rounding). Backend untouched since Slice 1 (145/145, not re-run this slice — no backend
files touched).

---

### Original plan (superseded by the outcome above)

- Add the five held-over shadcn primitives: `radio-group`, `checkbox`, `textarea`,
  `alert-dialog`, `dialog` (Phosphor icon swap; wrap in `React.forwardRef` where an RHF
  `Controller` will touch them — the Phase 1 `input.tsx` / `button.tsx` lesson).
- `form-engine/configs/{types,nouns,index}.ts`, `buildYupSchema.ts`, `FieldRenderer.tsx`,
  `TranslationCard.tsx` per the design section above. No orchestrator, no autocomplete
  row wiring yet (leave the slot + a comment pointing at Phase 3).
- `lib/language.ts` — extend with the per-language tint + native-name helpers if not
  already present (`--lang-*` from `styles/tokens.css`).
- i18n: `wordRelated:wordForm.noun.fields.*` (D4) in all four locales, EE flagged.

**Runnable:** a harness test mounts one `TranslationCard` per language; build green.

**Tests:** `FieldRenderer` render per kind; `buildYupSchema` validation (noNumbers,
required); the **config -> old-field-list regression test** for all four noun languages.

---

## Slice 4 — `WordForm` orchestrator + `AddWordPage` (create flow) ✅ done (2026-09-12)

### Outcome — what landed, and where it diverged from the plan below

- **`form-engine/useWordFormState.ts`** — built exactly to the design section's spec
  (translations[] add/remove/clear-slot, per-slot completion/dirty pushed up from
  `TranslationCard`, `canSave` = `>= 2 slots, all complete, something dirty`). **One
  addition not spelled out in the plan**: `resetTokens` (`Partial<Record<Lang, number>>`),
  a per-language bump counter passed to `TranslationCard` as `resetKey`. It exists because
  each card owns its own RHF instance keyed off `defaultValues` (mount-time only, not the
  reactive `values` option — a `values`-controlled form would resync from its own `onChange`
  echo every keystroke and snap `isDirty` back to `false`). Clear needed an explicit
  "resync now" signal a passive echo can't produce, so `clearTranslation` bumps the token
  for that slot's language; **this is also the seam Slice 5's Cancel will reuse** (see
  below) — `useWordFormState`'s own header comment already flags that hydration "runs
  once, off the props present at mount" and that the component **remounts via a `key`**
  rather than re-hydrating a live form on `initialWord` swap.
- **`form-engine/WordForm.tsx`** — orchestrator built to spec: PoS gate (create mode
  only — edit mode's `initialWord.partOfSpeech` is always present, so the gate line
  is structurally unreachable there, matching D3's "unreachable in practice" pattern) ->
  translation grid -> "+ Add language" dialog (a `Dialog`, not an inline row) -> clue
  textarea -> sticky save bar. **Signature already carries everything Slice 5 needs**
  (`mode: 'create' | 'edit'`, `initialWord?`, `onDelete?`) so Slice 5 should need **no
  signature change** to this component — confirmed by its own header comment ("this slice
  only wires the create path... so Slice 5 doesn't need to change this component's
  signature"). **What it does *not* yet have**: any read-only / view-mode rendering — it
  always renders the full editable grid. `TranslationCard`'s `displayOnly` prop (built in
  Slice 3 for D3) is wired through `FieldRenderer` but `WordForm` never passes it down.
  Slice 5's read-only "view before Edit is clicked" state is therefore **not** a `WordForm`
  concern per the current design — see the Slice 5 revision below.
- **`components/common/PartOfSpeechSelector.tsx`** — all ten `PartOfSpeech` values render
  (not just the four planned languages' concern — this is PoS, not language), Noun the
  only enabled radio; the other nine show `missingImplementationPoS` inline. Widening to
  Verb/Adjective/Adverb in Phase 3 is a one-line change to `SHIPPED_POS`.
- **`lib/words.ts`** — beyond the planned `filterTranslationsByUserLanguages`, two more
  helpers landed **ahead of their Slice 5 need**: `primaryCaseWord(pos, translation)` (the
  one required singular/nominative case value, for a word's page title) and
  `partOfSpeechLabelKey(pos)` / `partOfSpeechFromRouteParam(param)`. Slice 5's `WordPage`
  title can consume `primaryCaseWord` + `partOfSpeechLabelKey` directly — no new helper
  needed there.
- **`lib/toast.tsx`** — new, not originally planned as a separate file (the plan's Slice 4
  bullets described the toast behaviour inline on `AddWordPage`). Extracted because the
  "loading -> success-with-action or loading -> error" morph is reusable — **Slice 5's
  Update/Delete flows reuse `startLoadingToast` / `resolveLoadingToastSuccess` /
  `resolveLoadingToastError` as-is**, no new toast plumbing needed.
- **`features/words/errors.ts`** — `wordErrorKey` maps all four backend messages
  (`wordNotFound`, `notAuthorized`, `missingPartOfSpeech`, `notEnoughTranslations`) even
  though only the last two are reachable from `AddWordPage` (create can't 403/404). The
  first two exist for `WordPage`'s `useWord` error branch — **Slice 5 needs no changes to
  this file**, just a call site.
- **`AddWordPage.tsx`** — matches the plan: typed route param -> `WordForm` create mode ->
  toast morph -> "See details" -> `/word/$wordId`, then **remounts `WordForm` via a
  `formKey` bump** (not a call into a form-level `reset` API) to clear the PoS gate back to
  ungated. This is the same remount-key pattern `useWordFormState` calls out for a future
  edit-mode reset — Slice 5's Cancel should follow it.
- **`app/router.tsx`** — `/addWord/{-$partOfSpeech}` -> `AddWordPage`; `/word/$wordId`
  still the Slice-2-era `Placeholder`, swapped in Slice 5.
- **Divergence — `alert-dialog.tsx` was already added in Slice 3** (it's in the held-over
  primitive list there), not Slice 4. It exists, unused so far; **Slice 5's `ConfirmDialog`
  is its first consumer.**

**Tests**: `useWordFormState.test.ts` (16 — create-mode add/remove/clear/canAddMore/
canSave/reset/buildPayload, edit-mode hydration filtering + re-offering a dropped
language); `WordForm.test.tsx` (8 — PoS gate show/hide, add/remove/clear via the picker,
min-translations hint, exact nested save payload); `PartOfSpeechSelector.test.tsx` (2);
`errors.test.ts` (2); `TranslationCard.test.tsx` (+9 over Slice 3's baseline — the
`onChange` push-up contract, `resetKey` resync); `AddWordPage.test.tsx` (3 — create +
morph + navigate, route-param PoS skip, generic-error preserves form state);
`lib/words.test.ts` (7).

**Verified**: `npm run build -w frontend` (tsc -b + vite) green; `npm test -w frontend`
**133 → 180** (47 new, matches the file-by-file counts above exactly). `grep -r "_id"
frontend/src/features/words` = 0 (only a doc-comment reference and an
`hooks.test.tsx` `not.toHaveProperty('_id')` assertion, both expected). Backend untouched
since Slice 1 (145/145, not re-run this slice — no backend files touched).

---

### Original plan (superseded by the outcome above)

- `form-engine/useWordFormState.ts` + `form-engine/WordForm.tsx`.
- `features/words/errors.ts` — backend message → i18n-key map (`wordErrorKey`), mirroring
  `features/auth/errors.ts`; + a `wordRelated:apiErrors.*` block (`wordNotFound`,
  `notAuthorized`, `missingPartOfSpeech`, `notEnoughTranslations`) in all four locales,
  EE flagged. Moved here from Slice 2 — the hooks carry no toasts, so the first page that
  shows one owns the mapping. `AddWordPage` / `WordPage` `onError` → `toast.error(t(wordErrorKey(err)))`.
- `components/common/PartOfSpeechSelector.tsx` — 4 radio cards; Noun enabled, the other
  three disabled with `wordRelated:partOfSpeechSelector.missingImplementationPoS`.
- `lib/words.ts` — `filterTranslationsByUserLanguages` (port of
  `filterAvailableTranslationsBySelectedLanguages`, `WordForm.tsx:157-169`, with tests) +
  primary-case extraction for the page title.
- `features/words/pages/AddWordPage.tsx` — typed `{-$partOfSpeech}` route param (lowercase
  key -> `PartOfSpeech`), `WordForm` create mode, `onSubmit` -> `useCreateWord`; success ->
  toast with a **"See details"** action -> `/word/:id`, then reset the form and stay on
  `/addWord`.
- `app/router.tsx` — `/addWord/{-$partOfSpeech}` leaf -> `AddWordPage`.

**Runnable:** `npm run dev` — log in, add a 4-language noun, save, follow "See details".

**Tests (MSW):** create a noun with EN+ES+DE+EE -> assert exact `POST /api/words` body
(`{ partOfSpeech, clue, translations: [{ language, cases: [{ caseName, word }] }] }`);
save gating (disabled < 2 / incomplete slot / not dirty); PoS gate renders then hides;
add / remove / clear a language slot; `filterTranslationsByUserLanguages` unit tests.

---

## Slice 5 — `WordPage` (view / edit / delete) ✅ done (2026-09-12)

### Outcome — what landed, and where it diverged from the revised plan below

- Built to the revision below almost exactly: `WordPage` owns View (read-only
  `TranslationCard displayOnly` grid) and Edit (`WordForm mode="edit"`) as two branches of
  one ternary, with `editKey` bumped on every Edit click and `ConfirmDialog` (new,
  `components/common/ConfirmDialog.tsx`) as the ` alert-dialog` wrapper for delete.
- **Divergence — a page-level Cancel button, not inside `WordForm`.** The revision's prose
  didn't spell out exactly where Cancel lives; it landed as a small `Button` above the
  mounted `WordForm` (`WordPage.tsx`, the `editing` branch), flipping `editing` back to
  `false` directly — `WordForm` itself still has no Cancel concept of its own, consistent
  with it staying scoped to "compose, don't orchestrate page-level navigation between
  view/edit."
- **Divergence — zero new i18n keys.** `wordRelated:displayWord.{titlePos,titleSimple,
  subtitle,toastUpdateSuccess}` and `common:buttons.{edit,cancel,return,delete,confirm,
  confirmDelete}` / `common:status.word.{savedSuccess,deletedSuccess}` already existed,
  fully translated in all four locales — leftover scaffolding from the old app's locale
  files that nothing had consumed yet. `status.word.savedSuccess` turned out unused (the
  update-success toast uses the more specific `displayWord.toastUpdateSuccess` instead,
  matching the key `lib/words.ts`'s comments already pointed at); `deletedSuccess` is used
  as planned.
- **Headline word, not just PoS, in the page title** — confirms the Slice 4 outcome's read
  of `primaryCaseWord`'s own doc-comment ("used for a word's page title"): the `<h1>` is
  the word's own primary case value (e.g. "house"), with `wordRelated:displayWord.titlePos`
  ("Detailed view: Noun") rendered as a `meta` eyebrow line above it, not as the `<h1>`
  itself. Falls back to `titleSimple` in the unreachable case `primaryCaseWord` returns `''`.
- **Not-found / 403 navigation uses `useRouter().history.back()`**, not
  `navigate({ to: '..' })` — `..` has no defined resolution one level above a pathless
  `_protected` layout route, so `router.history.back()` (used identically for the View
  state's own **Return** button) is the one mechanism for "leave this page" throughout.
  Verified in tests via `vi.spyOn(router.history, 'back')`, not by asserting a landing path
  (a single-entry `createMemoryHistory` — `renderApp`'s only mode — makes `.back()` a
  no-op past index 0, so path-based assertions would be meaningless there).
- **`ConfirmDialog`'s `destructive` styling** bakes `buttonVariants({ variant: 'destructive'
  })` into `AlertDialogAction`'s `className` prop, appended *after* the component's own
  baked-in `variant: 'default'` classes — relies on `cn`'s `tailwind-merge` pass to resolve
  the conflicting `bg-*` utilities in the destructive className's favour. Not independently
  verified beyond "the button renders and the click handler fires" (tests assert behaviour,
  not computed color) — worth an eyeball in the browser before Phase 3 reuses
  `ConfirmDialog` elsewhere.
- **`app/router.tsx`** — `/word/$wordId` -> `WordPage`; header comment updated ("`word` in
  Slice 5").

**Tests** (`WordPage.test.tsx`, 8): read-only view render (heading, PoS eyebrow, clue,
zero `textbox`/`Clear` elements); Return calls `history.back()`; not-found and
non-owner-403 each toast the mapped message and call `history.back()`; edit round-trip
(exact `PUT` body incl. `id`, toast, drops back to View showing the persisted change);
Cancel discards an in-progress edit with zero requests made; delete-confirm Cancel makes
no request; confirming delete removes the word, toasts, and navigates to `/`.

**Verified**: `npm run build -w frontend` (tsc -b + vite) green; `npm test -w frontend`
**180 → 188** (the 8 above). `grep -r "_id" frontend/src/features/words` unchanged (0 real
hits). Backend untouched since Slice 1 (not re-run this slice — no backend files touched).

---

### Revised plan (superseded by the outcome above, but accurate enough to keep for context)

**Revised against the Slice 4 outcome** (2026-09-12): `WordForm` has no read-only
rendering mode of its own — it always renders the full editable grid (Slice 4 outcome,
above). Rather than bolt a `readOnly`/`displayOnly` prop onto `WordForm` (which would
duplicate `TranslationCard`'s existing `displayOnly` contract one layer up, and widen an
orchestrator whose own docstring scopes it to "compose/edit"), `WordPage` owns its two
render states directly:

- **View state (default on load)**: `WordPage` renders its own read-only layout — page
  title from `partOfSpeechLabelKey(word.partOfSpeech)` + `primaryCaseWord(...)` (both
  already built in Slice 4 for exactly this), one `<TranslationCard displayOnly lang=...
  initialCases=...>` per translation (no `onChange`/`onRemove`/`onClear`), the clue as
  static text. **Edit** / **Back** / **Delete** buttons live here, not inside `WordForm`.
- **Edit state**: swaps in `<WordForm mode="edit" initialWord={word} key={editKey}
  onSubmit={...} onDelete={...} submitting={...}>` — unchanged from the Slice 4 signature,
  confirming that outcome note. **Cancel** does **not** need a form-level "restore" API:
  it just flips back to View state and drops the mounted `WordForm` (React unmounts it,
  discarding whatever `useWordFormState` had in flight) — the exact remount-discards-state
  pattern `useWordFormState`'s own header comment anticipates, reused here with a plain
  state flip instead of `AddWordPage`'s `formKey` bump (there is nothing to preserve across
  Cancel, since the freshly-unmounted form's home *is* the read-only view of `word`, not a
  blank slate). `editKey` still bumps once per Edit click so a second Edit after a failed
  Update starts from a clean `useWordFormState`, not the previous attempt's half-typed state.
- `partOfSpeech` is never shown as an input in either state — the view title carries it,
  and `WordForm` edit mode already skips its own PoS gate whenever `initialWord` is set
  (Slice 4 outcome), so there is no PoS control to disable.

Concretely:

- `features/words/pages/WordPage.tsx` — `useWord(wordId)`; a `Skeleton` (already in
  `components/ui/skeleton.tsx`, unused since Phase 1) while loading; on error, `toast.error
  (t(wordErrorKey(error)))` + `navigate({ to: '..' })` (D3: only `wordNotFound` /
  `notAuthorized` are reachable here, both already mapped in `features/words/errors.ts` —
  no changes needed there). Owner is implicit: D3 means a successful fetch is always the
  caller's own word, so there is still no non-owner branch to write.
- `components/common/ConfirmDialog.tsx` — wraps `alert-dialog.tsx` (added in Slice 3,
  unused until now): `{ title, description, confirmLabel, cancelLabel, destructive?,
  onConfirm }`. First and only consumer this slice is the delete confirm.
- Update -> `useUpdateWord`, wrapped in the Slice 4 `startLoadingToast` /
  `resolveLoadingToastSuccess` / `resolveLoadingToastError` trio (no new toast plumbing) ->
  on success, drop back to View state (re-locks fields by construction, since View never
  mounts an editable form) and stay on `/word/:id`; on error, stay in Edit state with
  whatever was typed (`WordForm`'s own local state is untouched by a failed mutation).
- Delete -> `ConfirmDialog` -> `useDeleteWord` -> loading/success/error toast trio ->
  success navigates `/`.
- `app/router.tsx` — `/word/$wordId` leaf: swap the Slice-2-era `Placeholder` for
  `WordPage`.

**Runnable:** full loop — add, open, edit a case, save, reload, delete.

**Tests (MSW):** view render (title + read-only fields, no inputs); Edit shows the same
editable grid `WordForm.test.tsx` already covers, pre-filled; edit round-trip — load a
word, change one case, save, assert the exact `PUT` body + detail-cache write + drop back
to View with the new value visible; Cancel discards an in-progress edit and returns to the
unchanged View state; delete confirm -> `DELETE` called -> navigate `/`; delete cancel ->
no call, dialog closes; not-found / 403 -> toast + `navigate({ to: '..' })`.

---

## Slice 6 — Phase gate

- `e2e/tests/phase-2-noun-crud.spec.ts`: a logged-in user adds a noun with >= 3 language
  translations through the real form -> save -> reload `WordPage` -> all translations +
  case fields render -> edit one -> it persists after reload -> `GET /api/words/:id` for
  another user's word is refused.
- Update `new-repo-build-plan.md` §9 (progress table + Phase 2 deviations D1–D4) and
  `frontend-structure.md` if the `form-engine/` tree diverged from `:108-118`.
- Gate: `npm test` · `npm test -w frontend` · `npm run build -w frontend` ·
  `npm run test:e2e` all green; `grep -r "_id" frontend/src/features/words` = 0.

---

## Invalidation graph — Phase 2 additions

```
createWord / updateWord / deleteWord  =>  invalidate ['words'], ['words', id], ['metrics']
```

`['metrics']` has no consumer until Phase 3.5 — the edge is declared now so the consuming
phase only has to add the query.

---

## Verification

Per slice, before handing back for commit:

```bash
npm run build -w frontend     # tsc -b + vite build
npm test -w frontend          # vitest
npm test                      # backend jest (slices 1, 6)
```

End-to-end, after Slice 5:

```bash
npm run docker:up && npm run db:migrate
npm run dev                   # backend :5001 + vite
npm run test:e2e              # phase-2-noun-crud.spec.ts (slice 6)
```

Then, in the browser: log in -> Add Word -> pick Noun -> fill EN + ES + DE + EE ->
Save -> "See details" -> `WordPage` shows all four translations with their case fields ->
Edit a case -> Update -> reload -> change persisted -> Delete -> lands on Home.

---

## Risks

- **Engine over-abstraction (study §10).** Mitigation: the config is *data* (from
  `WordCasesData`); the regression test pins output to the old field lists; only Noun
  ships now — Verb / Adjective / Adverb are Phase 3 configs against the same renderer.
- **`_id` strip breaks `tags.test.js`** (shared `fetchWordsWithRelations` helper).
  Expected; fixing those assertions is in Slice 1 scope.
- **`useWordFormState` re-growing a flag machine.** The snapshot's observable contract
  (create -> reset + stay, update -> toast + relock, delete -> toast + `/`, save gating,
  empty-case filtering, per-user-language filtering on hydration) is the spec; derived
  state only, no `recently*` / `hideView` imperative flags.
- **shadcn primitive `forwardRef` gaps** under React 18 + RHF `Controller` — apply the
  Phase 1 fix proactively when the five primitives land in Slice 3.
- **`GET /api/words/:id` 403 vs. followed-tag read access.** Phase 2 is owner-only by
  decision D3; Phase 4 must widen it (owner OR follows a tag containing the word) and add
  the non-owner read-only `WordPage` branch. Recorded here so it is not lost.
