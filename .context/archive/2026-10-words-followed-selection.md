# /words: select any row, gated actions, row click (plan, 2026-10-14)

**Status:** done 2026-10-14 (slices 1 to 5). Merged in PR #87. The live spec is `.context/features/words-list.md` (W-5 to W-7, §3).

**Decisions kept:**
- W-5: any row is selectable; the bar shows only the actions the whole selection allows.
- W-6: Owner filter (Mine / Not mine), backed by `owner=me` and `owner=others`.
- W-7: a row click asks "Open this word?" first. The View button is removed.
- Hint text: "Add tags and Delete are available only when all selected words are your own."
- A filled cell of a followed word opens read-only (this closed D28 of `phase-3-forms-autocomplete-review.md`).

**Plan versus built:**
- Slice 2b replaced the "Select all N matching" banner with a "(+ all pages)" text button.
- `useOwnWordsTotal` and `useFetchAllOwnWords` were removed. The new name is `useFetchAllMatchingWords`.
- Slice 5 (read-only cell dialog) was added after the plan, also for `/tag/$tagId`.

**Traps:**
- `.bulkbar` CSS is shared with another banner. A colour change applies to both.
- The 401 branch in bulk delete is now unreachable by design: the bar hides Delete for mixed selections.

**Old text:** `git log -- .context/plans/words-followed-selection.md`
