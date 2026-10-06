/**
 * Tag wire contracts — pinned against `backend/controllers/tagController.ts`
 * as rebuilt in phase-4-tags.md Slices 2–3. Every tag response is `id`-only
 * (no `_id`/`author`-alias, per the standing rule) and shaped as
 * `TagSummary`: counts and relations the backend computes via SQL, never a
 * tag's actual word list (that comes from `GET /api/words/simple?tag=`,
 * `features/words/api.ts`).
 *
 * `TagVisibility` here is the two values the create/edit UI ever writes
 * (phase-4-tags.md D3) — `Friends-Only` stays a schema/authz-only value
 * until Phase 6 ships real friendships, so nothing in this feature needs to
 * type for it.
 */
export type TagVisibility = 'Public' | 'Private';

/** `/tags`' scope chips (D2) — `all` is owned + followed, the page's default. */
export type TagScope = 'all' | 'owned' | 'followed' | 'discover';

/** `/tags`' sort control (D16) — `recent` (default) or alphabetical. */
export type TagSort = 'recent' | 'label';

/**
 * Account badge types the UI has a label and an icon for. A badge belongs to the
 * author's account and is granted by staff only (verified-badges.md).
 */
export const AUTHOR_BADGE_TYPES = ['official'] as const;
export type AuthorBadgeType = (typeof AUTHOR_BADGE_TYPES)[number];

export const isAuthorBadgeType = (value: string): value is AuthorBadgeType =>
    (AUTHOR_BADGE_TYPES as readonly string[]).includes(value);

/** A tag's author — just enough to render "by <username>" and their badges (`TagCard`/`TagViewPage`). */
export interface TagAuthor {
    id: string;
    username: string;
    /**
     * The author's active account badges, sorted; `[]` when none. Plain strings on
     * purpose: a newer server may send a type this build does not know, and
     * `AuthorBadges` then skips it.
     */
    badges: string[];
}

/** Set only on a cloned tag (D11) — the tag it was cloned from, for "Cloned from X by Y". */
export interface TagSourceRef {
    id: string;
    label: string;
}

/**
 * `GET /api/tags`, `GET /api/tags/:id`, `POST /api/tags`, `PATCH /api/tags/:id`,
 * `POST /api/tags/:id/follow`, `DELETE /api/tags/:id/follow`, and
 * `POST /api/tags/:id/clone` all return this shape (`buildTagSummary` in
 * `tagController.ts`). Dates are ISO strings over the wire.
 */
export interface TagSummary {
    id: string;
    label: string;
    description: string | null;
    visibility: TagVisibility;
    createdAt: string;
    updatedAt: string;
    author: TagAuthor;
    wordCount: number;
    followerCount: number;
    /** The caller authored this tag. */
    isOwner: boolean;
    /** The caller follows this tag (independent of `isAvailable` — see D9). */
    isFollowing: boolean;
    /**
     * The caller can currently see this tag's words. Always `true` for the
     * owner; for a follower it tracks the tag's *live* visibility, so it can
     * be `false` while `isFollowing` stays `true` — a followed tag the owner
     * just made Private renders "unavailable", not gone (D9).
     */
    isAvailable: boolean;
    /** Set only on a cloned tag (D11); `null` otherwise. */
    sourceTag: TagSourceRef | null;
}

/**
 * `POST /api/tags` body. `wordIds` is optional and ownership-checked
 * server-side (403 if any id isn't the caller's own word) — this is what
 * lets `WordForm`'s create flow attach tags in the same request (D4),
 * instead of waiting for the word to exist first.
 */
export interface CreateTagBody {
    label: string;
    description?: string;
    visibility: TagVisibility;
    wordIds?: string[];
}

/**
 * `PATCH /api/tags/:id` body — metadata only. Word membership never rides
 * here; that's `linkTagsToWords`/`unlinkTagsFromWords` below (D5) — folding
 * it back into this endpoint would reopen the exact "silently wipes
 * associations on a partial update" bug already fixed once for words.
 */
export interface UpdateTagBody {
    label?: string;
    description?: string;
    visibility?: TagVisibility;
}

/** `POST /api/tags/:id/clone` body — the caller's chosen visibility for the copy (D11), not the source's. */
export interface CloneTagBody {
    visibility: TagVisibility;
}

/**
 * `POST /api/tags/links` / `POST /api/tags/links/remove` body. The caller
 * must own every tag AND every word, or the whole call 403s — no
 * partial-apply (phase-4-tags.md Risks).
 */
export interface LinkTagsToWordsBody {
    tagIds: string[];
    wordIds: string[];
}

/** Both link endpoints echo back what they applied. */
export interface LinkTagsToWordsResponse {
    tagIds: string[];
    wordIds: string[];
}

/**
 * `GET /api/tags` query filters, shared by `api.ts`'s param builder and
 * `keys.ts`'s list-key shape (mirrors `WordListFilters`'s role for words).
 */
export interface TagListFilters {
    scope?: TagScope;
    q?: string;
    sort?: TagSort;
}
