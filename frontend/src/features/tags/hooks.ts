/**
 * Server-state hooks for the tags feature — the ONLY place tag data is read
 * or written (frontend invariant 1: no server state outside TanStack Query).
 *
 * Invalidation graph (`app/query-client.ts`), Phase 4 edge: every tag
 * mutation invalidates `tagKeys.all` (the list + every detail this session
 * has looked at) AND `wordKeys.all` — broad on purpose, matching
 * `features/words/hooks.ts`'s own precedent of invalidating both the
 * feature's own keys and the cross-feature ones a mutation can affect
 * (there: `wordKeys.all` + `metricsKeys.all`). Every one of these mutations
 * changes something `word.tags` or Review's followed-word list depends on:
 *   - create (with `wordIds`) / link / unlink -> a word's own tags changed.
 *   - update -> a label/visibility change changes what followers can see
 *     (D9) and what a word's tag chips show.
 *   - delete -> tag_words cascades, so affected words lose a tag.
 *   - follow / unfollow -> Review's word list gains/loses that tag's words.
 *   - clone -> new words exist for the cloner.
 * A more surgical invalidation (e.g. only the specific word ids touched) is
 * possible later if this proves too broad in practice; it isn't yet.
 *
 * No toasts and no navigation here: those vary per call site and are passed
 * as `onSuccess`/`onError` options to `mutate()` by the components in
 * Slices 5–8.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import * as tagApi from './api';
import { tagKeys } from './keys';
import { wordKeys } from '@/features/words/keys';
import type { CloneTagBody, CreateTagBody, LinkTagsToWordsBody, TagListFilters, UpdateTagBody } from './types';

const LIST_PAGE_SIZE = 24;

/** Invalidates both this feature's own keys and the words feature's — see the module note above. */
function invalidateTagsAndWords(queryClient: QueryClient): void {
    void queryClient.invalidateQueries({ queryKey: tagKeys.all });
    void queryClient.invalidateQueries({ queryKey: wordKeys.all });
}

/**
 * `/tags`' scoped, searched, sorted list — `useInfiniteQuery` over the
 * keyset-paginated `GET /api/tags`, mirroring `useWordsInfinite`'s shape
 * exactly. `getNextPageParam` returning the backend's own `nextCursor`
 * (`null` at the end) is exactly what TanStack Query's `hasNextPage` needs.
 */
export function useTags(filters: TagListFilters = {}) {
    return useInfiniteQuery({
        queryKey: tagKeys.list(filters),
        queryFn: ({ pageParam, signal }) =>
            tagApi.listTags({ ...filters, cursor: pageParam ?? undefined, limit: LIST_PAGE_SIZE }, signal),
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
    });
}

/** One tag by id. Disabled for an empty id so a not-yet-known route param doesn't fire. */
export function useTag(id: string) {
    return useQuery({
        queryKey: tagKeys.detail(id),
        queryFn: () => tagApi.getTagById(id),
        enabled: id !== '',
    });
}

export function useCreateTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (body: CreateTagBody) => tagApi.createTag(body),
        onSuccess: () => invalidateTagsAndWords(queryClient),
    });
}

export function useUpdateTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: UpdateTagBody }) => tagApi.updateTag(id, body),
        onSuccess: (tag) => {
            // Seed the detail cache with the fresh tag so a page reading it
            // re-renders immediately, then let the list refetch in the background.
            queryClient.setQueryData(tagKeys.detail(tag.id), tag);
            invalidateTagsAndWords(queryClient);
        },
    });
}

export function useDeleteTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => tagApi.deleteTag(id),
        onSuccess: (_result, id) => {
            queryClient.removeQueries({ queryKey: tagKeys.detail(id) });
            invalidateTagsAndWords(queryClient);
        },
    });
}

export function useFollowTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => tagApi.followTag(id),
        onSuccess: (tag) => {
            queryClient.setQueryData(tagKeys.detail(tag.id), tag);
            invalidateTagsAndWords(queryClient);
        },
    });
}

export function useUnfollowTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => tagApi.unfollowTag(id),
        onSuccess: (tag) => {
            queryClient.setQueryData(tagKeys.detail(tag.id), tag);
            invalidateTagsAndWords(queryClient);
        },
    });
}

export function useCloneTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: CloneTagBody }) => tagApi.cloneTag(id, body),
        onSuccess: (clone) => {
            queryClient.setQueryData(tagKeys.detail(clone.id), clone);
            invalidateTagsAndWords(queryClient);
        },
    });
}

export function useLinkTagsToWords() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (body: LinkTagsToWordsBody) => tagApi.linkTagsToWords(body),
        onSuccess: () => invalidateTagsAndWords(queryClient),
    });
}

export function useUnlinkTagsFromWords() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (body: LinkTagsToWordsBody) => tagApi.unlinkTagsFromWords(body),
        onSuccess: () => invalidateTagsAndWords(queryClient),
    });
}
