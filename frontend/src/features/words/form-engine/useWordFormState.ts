/**
 * Owns the word-compose state `WordForm` renders against: which languages are
 * in play, each one's cases + completion/dirtiness (pushed up per-keystroke
 * by `TranslationCard`), the part of speech, and the clue. Every derived value
 * below (`availableLanguages`, `canSave`, `canAddMore`) is a plain computation
 * off that state — no `recently*` / `hideView` flag machine (the old app's
 * `WordForm.tsx`), per the phase-2 plan's explicit risk callout.
 */
import { useCallback, useMemo, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { UI_LANGUAGES } from '@/lib/language';
import { filterTranslationsByUserLanguages } from '@/lib/words';
import type { Lang, PartOfSpeech } from '@/ts/enums';
import type { TranslationItem, WordItem } from '@/ts/interfaces';
import type { TranslationCardChange } from './TranslationCard';
import type { WordBE } from '../types';

/** Why the Save button is disabled (`null` when it is enabled). */
export type SaveBlockReason = 'minTranslations' | 'incomplete' | 'noChanges';

/**
 * Whether Remove would throw something away. The card reports `hasData` from
 * its own field values; a slot that has not reported yet (a hydrated word
 * before its cards mount) falls back to its cases.
 */
export function translationHasData(translation: TranslationItem): boolean {
    return translation.hasData ?? translation.cases.length > 0;
}

const MAX_TRANSLATIONS = 4;
const MIN_TRANSLATIONS = 2;

export interface UseWordFormStateOptions {
    /** Edit mode: hydrate from an existing word (filtered to the user's current languages). */
    initialWord?: WordBE;
    /** Create mode: pre-seed the part-of-speech gate from the route param. */
    defaultPartOfSpeech?: PartOfSpeech;
}

function initialState(options: UseWordFormStateOptions, userLanguages: readonly string[]) {
    if (options.initialWord) {
        return {
            partOfSpeech: options.initialWord.partOfSpeech as PartOfSpeech | undefined,
            clue: options.initialWord.clue ?? '',
            translations: filterTranslationsByUserLanguages(options.initialWord.translations, userLanguages),
        };
    }
    return {
        partOfSpeech: options.defaultPartOfSpeech,
        clue: '',
        translations: [] as TranslationItem[],
    };
}

export function useWordFormState(options: UseWordFormStateOptions = {}) {
    const userLanguages = useAuthStore((s) => s.user?.languages ?? []);
    // Hydration runs once, off the props present at mount — `WordForm` remounts
    // (via a `key`) rather than re-hydrating a live form on `initialWord` swap.
    const [seed] = useState(() => initialState(options, userLanguages));

    const [partOfSpeech, setPartOfSpeech] = useState(seed.partOfSpeech);
    const [translations, setTranslations] = useState<TranslationItem[]>(seed.translations);
    const [clue, setClueValue] = useState(seed.clue);
    const [clueDirty, setClueDirty] = useState(false);
    // Removing a slot changes the word, but leaves every remaining card and the
    // clue untouched — so no card reports `isDirty`. Without this flag, taking a
    // translation away from a saved word could never enable Save.
    const [translationRemoved, setTranslationRemoved] = useState(false);
    // One bump counter per language — `TranslationCard`'s `resetKey` prop.
    const [resetTokens, setResetTokens] = useState<Partial<Record<Lang, number>>>({});

    const availableLanguages = useMemo(() => {
        const used = new Set(translations.map((t) => t.language));
        return UI_LANGUAGES.filter((ui) => userLanguages.includes(ui.label) && !used.has(ui.label as Lang));
    }, [translations, userLanguages]);

    const addTranslation = useCallback((language: Lang) => {
        setTranslations((prev) => [...prev, { language, cases: [], completionState: false, isDirty: true, hasData: false }]);
    }, []);

    const removeTranslation = useCallback((index: number) => {
        setTranslations((prev) => prev.filter((_, i) => i !== index));
        setTranslationRemoved(true);
    }, []);

    // Clearing a slot resets its *parent* state, but the mounted `TranslationCard`
    // owns its RHF form independently (see that file's header comment) and never
    // resyncs from `initialCases` after mount — otherwise every keystroke's own
    // echo would resync it right back, undoing the isDirty fix. `resetTokens`
    // is the explicit "please resync now" signal that echo can't produce on its
    // own: bumped only here, keyed by language (not index, so it can't drift
    // out of alignment with a slot after an unrelated `removeTranslation`).
    const clearTranslation = (index: number) => {
        const language = translations[index]?.language;
        setTranslations((prev) =>
            prev.map((t, i) => (i === index ? { ...t, cases: [], completionState: false, isDirty: true, hasData: false } : t)),
        );
        if (language) {
            setResetTokens((prev) => ({ ...prev, [language]: (prev[language] ?? 0) + 1 }));
        }
    };

    const updateTranslation = useCallback((index: number, next: TranslationCardChange) => {
        setTranslations((prev) => prev.map((t, i) => (i === index ? { ...t, ...next } : t)));
    }, []);

    const setClue = useCallback((value: string) => {
        setClueValue(value);
        setClueDirty(true);
    }, []);

    const reset = useCallback((nextPartOfSpeech?: PartOfSpeech) => {
        setPartOfSpeech(nextPartOfSpeech);
        setTranslations([]);
        setClueValue('');
        setClueDirty(false);
        setTranslationRemoved(false);
    }, []);

    const canAddMore = translations.length < MAX_TRANSLATIONS && availableLanguages.length > 0;
    const belowMinTranslations = translations.length < MIN_TRANSLATIONS;
    // Whether changing the part of speech would discard anything — a slot
    // added but never typed into (`cases: []`) isn't content. Drives the
    // create-mode "Change word type" confirm gate.
    const hasContent = translations.some((t) => t.cases.length > 0) || clue !== '';
    const hasEnoughTranslations = translations.length >= MIN_TRANSLATIONS;
    const allComplete = translations.every((t) => t.completionState);
    const hasChanges = translations.some((t) => t.isDirty) || clueDirty || translationRemoved;
    const canSave = hasEnoughTranslations && allComplete && hasChanges;
    // Why Save is disabled, for the editor's bottom bar. One reason at a time,
    // most fundamental first: too few translations, then a required field
    // still missing somewhere, then nothing changed yet. `null` = can save.
    const saveBlockReason: SaveBlockReason | null = !hasEnoughTranslations
        ? 'minTranslations'
        : !allComplete
          ? 'incomplete'
          : !hasChanges
            ? 'noChanges'
            : null;

    const buildPayload = useCallback(
        () => ({
            partOfSpeech: partOfSpeech as PartOfSpeech,
            clue: clue || undefined,
            translations: translations.map((t): { language: Lang; cases: WordItem[] } => ({
                language: t.language,
                cases: t.cases,
            })),
        }),
        [partOfSpeech, clue, translations],
    );

    return {
        partOfSpeech,
        setPartOfSpeech,
        translations,
        clue,
        setClue,
        availableLanguages,
        canAddMore,
        canSave,
        saveBlockReason,
        belowMinTranslations,
        hasContent,
        resetTokens,
        addTranslation,
        removeTranslation,
        clearTranslation,
        updateTranslation,
        reset,
        buildPayload,
    };
}
