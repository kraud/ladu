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
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { getWordsSimplified } from '@/features/words/api';
import { wordKeys } from '@/features/words/keys';
import type { LangKey } from '@/features/words/types';
import * as practiceApi from './api';
import { practiceKeys } from './keys';
import { saveOrUpdateSession } from './savedSessions';
import { toPreselectedWord, type PreselectedWord } from './preselection';
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

/** The page size of the words endpoint: its largest. */
const TAG_WORDS_PAGE = 100;

/** All the words of one tag, as pre-selected words: follows the cursor until the last page. */
async function fetchTagWords(tagId: string, order: readonly LangKey[], signal?: AbortSignal): Promise<PreselectedWord[]> {
    const words: PreselectedWord[] = [];
    let cursor: string | undefined;
    for (;;) {
        const page = await getWordsSimplified({ tag: [tagId], cursor, limit: TAG_WORDS_PAGE }, signal);
        words.push(...page.items.map((row) => toPreselectedWord(row, order)));
        if (!page.nextCursor) return words;
        cursor = page.nextCursor;
    }
}

/**
 * The words of each chosen tag (Practice's set-up, no words from Review). One query per tag;
 * the keys sit under `wordKeys.all`, so every word or tag change refreshes them. `order` is the
 * language order of the account (the flags and the main form follow it, as in Review).
 * `byTag[id]` is `undefined` until that tag has loaded.
 */
export function useTagWords(tagIds: readonly string[], order: readonly LangKey[]) {
    const results = useQueries({
        queries: tagIds.map((id) => ({
            queryKey: [...wordKeys.all, 'practiceTagWords', id, order.join(',')],
            queryFn: ({ signal }: { signal?: AbortSignal }) => fetchTagWords(id, order, signal),
        })),
    });
    const byTag: Record<string, PreselectedWord[] | undefined> = {};
    tagIds.forEach((id, index) => {
        byTag[id] = results[index]?.data;
    });
    return {
        byTag,
        isPending: results.some((r) => r.isPending),
        isError: results.some((r) => r.isError),
    };
}
