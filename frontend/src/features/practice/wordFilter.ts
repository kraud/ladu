/**
 * Which of the pre-selected words the practice settings would really use, and with which
 * languages. Pure: the sidebar list shows the result live while the user changes the
 * settings, and the results page shows it for the settings of the finished session.
 *
 * A word is used when its word type is selected AND at least one of its languages is.
 * (The server decides the real exercises; this mirrors the two settings the user can see.)
 */
import type { LangKey } from '@/features/words/types';
import { languageByLabel } from '@/lib/language';
import type { PreselectedWord } from './preselection';
import type { PracticeParams } from './types';

export interface DescribedWord {
    word: PreselectedWord;
    /** The word will be used with these settings. */
    included: boolean;
    /** The languages of the word that are selected in the settings, in the word's order. */
    activeLanguages: LangKey[];
}

export function describeWords(
    words: readonly PreselectedWord[],
    params: Pick<PracticeParams, 'languages' | 'partsOfSpeech'>,
): DescribedWord[] {
    const selectedLanguages = new Set(
        params.languages.map((label) => languageByLabel(label)?.key).filter((key) => key !== undefined),
    );
    const selectedTypes = new Set(params.partsOfSpeech);
    return words.map((word) => {
        const activeLanguages = word.languages.filter((key) => selectedLanguages.has(key));
        return {
            word,
            activeLanguages,
            included: selectedTypes.has(word.partOfSpeech) && activeLanguages.length > 0,
        };
    });
}
