# Tags

Live spec. It replaces a finished plan (archive record: `.context/archive/2026-09-phase-4-tags.md`). Built 2026-09-27 to 2026-09-28 (slices 0 to 9), extended later by account badges (`features/admin.md`), word-table rules (`features/words-list.md`) and sidebar rules (`design/04-layout.md`). Gate: `e2e/tests/phase-4-tags.spec.ts`. Tag **sharing** (share, accept, decline) is not built in the UI: see "Deferred" below.

Code map: backend `backend/controllers/tagController.ts`, `routes/tagRoutes.js`, `services/wordService.ts`, migration `0006_tags_provenance_and_indexes.sql`; frontend `frontend/src/features/tags/` (`types`, `api`, `keys`, `hooks`, `errors`, `TagsPage`, `TagViewPage`, `TagWordsTable`, `TagFormDialog`, `CloneTagDialog`, `TagPickerDialog`, `TagCombobox`, `TagChip`, `TagBadge`, `WordPicker`, `AddWordsDialog`), `features/words/layout/SidebarFields.tsx` (tags section), `features/words/review/` (tags column, filter, bulk actions). Code comments that cite a "Slice N" of Phase 4 mean the slice order listed in the archive record.

## 1. Decisions

| ID | Decision |
|---|---|
| D1 | `/tags` is the permanent home for tag CRUD. It stays strictly tag data: no profile fields, no friends list. |
| D2 | One `/tags` list, filtered by scope chips: **All** (owned and followed, default), **Owned**, **Followed**, **Discover** (other users' Public tags not followed). One search box matches label and description. |
| D3 | The create and edit form offers Public and Private only. Friends-Only stays in the schema and in `canViewTag`, but is not offered until friendships exist. |
| D4 | Tags can be assigned during word creation: `POST /api/words` accepts `tagIds`, ownership-checked, linked in the same transaction as the word. |
| D4a | Word-level assignment is in the word editor sidebar, for both create and view or edit. |
| D5 | The tag backend is a small resource-style API (section 2). Link and unlink are their own endpoint pair, used by bulk assign, the sidebar and tag creation. |
| D6 | Every legacy tag route without a consumer was deleted: `checkIfTagLabelAvailable` (a unique constraint with a 409 replaces it), `filterTags`, `getFollowedTagsIdByUserId`, `getOtherUserTags`. |
| D7 (=D14) | Review's tags column shows plain chips and a count, with no click target. Tags change only in the word editor sidebar or in Review's bulk "Add tags" and "Remove tags". |
| D8 | One dialog and one mutation state per operation (create, edit, delete are separate). |
| D9 | When a tag turns Private, followers lose access but stay following. The tag shows as "unavailable". Their words leave Review and Practice. If the tag turns Public again, access returns (the follow row was never deleted). |
| D10 | A user's own tag can be attached only to words that user owns. To organise another user's words, clone the tag first. So a tag's word list is "all mine" or "all cloned and mine". |
| D11 | Clone: `tags.source_tag_id` and `words.source_word_id` (both `ON DELETE SET NULL`) record the origin ("Cloned from X by Y"). The dialog asks for the new tag's visibility (default Private). A "Keep the tag" checkbox (default on) can copy only the words (`{keepTag: false}`, answer `{tag: null, clonedWordCount}`). Cloning a tag the user follows ends the follow, or the same words would show twice. |
| D12 | Deleting a tag deletes only the tag (links and follows cascade). To delete the words too, filter Review by the tag and bulk-delete. |
| D13 | Tag labels are unique per author, case-insensitively: unique index `(author_id, lower(label))`, a 409 on create or rename. A clone whose label collides gets a suffix: "Label (2)". |
| D15 | The tags filter is a searchable combobox, not a chip list (a user may have hundreds of tags). Matches are **additive (OR)**: more tags give more words. The query `inArray(tagWords.tagId, tagIds)` already is OR. Do not change it to AND. The search is server-side (`GET /api/tags?scope=owned,followed&q=`). |
| D16 | `/tags` has a Sort control: Recent (default) or Label A to Z. |
| D17 | One shared `TagCombobox`. Filtering hosts it inline (instant, no create). Assignment hosts it in `TagPickerDialog` (explicit Save; the word editor's "Add tag" and Review's bulk actions). |
| D18 | Adding words to a tag is: search, results table, select, the search box clears. `WordPickerDialog` is shared by the create-tag dialog ("Add words now") and `/tag/:id` "Add words". It uses `GET /api/words/simple?q=` and keeps only the caller's own words (D10). Both a checkbox and a row click work: the checkbox is `pointer-events-none`, so every click falls through to the row handler. |
| D19 | `TagFormDialog` shows the word picker only in create mode. Edit is metadata only. |
| D20 | `TagChip` (a label pill with `locked`, `removable`, `onRemove`, no `onClick`) and the filter `chip` (a toggle button) are two different components. Do not merge them. |

Calls made by the agent (reversible): tag endpoints use 404 for "not found" and 403 for "not allowed" (as the word endpoints do). `PUT /api/words/:id` stops accepting `tags`, so one path changes word and tag membership (a partial update once wiped tags).

## 2. API

| Route | Behaviour |
|---|---|
| `GET /api/tags?scope=all\|owned\|followed\|discover&q=&sort=recent\|label&badge=&cursor=&limit=` | Keyset-paginated `TagSummary` list. `q` matches label and description with `ILIKE`. `badge=official` keeps tags whose author has that active badge (`features/admin.md`; 400 for an unknown value). |
| `GET /api/tags/:id` | One `TagSummary`. `canViewTag` decides. 404 when not viewable, so existence is not confirmed. |
| `POST /api/tags` | `{label, description?, visibility, wordIds?}`. Every `wordIds` entry must be owned (403 otherwise). One transaction. |
| `PATCH /api/tags/:id` | `{label?, description?, visibility?}`. Author only. |
| `DELETE /api/tags/:id` | Author only. |
| `POST /api/tags/:id/follow`, `DELETE /api/tags/:id/follow` | No body. Follow of an own tag: 400. Both are idempotent. |
| `POST /api/tags/:id/clone` | `{visibility}` or `{keepTag: false}`. Public source, not an own tag. One transaction, batch inserts, provenance set, label suffix, auto-unfollow. |
| `POST /api/tags/links`, `POST /api/tags/links/remove` | `{tagIds, wordIds}`. The caller must own every tag and every word, or the **whole** call is 403 (no partial apply). Adding an existing link or removing a missing one is a no-op. |

`TagSummary`: `{ id, label, description, visibility, createdAt, updatedAt, author: { id, username, badges }, wordCount, followerCount, isOwner, isFollowing, isAvailable, sourceTag: { id, label } | null }`. `isAvailable` is false for a followed tag that the owner made Private (D9). Counts come from SQL `count(*)` subqueries, never from loading the words. A tag's words come from `GET /api/words/simple?tag=<id>`.

Word-side rules:
- `word.tags` on every word response is filtered to tags the **viewer** can see (own tags, or others' Public tags) and slimmed to `{id, label, visibility, authorId}`. A follower never sees the owner's other Private tag labels.
- `getWordsSimplified` resolves followed words with a SQL subquery (`user_following_tags` joined with viewable `tags` and `tag_words`), not a preloaded id list, so a Private flip acts at once.
- `GET /api/words/simple?tag=<id>` also shows the words of a **Public** tag the caller does not follow (the Discover preview). The extra access branch is gated to the requested tag ids and to Public. Friends-Only is untouched.
- `getWordById` allows read access through a followed tag the caller can view (read only).
- `createWord` runs in one transaction with `tagIds`.
- Migration `0006`: indexes `tag_words(word_id)`, `user_following_tags(follower_user_id)`, `tags(author_id)`; the two provenance columns; the unique label index, after a data step that renames existing duplicates (" (2)", " (3)").
- The tag-sharing routes stay (`POST /:id/share`, `POST /api/tag-shares/:id/accept`, `.../decline`), with one fix in `acceptTagShare`'s transaction.

## 3. Screens

- **`/tags`:** `TagCard` grid with `TagBadge` (relation and visibility). Cards on All and Yours have no action buttons. Follow, unfollow and clone actions are on Followed, Discover and the tag page. The scope chip "Owned" reads "Yours".
- **`/tag/$tagId`:** header (label, description, badges, "by <author>" when not owned, a "Cloned from" chip, word count, follower count), the word table (`TagWordsTable`, built from Review's column pieces `buildPartOfSpeechColumn`, `buildLanguageColumns`, `WordCell`), owned tags get "Add words" and a per-row remove column, others get Follow or Unfollow and Clone. Two non-table states: **unavailable** (lock icon, words hidden) and **not found or no access**. Pagination and row rules: `features/words-list.md`.
- **Word editor:** the tags section shows `TagChip`s with × and an "Add tag" button. In create mode picks accumulate in local state and go out as `tagIds` (`TagPickerDialog` with `wordIds` omitted). Tags are **staged** until Save, like every other field: they are linked and unlinked by a diffed call on Save and discarded on Cancel. A word reached through a followed tag shows the tags section disabled with the note "managed by the tag's owner".
- `TagWordsTable` takes everything as props (no router, store or query); `TagViewPage` owns the single words query, so the page can reuse the loaded rows for the picker's `excludeIds`.

## 4. Traps

- A partial-ownership request to the link endpoints must give 403 for the whole call.
- `/tags` must not drift into Account. Keep it tag data only.
- The unique label index fails to apply if staging or production already holds duplicate labels for one author. The data step must run first, and it was tested on a copy of that data.
- Do not turn the OR tag filter into AND.
- Two-user e2e needs two independent `registerAndVerify` calls in one spec file. `phase-4-tags.spec.ts` holds two browser contexts open at once.
- Pass `{ name: 'tags', exact: true }` when a test looks for the nav link: the tag page has a second link, "Back to /tags".

## 5. Deferred and open

- Friends-Only visibility in the UI, tag-sharing UI (share, accept, decline from the inbox), notification-driven acceptance, and `GET /api/tags?authorId=` (the list shape allows it): wait for the social phases (`plans/new-repo-build-plan.md`, social design section).
- Tag statistics on the dashboard (words per tag, followed versus owned): needs a new aggregation.
- Tag colour: out of scope on purpose. The mockups use semantic tokens, not a per-tag colour.
- Closed 2026-11-02 (confirmed by the user): the review of the ES, DE and EE texts of the tag screens.
