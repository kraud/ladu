# Plan: Numbered pagination for /words and /tag/$tagId

Status: in progress. Plan agreed on 2026-10-12. Slices 1 to 4 (backend, frontend groundwork, `/words`, `/tag/$tagId`) done on 2026-10-13.

Goal: the two word tables show numbered pages with a page-size menu (50 / 100 / 200 / All), instead of the "Load more" button.

## How to start (read this first in a new session)

1. Read `CLAUDE.md` and `.context/README.md`. Follow the working rules: one small slice at a time, a plain-language overview **before** any file changes, ask before assuming, docs and tests with the code. The user runs `git commit` and creates branches; you only draft messages and names.
2. Do the slices in order. After each slice: run its checks (see **Verification**), tick the **Progress** list below with the date, and suggest a commit message.
3. Before slice 1, read `backend/controllers/wordController.ts` (`getWordsSimplified`) and `backend/services/wordService.ts` (l.303-336, the paging helpers).

## Progress

- [x] Stage 0 — This plan is in the repo (2026-10-12)
- [x] Slice 1 — Backend: offset mode and `owner=me` on `/api/words/simple` (2026-10-13). Built inline in `getWordsSimplified` (no separate helper functions); `owner=me` reuses `/simple`, no separate ids endpoint. Backend: 53 suites / 1,255 tests green, typecheck clean.
- [x] Slice 2 — Frontend groundwork: types, API, `useWordsPage`, page-size preference, `TablePagination`, MSW (2026-10-13). Two path changes from the plan: the page-size module is `src/lib/pagination.ts` (both the words feature and the tag page use it) and the component is `src/components/common/TablePagination.tsx` (`components/ui` holds only plain shadcn parts). Strings are in `common.json` under `pagination` (en, de, es, ee). Frontend: 131 files / 1,647 tests green, typecheck and lint clean. No screen uses the new parts yet.
- [x] Slice 3 — `/words` (ReviewPage): URL state, numbered pages, selection across pages (2026-10-13). Frontend: 131 files / 1,688 tests green, typecheck clean. Full e2e: 137 passed (`phase-3-review.spec.ts` walks pages, reload, All/50, sort in the URL, and a selection across two pages). Still to do by hand: look at the footer layout in a real browser, desktop and phone.
- [x] Slice 4 — `/tag/$tagId` (TagViewPage): URL state, numbered pages, `existingWordIds` fix (2026-10-13). Frontend: 131 files / 1,710 tests green, typecheck clean. The two Add-words regression tests fail with the old logic and pass with the fix (checked). Full e2e: 138 passed (`phase-4-tags.spec.ts` has a third account with a 51-word tag). The first full run had 11 failures, all stub tests (Ekilex and Google), because the user's own dev backend held port 5001 and the e2e run reused it; with the port free the run is green. **Stop the dev backend before `npm run test:e2e`.** Menu tests now use `findByRole` (the options appear a moment after the click; one test was flaky).

## Context

Users can now have many words. The two word tables (`/words` = `ReviewPage`, `/tag/$tagId` = `TagViewPage`) already get their data in pages from `GET /api/words/simple`. This endpoint uses cursor (keyset) paging: 50 rows by default, 100 at most, response `{items, nextCursor, total}`. The tables show a **Load more** button that adds rows below. Filters (`q`, `pos`, `gender`, `tag`) and the language sort already run on the server.

Decisions from the user (2026-10-12):
- Numbered pages. "Load more" is removed from these two tables.
- The selection stays when the user changes page. "Select all" selects the visible page. A banner then offers "Select all N matching words".
- page, size and sort go in the URL. The last page size is also kept in localStorage as the default for a new visit.

Cursor paging cannot go directly to page N, so the backend gets an **offset mode** next to the cursor mode. The cursor mode stays unchanged, because three consumers need it: `WordPicker` (5-row Load more), `fetchTagWords` in `features/practice/hooks.ts`, and the `total` check in `PracticePage`.

## Slice 1 — Backend: offset mode and `owner=me` on `/api/words/simple`

**File:** `backend/controllers/wordController.ts` (`getWordsSimplified`, l.347-509)

- **Offset mode** applies when `?page=` is present.
  - `page`: an integer ≥ 1. Any other value returns 400.
  - `limit`: an integer from 1 to 200, or the literal `all`. The default is 50. Add `parsePageLimitParam` and `parsePageParam` next to `parseLimitParam` in `backend/services/wordService.ts:303-336`. Keep `MAX_PAGE_LIMIT = 100` for cursor mode. Add `MAX_OFFSET_PAGE_LIMIT = 200`.
  - `page` together with `cursor` returns 400.
  - The query uses the same `conditions` and the same `orderByClauses` / `createdAt desc, id desc` order. Then `.limit(limit).offset((page-1)*limit)`. For `all` there is no limit or offset. The `id` tie-breaker already makes the order stable across pages.
  - Response: `{ items, total, page, pageSize }`. `pageSize` is `null` for `all`. `nextCursor` is not sent.
  - A page after the last page returns `items: []` with the correct `total`. The frontend then goes to the last page.
- **`owner=me` filter** (both modes): adds `eq(words.userId, req.user.id)`. This feeds "Select all N matching". Only the user's own words can be selected (`enableRowSelection` in `ReviewTable.tsx:142`). So the frontend calls `/simple?<filters>&owner=me&limit=all&page=1`. This gives the ids and the row data that Practice needs (`toPreselectedWord`), with no new route.
  - Open point for the user: the first idea was a separate ids-only endpoint. Reusing `/simple` is smaller and also gives Practice its row data. Confirm before slice 1.
- **Hydration size for `all`:** `fetchWordsWithRelations` (`services/wordService.ts:251`) uses `inArray(ids)`. Postgres allows at most 65,535 bind parameters in one query. Hydrate the ids in groups of 5,000 so a very large "All" request cannot fail.
- Refactor: move the cursor branch and the offset branch into two small helpers inside the controller. This keeps the function readable. The shared `conditions` building stays as it is.

**Tests:** `backend/tests/words-simple.test.js` gets a new `describe('offset pagination')`:
- page 1 and page 2 do not overlap and together contain all words;
- `total`, `page` and `pageSize` are correct;
- `limit=all` returns every word;
- a page after the last returns `[]` with `total`;
- offset mode with `sort=EN` (also checks that empty cells come last across the page boundary);
- 400 for `page=0`, `page=abc`, `limit=201`, and `page` with `cursor`;
- `owner=me` excludes words from followed tags.

Also update the contract in the file's header comment.

**Docs:** `.context/README.md:117` (§8.4 row). Update the out-of-date notes in `.context/plans/phase-3-forms-autocomplete-review.md` l.70 and l.566.

## Slice 2 — Frontend groundwork (shared by both tables)

- **Types:** `frontend/src/api/types.ts` gets `OffsetPage<T> { items; total; page; pageSize: number | null }`.
- **API:** `frontend/src/features/words/api.ts`. `buildListQuery` (l.71-84) gets `page`, `limit: number | 'all'` and `owner`. Add `getWordsPage(params, signal)`.
- **Hook:** `frontend/src/features/words/hooks.ts`. Add `useWordsPage(filters, { page, pageSize })`:
  - `useQuery` with `placeholderData: keepPreviousData`, so the old page stays on screen while the next page loads;
  - key `wordKeys.list({ ...normalizeWordFilters(f), page, limit })`;
  - reuses `normalizeWordFilters` (l.96-106).
  - Keep `useWordsInfinite` for `WordPicker` and `PracticePage`.
  - Invalidating `wordKeys.all` now refetches only one page. This also removes the N-page refetch that the comment at l.17-21 describes.
- **Page-size preference:** new file `frontend/src/lib/pagination.ts` (built; first planned as `features/words/pageSize.ts`).
  - `PAGE_SIZE_OPTIONS = [50, 100, 200, 'all']`, `parsePageSize`, `pageCountFor`, `pageRange`, `buildPageItems`;
  - `readStoredPageSize()` / `storePageSize()` on one localStorage key, with every access in try/catch and 50 as the fallback;
  - one preference for both tables.
- **UI:** new file `frontend/src/components/common/TablePagination.tsx` (built; first planned under `components/ui`).
  - Prev / page numbers with ellipsis / Next, the "Showing 201–300 of 1143" text, and a page-size `Select`. Uses the existing ui `Select`; there was no shadcn `pagination` primitive.
  - The page buttons are hidden when the size is All.
  - Every label goes through i18n, in all four UI languages.
- **MSW:** `frontend/src/test/msw/wordHandlers.ts:268` gets offset mode and `owner=me`, next to the cursor mode.
- **Unit tests:** `useWordsPage` in `hooks.test.tsx`, `TablePagination.test.tsx`, `pageSize.test.ts`.

## Slice 3 — `/words` (ReviewPage)

- **URL state:** `frontend/src/features/words/review/search.ts` (`validateReviewSearch`) gets `page`, `size` (`50|100|200|all`), `sort` (`EN|ES|DE|EE`) and `dir`.
  - Sort moves from local `useState` to the URL. *Built:* `ReviewPage` reads the sort with `reviewSearchToSort` and moves it with the existing pure `nextLanguageSort` (asc → desc → off). The `useLanguageSort` hook itself is unchanged, because the tag page still uses it; Slice 4 moves that page too.
  - *Built:* `updateSearch` goes back to page 1 only when a value really changes. The search box writes `q` once on mount (twice under React StrictMode in dev); a plain "always reset" rule threw the user off page 2 after a reload. The e2e run found this; `ReviewPage.test.tsx` has a StrictMode regression test (`renderApp({ strictMode: true })`).
  - A missing `size` falls back to `readStoredPageSize()`.
  - A change to a filter, the sort or the size sets `page` back to 1.
- **ReviewPage.tsx:**
  - change `useWordsInfinite` to `useWordsPage` (l.76-81);
  - if `page > pageCount` and `total > 0`, go to the last page with `replace`. This covers deleting the last rows of the last page.
- **Selection across pages:**
  - keep `rowSelection` with `getRowId = id`, and remove the reset on page change. The reset on filter change at l.92-94 stays, because the matching set changes;
  - add `selectedRows: Map<id, WordSimpleBE>` (built as a ref, filled by an effect from the visible rows, pruned to the selection). `handlePractice` reads this map, not `rows`, so selected words on other pages are not dropped. Limit: a word edited after it was selected, and now on another page, keeps its old data in the map until it is seen again;
  - after the header checkbox selects the full page, and if more of your own words match on other pages, show a banner: "All words on this page are selected. [Select all N matching words]". *Built:* `review/SelectAllMatchingBanner.tsx`. `N` is exact: `useOwnWordsTotal` (one `owner=me&limit=1` request, only while the banner can show), because the list `total` also counts followed-tag words that cannot be selected. The click runs `useFetchAllOwnWords` (`owner=me`, `limit=all`) and fills the selection and the map. When all are selected the banner says so and offers "Clear selection";
  - the BulkActionBar count uses `selectedIds.length`. It already does.
- **ReviewTable.tsx:** replace the Load more footer and the skeleton rows (l.280-313) with `TablePagination`. Remove `hasNextPage`, `onFetchNextPage` and `isFetchingNextPage`. Add `page`, `pageSize`, `total`, `onPageChange` and `onPageSizeChange`. In compact mode, show only the page controls.
- **Tests:**
  - change the tests in `ReviewPage.test.tsx` (l.119 Load more, l.722 selection survives Load more) and `ReviewTable.test.tsx` (l.300) to page navigation;
  - add tests for the select-all-matching banner, the URL page/size/sort round-trip, and the clamp after delete;
  - `search.test.ts` and `useLanguageSort.test.ts`.
- **E2E:** `e2e/tests/phase-3-review.spec.ts` (it already seeds more than 50 Verbs, l.60):
  - click "Next", not Load more;
  - select a row on page 2, go back to page 1, and check that the selection count stays;
  - set size to "All" and check that every row shows;
  - reload and check that page, size and sort stay.

## Slice 4 — `/tag/$tagId` (TagViewPage)

- **Router** (`frontend/src/app/router.tsx`): add `validateSearch: validateTagSearch` (new `features/tags/search.ts`, with `q`, `page`, `size`, `sort`, `dir`; it reuses `toOptionalString`, `toPage` and the new `toSortParams` exported from `words/review/search.ts`). The local `query` state stays for the input, debounced (300 ms), and then writes `q` to the URL. *Built:* the write only happens when `q` really changes (StrictMode safe, like Slice 3), and a change of the URL from outside (the back button) goes back into the box.
- **TagViewPage.tsx** (l.59-62): change to `useWordsPage({ tag:[tagId], q, ...sort }, { page, pageSize })`, with the same clamp to the last page.
- **Fix an existing bug:** `existingWordIds` (given to `AddWordsDialog` → `WordPicker excludeIds`) was built from the loaded rows only, so it was wrong for more than 50 words or during a search. *Built differently from the plan:* a new hook `useTagWordIds(tagId, enabled)` in `features/words/hooks.ts` (one `tag=…&page=1&limit=all` request, key under `wordKeys.all`), not `useTagWords` from practice. It keeps the words feature the owner of that endpoint and avoids mapping to `PreselectedWord`. It runs only while the dialog is open; `AddWordsDialog` shows a skeleton until the ids are in (`existingWordIds` is `undefined` while loading), and if the request fails the dialog works without the filter.
- **TagWordsTable.tsx:** replace the Load more footer with `TablePagination` (compact on a phone). The search count now says `N results` for all pages (`tags:words.resultTotal`), because "N of M" would count only the page on screen; the unused `words.resultCount` and `words.loaded` strings are removed. A page past the last one is not the empty state.
- **`useLanguageSort` hook removed.** After this slice nothing uses it: both pages keep the sort in the URL and move it with the pure `nextLanguageSort`. `sortFilters` and `nextLanguageSort` stay.
- **Tests:** `TagViewPage.test.tsx`, `TagWordsTable.test.tsx` (l.242), and a test for the `existingWordIds` fix in `AddWordsDialog.test.tsx`.
- **E2E:** `e2e/tests/phase-4-tags.spec.ts`. Add enough words to a tag to get two pages at size 50, go to page 2, reload, and check that the page stays.

## Not changed

- `WordPicker` (5-row Load more) and `PracticePage`'s `useWordsInfinite({}, 1)` stay on cursor mode.
- `fetchTagWords` in practice stays on cursor mode. It could later become one `limit=all` request, but that is not part of this work.
- `GET /api/words` (full list, no frontend caller) is not touched.

## Test data for the manual checks

A local seed account owns a Public tag with 200 words ("Pagination test (200 words)"). Follow it from your own account to test `/words` and `/tag/$tagId` with several pages. The account, the tag and the rebuild command are in `.dev-context/infrastructure-guide/02-environments-and-databases.md` (section "The seed account and the pagination test tag"). The script is `backend/scripts/seed-pagination-words.ts`.

## Verification (at the end of each slice)

- Backend: `npm test` in `backend/` (the new `words-simple` offset tests). Do not pipe the output through tail or head.
- Frontend: `npm test` in `frontend/` (Vitest) and the type check / lint from `.context/README.md`.
- E2E: `npm run test:e2e` must be green, especially `phase-3-review` and `phase-4-tags`. First check that no orphaned backend is on :5001.
- Manual: with the Playwright MCP, seed about 250 words. On `/words`, test 50 → 100 → 200 → All, go to page 3, sort by DE, reload, use browser back, select words on two pages and start Practice, then "Select all N matching" → add tag. On `/tag/$id`, do the same for paging, and check that the Add-words picker does not show words already in the tag.
- Each slice ends with a suggested commit message and a tick on the **Progress** list. The user runs the commit.
