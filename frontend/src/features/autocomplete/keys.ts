/** Query-key factory for the autocomplete feature. One export, imported by `hooks.ts`. */
import type { Lang, PartOfSpeech } from '@/ts/enums';

export const autocompleteKeys = {
    lookup: (language: Lang, pos: PartOfSpeech, query: string, extra?: boolean, entryId?: string) =>
        ['autocomplete', language, pos, query, extra ?? false, entryId ?? null] as const,
    suggestions: (language: Lang, pos: PartOfSpeech, prefix: string) => ['autocomplete', 'suggestions', language, pos, prefix] as const,
};
