/**
 * Thin transport layer over `apiClient` for the one dictionary route. No React, no
 * query-cache access — those live in `hooks.ts`. Matches `features/words/api.ts`'s own shape.
 */
import { apiClient } from '@/api/client';
import type { Lang, PartOfSpeech } from '@/ts/enums';
import type { DictionaryResponse } from './types';

/** `searchInEnglish`: Estonian verb only — look the word up by its English meaning. */
export async function lookupDictionary(
    language: Lang,
    pos: PartOfSpeech,
    query: string,
    searchInEnglish?: boolean
): Promise<DictionaryResponse> {
    const path = [language, pos, query].map(encodeURIComponent).join('/');
    const { data } = await apiClient.get<DictionaryResponse>(`/dictionary/${path}`, {
        params: searchInEnglish ? { searchInEnglish: true } : undefined,
    });
    return data;
}
