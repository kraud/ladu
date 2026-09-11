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
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as wordApi from './api';
import { wordKeys } from './keys';
import type { CreateWordBody, UpdateWordBody } from './types';

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
