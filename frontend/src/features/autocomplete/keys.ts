/** Query-key factory for the autocomplete feature. One export, imported by `hooks.ts`. */
import type { Lang, PartOfSpeech } from '@/ts/enums';
import type { SenseKey } from './types';

export const autocompleteKeys = {
    lookup: (language: Lang, pos: PartOfSpeech, query: string, entryId?: string) =>
        ['autocomplete', language, pos, query, entryId ?? null] as const,
    suggestions: (language: Lang, pos: PartOfSpeech, prefix: string) => ['autocomplete', 'suggestions', language, pos, prefix] as const,
    senseSuggestions: (language: Lang, pos: PartOfSpeech | 'Any', prefix: string) =>
        ['autocomplete', 'senseSuggestions', language, pos, prefix] as const,
    sense: (pos: string, key: SenseKey, languages: readonly string[]) =>
        ['autocomplete', 'sense', pos, key.englishLemma, key.entryOrder, key.senseOrder, languages.join(',')] as const,
};
