/**
 * Server-state hook for the autocomplete feature. `AutocompleteRow` is the
 * only consumer; it already debounces the query value before it reaches here.
 */
import { useQuery } from '@tanstack/react-query';
import type { Lang, PartOfSpeech } from '@/ts/enums';
import { autocompleteKeys } from './keys';
import { getAutocompleteEndpoint } from './transforms';
import type { AutocompleteResult } from './types';

export interface UseAutocompleteTranslationArgs {
    language: Lang;
    pos: PartOfSpeech;
    /** Already-debounced query value. */
    query: string;
    /** Estonian `searchInEnglish` checkbox value, where the registry entry has one. */
    extra?: boolean;
}

/** Disabled when there is no registry entry for `(language, pos)` or the query is blank. */
export function useAutocompleteTranslation({ language, pos, query, extra }: UseAutocompleteTranslationArgs) {
    const endpoint = getAutocompleteEndpoint(language, pos);
    const trimmed = query.trim();

    return useQuery<AutocompleteResult>({
        queryKey: autocompleteKeys.lookup(language, pos, trimmed, extra),
        queryFn: () => endpoint!.fetch(trimmed, extra),
        enabled: endpoint !== undefined && trimmed !== '',
    });
}
