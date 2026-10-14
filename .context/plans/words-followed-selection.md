# /words: select any row, gated actions, row-click to word page

## Context

On `/words`, only your own words can be selected (`enableRowSelection` in `ReviewTable.tsx:159`). This blocks two valid uses of followed-tag words: Practice from the table, and opening a word in `/word/[id]`. The limit exists so that Delete (backend 401 → session cleared by the axios interceptor) and Add tags cannot target words you do not own. New rule: any row can be selected; the action bar shows only the actions that the whole selection supports.

Facts checked:
- `GET /api/words/:id` already lets a user read a word from a followed tag (`wordController.ts:559-567`), and `WordPage` already shows such a word read-only. No backend change is needed for row-click.
- `.bulkbar` CSS (`globals.css:1090`) is also used by `SelectAllMatchingBanner`. The new colours apply to both.
- Scope is `/words` only. `/tag/[id]` (`TagWordsTable`) has no bulk bar and does not change.

Decisions from you (2026-10-14):
- Select all selects **every row** (followed words too). Add an **Owner filter** (Mine / Not mine) so the user can narrow to own words before Select all.
- Hint text: **"Add tags and Delete are available only when all selected words are your own."**
- Bar colours: **soft accent tint**.

## Slices (each ends runnable, with tests + docs; commit message suggested after each)

### Slice 1 — Owner filter
Why first: Slice 2 removes "own words only" from Select all; this filter gives the user a way back to "all my words".
- Backend `wordController.ts:434-438`: accept `owner=others` → `ne(words.userId, req.user.id)`, next to the existing `owner=me`. Reject other values with 400 (or ignore — follow how `pos` handles bad values). Backend test in the existing `/simple` test file.
- Frontend `features/words/api.ts:71`: `owner?: 'me' | 'others'`. Add `owner` to `WordListFilters`, `ReviewSearch` (`review/search.ts`, validated, mapped by `reviewSearchToFilters`, counted by `hasActiveFilters`).
- `review/FilterBar.tsx`: new section id `'owner'` (icon `UserIcon`), two chips "Mine" / "Not mine", one value at a time (click the active chip again = no filter). `activeFilterCount` counts it. `TagViewPage.tsx:170` passes its own `sections`, so `/tag/[id]` does not get it (check that the default list does not leak it there).
- i18n keys in en/es/de/ee `public/locales/*/review.json`.
- Tests: `search.test.ts`, `FilterBar.test.tsx`, backend test.

### Slice 2 — Any row selectable, actions gated by the selection
- `ReviewTable.tsx`: remove the `enableRowSelection` limit (and its comment). The header checkbox now selects the full page; long press works on every row.
- `ReviewPage.tsx`: compute `allOwn` = every selected id is an own word (current `rows` first, then `selectedRowsRef` for off-page ids — every selected row was seen, so the map has it). Pass `canEdit={allOwn}` to `BulkActionBar`.
- `BulkActionBar.tsx`: when `canEdit` is false, do not render Add tags / Delete; render the hint (`review:bulk.ownOnlyHint`) as a small `.hint` line between the bar and the table. Practice is always shown.
- "Select all N matching": N = list `total` (no more `useOwnWordsTotal`); fetch uses the filters without `owner=me` → rename `useFetchAllOwnWords` → `useFetchAllMatchingWords` (keeps the current `owner` filter from Slice 1). `selectableRows` / `pageFullySelected` use all rows. Delete `useOwnWordsTotal` if it has no other consumer.
- `hooks.ts:200` bulk-delete comment: the 401 branch is now kept unreachable by the bar gate, not by `enableRowSelection`.
- Update `.context/plans/words-pagination.md` line 43/95 notes (own-only selection no longer true).
- Tests: `BulkActionBar.test.tsx` (gate + hint), `ReviewTable.test.tsx` (followed row checkbox enabled), `ReviewPage.test.tsx` (mixed selection hides actions; select-all-matching count), e2e `phase-3-review.spec.ts` / `phase-4-tags.spec.ts` where they assert disabled checkboxes.

### Slice 3 — Action bar look and mobile layout
- Buttons: Practice with `BrainIcon`, Add tags with `TagIcon` (same icons as `AppHeader.tsx:26-30`). Delete becomes an icon-only red trash button (`TrashIcon`, `aria-label` = "Delete", `title` too).
- Mobile (`onClear` set): order = counter, "n selected", Unselect (icon button `XIcon` with aria-label) right after the counter, then the actions. New "Select all" button on mobile (`onSelectAll` prop → selects all rows of the current page; the "Select all N matching" banner then appears as on desktop).
- Colours (`globals.css` `.bulkbar`): background `color-mix(in oklch, var(--accent) 12%, var(--bg))`, border `1px solid color-mix(... var(--accent) 35% ...)`, text `var(--fg)`, counter pill in accent. Buttons drop the inverted overrides; danger icon uses `var(--danger)`. Check both themes; check the `dark:` utility override note still holds.
- Tests: `BulkActionBar.test.tsx` (icon buttons by accessible name, mobile Select all / Unselect).

### Slice 4 — Row click opens the word (with confirmation); remove View
- `ReviewTable.tsx`: new prop `onOpenWord(wordId)`. Desktop: `onClick` on `<tr>` that ignores clicks whose target is inside `button, a, input, [role=checkbox], label` (cell labels open the cell dialog, checkbox still selects). Mobile: a tap with no selection active and no long press → `onOpenWord`; with a selection active a tap still toggles selection; long press still selects. Rows get `cursor: pointer`.
- `ReviewPage.tsx`: `onOpenWord` sets a target; a `ConfirmDialog` (`destructive={false}`, title "Open this word?", description = the word in the first visible language, confirm "Open") navigates to `/word/$wordId`. Remove `handleView`, `onView`, `review:bulk.view`.
- Tests: `ReviewTable.test.tsx` (row click fires, button click does not), `ReviewPage.test.tsx` (dialog → navigate), e2e: open a followed word from the table.

## Verification (each slice)
- `npm run test -w frontend` and backend tests (Slice 1) — check exit code, no piping through tail.
- `npm run test:e2e` green at the end of Slices 2 and 4 (check for an orphaned backend on :5001 first).
- Manual with Playwright MCP on the seed account (Public 200-word tag, follow it from a second user): select own + followed rows → hint shows, actions hide; unselect followed → actions back; Owner filter "Mine" + Select all N matching → Delete available; row click on desktop and tap on a phone width → dialog → word page; light + dark theme screenshots of the bar.

## Progress

- [x] Slice 1 — Owner filter (built 2026-10-14; backend `owner=others`, URL `?owner=`, side-menu section Owner)
- [ ] Slice 2 — Any row selectable, actions gated
- [ ] Slice 3 — Action bar look and mobile layout
- [ ] Slice 4 — Row click opens the word
