# Phase 4 — Tags

## Context

Phase 3.9 is done and committed; work continues on branch `tags` (cut from
`theme-and-ui-changes`). Phase 4 is the next item in
`new-repo-build-plan.md` §5 — tag CRUD, follow/unfollow, and bulk tag
assignment from Review.

**This plan replaces an earlier version of itself.** The earlier version
found that the backend side of tags — including the tag-*sharing* lifecycle
that the roadmap scopes to **Phase 7** — was already built and tested in the
Phase 0 commit, and concluded it could mostly be left alone. A 2026-09-27
review with the user, done specifically to check whether that was still the
most efficient path, found that conclusion **does not hold**: the existing
tag backend has real ownership-bypass bugs, a broken route, and no
pagination anywhere. Since this rewrite explicitly does not aim to
reproduce the old app 1:1, and backend changes are in scope wherever they
improve quality or performance, this phase now includes a backend rebuild
of the tag API, not just a frontend built on top of it.

The **frontend is a blank slate** (`grep -r tag frontend/src` outside the
type/comment seeds below returns nothing), but Phases 2–3.5 deliberately left
marked insertion points rather than ignoring tags entirely:

- `features/words/types.ts` — `WordTagRef`, `WordBE.tags`,
  `WordSimpleBE.tags`, `WordListFilters.tag` are all typed and threaded
  through `api.ts`'s `buildListQuery` / `hooks.ts`'s `normalizeWordFilters`;
  none of it is rendered or populated from the URL yet.
- `features/words/review/columns.tsx:105-106` — a comment marking exactly
  where a `tagsColumn(options)` gets appended, after the language columns.
- `features/words/review/FilterBar.tsx:3-4` — "No Tags group (D1)".
- `features/words/review/BulkActionBar.tsx:4-5` — "Create-exercises and
  Assign-tag are absent, not disabled (Phases 5 and 4 respectively)".
- `features/words/review/search.ts` — `ReviewSearch` has no `tag` field yet
  (the URL layer is the only missing piece; the query layer beneath it is
  already tag-aware).
- `features/words/layout/SidebarFields.tsx` — the word editor's sidebar
  **already has a full Tags UI seam**: a `tagCount` prop, a collapsed-rail
  icon+badge, and a `TagsPlaceholder` showing
  `wordRelated:wordForm.sidebar.tagsComingSoon`. Used identically by
  `WordForm` (create) and `WordPage` (view/edit); neither passes real tag
  data today.
- `app/router.tsx` — `/tag/$tagId` is already stubbed
  (`<Placeholder title="Tag" note="Tag view lands in Phase 4." />`); there is
  **no** `/tags` route yet.
- `app/query-client.ts:29` — the invalidation edge is pre-documented:
  `Phase 4 (tags) — add: bulk-add-tags ⇒ ['tags', id, 'wordCount'] + ['words']`.
- `app/feature-flags.ts` — `featureFlags.tags` already exists, default `true`.
- `public/locales/{en,es,de,ee}/{tags,review,account}.json` already carry
  old-app strings for tag flows — reusable content that needs reshaping into
  the new components' key structure, same as every prior phase's locale work.

## Why the backend is being rebuilt, not reused

A 2026-09-27 code review (prompted by the question "is the current process
the most efficient way to implement this?") found the existing
`tagController.ts`/`tagRoutes.js`, though covered by 16/16 green tests,
has problems the old tests don't exercise:

- **`GET /api/tags/filterTags` is broken.** `tagRoutes.js` binds the helper
  `getTagDataByRequest` directly as an Express handler; that helper never
  calls `res.json(...)` and reads its second argument as a filter array, not
  as `res`. The route 500s or hangs. The original plan named this route as
  Review's tag-filter data source.
- **No ownership check when tags and words are linked.** `createTag`
  (`req.body.words`), `updateTag` (`req.body.words`), `createWord`
  (`req.body.tags`) and `updateWord` (`req.body.tags`) all write to
  `tagWords` from caller-supplied ids with no check that the caller owns
  both sides. User A can link their own word into user B's tag (or vice
  versa); B's followers then see A's word inside B's tag.
- **`getTagsFollowedByUser` (`GET /api/tags/getFollowedTagsIdByUserId?userId=`)**
  takes an arbitrary `userId` query param with no authorization check —
  anyone can list anyone's followed tags.
- **Followers see Private tags.** `fetchTagsMap`
  (`backend/services/wordService.ts:140`) attaches every tag on a word to
  every response, including the owner's Private tags, so a word reached
  through one Public tag leaks the owner's other, unrelated Private tag
  labels.
- **`getWordById` 403s for followed words.** A user who follows a tag can
  see the word in Review's simplified list but cannot open its detail view
  — the route only allows the author.
- **Followers keep access after a tag turns Private.**
  `getWordsIdFromFollowedTagsByUserId` resolves purely through the
  `user_following_tags` → `tag_words` join with no visibility check.
- **Tag-share accept is not atomic.** `acceptTagShare` calls
  `cloneTagForUser`, which opens its *own* `db.transaction` instead of
  running inside the caller's `tx` — a crash between the two leaves a share
  marked accepted with no clone, or a clone with the share still pending.
- **Clone inserts words one at a time** inside the transaction (an
  `await` in a loop), rather than as batch inserts.
- **Minor:** `followTag` lets a user follow their own tag, and a duplicate
  follow surfaces a raw Postgres `23505` (500) instead of a clean 400.
- **`createWord` is not transactional** — a crash partway through leaves an
  orphaned word row with no translations.
- **No pagination or lean shape on any tag list.** `getUserTags`,
  `searchTags`, `getTagsFollowedByUser`, `getOtherUserTags` all load every
  matching tag's **entire word list, with every translation and case**,
  just to show a label and a count in a list UI. `searchTags`/
  `getOtherUserTags` also load *all* accepted friendship rows in the
  database and filter them in JavaScript, and `searchTags` label-matches
  in JS after loading every Public tag.
- **Missing indexes**: `tag_words(word_id)`, `user_following_tags
  (follower_user_id)`, `tags(author_id)` — the existing composite primary
  keys only serve lookups by their first column.

The earlier plan's D4 ("tag assignment is only possible once the word has
an id") is also simply incorrect: `createWord` already reads and links
`req.body.tags`. Once ownership is checked, there is no reason not to let
the create form send tag ids in the same request.

None of this touched by the fix is the tag-*sharing* lifecycle
(`shareTag`/`acceptTagShare`/`declineTagShare`/notifications) — that stays
out of scope for this phase's UI (Phase 7), beyond the one atomicity fix
above, which is small and prevents a real data-integrity bug from shipping
dormant code.

## Decisions taken with the user (2026-09-27)

- **D1 — `/tags` is the permanent home for tag CRUD**, not a stopgap Phase 7
  folds into Account.
- **D2 — One `/tags` list, filtered by scope, not three separate UIs.**
  A single search box (matches label + description) plus scope chips: **All**
  (owned + followed, default) / **Owned** / **Followed** / **Discover**
  (other users' Public tags, replacing the old app's header-searchbar
  discovery pattern with a page section).
- **D3 — The tag create/edit form offers Public/Private only.**
  Friends-Only stays in the schema and in `canViewTag`'s authorization logic,
  but is not offered in the picker until Phase 6 ships real friendships.
- **D4 — Tags can be assigned during word creation.** `POST /api/words`
  accepts `tagIds`, checked for ownership and linked in the same transaction
  as the word. (Assignment from the word *editor* sidebar, for an
  already-saved word, ships in this phase too — see D4a below — using the
  dedicated link endpoints instead.)
- **D4a — Word-level tag assignment ships in this phase**, not just
  bulk-assign from Review. `SidebarFields.tsx` already has the seam
  (`tagCount` prop, rail badge, `TagsPlaceholder`) waiting for it in both the
  create form and the word view/edit page.
- **D5 — The tag backend is rebuilt as a small resource-style API**
  (below), replacing the legacy 15-route surface rather than patching it
  route-by-route. Link/unlink of tags↔words is its own endpoint pair,
  reused by bulk-assign (Review), the sidebar, and tag creation.
- **D6 — Every legacy route with no remaining consumer is deleted**, not
  just `getAmountByTag`: `checkIfTagLabelAvailable` (superseded by a DB
  unique constraint + 409), `filterTags` (broken, superseded by the new
  list endpoint), `getFollowedTagsIdByUserId` (superseded), `getOtherUserTags`
  (superseded by `GET /api/tags?authorId=`, deferred until profiles exist).
- **D7 — Review's tags column is read-only chips + count.** Adding/removing
  tags on a word happens in the word editor sidebar (D4a) or Review's bulk
  "Add tags"/"Remove tags" actions, not inline in the table cell.
- **D8 — One dialog, one state per operation.** `/tags`' own-tag editor is a
  single mode-driven component (create / edit / delete), each with its own
  mutation state, not one overloaded slot.
- **D9 — Followers lose access, but stay following, when a tag turns
  Private.** The tag shows as "unavailable" in their `/tags` list and its
  words drop out of Review/practice; if the owner later flips it back to
  Public, access resumes automatically (the follow row was never deleted).
  Deleting a tag cascades the follow rows (already true via the FK).
- **D10 — A user's own tags can only be attached to words that user owns.**
  To organize another user's words under one's own tag, the user clones the
  tag first. This keeps every tag's word list either "all mine" or "all
  cloned-and-mine" — no per-link visibility rules are needed anywhere else
  in the system.
- **D11 — Clone details:**
  - New column `tags.source_tag_id` (`uuid`, `ON DELETE SET NULL`,
    references `tags.id`) records what a cloned tag was cloned from, for
    display ("Cloned from X by Y") and auditing.
  - New column `words.source_word_id` (`uuid`, `ON DELETE SET NULL`,
    references `words.id`) records the same for each cloned word,
    alongside the existing `isCloned`/`originalCreatorId`.
  - The clone dialog asks the user to pick the new tag's visibility
    (default Private) rather than silently copying the source's visibility.
  - If the user already follows the tag being cloned, cloning removes the
    follow — otherwise the same words would appear twice (original +
    clone) in Review.
- **D12 — Deleting a tag deletes only the tag** (and its links/follows via
  cascade); the words themselves are never deleted as a side effect. To
  delete the words too, the user filters Review by that tag and bulk-deletes
  from there — one existing, well-tested code path instead of a second one.
- **D13 — Tag labels are unique per author, case-insensitively.** A new
  Postgres unique index enforces `(author_id, lower(label))`; create/rename
  returns 409 with a clear message instead of the old
  `checkIfTagLabelAvailable` pre-check round-trip. A clone whose label
  collides with one the recipient already has gets a numeric suffix
  (`"Label" → "Label (2)"`).

### Calls made by the agent rather than asked — each reversible

- Tag endpoints use 404 for "resource not found" and 403 for "not allowed",
  matching the word endpoints' existing convention (`getWordById` already
  returns 403 for a non-owner), rather than the legacy controller's mix of
  400/401 for both cases.
- `PUT /api/words/:id` **stops accepting a `tags` field.** Once the
  dedicated link/unlink endpoints exist (D5), there is exactly one code path
  that changes word↔tag membership; a second path via the word PUT would
  reintroduce the exact "partial update silently wipes tags" class of bug
  Phase 3.9 already had to fix once for this same field.

## Architecture

### Backend — new tag API

Replaces every legacy `tagRoutes.js` route except the three tag-*sharing*
routes (`POST /:id/share`, `POST /api/tag-shares/:id/accept`,
`POST /api/tag-shares/:id/decline`), which stay as-is except for the
`acceptTagShare` transaction fix.

| Method + path | Purpose |
|---|---|
| `GET /api/tags?scope=all\|owned\|followed\|discover&q=&cursor=&limit=` | Paginated list of `TagSummary`. `q` matches label + description via SQL `ILIKE`. `discover` = other users' Public tags not already followed. Keyset-paginated the same way `GET /api/words/simple` already is (reuse `encodeCursor`/`decodeCursor`). |
| `GET /api/tags/:id` | One `TagSummary`. `canViewTag` authorization (404 if not viewable, to avoid confirming existence to a non-viewer — matches `getWordById`'s posture). |
| `POST /api/tags` | `{label, description?, visibility, wordIds?}`. Ownership of every `wordIds` entry checked; 403 if not all owned. One transaction. |
| `PATCH /api/tags/:id` | `{label?, description?, visibility?}` — metadata only, author-only. |
| `DELETE /api/tags/:id` | Deletes the tag; `tag_words`/`user_following_tags` cascade via FK. Author-only. |
| `POST /api/tags/:id/follow` | No body. 400 if it's the caller's own tag. Idempotent (already-following is a no-op 200, not an error). |
| `DELETE /api/tags/:id/follow` | No body (fixes the legacy route's oddity of a `DELETE` with a body). Idempotent. |
| `POST /api/tags/:id/clone` | `{visibility}`. Public-only source, not-already-own-tag. One transaction, batch inserts, provenance columns set, label-collision suffix, auto-unfollow if previously followed. |
| `POST /api/tags/links` | `{tagIds, wordIds}`. Caller must own every tag *and* every word (403 for the whole call otherwise, matching the legacy `addTagsInBulkToWords` ownership shape). Adding an existing link is a no-op. |
| `POST /api/tags/links/remove` | Same shape, removes links. Removing a non-existent link is a no-op. |

`TagSummary` shape:
```
{
  id, label, description, visibility, createdAt, updatedAt,
  author: { id, username },
  wordCount, followerCount,
  isOwner, isFollowing, isAvailable,   // isAvailable = false for a followed
                                        // tag the owner made Private (D9)
  sourceTag: { id, label } | null,      // set on a cloned tag (D11)
}
```
Counts come from SQL `count(*)` subqueries against `tag_words`/
`user_following_tags` — never from loading the word list. A tag's actual
words are fetched separately via the already-paginated, already-filterable
`GET /api/words/simple?tag=<id>`, not embedded in the tag response.

Word-side changes:
- `word.tags` on every word response (`assembleWord`/`fetchTagsMap`) is
  filtered to tags the *viewer* can see (own tags, or others' Public tags;
  Friends-Only deferred) and slimmed to `{id, label, visibility, authorId}`
  — a follower never sees the owner's unrelated Private tag labels.
- `getWordsSimplified`'s followed-word resolution becomes a SQL subquery
  (`user_following_tags` ⋈ `tags` WHERE viewable ⋈ `tag_words`) instead of a
  preloaded array of ids, so a Private flip take effect immediately (D9).
- `getWordById` allows read access when the word is reachable through a
  tag the caller follows and can currently view, in addition to
  authorship — read-only for a non-owner, matching `overview.md` §3.2's
  "words accessed via followed tags are read-only".
- `createWord` accepts `tagIds` (D4), ownership-checked, and runs inside one
  transaction alongside the word/translations/cases insert (fixing the
  existing non-atomicity too, while touched).

### Migration `0006`

- Indexes: `tag_words(word_id)`, `user_following_tags(follower_user_id)`,
  `tags(author_id)`.
- Columns: `tags.source_tag_id uuid REFERENCES tags(id) ON DELETE SET NULL`;
  `words.source_word_id uuid REFERENCES words(id) ON DELETE SET NULL`.
- Unique index `(author_id, lower(label))` on `tags`, preceded by a data-fix
  step that renames any pre-existing duplicate labels (appending " (2)",
  " (3)", …) so the migration doesn't fail against seeded/staging data.

### Frontend — conventions this phase follows

Per-feature shape mirrors `features/words/`: `types.ts` / `api.ts` /
`keys.ts` / `hooks.ts` / `errors.ts`, tests co-located,
`test/msw/tagHandlers.ts` using the existing factory pattern.

```
frontend/src/features/tags/
├── types.ts          TagSummary, CreateTagBody, UpdateTagBody, CloneTagBody,
│                      TagScope, TagVisibility ('Public'|'Private')
├── api.ts             listTags / getTag / createTag / updateTag / deleteTag /
│                      followTag / unfollowTag / cloneTag / linkTagsToWords /
│                      unlinkTagsFromWords
├── keys.ts            tagKeys = { all, detail(id), list(scope, q?) }
├── hooks.ts            useTags(scope, q) / useTag(id) / useCreateTag /
│                      useUpdateTag / useDeleteTag / useFollowTag /
│                      useUnfollowTag / useCloneTag / useLinkTagsToWords /
│                      useUnlinkTagsFromWords
├── errors.ts           tagErrorKey(error)
├── components/
│   ├── TagChip.tsx           label (+ count, + remove ×, + Private icon)
│   ├── TagCard.tsx           the /tags list card (relation-aware actions)
│   ├── TagDialog.tsx         create/edit/delete, mode-driven (D8)
│   ├── TagPicker.tsx         multi-select + inline quick-create; shared by
│   │                          the sidebar, Review's bulk actions, and the
│   │                          create-tag word picker
│   └── CloneTagDialog.tsx    visibility choice + confirm copy (D11)
└── pages/
    ├── TagsPage.tsx          `/tags` — search + scope chips + TagCard grid
    └── TagViewPage.tsx       `/tag/$tagId` — header + word list + actions
```

Plus edits inside `features/words/`:

- `review/columns.tsx` — the marked `tagsColumn(options)` insertion.
- `review/FilterBar.tsx` (+ `MobileFilters.tsx`) — a Tags filter group
  sourced from `useTags('all')` (own + followed only, not Discover).
- `review/BulkActionBar.tsx` — "Add tags" and "Remove tags" buttons opening
  `TagPicker`, calling `useLinkTagsToWords`/`useUnlinkTagsFromWords`.
- `review/search.ts` — `ReviewSearch.tag?: string[]` (tag ids);
  `reviewSearchToFilters` maps it through; `hasActiveFilters`/
  `activeFilterCount` include it.
- `layout/SidebarFields.tsx` — real tag list + "Add tag" affordance
  replacing `TagsPlaceholder`; in create mode, chosen tags accumulate
  locally and are sent as `tagIds` with the create request (D4); in
  view/edit mode, chip removal calls `useUnlinkTagsFromWords` and "Add tag"
  calls `useLinkTagsToWords` directly (writes happen immediately, not
  batched with word Save — see Risks).

## Slices

Each ends runnable; the user commits and re-confirms between them.

| Slice | Scope |
|---|---|
| 0 | Persist this plan (done — this document) |
| 1 | Backend: migration 0006; word-side fixes (`createWord` transaction + ownership-checked `tagIds`, `PUT /api/words/:id` drops `tags`, `word.tags` viewer-filtered, followed-word SQL subquery with visibility, follower read access on `getWordById`); extend `words.test.js`/`words-simple.test.js` |
| 2 | Backend: new tag API (list/get/create/patch/delete/follow/unfollow/links/links-remove); delete every superseded legacy route + controller export; rewrite `tags.test.js` (sharing block kept, adapted to the surrounding changes) |
| 3 | Backend: clone rebuild (batch inserts, provenance columns, visibility param, label-suffix, auto-unfollow) + `acceptTagShare`'s transaction fix; tests |
| 4 | `features/tags/` data layer (`types`/`api`/`keys`/`hooks`/`errors`) + MSW handlers |
| 5 | `/tags` page: search + scope chips, `TagCard` grid, `TagDialog` create/edit/delete, follow/unfollow from the card, nav entry (feature-flagged on `featureFlags.tags`) |
| 6 | `/tag/$tagId` page: header (label/description/badges/author/counts), word list via `GET /api/words/simple?tag=`, follow/unfollow, `CloneTagDialog`; replaces the router `Placeholder` |
| 7 | Review: tags column (`columns.tsx`), tags filter group (`FilterBar`/`MobileFilters`/`search.ts`), bulk "Add tags"/"Remove tags" (`BulkActionBar` + `TagPicker`) |
| 8 | Word editor: real Tags section in `SidebarFields` for both `WordForm` (create, D4) and `WordPage` (view/edit, D4a); read-only tags display for a word reached via a followed tag |
| 9 | Phase gate: `phase-4-tags.spec.ts` + docs + full green run |

**Slice 1 — backend word-side fixes.** `createWord` becomes one
`db.transaction`; accepts `req.body.tagIds`, checks the caller owns every
id (403 otherwise), links inside the same transaction. `updateWord` drops
its `tags`-diffing branch entirely (the agent call above). `fetchTagsMap`
takes a `viewerId` and filters each word's tags to what that viewer may see
before attaching them. `getWordsIdFromFollowedTagsByUserId` joins through
`tags` and applies `canViewTag`-equivalent visibility filtering in SQL
rather than trusting `user_following_tags` alone. `getWordById` adds an
`OR EXISTS` branch for "reachable via a followed, currently-viewable tag"
before its ownership check, and the response marks such a word read-only
(reuse the existing `user`-vs-`req.user.id` comparison the frontend already
does for the owner dot).

**Slice 2 — new tag API.** Fresh `tagController.ts` functions per the table
above; `tagRoutes.js` rewritten to the new path set; every deleted route's
handler is deleted too (D6), not left unexported. `tags.test.js` is
substantially rewritten: new assertions for scope filtering, search,
pagination, the label-uniqueness 409, link/unlink ownership (partial
ownership → 403 for the whole call, no partial-apply), and the D9
Private-turns-unavailable behavior. The share/accept/decline block's
existing assertions are kept and adjusted only for whatever shape changes
ripple in (e.g. `normalizeTag`'s `_id` removal, if that alias still exists
— confirm during Slice 2 and strip it if so, per `CLAUDE.md` §4's standing
`_id` rule).

**Slice 3 — clone rebuild.** `cloneTagForUser` takes a `visibility` param,
inserts words/translations/cases via `db.insert(...).values([...])` arrays
instead of a per-word loop, sets `source_tag_id`/`source_word_id`, appends
a numeric suffix on label collision (reuses the same uniqueness check
Slice 2 added to `createTag`), and — when the recipient already follows
the source tag — deletes that follow row in the same transaction.
`acceptTagShare` is updated to pass its own `tx` into `cloneTagForUser`
instead of that function opening a second transaction.

**Slice 4 — data layer.** `types.ts` mirrors `TagSummary` etc.; `api.ts`/
`keys.ts`/`hooks.ts`/`errors.ts` follow the `features/words/` header style.
`test/msw/tagHandlers.ts` follows the factory pattern (`makeTagHandlers()`).

**Slice 5 — `/tags` page.** New route (`tagsRoute`, path `/tags`, under
`protectedLayoutRoute`). Search box + four scope chips (All/Owned/Followed/
Discover) driving `useTags(scope, q)`; `TagCard` renders relation-aware
actions (Owned: Edit/Delete/View; Followed: Unfollow/Clone/View;
Discoverable: Follow/Clone/View; Unavailable: Unfollow only). "+ Create
tag" opens `TagDialog` in create mode, optionally with a word picker.
Empty states via `EmptyState` for each scope. `AppHeader`'s nav gains a
Tags entry.

**Slice 6 — tag viewer.** Replaces the `/tag/$tagId` `Placeholder`. Header
with label/description/visibility badge/relation badge/author/word count/
follower count/"Cloned from" line when `sourceTag` is set. Word list reuses
a slimmed `ReviewTable`-style list scoped to `?tag=$tagId`. For an owned
tag: "Add words" (opens a word picker) and a per-row "Remove from tag". For
a non-owner: Follow/Unfollow and `CloneTagDialog`. A tag the caller can't
view 404s server-side; the page shows an error state with a link back to
`/tags`, not a silent redirect.

**Slice 7 — Review integration.** `search.ts` gains `tag?: string[]` in
`ReviewSearch`; `FilterBar` gets a Tags group from `useTags('all')` (chip-
toggle, like gender/PoS); `columns.tsx`'s `tagsColumn(options)` renders each
row's `tags` as `TagChip`s with overflow (max 2 + "+N"), no click-to-edit
(D7); `BulkActionBar` gains "Add tags"/"Remove tags" opening `TagPicker`,
invalidating `tagKeys.all` + `wordKeys.all` on success.

**Slice 8 — word editor.** `SidebarFields` gets a real tags section: chips
with per-chip × (calling `useUnlinkTagsFromWords` when `word.id` exists) and
an "Add tag" button opening `TagPicker`. `WordForm.tsx` (create): chosen
tags accumulate in local state and are sent as `tagIds` on the create
mutation (D4 — no more "coming soon" placeholder, and no more waiting for
`word.id`). `WordPage.tsx` (view/edit): passes real `word.tags`; for a word
reached via a followed tag, the whole tags section renders read-only.
`SidebarFields.test.tsx`/`WordForm.test.tsx`/`WordPage.test.tsx` gain
coverage for the populated and read-only states.

**Slice 9 — gate.** `e2e/tests/phase-4-tags.spec.ts`: user A creates a tag
with two words attached at creation time (D4), bulk-adds it to a third word
from Review, user B discovers and follows it (words show up read-only,
owner-dot as group), A flips the tag to Private (B's Review loses the
words, `/tags` shows it "unavailable" for B), A flips it back to Public
(B's access returns without re-following), B clones a *different* Public
tag from A instead (gets an independent, editable copy; word-count and
follower badges update throughout). Two browser contexts/users, following
the `phase-6/7` two-context pattern already used elsewhere in the suite.
Update `e2e/README.md`, the build plan's §9 status table and §5 Phase 4
entry, `.context/README.md`'s roadmap row.

## Design brief — tag system and `/tags`

*(For the design/mockup tool. Plain description of the feature and the new
page, no implementation detail.)*

**Purpose.** A tag is a named group of words. A user makes tags to organize
vocabulary — for example "Chapter 1", "Medical terms". One word can belong
to many tags. One tag can hold many words, or none.

**Tag fields.** Label (required, unique per user), description (optional),
visibility (Public or Private), author, word count, follower count,
creation date, and — for a cloned tag — a link back to the tag it was
cloned from.

**Relations between a user and a tag.**
- **Owned** — the user made it. Full control: edit, delete, add and remove
  words.
- **Followed** — another user's Public tag the user subscribed to. Its
  words show up in the user's Review list and practice pool, read-only, and
  update automatically whenever the owner changes the tag's word list.
- **Unavailable** — a followed tag whose owner made it Private. The user
  keeps following it, but its words disappear from Review until (if ever)
  the owner makes it Public again.
- **Discoverable** — another user's Public tag the user does not yet
  follow. Actions: Follow, or Clone.
- **Clone** — makes a full, independent copy of the tag and every one of
  its words (with all translations) in the user's own account. The user can
  freely edit or delete the copy; it shows "Cloned from <label> by
  <author>" for reference.

**Page `/tags` — the tag home page.**
- Header: page title, "New tag" button.
- One search box, matching label and description.
- Scope chips, one active at a time: **All** (owned + followed, default),
  **Owned**, **Followed**, **Discover** (other users' Public tags).
- A paginated grid/list of tag cards below.
- **Tag card:** label, description (up to two lines), a visibility badge
  (Public/Private), a relation badge (Owned/Followed/Unavailable), the
  author's name (when not the viewer's own tag), word count, follower count
  (on owned tags), and a "Cloned from …" line when applicable.
- **Card actions**, by relation: Owned → Edit, Delete, View words. Followed
  → Unfollow, Clone, View words. Discoverable → Follow, Clone, View words.
  Unavailable → Unfollow only.
- Clicking a card opens the tag's own page.
- Empty states: no owned tags yet ("Make your first tag"), no followed tags
  yet ("Find tags in Discover"), no search results.
- On a phone: cards stack in a single column; scope chips scroll
  horizontally.

**Dialogs.**
- **Create / edit tag** — label, description, visibility (Public/Private,
  each with one line explaining what it means). Creating also offers an
  optional "add words now" picker over the user's own words. A label
  already in use shows an inline error.
- **Delete tag** — confirms that the words themselves are not deleted.
- **Unfollow** — confirms that the tag's words will disappear from Review.
- **Clone** — shows the tag's label and word count, lets the user choose
  the new copy's visibility (default Private), and confirms that the copy
  will be fully independent (and that following the original ends, if
  applicable).

**Page `/tag/:id` — one tag's own page.** Header repeats the card's
information plus the same actions. Below it, the tag's words as a compact,
read-only table — the same languages and layout style as the main Review
table — with its own search and pagination. On an owned tag, each row has
a "Remove from tag" action, and the header has "Add words". If the viewer
can't see this tag, the page shows a plain error state with a link back to
`/tags`.

**Tags elsewhere in the app, for consistency.**
- **Review table** — a Tags column shows small chips per row (two visible,
  "+N" for the rest). A Tags filter group in the sidebar lists the user's
  owned and followed tags. The bulk-action bar gains "Add tags" and "Remove
  tags", opening a tag picker with search and an inline "create new tag"
  option.
- **Word creation and the word detail view** — a Tags section in the
  sidebar: chips with a × to remove, and an "Add tag" button opening the
  same tag picker. When creating a word, chosen tags are saved together
  with the word. A word reached through a followed tag shows its tags
  read-only.
- **Tag chip** — one small shared piece used everywhere above: label,
  optional word count, optional remove ×, a small icon marking a Private
  tag.

**Design principles to honor** (from `overview.md` §1.2): assigning a tag
must stay fast and frictionless; following/cloning/discovering are always
optional, never required for the core word+practice loop; every language is
shown equally; ownership and read-only state must always be visually clear.

## Deferred / future scope (recorded, not built here)

- **Friends-Only visibility in the UI** — Phase 6, once friendships are
  real.
- **Tag sharing UI** (share a tag to a friend, accept/decline from the
  notification inbox) — backend stays, gets one atomicity fix (Slice 3);
  the frontend is Phase 7.
- **Tag statistics on the Dashboard** (words per tag, followed-vs-owned) —
  still deferred, needs a new backend aggregation.
- **Notification-driven tag-share acceptance** — Phase 6/7.
- **Listing another user's tags from their profile** (`GET
  /api/tags?authorId=`) — the list endpoint's shape already supports adding
  this filter later; not built until Phase 7's profile view exists.
- **Tag color** — no color field in this phase; revisit only if the
  mockups call for one.

## Files

**New** — `backend/src/db/migrations/0006_*.sql`; `frontend/src/features/tags/**`
(all listed under Architecture, + tests co-located);
`frontend/src/test/msw/tagHandlers.ts`; `e2e/tests/phase-4-tags.spec.ts`.

**Modified** — `backend/controllers/tagController.ts` (near-full rewrite),
`backend/routes/tagRoutes.js` (near-full rewrite), `backend/controllers/wordController.ts`,
`backend/services/wordService.ts`, `backend/src/db/schema.ts`,
`backend/tests/tags.test.js`, `backend/tests/words.test.js`,
`backend/tests/words-simple.test.js`;
`frontend/src/features/words/types.ts` (`WordTagRef` slimmed, `CreateWordBody.tagIds`);
`frontend/src/features/words/review/{columns,FilterBar,MobileFilters,BulkActionBar,search}.ts(x)`;
`frontend/src/features/words/layout/SidebarFields.tsx` (+ test);
`frontend/src/features/words/form-engine/WordForm.tsx` (+ test);
`frontend/src/features/words/pages/WordPage.tsx` (+ test);
`frontend/src/app/router.tsx`; `frontend/src/app/query-client.ts` (comment →
active edge); `frontend/src/components/layout/AppHeader.tsx` (nav entry);
`frontend/public/locales/{en,es,de,ee}/{tags,review,wordRelated}.json`;
`.context/plans/new-repo-build-plan.md`; `.context/README.md`; `e2e/README.md`.

**Reuse rather than rewrite** — `components/common/{EmptyState,ErrorState,ConfirmDialog}.tsx`,
`components/ui/{dialog,alert-dialog}.tsx`, `lib/avatar.ts`, `api/client.ts`,
`test/render.tsx`, `e2e/fixtures/db.ts`, `encodeCursor`/`decodeCursor` from
`wordController.ts` (reused for the new tag list's pagination).

## Verification

```bash
# per slice
npm test -w backend -- tests/tags.test.js       # slices 1-3
npm test -w backend                              # slices 1-3 (full suite)
npm test -w frontend                             # slices 4-8
npm run build -w frontend

# end to end (slice 9)
npm run docker:up && npm run db:migrate
npm test && npm test -w frontend && npm run build -w frontend
npm run test:e2e
```

**Gate:** backend green, frontend green, `npm run test:e2e` green (existing
count + Slice 9's new spec), `npm run build -w frontend` clean;
`grep -rn "_id" backend/controllers/tagController.ts` = 0; `grep -rln
"getAmountByTag\|filterTags\|checkIfTagLabelAvailable\|getFollowedTagsIdByUserId"
backend frontend` = 0 (D6); a fresh word shows the "coming soon" tags
placeholder nowhere in the app; `npm run db:migrate` succeeds against a DB
seeded with duplicate tag labels (proves the dedupe step in migration 0006).

## Risks

- **Word-editor tag mutations mid-edit.** Adding/removing a tag on
  `WordPage` writes immediately, not batched with the word's own Save —
  matches the mental model of "tags are a relationship between two
  already-saved things." Confirm against the live v1 app's actual behavior
  in Slice 8 if anything feels off (`CLAUDE.md` §2's tiebreaker rule).
- **Link/unlink ownership check shape.** A partial-ownership request to
  `POST /api/tags/links` or `/links/remove` must 403 the whole call, not
  silently partial-apply. Slice 2's tests pin this explicitly.
- **`/tags` page scope creep toward Account.** D1 makes `/tags` permanent;
  mitigate by keeping it strictly tag data — no profile fields, no friends
  list, ever.
- **Two-user e2e a phase early.** Slice 9 needs a second seeded account
  before Phase 6 builds shared social e2e infrastructure — check
  `e2e/fixtures/db.ts` supports two independent `registerAndVerify` calls in
  one spec file already.
- **Migration on real data.** The new `(author_id, lower(label))` unique
  index will fail to apply if staging/production already has duplicate
  labels for one author; the dedupe step (a data migration before the index
  is added) must run and be verified against a copy of that data before
  this ships past local dev.
