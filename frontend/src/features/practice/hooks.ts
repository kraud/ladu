/**
 * Mutation hooks for practice. There are no queries here on purpose: an
 * exercise session is a client-owned snapshot (`session.ts`, C6), not cached
 * server state, and a practice session never changes `['words']` or
 * `['metrics']` (invalidation graph, `app/query-client.ts`) — so no hook
 * touches the query cache. Toasts and navigation are per call site.
 */
import { useMutation } from '@tanstack/react-query';
import * as practiceApi from './api';
import type { GenerateBody, SaveAnswerBody, SetModifierBody } from './types';

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
