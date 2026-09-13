/** Query-key factory for the autocomplete feature. One export, imported by `hooks.ts`. */
import type { Lang, PartOfSpeech } from '@/ts/enums';

export const autocompleteKeys = {
    lookup: (language: Lang, pos: PartOfSpeech, query: string, extra?: boolean) =>
        ['autocomplete', language, pos, query, extra ?? false] as const,
};
