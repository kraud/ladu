/**
 * Mastered language pairs (plans/mastered-language-pairs): pairs of the user's languages that
 * Practice never combines. The server owns the final check (`backend/lib/masteredPairs.ts`);
 * these helpers keep the form in step with it. A pair is two language labels, sorted, so
 * `Spanish + English` and `English + Spanish` are the same pair.
 */

const keyOf = (a: string, b: string) => [a, b].sort().join('|');

/** Add a pair, with its two languages sorted. A pair that exists is not added again. */
export function addPair(pairs: string[][], a: string, b: string): string[][] {
    if (pairs.some(([x, y]) => keyOf(x, y) === keyOf(a, b))) return pairs;
    return [...pairs, [a, b].sort()];
}

/** The pairs whose two languages are both in `languages`. */
export function keepPairsWithin(pairs: string[][], languages: string[]): string[][] {
    return pairs.filter(([a, b]) => languages.includes(a) && languages.includes(b));
}

/** True when the pairs leave no pair of `languages` open: Practice would have no multi-language exercise. */
export function coversEveryPair(pairs: string[][], languages: string[]): boolean {
    if (languages.length < 2) return false;
    const distinct = new Set(keepPairsWithin(pairs, languages).map(([a, b]) => keyOf(a, b)));
    return distinct.size >= (languages.length * (languages.length - 1)) / 2;
}
