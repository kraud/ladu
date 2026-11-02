# Followed words: view only, clone one word, no duplicates (plan, 2026-10-14)

**Status:** done 2026-10-14 (slices 1 to 7). Merged in PR #87. The live spec is `.context/features/words-list.md` (W-8 to W-14, §2).

**Decisions kept:**
- W-8: a word of someone else is view only; "Clone" replaces Edit.
- W-9: a clone is one private word with no tags; origin in `source_word_id`, `is_cloned`, `original_creator_id`. No schema change.
- W-10, W-11: a followed word is hidden when the user has a copy. This is a query rule, also in the Practice pool.
- W-12: a saved practice list swaps the original for the copy and stores nothing.
- W-13, W-14: words on a Public tag are readable and clonable by anyone; the tag table gets row click and a "Practice only" selection.

**Plan versus built:**
- The rule is off with a `tag` filter and with `owner=others` (added after slice 4).
- Slices 6a to 6c and 7 were added to the backlog on 2026-10-14 and built the same day.
- Shared pieces were extracted from `ReviewTable` and `ReviewPage`: `review/rowClick.ts`, `review/OpenWordDialog.tsx`, `review/useRowPress.ts`, `review/useWordSelection.ts`, `buildSelectColumn`.

**Traps:**
- `visibleWordCondition` is not changed, so saving an answer for a hidden original still works.
- With more than one copy of the same original, the oldest copy is used.

**Open points at the end:** none.

**Old text:** `git log -- .context/plans/words-clone-followed.md`
