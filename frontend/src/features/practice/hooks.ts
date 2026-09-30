/**
 * Hooks for practice. An exercise session is a client-owned snapshot
 * (`session.ts`, C6), not cached server state, and a practice session never
 * changes `['words']` or `['metrics']` (invalidation graph,
 * `app/query-client.ts`) — so the exercise hooks below never touch the query
 * cache. The one query here is the list of saved configurations (Phase 5.5);
 * its create / edit / delete mutations invalidate `practiceKeys.configs`.
 * Toasts and navigation are per call site.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as practiceApi from './api';
import { practiceKeys } from './keys';
import type { GenerateBody, SaveAnswerBody, SaveConfigBody, SetModifierBody } from './types';

/** Creates the exercises of one session. */
export function useGenerateExercises() {
    return useMutation({
        mutationFn: (body: GenerateBody) => practiceApi.generateExercises(body),
    });
}

/** Saves one answer; resolves with the fresh performance of that translation. */
export function useSaveAnswer() {
    return useMutation({
        mutationFn: (body: SaveAnswerBody) => practiceApi.saveAnswer(body),
    });
}

/** Sets or clears (`null`) Mastered / Revise for one translation. */
export function useSetModifier() {
    return useMutation({
        mutationFn: ({ translationId, modifier }: { translationId: string } & SetModifierBody) =>
            practiceApi.setModifier(translationId, { modifier }),
    });
}

/** The caller's saved configurations, newest first. */
export function useConfigs() {
    return useQuery({
        queryKey: practiceKeys.configs,
        queryFn: ({ signal }) => practiceApi.listConfigs(signal),
    });
}

export function useCreateConfig() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: SaveConfigBody) => practiceApi.createConfig(body),
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: practiceKeys.configs }),
    });
}

export function useUpdateConfig() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: SaveConfigBody }) => practiceApi.updateConfig(id, body),
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: practiceKeys.configs }),
    });
}

export function useDeleteConfig() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => practiceApi.deleteConfig(id),
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: practiceKeys.configs }),
    });
}

/** Fetches the words a configuration still has. A mutation, not a query: it runs once, on a click. */
export function useLoadConfigWords() {
    return useMutation({
        mutationFn: (id: string) => practiceApi.getConfigWords(id),
    });
}
