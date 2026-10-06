/**
 * An in-memory fake of the `tagController` endpoints (phase-4-tags.md
 * Slices 2–3), for the tags data-layer tests (Slice 4) and the `/tags` /
 * `/tag/$tagId` pages (Slices 5–7). Each call to `makeTagHandlers()` gets
 * its own isolated store.
 *
 * Deliberately simpler than the real backend in a few places the backend's
 * own integration tests (`tags.test.js`) already cover in full — mirroring
 * `wordHandlers.ts`'s own precedent (its comment: "this fake models only
 * ownership — followed-tag access is covered by the backend's own
 * integration tests"):
 *   - `isAvailable` only checks owner-or-Public — Friends-Only visibility
 *     is a backend/authz concern with no frontend consumer until Phase 6.
 *   - Word ownership for `createTag`/`linkTagsToWords`/`unlinkTagsFromWords`
 *     is resolved via the optional `wordOwners` map (defaults to "the
 *     caller owns every word id it mentions", since most tests don't care).
 *
 * The bearer token is not verified — tests set `callerId` directly and the
 * fake treats every request as coming from that user.
 */
import { http, HttpResponse } from 'msw';
import type {
    CloneTagBody,
    CreateTagBody,
    LinkTagsToWordsBody,
    TagAuthor,
    TagSourceRef,
    TagSummary,
    TagVisibility,
    UpdateTagBody,
} from '@/features/tags/types';

export interface SeedTag {
    id?: string;
    authorId: string;
    label: string;
    description?: string | null;
    visibility: TagVisibility;
    /** Pre-existing `tag_words` rows for this tag. */
    wordIds?: string[];
    /** User ids that already follow this tag. */
    followerIds?: string[];
    sourceTag?: TagSourceRef | null;
}

interface InternalTag {
    id: string;
    authorId: string;
    label: string;
    description: string | null;
    visibility: TagVisibility;
    wordIds: Set<string>;
    followerIds: Set<string>;
    sourceTag: TagSourceRef | null;
    createdAt: string;
    updatedAt: string;
}

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

const VALID_VISIBILITIES = ['Public', 'Private', 'Friends-Only'];

function toSummary(tag: InternalTag, viewerId: string, authorOf: (id: string) => TagAuthor): TagSummary {
    const isOwner = tag.authorId === viewerId;
    const isFollowing = tag.followerIds.has(viewerId);
    // Simplified per the module note above — Public-or-owner only.
    const isAvailable = isOwner || tag.visibility === 'Public';
    return {
        id: tag.id,
        label: tag.label,
        description: tag.description,
        visibility: tag.visibility as TagVisibility,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
        author: authorOf(tag.authorId),
        wordCount: tag.wordIds.size,
        followerCount: tag.followerIds.size,
        isOwner,
        isFollowing,
        isAvailable,
        sourceTag: tag.sourceTag,
    };
}

function matchesScope(tag: InternalTag, callerId: string, scope: string): boolean {
    if (scope === 'owned') return tag.authorId === callerId;
    if (scope === 'followed') return tag.followerIds.has(callerId);
    if (scope === 'discover') {
        return tag.visibility === 'Public' && tag.authorId !== callerId && !tag.followerIds.has(callerId);
    }
    // 'all' (default) = owned + followed, regardless of current visibility (D9).
    return tag.authorId === callerId || tag.followerIds.has(callerId);
}

function compareNewestFirst(a: InternalTag, b: InternalTag): number {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
}

function compareLabel(a: InternalTag, b: InternalTag): number {
    if (a.label !== b.label) return a.label < b.label ? -1 : 1;
    return a.id < b.id ? -1 : 1;
}

/** Base64 `"<sortValue>|<id>"`, matching `encodeCursor`/`decodeCursor` in `wordService.ts`. */
function encodeCursor(sortValue: string, id: string): string {
    return btoa(`${sortValue}|${id}`);
}

function decodeCursor(cursor: string): { sortValue: string; id: string } | null {
    try {
        const [sortValue, id] = atob(cursor).split('|');
        if (!id || sortValue === undefined) return null;
        return { sortValue, id };
    } catch {
        return null;
    }
}

export function makeTagHandlers(opts: {
    callerId: string;
    /** Known usernames, so `author.username` on someone else's tag isn't just their id. Defaults to the id itself. */
    usernames?: Record<string, string>;
    seedTags?: SeedTag[];
    /** Word id -> owner id, for `createTag`/`linkTagsToWords`/`unlinkTagsFromWords` ownership checks. A word id absent from this map is treated as the caller's own. */
    wordOwners?: Record<string, string>;
    /** Active account badges per user id, e.g. `{ 'user-9': ['official'] }`. Absent = none. */
    authorBadges?: Record<string, string[]>;
}) {
    const { callerId, usernames = {}, seedTags = [], wordOwners = {}, authorBadges = {} } = opts;
    const authorOf = (id: string): TagAuthor => ({ id, username: usernames[id] ?? id, badges: authorBadges[id] ?? [] });
    const ownerOfWord = (id: string) => wordOwners[id] ?? callerId;

    const store = new Map<string, InternalTag>();
    /** Bodies received by mutating calls, in call order — for payload-shape assertions. */
    const requests: Array<{ method: string; path: string; body?: unknown }> = [];
    /** Raw query strings received by `GET /tags`, in call order. */
    const listQueries: string[] = [];

    // Monotonically increasing, distinct per tag — a wall-clock `Date.now()`
    // can tie two tags created in the same test's same millisecond, which
    // would make the DESC keyset order (and therefore pagination) flaky.
    let clock = Date.now();
    const nextTimestamp = () => new Date((clock += 1)).toISOString();

    function hydrate(s: SeedTag): InternalTag {
        const now = nextTimestamp();
        const tag: InternalTag = {
            id: s.id ?? nextId('tag'),
            authorId: s.authorId,
            label: s.label,
            description: s.description ?? null,
            visibility: s.visibility,
            wordIds: new Set(s.wordIds ?? []),
            followerIds: new Set(s.followerIds ?? []),
            sourceTag: s.sourceTag ?? null,
            createdAt: now,
            updatedAt: now,
        };
        store.set(tag.id, tag);
        return tag;
    }

    for (const s of seedTags) hydrate(s);

    const labelTaken = (label: string, authorId: string, excludeId?: string): boolean =>
        [...store.values()].some(
            (t) =>
                t.id !== excludeId &&
                t.authorId === authorId &&
                t.label.toLowerCase() === label.toLowerCase(),
        );

    const resolveUniqueLabel = (label: string, authorId: string): string => {
        if (!labelTaken(label, authorId)) return label;
        let suffix = 2;
        while (labelTaken(`${label} (${suffix})`, authorId)) suffix += 1;
        return `${label} (${suffix})`;
    };

    const handlers = [
        // GET /api/tags — scoped, searched, sorted, keyset-paginated
        http.get('*/api/tags', ({ request }) => {
            const url = new URL(request.url);
            listQueries.push(url.search);

            const scope = url.searchParams.get('scope') ?? 'all';
            const q = url.searchParams.get('q')?.trim().toLowerCase();
            const sort = url.searchParams.get('sort') === 'label' ? 'label' : 'recent';

            let filtered = [...store.values()].filter((t) => matchesScope(t, callerId, scope));
            if (q) {
                filtered = filtered.filter(
                    (t) =>
                        t.label.toLowerCase().includes(q) ||
                        (t.description ?? '').toLowerCase().includes(q),
                );
            }
            const total = filtered.length;
            const sorted = [...filtered].sort(sort === 'label' ? compareLabel : compareNewestFirst);

            let afterCursor = sorted;
            const cursorParam = url.searchParams.get('cursor');
            if (cursorParam !== null) {
                const cursor = decodeCursor(cursorParam);
                if (!cursor) {
                    return HttpResponse.json({ message: 'Invalid cursor' }, { status: 400 });
                }
                afterCursor = sorted.filter((t) =>
                    sort === 'label'
                        ? t.label !== cursor.sortValue
                            ? t.label > cursor.sortValue
                            : t.id > cursor.id
                        : t.createdAt !== cursor.sortValue
                          ? t.createdAt < cursor.sortValue
                          : t.id < cursor.id,
                );
            }

            const limitParam = url.searchParams.get('limit');
            const parsedLimit = limitParam !== null ? parseInt(limitParam, 10) : 24;
            const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 24;

            const pageRows = afterCursor.slice(0, limit + 1);
            const hasMore = pageRows.length > limit;
            const rows = hasMore ? pageRows.slice(0, limit) : pageRows;
            const last = rows[rows.length - 1];
            const nextCursor = hasMore
                ? encodeCursor(sort === 'label' ? last.label : last.createdAt, last.id)
                : null;

            return HttpResponse.json({
                items: rows.map((t) => toSummary(t, callerId, authorOf)),
                nextCursor,
                total,
            });
        }),

        // POST /api/tags/links — MUST be registered before `*/api/tags/:id`
        // family below is irrelevant here (different segment count), but
        // kept ahead of `POST /api/tags` for readability.
        http.post('*/api/tags/links', async ({ request }) => {
            const body = (await request.json()) as LinkTagsToWordsBody;
            requests.push({ method: 'POST', path: '/tags/links', body });

            const tags = body.tagIds.map((id) => store.get(id));
            if (tags.some((t) => !t || t.authorId !== callerId)) {
                return HttpResponse.json(
                    { message: 'User not authorized to apply one or more of these tags' },
                    { status: 403 },
                );
            }
            if (body.wordIds.some((id) => ownerOfWord(id) !== callerId)) {
                return HttpResponse.json(
                    { message: 'User not authorized to modify one or more of these words' },
                    { status: 403 },
                );
            }
            for (const tag of tags) {
                for (const wordId of body.wordIds) tag?.wordIds.add(wordId);
            }
            return HttpResponse.json({ tagIds: body.tagIds, wordIds: body.wordIds });
        }),

        http.post('*/api/tags/links/remove', async ({ request }) => {
            const body = (await request.json()) as LinkTagsToWordsBody;
            requests.push({ method: 'POST', path: '/tags/links/remove', body });

            const tags = body.tagIds.map((id) => store.get(id));
            if (tags.some((t) => !t || t.authorId !== callerId)) {
                return HttpResponse.json(
                    { message: 'User not authorized to apply one or more of these tags' },
                    { status: 403 },
                );
            }
            if (body.wordIds.some((id) => ownerOfWord(id) !== callerId)) {
                return HttpResponse.json(
                    { message: 'User not authorized to modify one or more of these words' },
                    { status: 403 },
                );
            }
            for (const tag of tags) {
                for (const wordId of body.wordIds) tag?.wordIds.delete(wordId);
            }
            return HttpResponse.json({ tagIds: body.tagIds, wordIds: body.wordIds });
        }),

        // POST /api/tags
        http.post('*/api/tags', async ({ request }) => {
            const body = (await request.json()) as CreateTagBody;
            requests.push({ method: 'POST', path: '/tags', body });

            const label = body.label?.trim();
            if (!label) {
                return HttpResponse.json({ message: 'Please specify label for tag' }, { status: 400 });
            }
            if (!VALID_VISIBILITIES.includes(body.visibility)) {
                return HttpResponse.json({ message: 'Invalid visibility status' }, { status: 400 });
            }
            if (labelTaken(label, callerId)) {
                return HttpResponse.json(
                    { message: 'You already have a tag with this label.' },
                    { status: 409 },
                );
            }
            const wordIds = body.wordIds ?? [];
            if (wordIds.some((id) => ownerOfWord(id) !== callerId)) {
                return HttpResponse.json(
                    { message: 'User not authorized to add one or more of these words' },
                    { status: 403 },
                );
            }

            const tag = hydrate({
                authorId: callerId,
                label,
                description: body.description ?? null,
                visibility: body.visibility,
                wordIds,
            });
            return HttpResponse.json(toSummary(tag, callerId, authorOf));
        }),

        // GET /api/tags/:id
        http.get('*/api/tags/:id', ({ params }) => {
            const tag = store.get(params.id as string);
            if (!tag) return HttpResponse.json({ message: 'Tag not found' }, { status: 404 });

            const summary = toSummary(tag, callerId, authorOf);
            if (!summary.isFollowing && !summary.isAvailable) {
                return HttpResponse.json({ message: 'Tag not found' }, { status: 404 });
            }
            return HttpResponse.json(summary);
        }),

        // PATCH /api/tags/:id
        http.patch('*/api/tags/:id', async ({ params, request }) => {
            const tag = store.get(params.id as string);
            const body = (await request.json()) as UpdateTagBody;
            requests.push({ method: 'PATCH', path: `/tags/${params.id as string}`, body });

            if (!tag) return HttpResponse.json({ message: 'Tag not found' }, { status: 404 });
            if (tag.authorId !== callerId) {
                return HttpResponse.json({ message: 'User not authorized' }, { status: 403 });
            }

            if (body.label !== undefined) {
                const label = body.label.trim();
                if (!label) {
                    return HttpResponse.json({ message: 'Please specify label for tag' }, { status: 400 });
                }
                if (labelTaken(label, callerId, tag.id)) {
                    return HttpResponse.json(
                        { message: 'You already have a tag with this label.' },
                        { status: 409 },
                    );
                }
                tag.label = label;
            }
            if (body.description !== undefined) tag.description = body.description;
            if (body.visibility !== undefined) {
                if (!VALID_VISIBILITIES.includes(body.visibility)) {
                    return HttpResponse.json({ message: 'Invalid visibility status' }, { status: 400 });
                }
                tag.visibility = body.visibility;
            }
            tag.updatedAt = nextTimestamp();
            return HttpResponse.json(toSummary(tag, callerId, authorOf));
        }),

        // DELETE /api/tags/:id/follow — 2 segments, distinct from `DELETE /api/tags/:id` below.
        http.delete('*/api/tags/:id/follow', ({ params }) => {
            const tag = store.get(params.id as string);
            if (!tag) return HttpResponse.json({ message: 'Tag not found' }, { status: 404 });
            tag.followerIds.delete(callerId);
            return HttpResponse.json(toSummary(tag, callerId, authorOf));
        }),

        // POST /api/tags/:id/follow
        http.post('*/api/tags/:id/follow', ({ params }) => {
            const tag = store.get(params.id as string);
            if (!tag) return HttpResponse.json({ message: 'Tag not found' }, { status: 404 });
            if (tag.authorId === callerId) {
                return HttpResponse.json({ message: 'You already own this tag' }, { status: 400 });
            }
            if (tag.visibility !== 'Public') {
                return HttpResponse.json(
                    { message: 'User not authorized to follow this tag' },
                    { status: 403 },
                );
            }
            tag.followerIds.add(callerId);
            return HttpResponse.json(toSummary(tag, callerId, authorOf));
        }),

        // POST /api/tags/:id/clone
        http.post('*/api/tags/:id/clone', async ({ params, request }) => {
            const source = store.get(params.id as string);
            const body = (await request.json()) as CloneTagBody;
            requests.push({ method: 'POST', path: `/tags/${params.id as string}/clone`, body });

            if (!source) return HttpResponse.json({ message: 'Tag not found' }, { status: 404 });
            if (source.authorId === callerId) {
                return HttpResponse.json({ message: 'You already own this tag' }, { status: 400 });
            }
            if (source.visibility !== 'Public') {
                return HttpResponse.json(
                    { message: 'User not authorized to clone this tag' },
                    { status: 403 },
                );
            }
            if (!VALID_VISIBILITIES.includes(body.visibility)) {
                return HttpResponse.json({ message: 'Invalid visibility status' }, { status: 400 });
            }

            // D11: cloning a tag you follow removes the follow.
            source.followerIds.delete(callerId);

            const clone = hydrate({
                authorId: callerId,
                label: resolveUniqueLabel(source.label, callerId),
                description: source.description,
                visibility: body.visibility,
                wordIds: [...source.wordIds],
                sourceTag: { id: source.id, label: source.label },
            });
            return HttpResponse.json(toSummary(clone, callerId, authorOf));
        }),

        // DELETE /api/tags/:id
        http.delete('*/api/tags/:id', ({ params }) => {
            const tag = store.get(params.id as string);
            if (!tag) return HttpResponse.json({ message: 'Tag not found' }, { status: 404 });
            if (tag.authorId !== callerId) {
                return HttpResponse.json(
                    { message: 'User not authorized to delete this tag' },
                    { status: 403 },
                );
            }
            store.delete(tag.id);
            return HttpResponse.json({ id: tag.id });
        }),
    ];

    return { handlers, store, requests, listQueries };
}
