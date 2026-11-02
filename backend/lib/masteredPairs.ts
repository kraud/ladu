/**
 * Mastered language pairs (plans/mastered-language-pairs): pairs of the user's own languages that
 * Practice never combines in a multi-language exercise. Each language stays in use with the others.
 *
 * A pair is two different language names. It is stored sorted, so `["Spanish","English"]` and
 * `["English","Spanish"]` are the same pair. This module has no database or HTTP code: the
 * controller calls it and sets the status code.
 */

export type MasteredPair = [string, string];

/** One key for a pair of languages, whatever the order inside the pair. */
export const pairKey = (a: string, b: string): string => [a, b].sort().join('|');

const sortedPair = (a: string, b: string): MasteredPair => (a < b ? [a, b] : [b, a]);

/** How many different pairs `count` languages make. */
const pairCount = (count: number): number => (count * (count - 1)) / 2;

export type MasteredPairsResult = { ok: true; pairs: MasteredPair[] } | { ok: false; message: string };

/**
 * Check the `masteredLanguagePairs` a client sends against the user's final `languages`.
 * Result: the pairs sorted inside, without repeats, in the order the client sent them.
 * Rejected: a value that is not a list of 2-item lists, two equal languages, a language outside
 * `languages`, and a set that covers every pair (Practice would have no multi-language pair left).
 */
export function resolveMasteredPairs(input: unknown, languages: string[]): MasteredPairsResult {
    if (!Array.isArray(input) || !input.every((entry) => Array.isArray(entry) && entry.length === 2)) {
        return { ok: false, message: 'Mastered language pairs must be a list of pairs of two languages' };
    }
    const seen = new Set<string>();
    const pairs: MasteredPair[] = [];
    for (const [a, b] of input as unknown[][]) {
        if (typeof a !== 'string' || typeof b !== 'string' || a === b) {
            return { ok: false, message: 'A mastered pair needs two different languages' };
        }
        if (!languages.includes(a) || !languages.includes(b)) {
            return { ok: false, message: 'Mastered pairs must use languages you have selected' };
        }
        const key = pairKey(a, b);
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push(sortedPair(a, b));
    }
    if (pairs.length >= pairCount(languages.length)) {
        return { ok: false, message: 'Leave at least one pair of languages open for practice' };
    }
    return { ok: true, pairs };
}

/** The stored pairs whose two languages are both still in `languages`. */
export function keepPairsWithin(stored: string[][], languages: string[]): string[][] {
    return stored.filter(([a, b]) => languages.includes(a) && languages.includes(b));
}
