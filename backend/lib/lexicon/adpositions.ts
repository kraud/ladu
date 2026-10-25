/**
 * Merges the preposition and the postposition rows of one word into ONE lexicon row.
 *
 * Wiktionary lists German "nach" twice, as a preposition and as a postposition. The ingest turns
 * each entry into a row with the position "Before the noun" or "After the noun" (selectors/functionWords.ts).
 * A word that has both gets one row: position "Before or after the noun", the governed cases of
 * both entries joined (letters A, D, G, each once). Rows of other parts of speech, words with one
 * position, and homograph rows of one position are not touched.
 */

const { AFTER_THE_NOUN, BEFORE_OR_AFTER, BEFORE_THE_NOUN }: typeof import('./selectors/functionWords') = require('./selectors/functionWords');

interface AdpositionRow {
    partOfSpeech: string;
    lemma: string;
    frequencyRank: number | null;
    entryOrder: number;
    forms: Record<string, string>;
}

const LETTER_ORDER = 'ADG';
const positionKey = (forms: Record<string, string>): string | undefined => Object.keys(forms).find((key) => key.startsWith('position'));

function mergeGroup<R extends AdpositionRow>(group: R[]): R {
    const [first] = group;
    const key = positionKey(first.forms)!;
    const code = key.slice('position'.length);
    const forms: Record<string, string> = {};
    for (const row of group) for (const [caseName, word] of Object.entries(row.forms)) if (!(caseName in forms)) forms[caseName] = word;
    forms[key] = BEFORE_OR_AFTER;
    const governedKey = `governedCase${code}`;
    const letters = new Set(group.flatMap((row) => (row.forms[governedKey] ?? '').split('')));
    const governed = [...LETTER_ORDER].filter((letter) => letters.has(letter)).join('');
    if (governed) forms[governedKey] = governed;
    return { ...first, entryOrder: 0, frequencyRank: group.find((row) => row.frequencyRank !== null)?.frequencyRank ?? null, forms };
}

export function mergeAdpositionRows<R extends AdpositionRow>(rows: R[]): R[] {
    const byLemma = new Map<string, R[]>();
    for (const row of rows) {
        if (row.partOfSpeech !== 'Preposition' || !positionKey(row.forms)) continue;
        byLemma.set(row.lemma, [...(byLemma.get(row.lemma) ?? []), row]);
    }
    const mergedAt = new Map<R, R>(); // first row of a merging group -> the merged row
    const dropped = new Set<R>();
    for (const group of byLemma.values()) {
        const positions = new Set(group.map((row) => row.forms[positionKey(row.forms)!]));
        if (!positions.has(BEFORE_THE_NOUN) || !positions.has(AFTER_THE_NOUN)) continue;
        mergedAt.set(group[0], mergeGroup(group));
        group.slice(1).forEach((row) => dropped.add(row));
    }
    return rows.filter((row) => !dropped.has(row)).map((row) => mergedAt.get(row) ?? row);
}
