/**
 * Thin transport layer over `apiClient` for the one dictionary route. No React, no
 * query-cache access — those live in `hooks.ts`. Matches `features/words/api.ts`'s own shape.
 */
import { apiClient } from '@/api/client';
import type { Lang, PartOfSpeech } from '@/ts/enums';
import type { DictionaryResponse, Suggestion, SuggestionsResponse } from './types';

/**
 * `searchInEnglish`: Estonian verb only — look the word up by its English meaning.
 * `entryId`: a type-ahead pick — the backend returns that exact entry (der See vs die See).
 */
export async function lookupDictionary(
    language: Lang,
    pos: PartOfSpeech,
    query: string,
    searchInEnglish?: boolean,
    entryId?: string
): Promise<DictionaryResponse> {
    const path = [language, pos, query].map(encodeURIComponent).join('/');
    const params = { ...(searchInEnglish ? { searchInEnglish: true } : {}), ...(entryId ? { entry: entryId } : {}) };
    const { data } = await apiClient.get<DictionaryResponse>(`/dictionary/${path}`, {
        params: Object.keys(params).length > 0 ? params : undefined,
    });
    return data;
}

/** The type-ahead list: dictionary words that start with `prefix` (2+ characters), most frequent first. */
export async function suggestDictionary(language: Lang, pos: PartOfSpeech, prefix: string): Promise<Suggestion[]> {
    const path = [language, pos].map(encodeURIComponent).join('/');
    const { data } = await apiClient.get<SuggestionsResponse>(`/dictionary/${path}`, { params: { prefix } });
    return data.suggestions;
}
