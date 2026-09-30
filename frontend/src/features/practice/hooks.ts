/**
 * Hooks for practice. An exercise session is a client-owned snapshot
 * (`session.ts`, C6), not cached server state, and a practice session never
 * changes `['words']` or `['metrics']` (invalidation graph,
 * `app/query-client.ts`) — so the exercise hooks below never touch the query
 * cache. The one query here is the list of saved configurations (Phase 5.5);
 * its create / edit / delete mutations invalidate `practiceKeys.configs`. The list of saved sessions
 * works the same way (`practiceKeys.sessions`).
 * Toasts and navigation are per call site.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as practiceApi from './api';
import { practiceKeys } from './keys';
import { saveOrUpdateSession } from './savedSessions';
import type { Session } from './session';
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

/** The caller's saved sessions (summaries), newest first. */
export function useSavedSessions() {
    return useQuery({
        queryKey: practiceKeys.sessions,
        queryFn: ({ signal }) => practiceApi.listSessions(signal),
    });
}

/** Saves the running session: updates its saved copy, or creates one (see `saveOrUpdateSession`). */
export function useSaveSession() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (session: Session) => saveOrUpdateSession(session),
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: practiceKeys.sessions }),
    });
}

export function useDeleteSavedSession() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => practiceApi.deleteSession(id),
        // Also after a failure: a 404 means the list is out of date.
        onSettled: () => void queryClient.invalidateQueries({ queryKey: practiceKeys.sessions }),
    });
}

/** Downloads one saved session. A mutation, not a query: it runs once, on a click. */
export function useLoadSavedSession() {
    return useMutation({
        mutationFn: (id: string) => practiceApi.getSession(id),
    });
}
