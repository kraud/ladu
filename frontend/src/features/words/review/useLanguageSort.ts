/**
 * The sort of a word table: one language column at a time. A click on a header goes
 * A to Z, then Z to A, then back to the default order (newest first). A click on
 * another column moves the sort there, A to Z. The sort goes to the server, so it
 * covers all the words and not only the loaded ones.
 */
import { useCallback, useState } from 'react';
import type { LangKey, SortDirection } from '../types';

export interface LanguageSort {
    lang: LangKey;
    dir: SortDirection;
}

/** The next sort after a click on the header of `lang`. */
export function nextLanguageSort(current: LanguageSort | null, lang: LangKey): LanguageSort | null {
    if (!current || current.lang !== lang) return { lang, dir: 'asc' };
    return current.dir === 'asc' ? { lang, dir: 'desc' } : null;
}

export function useLanguageSort() {
    const [sort, setSort] = useState<LanguageSort | null>(null);
    // Stable: the table builds its columns from this.
    const toggleSort = useCallback((lang: LangKey) => setSort((current) => nextLanguageSort(current, lang)), []);
    return { sort, toggleSort };
}

/** The list filters that carry the sort. */
export function sortFilters(sort: LanguageSort | null): { sort?: LangKey; dir?: SortDirection } {
    return sort ? { sort: sort.lang, dir: sort.dir } : {};
}
