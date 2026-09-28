/**
 * Thin transport layer over `apiClient` (baseURL `/api`). No React, no
 * toasts, no store or query-cache access — those live in `hooks.ts`. Each
 * function maps 1:1 to a `tagController` endpoint (phase-4-tags.md Slices
 * 2–3's rebuilt API).
 *
 * Tag-*sharing* (`share`/`accept`/`decline`) is deliberately absent here —
 * that lifecycle's frontend is Phase 7; this feature only ever calls the
 * endpoints below.
 */
import { apiClient } from '@/api/client';
import type { CursorPage } from '@/api/types';
import type {
    CloneTagBody,
    CreateTagBody,
    LinkTagsToWordsBody,
    LinkTagsToWordsResponse,
    TagListFilters,
    TagSummary,
    UpdateTagBody,
} from './types';

/** Params for `listTags` — the filters plus the two pagination knobs. */
export interface ListTagsParams extends TagListFilters {
    cursor?: string;
    limit?: number;
}

/**
 * `GET /api/tags` takes plain single-value query params (`scope`, `q`,
 * `sort`, `cursor`, `limit`) — no repeatable-key encoding to worry about
 * here, unlike `features/words/api.ts`'s `pos`/`gender`/`tag`.
 */
function buildListQuery(params: ListTagsParams): URLSearchParams {
    const search = new URLSearchParams();
    if (params.scope) search.set('scope', params.scope);
    if (params.q) search.set('q', params.q);
    if (params.sort) search.set('sort', params.sort);
    if (params.cursor) search.set('cursor', params.cursor);
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    return search;
}

/**
 * `GET /api/tags` — scoped, searched, sorted, keyset-paginated. 400 "Invalid
 * cursor" on a malformed `cursor`. `signal` is threaded through so
 * `useTags` can abort an in-flight page when the filters change mid-request.
 */
export async function listTags(
    params: ListTagsParams,
    signal?: AbortSignal,
): Promise<CursorPage<TagSummary>> {
    const { data } = await apiClient.get<CursorPage<TagSummary>>('/tags', {
        params: buildListQuery(params),
        signal,
    });
    return data;
}

/** `GET /api/tags/:id` — 404 "Tag not found" both when it doesn't exist and when the caller can't see it. */
export async function getTagById(id: string): Promise<TagSummary> {
    const { data } = await apiClient.get<TagSummary>(`/tags/${encodeURIComponent(id)}`);
    return data;
}

/** `POST /api/tags` — 400 missing label/invalid visibility, 409 label already in use, 403 an unowned wordId. */
export async function createTag(body: CreateTagBody): Promise<TagSummary> {
    const { data } = await apiClient.post<TagSummary>('/tags', body);
    return data;
}

/** `PATCH /api/tags/:id` — metadata only; 403 not the author, 409 label already in use. */
export async function updateTag(id: string, body: UpdateTagBody): Promise<TagSummary> {
    const { data } = await apiClient.patch<TagSummary>(`/tags/${encodeURIComponent(id)}`, body);
    return data;
}

/** `DELETE /api/tags/:id` — the tag only (D12); 403 not the author. */
export async function deleteTag(id: string): Promise<{ id: string }> {
    const { data } = await apiClient.delete<{ id: string }>(`/tags/${encodeURIComponent(id)}`);
    return data;
}

/** `POST /api/tags/:id/follow` — idempotent; 400 the caller's own tag, 403 not viewable. */
export async function followTag(id: string): Promise<TagSummary> {
    const { data } = await apiClient.post<TagSummary>(`/tags/${encodeURIComponent(id)}/follow`);
    return data;
}

/** `DELETE /api/tags/:id/follow` — idempotent, no body. */
export async function unfollowTag(id: string): Promise<TagSummary> {
    const { data } = await apiClient.delete<TagSummary>(`/tags/${encodeURIComponent(id)}/follow`);
    return data;
}

/** `POST /api/tags/:id/clone` — 400 own tag, 403 source not Public, 400 invalid visibility. */
export async function cloneTag(id: string, body: CloneTagBody): Promise<TagSummary> {
    const { data } = await apiClient.post<TagSummary>(`/tags/${encodeURIComponent(id)}/clone`, body);
    return data;
}

/** `POST /api/tags/links` — 403 for the whole call if any tag or word isn't the caller's own. */
export async function linkTagsToWords(body: LinkTagsToWordsBody): Promise<LinkTagsToWordsResponse> {
    const { data } = await apiClient.post<LinkTagsToWordsResponse>('/tags/links', body);
    return data;
}

/** `POST /api/tags/links/remove` — same ownership rule as `linkTagsToWords`. */
export async function unlinkTagsFromWords(
    body: LinkTagsToWordsBody,
): Promise<LinkTagsToWordsResponse> {
    const { data } = await apiClient.post<LinkTagsToWordsResponse>('/tags/links/remove', body);
    return data;
}
