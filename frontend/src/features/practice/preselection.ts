/**
 * The hand-off from Review's "Practice" action to the parameters screen
 * (phase-5-practice.md C4, Part C §C.3). Review knows more than the ids: the
 * screen also shows each word (flags + main form) and limits the word types
 * to the ones the words have, so the hand-off carries those too.
 */
import { headlineWord } from '@/features/words/review/row';
import type { LangKey, WordSimpleBE } from '@/features/words/types';
import { languageByLabel } from '@/lib/language';
import type { PartOfSpeech } from '@/ts/enums';
import { SELECTABLE_PARTS_OF_SPEECH } from './params';

export interface PreselectedWord {
    id: string;
    partOfSpeech: PartOfSpeech;
    /** The main form: the first headline word found, following the Review column order. */
    label: string;
    /** Languages the word has a translation in, in the Review column order. */
    languages: LangKey[];
}

/** One Review row -> one pre-selected word. `order` is the Review language order. */
export function toPreselectedWord(row: WordSimpleBE, order: readonly LangKey[]): PreselectedWord {
    const stored = new Set(
        row.storedLanguages.map((label) => languageByLabel(label)?.key).filter((key) => key !== undefined),
    );
    const languages = order.filter((key) => stored.has(key));
    const label = languages.map((key) => headlineWord(row, key)).find((word) => !!word) ?? '';
    return { id: row.id, partOfSpeech: row.partOfSpeech, label, languages };
}

/**
 * The word types the screen may offer for these words, in screen order — or
 * `null` when there is no limit (no words, or none of them has a type the
 * screen offers; the run then ends in the "no exercises" explanation).
 */
export function availablePartsOfSpeech(words: readonly PreselectedWord[] | null): PartOfSpeech[] | null {
    if (!words || words.length === 0) return null;
    const present = new Set(words.map((word) => word.partOfSpeech));
    const available = SELECTABLE_PARTS_OF_SPEECH.filter((pos) => present.has(pos));
    return available.length > 0 ? available : null;
}

/** The words of several lists as one list: each word once, in the order it first appears. */
export function unionWords(lists: readonly (readonly PreselectedWord[])[]): PreselectedWord[] {
    const seen = new Set<string>();
    const result: PreselectedWord[] = [];
    for (const list of lists) {
        for (const word of list) {
            if (seen.has(word.id)) continue;
            seen.add(word.id);
            result.push(word);
        }
    }
    return result;
}
