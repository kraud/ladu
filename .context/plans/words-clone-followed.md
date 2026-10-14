# Followed words: view only, clone one word, no duplicates (agreed 2026-10-14)

Follow-up of `plans/words-followed-selection.md`. Scope: the word page `/word/[id]` of a word the user does not own (it reached them through a followed tag), a "Clone" action, and hiding the followed original when the user has a clone of it.

## Decisions

- **Word page of a word that is not yours:** no Edit and no Delete, in the footer (desktop and phone) and in the phone side menu. The footer keeps "Return".
- **Clone (one word, no tag):** replaces the Edit button in the footer (desktop and phone). It copies the word into the user's account. The copy is private, has no tags, and keeps the user's own practice history (same as tag clone, D7 of `phase-5-practice.md`).
- **Where the origin is stored:** `words.source_word_id` (exists since Phase 4, D11), plus `is_cloned = true` and `original_creator_id`. No schema change.
- **After a clone:** a toast, then the app opens the new word (`/word/<new id>`).
- **Once you have a clone:** the original's word page shows "Open your copy" instead of "Clone" (no second copy). `GET /api/words/:id` returns `myCloneId` for that.
- **No duplicates on /words:** if a followed word and the user's clone of it are both in the result, only the clone is listed. If the clone is deleted, the original is listed again (nothing is stored: it is a query rule). The total and the pages count the same rows.
  - The rule is off when a Tags filter is active: the clone is not in the tag, and the user must still see the tag's real content. The tag page `/tag/[id]` always shows all words of the tag.
  - Only words of someone else are hidden. Your own words are never hidden.
- **Practice:** the word pool of Practice gets the same rule (included by the user's choice).

## Slices (one at a time; each ends runnable, with tests and docs)

- [x] **1. Word page: no Edit / Delete for a word that is not yours.** (built 2026-10-14; `WordPage.tsx`; unit tests only, e2e at Slice 3) Frontend only (`WordPage.tsx`, `WordEditorLayout`). Footer on desktop, footer and side menu on a phone.
- [x] **2. Backend: clone one word.** (built 2026-10-14; `cloneWord` in `wordController.ts`, shared helper `cloneWordsForUser` in `services/wordService.ts`, tests in `backend/tests/wordClone.test.js`; a second clone of the same word answers 409) `POST /api/words/:id/clone` (the caller must be able to see the word; own word = 400). Move the word-copy part of `cloneTagForUser` (`tagController.ts`) into a shared helper that both use. `GET /api/words/:id` adds `myCloneId` for a word of someone else. Backend tests.
- [x] **3. Word page: Clone / Open your copy.** (built 2026-10-14; `WordPage.tsx`, `useCloneWord`, `myCloneId` on `WordBE`; the test fake `makeWordHandlers` has clone and `cloneRequests`; e2e step at the end of the phase-4 tags spec) The footer button, the toast, the hand-off to the new word. Frontend tests and an e2e step (B follows a tag, clones a word, sees it in /words, the original is gone from the list only after Slice 4).
- [ ] **4. /words: no duplicates.** The rule in `GET /api/words/simple` (both modes, `total` included), off with a `tag` filter. Backend tests (clone hides the original, delete brings it back, tag filter keeps it, own words never hidden, total and pages).
- [ ] **5. Practice: no duplicates.** Same rule in the Practice word pool (`services/exerciseService.ts`). Research the pool query first.

## Backlog (after Slice 5)

- [ ] **6. `/tag/[id]` table: parity with `/words`.** Plan this slice when Slices 1–5 are done. What the user asked for (2026-10-14):
  - **Row click opens the word page** (confirm dialog first, as on `/words`). It must also work for a tag the user does **not** follow (a Public tag preview), so the user can judge the translations before following. *Backend check needed:* `GET /api/words/:id` allows a non-owner only through a followed tag today (`wordController.ts`, ownership check). A Public tag the user does not follow must be readable too. Same for the cell dialog (read-only) on that table. Decide how far the access goes (only words of a Public tag the user can see).
  - **Row selection only for Practice**, and only on a tag the user owns or follows. No other bulk action on this page (no Add tags, no Delete, no Clone). The `/words` selection features come with it: header checkbox, "(+ all pages)", Select all on a phone, Unselect, long press on a phone, the count bar. The bar has Practice only.
  - Reuse `BulkActionBar` and `ReviewTable` pieces where it is clean; do not copy them. `TagWordsTable` has its own table today.

## Open points

- The Practice pool query is not read yet. Slice 5 starts with that.
