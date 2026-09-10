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

Copy this plan to `.context/.frontend/plans/phase-2-noun-crud.md` (this file). It becomes
the tracked record the finished work is diffed against at the phase gate.

---

## Slice 1 — Backend: `_id` strip on word responses + `:id` ownership check

- `backend/services/wordService.ts` — drop `_id` from `WordResponse` and
  `AssembledTranslation`; `assembleWord` / `fetchTranslationsMap` emit `id` only.
- `backend/controllers/wordController.ts` — `deleteWord` response `{ id, _id }` -> `{ id }`.
  `getWordById`: **403 "User not authorized"** when `word.userId !== req.user.id`. Leave
  the `/simple`, `searchWord`, and tag-filter `_id` aliases for Phase 3 (their consumers
  land then).
- Tests: `backend/tests/words.test.js` — swap `_id` assertions for `id`, add
  `not.toHaveProperty('_id')` on create / get, add a non-owner `GET /api/words/:id` -> 403
  case. Expect to also touch a few `_id` assertions in `tags.test.js` (shared assembly
  helper). Full backend suite green.
- Docs: correct the `_id` claims in `snapshot/endpoints.md` (Words section) and
  `data-model.md` §2.1 per the same-slice rule in `new-repo-build-plan.md` §4.

**Runnable:** `npm test` green; `GET /api/words/:id` on another user's word -> 403.

**Tests:** create / get / delete response shape (`id`, no `_id`); non-owner get -> 403.

---

## Slice 2 — `features/words` data layer (no visible UI)

- `types.ts` — `WordBE` (response, `id`-only), `CreateWordBody`
  `{ partOfSpeech, clue?, translations: [{ language, cases: [{ caseName, word }] }] }`,
  `UpdateWordBody` `{ id, ...CreateWordBody }`. Imports `TranslationItem` / `WordItem`
  from `ts/interfaces.ts`.
- `api.ts` — `getWords`, `getWordById`, `createWord`, `updateWord`, `deleteWord` (typed
  axios on `api/client.ts`). No `deleteMany` / `simple` / `searchWord` (Phase 3).
- `keys.ts` — `wordsKeys`: `['words']`, `['words', id]`.
- `hooks.ts` — `useWord(id)`, `useCreateWord`, `useUpdateWord`, `useDeleteWord`.
  Mutations: `onSuccess` toast + `invalidateQueries(['words'])` + `['metrics']` (declared
  now; no consumer until Phase 3.5). No status booleans — `isPending` drives button state.
- `app/query-client.ts` — mark the Phase 2 invalidation-graph line active
  (`createWord / updateWord / deleteWord => ['words'], ['metrics']`).
- `test/msw/wordHandlers.ts` — in-memory fake of the five endpoints (incl. 403 on
  non-owner get), installed per-test via `server.use`.

**Runnable:** tests + build green; no route change yet (Phase 1 Slice 2 precedent).

**Tests:** create -> `['words']` invalidated + payload shape; update; delete -> navigate
seam; `useWord` success + 403.

---

## Slice 3 — Form engine core: config + renderer + `TranslationCard`

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

## Slice 4 — `WordForm` orchestrator + `AddWordPage` (create flow)

- `form-engine/useWordFormState.ts` + `form-engine/WordForm.tsx`.
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

## Slice 5 — `WordPage` (view / edit / delete)

- `features/words/pages/WordPage.tsx` — `useWord(wordId)`; skeleton while loading;
  not-found / 403 -> error toast + `navigate(-1)`; owner -> `WordForm` edit mode with
  **Edit <-> Cancel** toggle + **Update**; **Back** (history-back); **Delete** ->
  `ConfirmDialog` -> `useDeleteWord` -> toast -> navigate `/`. No non-owner branch (D3).
- `components/common/ConfirmDialog.tsx` — `alert-dialog` wrapper for destructive confirms.
- Edit hydration via `filterTranslationsByUserLanguages(initialWord.translations)`; Cancel
  restores from `initialWord`; `partOfSpeech` shown read-only (immutable after creation).
- Update -> `useUpdateWord` -> success toast, re-lock fields, stay on the page.
- `app/router.tsx` — `/word/$wordId` leaf -> `WordPage`.

**Runnable:** full loop — add, open, edit a case, save, reload, delete.

**Tests (MSW):** edit round-trip — load a word, change one case, save, assert the `PUT`
body + cache update; Cancel restores; delete confirm -> navigate `/`; not-found -> toast
+ back.

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
