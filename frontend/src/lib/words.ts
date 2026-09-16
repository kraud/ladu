/**
 * Pure word-form helpers shared by `WordForm` (Slice 4) and `WordPage` (Slice 5).
 */
import { getFormConfig } from '@/features/words/form-engine/configs';
import type { TranslationBE } from '@/features/words/types';
import { PartOfSpeech } from '@/ts/enums';
import type { TranslationItem, WordItem } from '@/ts/interfaces';

/**
 * Port of the old app's `filterAvailableTranslationsBySelectedLanguages`
 * (`WordForm.tsx:157-169`): drops any translation whose language isn't in
 * the current user's `languages`, and stamps every surviving one complete +
 * clean — a translation loaded from the backend is complete by definition,
 * and hydration itself isn't a user edit.
 */
export function filterTranslationsByUserLanguages(
    translations: readonly TranslationBE[],
    userLanguages: readonly string[],
): TranslationItem[] {
    const allowed = new Set(userLanguages);
    return translations
        .filter((translation) => allowed.has(translation.language))
        .map((translation) => ({
            language: translation.language,
            // `WordCaseBE.caseName` is `string` over the wire; `WordItem.caseName`
            // narrows that to the case-name enums for form-side type safety. The
            // backend only ever persists real case-name strings, so this is a
            // trusted narrowing, not an unchecked one.
            cases: translation.cases as WordItem[],
            completionState: true,
            isDirty: false,
        }));
}

/**
 * The one "headline" case value for a translation — the required singular /
 * nominative field the form config marks `required` for that language (D4 —
 * every noun language has exactly one). Used for a word's page title. Falls
 * back to `''` when the config or the case is missing (e.g. an unshipped PoS).
 */
export function primaryCaseWord(
    pos: PartOfSpeech,
    translation: { language: TranslationItem['language']; cases: readonly { caseName: string; word: string }[] },
): string {
    const config = getFormConfig(pos, translation.language);
    const primaryField = config?.fields.find((field) => field.kind === 'text' && field.required);
    if (!primaryField) return '';
    return translation.cases.find((c) => c.caseName === primaryField.caseName)?.word ?? '';
}

/** `PartOfSpeech.noun` ("Noun") -> `"common:partOfSpeech.noun"` — the enum's own key names the i18n leaf. */
export function partOfSpeechLabelKey(pos: PartOfSpeech): string {
    const key = (Object.keys(PartOfSpeech) as (keyof typeof PartOfSpeech)[]).find((k) => PartOfSpeech[k] === pos);
    return `common:partOfSpeech.${key ?? 'noun'}`;
}

/**
 * The `/addWord/{-$partOfSpeech}` route param (the old app's lowercase PoS
 * label, e.g. `"noun"`) -> the matching `PartOfSpeech` enum value, matched
 * against the enum's own keys case-insensitively. `undefined` for a missing
 * or unrecognised param — the PoS gate then decides.
 */
export function partOfSpeechFromRouteParam(param: string | undefined): PartOfSpeech | undefined {
    if (!param) return undefined;
    const key = (Object.keys(PartOfSpeech) as (keyof typeof PartOfSpeech)[]).find(
        (k) => k.toLowerCase() === param.toLowerCase(),
    );
    return key ? PartOfSpeech[key] : undefined;
}

/**
 * The inverse of `partOfSpeechFromRouteParam`: a `PartOfSpeech` value -> its
 * `/addWord/{-$partOfSpeech}` route param (the enum's own key, e.g. `"noun"`).
 * Used by the Dashboard's pie chart to link its worst category straight to
 * `/addWord/<pos>` (Phase 3.5 D7).
 */
export function partOfSpeechToRouteParam(pos: PartOfSpeech): string {
    const key = (Object.keys(PartOfSpeech) as (keyof typeof PartOfSpeech)[]).find((k) => PartOfSpeech[k] === pos);
    return key ?? 'noun';
}
