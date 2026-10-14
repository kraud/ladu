# Followed words: view only, clone one word, no duplicates (agreed 2026-10-14)

Follow-up of `plans/words-followed-selection.md`. Scope: the word page `/word/[id]` of a word the user does not own (it reached them through a followed tag), a "Clone" action, and hiding the followed original when the user has a clone of it.

## Decisions

- **Word page of a word that is not yours:** no Edit and no Delete, in the footer (desktop and phone) and in the phone side menu. The footer keeps "Return".
- **Clone (one word, no tag):** replaces the Edit button in the footer (desktop and phone). It copies the word into the user's account. The copy is private, has no tags, and keeps the user's own practice history (same as tag clone, D7 of `phase-5-practice.md`).
- **Where the origin is stored:** `words.source_word_id` (exists since Phase 4, D11), plus `is_cloned = true` and `original_creator_id`. No schema change.
- **Before a clone:** a confirmation dialog ("Clone this word?") says what is done: a private copy, no tags, editable, the original unchanged, practice progress copied. Added 2026-10-14 after Slice 3.
- **After a clone:** a toast, then the app opens the new word (`/word/<new id>`).
- **Once you have a clone:** the original's word page shows "Open your copy" instead of "Clone" (no second copy). `GET /api/words/:id` returns `myCloneId` for that.
- **No duplicates on /words:** if a followed word and the user's clone of it are both in the result, only the clone is listed. If the clone is deleted, the original is listed again (nothing is stored: it is a query rule). The total and the pages count the same rows.
  - The rule is also off with the Owner filter "Not mine" (`owner=others`), so the original shows there (added 2026-10-14 after Slice 4).
  - The rule is off when a Tags filter is active: the clone is not in the tag, and the user must still see the tag's real content. The tag page `/tag/[id]` always shows all words of the tag.
  - Only words of someone else are hidden. Your own words are never hidden.
- **Practice:** the word pool of Practice gets the same rule (included by the user's choice).

## Slices (one at a time; each ends runnable, with tests and docs)

- [x] **1. Word page: no Edit / Delete for a word that is not yours.** (built 2026-10-14; `WordPage.tsx`; unit tests only, e2e at Slice 3) Frontend only (`WordPage.tsx`, `WordEditorLayout`). Footer on desktop, footer and side menu on a phone.
- [x] **2. Backend: clone one word.** (built 2026-10-14; `cloneWord` in `wordController.ts`, shared helper `cloneWordsForUser` in `services/wordService.ts`, tests in `backend/tests/wordClone.test.js`; a second clone of the same word answers 409) `POST /api/words/:id/clone` (the caller must be able to see the word; own word = 400). Move the word-copy part of `cloneTagForUser` (`tagController.ts`) into a shared helper that both use. `GET /api/words/:id` adds `myCloneId` for a word of someone else. Backend tests.
- [x] **3. Word page: Clone / Open your copy.** (built 2026-10-14; `WordPage.tsx`, `useCloneWord`, `myCloneId` on `WordBE`; the test fake `makeWordHandlers` has clone and `cloneRequests`; e2e step at the end of the phase-4 tags spec) The footer button, the toast, the hand-off to the new word. Frontend tests and an e2e step (B follows a tag, clones a word, sees it in /words, the original is gone from the list only after Slice 4).
- [x] **4. /words: no duplicates.** (built 2026-10-14; `notHiddenByOwnCopy` in `services/wordService.ts`, used by `getWordsSimplified`; the Clone dialog text mentions it; e2e step added) The rule in `GET /api/words/simple` (both modes, `total` included), off with a `tag` filter. Backend tests (clone hides the original, delete brings it back, tag filter keeps it, own words never hidden, total and pages).
- [x] **5. Practice: no duplicates.** (built 2026-10-14; `rankCandidateWords` in `services/exerciseService.ts` uses `notHiddenByOwnCopy`; no exception for Practice, by the user's choice; `visibleWordCondition` itself is not changed, so saving an answer still works) Same rule in the Practice word pool (`services/exerciseService.ts`). Research the pool query first.

## Backlog (after Slice 5)

- **6. `/tag/[id]` table: parity with `/words`** (planned 2026-10-14; three slices). Decisions of the user:
  - A word on a **Public tag** can be read (word page, cell dialog) by anyone, also when they do not follow the tag. A Private or Friends-Only tag stays closed; if the tag turns Private, the access ends.
  - **Clone** works for any word the user can read, so also on a Public tag they do not follow (tag clone already lets anyone copy a Public tag).
  - In **"Remove words" mode** (owned tag) row click and row selection are off: the trash column is the only action.
  - Existing tag actions stay: "Add words" and "Remove words" (they act on the tag, not on a selection).
  - [x] **6a. Backend: read access to words of a Public tag.** (built 2026-10-14; `canReadOthersWord` in `wordController.ts`; tests at the end of `backend/tests/wordClone.test.js`) `GET /api/words/:id` and `POST /api/words/:id/clone` accept a word that is on any Public tag, not only on a followed tag (`canReadFollowedWord` in `wordController.ts` gets the Public-tag case, in the same query). Backend tests: readable, clonable, closed again when the tag turns Private, a Private tag stays closed, a stranger without any tag stays closed.
  - [ ] **6b. Tag table: row click opens the word.** `TagWordsTable` gets `onOpenWord` (same rules as `ReviewTable`: a click on a button, link or the checkbox is not a row click; a tap on a phone). The confirm dialog ("Open this word?") is shared with `/words` (move it into a small component both pages use). Off in remove mode. The cell dialog stays read-only for words of others (works for a Public tag without follow after 6a). Tests and an e2e step (a user who does not follow a Public tag opens one of its words and its cell dialog).
  - [ ] **6c. Tag table: select words for Practice only.** Only when the user owns the tag or follows it (`tagRelation` is `owned` or `followed`), and not in remove mode. A checkbox column on desktop, long press on a phone, header checkbox, "(+ all pages)", "Select all" and Unselect on a phone, the count bar. The bar has **Practice only**: no Add tags, no Delete, no Clone, and no hint line. Reuse, do not copy: the long-press and row-selection code and the "(+ all pages)" logic come out of `ReviewTable` / `ReviewPage` into shared pieces; `BulkActionBar` gets a "Practice only" mode. "(+ all pages)" uses the tag's filters (`tag`, search, part of speech, gender), so it selects the words of this tag only. Tests and an e2e step.

## Open points

- Saved practice lists (`practiceConfigService`) still count a followed original as visible even when you have a copy. A saved list that holds the original does not practise it any more (the pool rule leaves it out), and the copy is not in that list, so the user must add the copy. Not changed; decide later if this matters.
