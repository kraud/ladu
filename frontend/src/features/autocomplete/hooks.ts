/**
 * Server-state hooks for the autocomplete feature.
 * - `useAutocompleteTranslation`: the lookup. `AutocompleteRow` is the only consumer; it already
 *   debounces the query value before it reaches here.
 * - `useDictionarySuggestions`: the type-ahead list (Slice E). `TypeAheadInput` is the only
 *   consumer; it debounces the prefix.
 * - `lookupQueryOptions`: the lookup's query options, shared with a type-ahead pick
 *   (`queryClient.fetchQuery`), so the pick and `AutocompleteRow` read the same cache entry.
 */
import { keepPreviousData, queryOptions, useMutation, useQuery } from '@tanstack/react-query';
import type { Lang, PartOfSpeech } from '@/ts/enums';
import { createDraft, fetchSense, lookupDictionary, suggestDictionary, suggestSenses } from './api';
import { autocompleteKeys } from './keys';
import { getAutocompleteEndpoint, toAutocompleteResult } from './transforms';
import type { DraftPick, SenseKey, WordDraft } from './types';

/** Fewer characters than this never ask for suggestions (the backend also refuses them). */
export const MIN_PREFIX_LENGTH = 2;

export interface UseAutocompleteTranslationArgs {
    language: Lang;
    pos: PartOfSpeech;
    /** Already-debounced query value. */
    query: string;
    /** Estonian `searchInEnglish` checkbox value, where the registry entry has one. */
    extra?: boolean;
    /** A type-ahead pick: look up that exact entry. */
    entryId?: string;
}

export function lookupQueryOptions({ language, pos, query, extra, entryId }: UseAutocompleteTranslationArgs) {
    const trimmed = query.trim();
    return queryOptions({
        queryKey: autocompleteKeys.lookup(language, pos, trimmed, extra, entryId),
        queryFn: () => lookupDictionary(language, pos, trimmed, extra, entryId).then(toAutocompleteResult),
    });
}

/** Disabled when there is no registry entry for `(language, pos)` or the query is blank. */
export function useAutocompleteTranslation(args: UseAutocompleteTranslationArgs) {
    const endpoint = getAutocompleteEndpoint(args.language, args.pos);
    return useQuery({
        ...lookupQueryOptions(args),
        enabled: endpoint !== undefined && args.query.trim() !== '',
    });
}

export interface UseDictionarySuggestionsArgs {
    language: Lang;
    pos: PartOfSpeech;
    /** Already-debounced prefix. */
    prefix: string;
    /** False turns the list off (Estonian "Search verb in English"). */
    enabled: boolean;
}

/**
 * The type-ahead list. Disabled for a prefix under 2 characters. While the next prefix loads, the
 * previous list stays (`keepPreviousData`), so the list does not flash empty at each key press.
 */
export function useDictionarySuggestions({ language, pos, prefix, enabled }: UseDictionarySuggestionsArgs) {
    const trimmed = prefix.trim();
    return useQuery({
        queryKey: autocompleteKeys.suggestions(language, pos, trimmed),
        queryFn: () => suggestDictionary(language, pos, trimmed),
        enabled: enabled && trimmed.length >= MIN_PREFIX_LENGTH,
        placeholderData: keepPreviousData,
        staleTime: 5 * 60_000,
    });
}

/** The sense type-ahead of the start section (Slice G). Like `useDictionarySuggestions`, for senses. */
export function useSenseSuggestions({ language, pos, prefix, enabled }: {
    language: Lang;
    pos: PartOfSpeech | 'Any';
    /** Already-debounced prefix. */
    prefix: string;
    enabled: boolean;
}) {
    const trimmed = prefix.trim();
    return useQuery({
        queryKey: autocompleteKeys.senseSuggestions(language, pos, trimmed),
        queryFn: () => suggestSenses(language, pos, trimmed),
        enabled: enabled && trimmed.length >= MIN_PREFIX_LENGTH,
        placeholderData: keepPreviousData,
        staleTime: 5 * 60_000,
    });
}

/** One sense with its words for the preview, for the user's account languages only. */
export function useSense(partOfSpeech: string, key: SenseKey, languages: readonly string[]) {
    return useQuery({
        queryKey: autocompleteKeys.sense(partOfSpeech, key, languages),
        queryFn: () => fetchSense(partOfSpeech, key, languages),
        staleTime: 5 * 60_000,
    });
}

/** "Create draft": looks up the forms of the chosen words. Nothing is saved. */
export function useCreateDraft() {
    return useMutation({
        mutationFn: async ({ partOfSpeech, picks }: { partOfSpeech: string; picks: DraftPick[] }): Promise<WordDraft> => ({
            partOfSpeech,
            translations: await createDraft(partOfSpeech, picks),
        }),
    });
}
