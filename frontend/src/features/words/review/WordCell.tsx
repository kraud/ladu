import { PlusIcon, ProhibitIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { CompletionRing } from '@/components/common/CompletionRing';
import { languageByKey } from '@/lib/language';
import type { LangKey, WordSimpleBE } from '@/features/words/types';
import { PartOfSpeech } from '@/ts/enums';
import { expectedCaseCount } from './completion';
import { genderValue, hasTranslation, headlineWord, registeredCases } from './row';

const GENDER_CLASS: Record<string, string> = {
    der: 'gender-m',
    el: 'gender-m',
    le: 'gender-m',
    die: 'gender-f',
    la: 'gender-f',
    das: 'gender-n',
};

/** A gendered case word's CSS class, tolerant of the two-language "el/la" neutral spelling. */
function genderClass(word: string): string | undefined {
    return GENDER_CLASS[word.toLowerCase()];
}

export interface WordCellProps {
    row: WordSimpleBE;
    langKey: LangKey;
    /** `row.user === session user id`. Gates Add vs. the read-only Block glyph on an EMPTY cell; a filled cell opens for everyone. */
    isOwn: boolean;
    showGender: boolean;
    /** Toolbar "Display progress" switch — the completion ring renders only while this is on. */
    showProgress: boolean;
    /**
     * Gates only the empty-cell Add affordance — `/tag/:id`'s word table
     * (phase-4-tags.md, post-Slice-6 fixes) renders every own word read-only
     * outside its own edit mode: an empty own cell shows a plain grayed dash
     * instead of "+" while `editable` is `false`. Defaults to `true`, so
     * Review (which has no such toggle) is unaffected. A *filled* cell's own
     * clickability is untouched by this flag — D41 already opens it
     * read-only first regardless.
     */
    editable?: boolean;
    onOpenCell?: (wordId: string, langKey: LangKey) => void;
}

/**
 * One language cell in the Review table, in one of three states:
 *   1. no translation stored at all -> Add (own word, `editable`) or a plain
 *      dash (own word, not `editable`) or Block (followed-tag word: no button,
 *      so no translation can be added to a word of someone else);
 *   2. a translation IS stored but has no headline case (`headlineWord` is
 *      `undefined` even though `hasTranslation` is true — see `WordSimpleBE`'s
 *      doc comment) -> the button renders with a dash rather than being
 *      mistaken for an empty cell;
 *   3. a translation with a headline word -> the word, an optional gender
 *      chip, and the completion ring.
 */
export function WordCell({ row, langKey, isOwn, showGender, showProgress, editable = true, onOpenCell }: WordCellProps) {
    const { t } = useTranslation();
    // Language names are shown in their OWN native form, matching
    // `LanguagePicker`'s convention (design commandment: never treat one
    // language as more "primary" than another, including via translation).
    const languageLabel = languageByKey(langKey)?.native ?? langKey;

    if (!hasTranslation(row, langKey)) {
        if (isOwn && editable) {
            return (
                <button
                    type="button"
                    className="cell-add"
                    aria-label={t('review:table.addTranslation', { language: languageLabel })}
                    onClick={() => onOpenCell?.(row.id, langKey)}
                >
                    <PlusIcon size={14} weight="bold" />
                </button>
            );
        }
        if (isOwn) {
            return (
                <span className="cell-block" aria-hidden="true">
                    —
                </span>
            );
        }
        return (
            <span className="cell-block" title={t('review:table.blockedTranslation')}>
                <ProhibitIcon size={14} />
            </span>
        );
    }

    const word = headlineWord(row, langKey);
    const value = registeredCases(row, langKey);
    const total = expectedCaseCount(row.partOfSpeech, langKey);
    const gender = genderValue(row, langKey);
    const showGenderChip = showGender && row.partOfSpeech === PartOfSpeech.noun && gender !== undefined;
    const genderChip = showGenderChip && gender !== undefined && (
        <span className={`gender-chip ${genderClass(gender) ?? ''}`}>{gender}</span>
    );

    return (
        <div className="ring-wrap">
            {/* A filled cell opens the dialog for any word, also a followed one: the dialog is read-only
                there (`CellDialog` `readOnly`). Only an EMPTY cell of a followed word stays closed, so nobody
                adds a translation to a word that is not theirs. */}
            <button type="button" className="cell-btn cell-word" onClick={() => onOpenCell?.(row.id, langKey)}>
                {word ?? '—'}
                {genderChip}
            </button>
            {showProgress && (
                <CompletionRing
                    value={value}
                    total={total}
                    detail={t('review:table.ringDetail', { value, total })}
                />
            )}
        </div>
    );
}
