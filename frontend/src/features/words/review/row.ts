/**
 * `WordSimpleBE` accessors, keyed by `LangKey`. Kept as free functions rather
 * than methods so `columns.tsx` / `WordCell.tsx` / `completion.ts` share one
 * reading of the row's dynamic fields instead of each re-deriving the
 * `data${key}` / `registeredCases${key}` string.
 */
import { Lang } from '@/ts/enums';
import type { LangKey, WordSimpleBE } from '@/features/words/types';

const LANG_BY_KEY: Record<LangKey, Lang> = {
    EN: Lang.EN,
    ES: Lang.ES,
    DE: Lang.DE,
    EE: Lang.EE,
};

/**
 * The headline word for a language, or `undefined`. NOT the same absence as
 * `!hasTranslation` — a translation can be stored with no headline case at
 * all (see `WordSimpleBE`'s doc comment), which still needs a "translation
 * exists but nothing to show" cell rather than an "Add translation" one.
 */
export function headlineWord(row: WordSimpleBE, key: LangKey): string | undefined {
    return row[`data${key}`];
}

/** Stored case count for a language. 0 when the language isn't stored at all. */
export function registeredCases(row: WordSimpleBE, key: LangKey): number {
    return row[`registeredCases${key}`] ?? 0;
}

/** Raw stored gender case word. Only German/Spanish nouns carry one. */
export function genderValue(row: WordSimpleBE, key: LangKey): string | undefined {
    if (key === 'ES') return row.genderES;
    if (key === 'DE') return row.genderDE;
    return undefined;
}

/** Is there a translation in this language at all? The authoritative check — not `headlineWord`. */
export function hasTranslation(row: WordSimpleBE, key: LangKey): boolean {
    return row.storedLanguages.includes(LANG_BY_KEY[key]);
}
