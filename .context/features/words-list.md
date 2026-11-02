# Word tables: `/words` and `/tag/$tagId`

Live spec. It replaces three finished plans (archive records: `.context/archive/2026-10-words-pagination.md`, `2026-10-words-followed-selection.md`, `2026-10-words-clone-followed.md`). Built 2026-10-12 to 2026-10-14. All slices are done. All three plans were merged together in PR #87 (`words-pagination`).

Code map: backend `backend/controllers/wordController.ts` (`getWordsSimplified`, `cloneWord`, `canReadOthersWord`), `backend/services/wordService.ts` (`notHiddenByOwnCopy`, `ownCopyIdsBySource`, `cloneWordsForUser`, paging helpers); frontend `frontend/src/features/words/` (`review/`, `hooks.ts`, `api.ts`), `frontend/src/features/tags/` (`TagViewPage`, `TagWordsTable`), `frontend/src/lib/pagination.ts`, `frontend/src/components/common/TablePagination.tsx`.

## 1. Decisions

| ID | Decision | Rejected alternative |
|---|---|---|
| W-1 | Numbered pages with a size menu (50, 100, 200, All) replace "Load more" on `/words` and `/tag/$tagId`. | Load more. |
| W-2 | Page, size, sort and filters are in the URL. The last size is kept in `localStorage` as the default for a new visit (one preference for both tables). | Local state. |
| W-3 | `GET /api/words/simple` has an offset mode next to the cursor mode. The cursor mode stays for `WordPicker`, `fetchTagWords` in practice and the `total` check in `PracticePage`. | Dropping the cursor mode. |
| W-4 | "Select all N matching" reuses `/simple?<filters>&limit=all&page=1`. It gives the ids and the row data that Practice needs. | A separate ids-only route. |
| W-5 | Any row can be selected, followed words too. The action bar shows only what the whole selection allows. | Own words only. |
| W-6 | An Owner filter (Mine / Not mine) is the way back to "my words" before Select all. | None. |
| W-7 | A row click opens the word only after a confirm dialog ("Open this word?"). The View button is gone. | Direct navigation. |
| W-8 | A word of someone else is view only on `/word/$wordId`: no Edit, no Delete. "Clone" replaces Edit. | Edit allowed. |
| W-9 | A clone is one word, private, no tags, `source_word_id` set, `is_cloned = true`, `original_creator_id` kept. The practice history is copied (D7 of `phase-5-practice.md`). A confirm dialog says what happens. After the clone, the app opens the new word. | A clone with tags. |
| W-10 | No duplicates: a followed word is hidden when the user has a clone of it. It is a query rule; nothing is stored, so deleting the clone brings the original back. | Storing a hidden flag. |
| W-11 | The Practice word pool follows W-10 with no exception (user's choice). | Show both. |
| W-12 | A saved practice list swaps a followed original for the user's copy, in the same place (once if both are listed). Nothing is stored: the saved ids stay. | Rewriting saved ids. |
| W-13 | A word on a Public tag can be read and cloned by anyone, also without a follow. A Private or Friends-Only tag stays closed. If the tag turns Private, access ends. | Follow required. |
| W-14 | The tag table has the same row-click rule, and a "Practice only" selection (owned or followed tags, not in remove mode). | Full bulk bar on the tag page. |

## 2. API contract

`GET /api/words/simple`:
- **Cursor mode** (no `page`): `cursor`, `limit` 1 to 100. Answer `{items, nextCursor, total}`.
- **Offset mode** (`page` present): `page` integer 1 or more; `limit` 1 to 200 or `all` (default 50). `page` with `cursor` gives 400. Any bad value gives 400. Answer `{items, total, page, pageSize}`; `pageSize` is `null` for `all`. A page after the last gives `items: []` with the true `total`. The order is the filter order, then `createdAt desc, id desc`, so pages are stable.
- Filters: `q`, `pos`, `gender`, `tag`, `sort`, `owner=me` (own words) and `owner=others` (words of followed tags). A bad `owner` value is handled like a bad `pos`.
- `all` hydrates ids in groups of 5,000, because Postgres allows 65,535 bind parameters in one query.
- **No-duplicate rule (W-10):** without a `tag` filter and without `owner=others`, a followed word is left out when the caller has an own copy (`source_word_id`). `total` and the pages count the same rows. Own words are never hidden. The tag page always shows all words of its tag.

`GET /api/words/:id`: a non-owner may read a word on a followed tag or on any Public tag (W-13). It returns `myCloneId` (the caller's copy, or null) for a word of someone else.

`POST /api/words/:id/clone`: the caller must be able to read the word. Own word: 400. Not readable: 403. Already copied: 409. Tag clone and word clone share `cloneWordsForUser`.

`GET /api/practice/configs/:id/words`: W-12. `missingCount` treats a swapped original as present. With more than one copy the oldest is used (`ownCopyIdsBySource`).

## 3. Screen behaviour

- **Selection:** `rowSelection` uses stable ids and survives a page change. A filter change resets it. A map of selected rows (filled from visible rows) feeds Practice, so selected words on other pages are not dropped. A word edited after selection keeps its old data in the map until seen again.
- **Action bar:** Practice always. Add tags and Delete only when every selected word is the user's own. Otherwise a hint says "Add tags and Delete are available only when all selected words are your own." Delete is an icon-only red trash button. On a phone: counter, "n selected", Unselect, Select all, then actions. "(+ all pages)" sits next to the label and selects every matching word. Colours: a soft accent tint.
- **Row click:** desktop `onClick` on the row, ignored when the target is inside `button, a, input, [role=checkbox], label`. Phone: a tap opens the word when no selection is active; with a selection a tap toggles it; a long press selects. The confirm dialog is shared by both pages (`review/OpenWordDialog.tsx`).
- **Cell dialog:** a filled translation cell of a followed word opens read-only (no Edit, no Delete translation, no Save). An empty cell of a followed word has no button.
- **Tag table:** in "Remove words" mode (owned tag) row click and selection are off; the trash column is the only action. "Add words" and "Remove words" act on the tag, not on a selection. The picker excludes ids already in the tag: `useTagWordIds` makes one `tag=<id>&page=1&limit=all` request, only while the dialog is open.
- **Page clamp:** if `page` is past the last page and `total > 0`, the app goes to the last page with `replace` (covers deleting the last rows). A change of filter, sort or size goes back to page 1, but only when a value really changes (the search box writes `q` twice under React StrictMode).
- The search count says "N results" for all pages.

## 4. Known traps

- Stop the dev backend before `npm run test:e2e`. A backend on `:5001` makes the stub tests (Ekilex, Google) fail.
- Menu tests use `findByRole`: the options appear a moment after the click.
- `.bulkbar` CSS is shared with `SelectAllMatchingBanner`-style pieces. A colour change applies to both.
- `visibleWordCondition` is not changed by W-11, so saving an answer for a hidden original still works.
- Test data: the seed account with a 200-word Public tag (`backend/scripts/seed-pagination-words.ts`; steps in `guides/infrastructure-guide/02-environments-and-databases.md`).

## 5. Open items

1. Look at the pagination footer in a real browser, desktop and phone (not done by hand).
2. `GET /api/words` (full list) has no frontend caller and is not paginated. Remove it or keep it, by decision.
