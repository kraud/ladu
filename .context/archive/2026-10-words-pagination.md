# Numbered pagination for /words and /tag/$tagId (plan, 2026-10-12)

**Status:** done 2026-10-13 (slices 1 to 4). Merged in PR #87 (`words-pagination`). The live spec is `.context/features/words-list.md` (W-1 to W-4, §2, §3).

**Decisions kept:**
- W-1: numbered pages, sizes 50, 100, 200 and All. W-2: page, size, sort in the URL; last size in `localStorage`.
- W-3: offset mode beside the cursor mode on `GET /api/words/simple`. `WordPicker`, `fetchTagWords` and the `total` check in `PracticePage` need the cursor mode.
- W-4: "Select all N matching" reuses `/simple?...&limit=all&page=1`.

**Plan versus built:**
- Offset mode was built inline in `getWordsSimplified`, with no separate helper functions.
- The page-size module is `frontend/src/lib/pagination.ts` and the component is `frontend/src/components/common/TablePagination.tsx` (the plan named other places).
- The "Select all N matching" banner was replaced by a "(+ all pages)" button, and its count is the list `total`.
- `useTagWordIds` fixes a bug: `existingWordIds` came from the loaded rows only, so the Add-words picker was wrong above 50 words. The plan wanted `useTagWords` from practice.
- `useLanguageSort` was removed; both pages keep the sort in the URL.

**Traps:**
- "Always reset to page 1" on a filter change throws the user off page 2 after a reload, because the search box writes `q` twice under StrictMode. Reset only when a value really changes.
- A backend left running on `:5001` makes 11 stub e2e tests fail.
- Postgres allows 65,535 bind parameters: hydrate ids in groups of 5,000.

**Not done:** a look at the footer layout in a real browser, desktop and phone.

**Old text:** `git log -- .context/plans/words-pagination.md`
