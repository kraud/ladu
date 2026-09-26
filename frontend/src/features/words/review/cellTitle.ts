/**
 * The headword in the Review cell dialog's title — the main case of the word
 * (`primaryCaseWord`), with no language name (the title's flag shows it).
 *
 *  - Viewing/editing an existing translation: that translation's own main case.
 *  - Creating a new translation: the word as the user knows it already — the
 *    main case in their native language when the word has a translation there;
 *    otherwise in the first of their selected languages (account order) that
 *    the word has one in; otherwise in any translation the word has. A
 *    translation with no main case yet (incomplete) is skipped, so the title
 *    is never blank while another translation could fill it.
 *
 * `''` when nothing yields a word — the caller shows a generic placeholder.
 * Pure and store-free like the rest of `review/`: the native language and the
 * account languages come in as arguments.
 */
import { primaryCaseWord } from '@/lib/words';
import type { Lang, PartOfSpeech } from '@/ts/enums';

type TitleTranslation = { language: string; cases: readonly { caseName: string; word: string }[] };

export interface CellTitleOptions {
    /** The dialog's language has no translation on the word yet. */
    isAdd: boolean;
    /** `users.native_language` (a language label like `"Spanish"`); null/absent until the feature ships. */
    nativeLanguage?: string | null;
    /** The account's selected languages, in account order. */
    userLanguages?: readonly string[];
}

export function cellDialogHeadword(
    pos: PartOfSpeech,
    translations: readonly TitleTranslation[],
    target: Lang,
    { isAdd, nativeLanguage, userLanguages = [] }: CellTitleOptions,
): string {
    const headwordIn = (language: string): string => {
        const translation = translations.find((tr) => tr.language === language);
        return translation ? primaryCaseWord(pos, { ...translation, language: translation.language as Lang }) : '';
    };

    if (!isAdd) return headwordIn(target);

    const preference = [nativeLanguage, ...userLanguages, ...translations.map((tr) => tr.language)];
    for (const language of preference) {
        if (!language) continue;
        const word = headwordIn(language);
        if (word) return word;
    }
    return '';
}
