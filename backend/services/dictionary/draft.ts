/**
 * The draft lookup (autocomplete-data-source-strategy.md Slice G, step G3): the forms of one chosen
 * word per language, in one call. The preview (G4) sends the words the user picked; each runs through
 * the normal lookup chain of its (language, part of speech) pair (registry.ts), exactly as if the
 * user had typed it. The noun gender of a translation chooses between homographs ("See": der / die).
 *
 * One language failing must not fail the others: a lookup that throws (Ekilex 502) comes back as
 * `status: 'error'` with no cases, and the other languages still fill. Nothing is saved or cached.
 */

import type { LookupCase } from './types';
const { findAdapter }: typeof import('./registry') = require('./registry');

export interface DraftPick {
    language: string;
    word: string;
    /** Nouns: der / die / das, el / la, from the translation table. */
    gender?: string;
}

export interface DraftTranslation {
    language: string;
    word: string;
    gender?: string;
    /** found / partial / not-found as the lookup route says; `error` when the lookup itself failed. */
    status: 'found' | 'partial' | 'not-found' | 'error';
    cases: LookupCase[];
}

export async function draft(partOfSpeech: string, picks: DraftPick[]): Promise<DraftTranslation[]> {
    return Promise.all(
        picks.map(async ({ language, word, gender }): Promise<DraftTranslation> => {
            const echo = { language, word, ...(gender ? { gender } : {}) };
            const adapter = findAdapter(language, partOfSpeech);
            if (!adapter) return { ...echo, status: 'not-found', cases: [] };
            try {
                const { status, cases } = await adapter(word, { gender });
                return { ...echo, status, cases };
            } catch (error) {
                console.error(`Draft lookup failed for ${language} ${partOfSpeech} "${word}":`, error instanceof Error ? error.message : error);
                return { ...echo, status: 'error', cases: [] };
            }
        }),
    );
}
