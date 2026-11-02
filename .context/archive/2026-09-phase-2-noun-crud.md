# Phase 2: noun create and view, form engine v1 (plan, 2026-09-10)

**Status:** done 2026-09-12. PR #2 (`word-creation-groundwork`, `9d5c852`). Final state: backend 145, frontend 188, e2e 9. The live spec is `.context/features/word-form-engine.md` (section 1, decisions F-1 to F-4).

**Decisions kept:**
- F-4: noun labels are i18n-keyed (`wordRelated:wordForm.noun.fields.*`).
- F-1 to F-3 were scope calls and are closed: pagination moved to Phase 3; the first form had a clue and no tags; a non-owner got 403 on `GET /api/words/:id` until tags existed (now `features/words-list.md`).
- Derived form state only. No `recently*` flag machine.

**Plan versus built:**
- `WordPage` owns its read-only view. No `displayOnly` mode was added to `WordForm`.
- `ConfirmDialog` was added (first user of the unused `alert-dialog`).
- The `_id` alias was stripped from word responses in slice 1 (`id` only).

**Traps:**
- `WordPage` back navigation on a direct landing (found by the e2e gate): use `useCanGoBack()`.
- `_id` strip broke `tags.test.js` through the shared `fetchWordsWithRelations` helper.
- shadcn primitives need `forwardRef` under React 18 with RHF `Controller`.

**Slice order (for old citations):** 0 plan, 1 backend `_id` strip and `:id` check, 2 data layer, 3 engine core, 4 `WordForm` and `AddWordPage`, 5 `WordPage`, 6 gate.

**Old text:** `git log -- .context/plans/phase-2-noun-crud.md`
