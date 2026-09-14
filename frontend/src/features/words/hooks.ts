/**
 * Server-state hooks for the words feature — the ONLY place word data is read
 * or written (frontend invariant 1: no server state outside TanStack Query).
 *
 * Invalidation graph (`app/query-client.ts`), Phase 2 edges:
 *   createWord / updateWord / deleteWord  ⇒  invalidate `wordKeys.all` (list +
 *   every detail) and `['metrics']` (declared now; first consumer is the
 *   Phase 3.5 dashboard — a no-op until then).
 *
 * No toasts and no navigation here: those vary per call site (create morphs a
 * "Saving…" toast and links to the new word; update re-locks the form; delete
 * returns to `/`) and are passed as `onSuccess` / `onError` options to
 * `mutate()` by the pages in Slices 4–5. The message→i18n-key mapping that
 * those `onError` handlers use lands with the first page (Slice 4). A component
 * reads only `isPending` / `isError` / `error` / `data`.
 *
 * Phase 3 Slice 6 edge: `useBulkDeleteWords` needs no NEW invalidation edge —
 * `wordKeys.all = ['words']` is already a prefix of `wordKeys.list(filters)`,
 * so the existing `invalidateQueries({ queryKey: wordKeys.all })` already
 * covers every filter combination the Review table might be viewing. (It does
 * mean an infinite query with N pages loaded refetches all N sequentially.)
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as wordApi from './api';
import { wordKeys } from './keys';
import type { CreateWordBody, UpdateWordBody, WordListFilters } from './types';

/**
 * `['metrics']` is owned by `features/metrics` from Phase 3.5; until that module
 * grows a `keys.ts`, the edge is spelled out here (and in the query-client
 * invalidation-graph comment).
 */
const METRICS_KEY = ['metrics'] as const;

/** One word by id. Disabled for an empty id so a not-yet-known route param doesn't fire. */
export function useWord(id: string) {
    return useQuery({
        queryKey: wordKeys.detail(id),
        queryFn: () => wordApi.getWordById(id),
        enabled: id !== '',
    });
}

export function useCreateWord() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (body: CreateWordBody) => wordApi.createWord(body),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: wordKeys.all });
            void queryClient.invalidateQueries({ queryKey: METRICS_KEY });
        },
    });
}

export function useUpdateWord() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (body: UpdateWordBody) => wordApi.updateWord(body),
        onSuccess: (word) => {
            // Seed the detail cache with the fresh word so the page re-renders
            // from it immediately, then let the list refetch in the background.
            queryClient.setQueryData(wordKeys.detail(word.id), word);
            void queryClient.invalidateQueries({ queryKey: wordKeys.all });
            void queryClient.invalidateQueries({ queryKey: METRICS_KEY });
        },
    });
}

export function useDeleteWord() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => wordApi.deleteWord(id),
        onSuccess: (_result, id) => {
            queryClient.removeQueries({ queryKey: wordKeys.detail(id) });
            void queryClient.invalidateQueries({ queryKey: wordKeys.all });
            void queryClient.invalidateQueries({ queryKey: METRICS_KEY });
        },
    });
}

const LIST_PAGE_SIZE = 50;

function sortedOrUndefined<T extends string>(values: T[] | undefined): T[] | undefined {
    if (!values || values.length === 0) return undefined;
    // Sorted so `{pos:['Verb','Noun']}` and `{pos:['Noun','Verb']}` hash to the
    // SAME query key: TanStack's `hashKey` sorts object keys but preserves
    // array order, and the server's `inArray` filter doesn't care about order,
    // so two equivalent filter states would otherwise be two cache entries and
    // two round trips.
    return [...values].sort();
}

/**
 * Filters -> a canonical shape so equivalent filter states share one cache
 * entry. `lang` (column order) is deliberately NOT part of this — it is a
 * display concern, not a query concern, and must not trigger a refetch when
 * Slice 7's drag-to-reorder changes it.
 */
export function normalizeWordFilters(filters: WordListFilters): WordListFilters {
    const q = filters.q?.trim();
    return {
        q: q ? q : undefined,
        pos: sortedOrUndefined(filters.pos),
        gender: sortedOrUndefined(filters.gender),
        tag: sortedOrUndefined(filters.tag),
    };
}

/**
 * The Review table's word list — `useInfiniteQuery` over the keyset-paginated
 * `GET /api/words/simple`. `getNextPageParam` returning the backend's own
 * `nextCursor` (`null` at the end) is exactly what TanStack Query's
 * `hasNextPage` needs, with no translation.
 */
export function useWordsInfinite(filters: WordListFilters = {}) {
    const normalized = normalizeWordFilters(filters);

    return useInfiniteQuery({
        queryKey: wordKeys.list(normalized),
        queryFn: ({ pageParam, signal }) =>
            wordApi.getWordsSimplified(
                { ...normalized, cursor: pageParam ?? undefined, limit: LIST_PAGE_SIZE },
                signal,
            ),
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
    });
}

/**
 * Bulk delete for the Review table's selection. `enableRowSelection` on the
 * table (Slice 6) restricts selection to the caller's own words, so the
 * backend's 401 "not authorized to delete at least one" branch — which would
 * otherwise trip `apiClient`'s any-401-clears-the-session interceptor — is
 * unreachable from this UI.
 */
export function useBulkDeleteWords() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (ids: string[]) => wordApi.deleteManyWords(ids),
        onSuccess: (_result, ids) => {
            for (const id of ids) queryClient.removeQueries({ queryKey: wordKeys.detail(id) });
            void queryClient.invalidateQueries({ queryKey: wordKeys.all });
            void queryClient.invalidateQueries({ queryKey: METRICS_KEY });
        },
    });
}
