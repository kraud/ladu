/**
 * The preview of a picked sense (Slice G): the screen between the sense list and the draft. It replaces
 * the Add Word page's own title and back arrow (`StartFromWord` hides them), so it has its own: the
 * arrow goes back to the start section on the same page, not to the word list.
 *
 * One card per language of the user's account, in the style of the real translation cards, two to a
 * row on a desktop and collapsed (`translationGridClass`). A card's header shows the flag, the
 * preselected word and a hint: how many other options there are, or that there are none. The start
 * language preselects the word the user picked; the others the first word (Wiktionary lists the
 * common one first).
 *
 * - The expand button is enabled when the language has a word: the body then lists the words and
 *   "No translation". With no word at all there is nothing to choose, so it is disabled.
 * - "No translation" leaves the language out of the draft. The card stays here; the form that follows
 *   has no card for that language (the user can still add it by hand before saving).
 * - One language is enough (decision G-h); the user adds the rest by hand, and Save still needs two.
 * - Estonian with no word in the table shows the Ekilex words, marked "from Ekilex" (D22), or says they
 *   are not available now.
 * - "Create draft" asks the draft route for the forms of the chosen words and hands the result up.
 *   Nothing is saved here.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon, CaretDownIcon, CaretUpIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { FlagIcon } from '@/components/common/FlagIcon';
import { useCreateDraft, useSense } from '@/features/autocomplete/hooks';
import type { SenseSuggestion, TranslationWord, WordDraft } from '@/features/autocomplete/types';
import { langTint, languageByLabel } from '@/lib/language';
import { cn } from '@/lib/utils';
import { PartOfSpeech } from '@/ts/enums';
import { translationGridClass } from '../form-engine/TranslationCard';

/** The value of the "No translation" radio. */
const NONE = 'none';

interface Row {
    language: string;
    words: TranslationWord[];
    fromEkilex: boolean;
    ekilexUnavailable: boolean;
}

const labelOf = ({ word, gender }: TranslationWord) => (gender ? `${gender} ${word}` : word);

export function SensePreview({
    suggestion,
    startLanguage,
    languages,
    onBack,
    onDraft,
}: {
    suggestion: SenseSuggestion;
    startLanguage: string;
    /** The user's account languages, start language first. */
    languages: readonly string[];
    onBack: () => void;
    onDraft: (draft: WordDraft) => void;
}) {
    const { t } = useTranslation();
    const sense = useSense(suggestion.partOfSpeech, suggestion.key, languages);
    const draft = useCreateDraft();
    // Only what the user changed; everything else comes from the data (defaults below).
    const [chosenOverride, setChosenOverride] = useState<Record<string, number | typeof NONE>>({});
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const header = (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('wordRelated:startFromWord.back')}
                    title={t('wordRelated:startFromWord.back')}
                    onClick={onBack}
                >
                    <ArrowLeftIcon size={18} />
                </button>
                <h1 className="h1">{t('wordRelated:startFromWord.previewTitle')}</h1>
            </div>
            <p className="text-sm text-muted-foreground">
                {suggestion.gender ? `${suggestion.gender} ` : ''}
                {suggestion.word}
                {suggestion.sense ? ` — ${suggestion.sense}` : ''}
            </p>
        </div>
    );

    if (sense.isPending) {
        return (
            <div className="flex flex-col gap-4" data-testid="sense-preview" aria-busy="true">
                {header}
                <p className="sr-only" role="status">{t('wordRelated:startFromWord.loading')}</p>
                <div className={translationGridClass(PartOfSpeech.noun)}>
                    {languages.map((language) => <Skeleton key={language} className="h-14 w-full" />)}
                </div>
            </div>
        );
    }
    if (sense.isError) {
        return (
            <div className="flex flex-col gap-4" data-testid="sense-preview">
                {header}
                <p role="alert" className="text-sm text-destructive">{t('wordRelated:startFromWord.loadFailed')}</p>
            </div>
        );
    }

    const { sense: data, ekilex } = sense.data;
    const rows: Row[] = languages.map((language) => {
        const own = data.words[language] ?? [];
        const ekilexWords = ekilex && 'estonian' in ekilex ? ekilex.estonian : [];
        const useEkilex = language === 'Estonian' && own.length === 0;
        return {
            language,
            words: useEkilex ? ekilexWords : own,
            fromEkilex: useEkilex && ekilexWords.length > 0,
            ekilexUnavailable: useEkilex && ekilex !== undefined && 'unavailable' in ekilex,
        };
    });

    /** The index of the chosen word, or NONE. Default: the picked word (start language) or the first word. */
    const chosenOf = (row: Row): number | typeof NONE => {
        if (row.words.length === 0) return NONE;
        const override = chosenOverride[row.language];
        if (override === NONE) return NONE;
        if (override !== undefined && override < row.words.length) return override;
        if (row.language === startLanguage) {
            const picked = row.words.findIndex((w) => w.word.toLowerCase() === suggestion.word.toLowerCase());
            if (picked >= 0) return picked;
        }
        return 0;
    };
    const picks = rows.flatMap((row) => {
        const index = chosenOf(row);
        if (index === NONE) return [];
        const word = row.words[index];
        return [{ language: row.language, word: word.word, ...(word.gender ? { gender: word.gender } : {}) }];
    });

    return (
        <div className="flex flex-col gap-4" data-testid="sense-preview">
            {header}
            <div className={translationGridClass(PartOfSpeech.noun)}>
                {rows.map((row) => {
                    const native = languageByLabel(row.language)?.native ?? row.language;
                    const chosen = chosenOf(row);
                    const hasWords = row.words.length > 0;
                    const isOpen = hasWords && expanded[row.language] === true;
                    const hint = !hasWords
                        ? row.ekilexUnavailable
                            ? t('wordRelated:startFromWord.ekilexUnavailable')
                            : t('wordRelated:startFromWord.noWord')
                        : [
                              row.fromEkilex ? t('wordRelated:startFromWord.fromEkilex') : null,
                              chosen === NONE
                                  ? t('wordRelated:startFromWord.optionsAvailable', { count: row.words.length })
                                  : row.words.length > 1
                                    ? t('wordRelated:startFromWord.otherOptions', { count: row.words.length - 1 })
                                    : t('wordRelated:startFromWord.noOtherOptions'),
                          ]
                              .filter(Boolean)
                              .join(' · ');
                    return (
                        <div
                            key={row.language}
                            role="group"
                            aria-label={native}
                            data-testid={`preview-card-${row.language}`}
                            className="flex flex-col overflow-hidden rounded-lg border bg-card"
                            style={{ borderTopColor: langTint(row.language), borderTopWidth: 2 }}
                        >
                            <div className="flex items-center justify-between gap-2 bg-background px-4 py-3">
                                <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                                    <FlagIcon lang={row.language} title={native} />
                                    <span className={cn('shrink-0', chosen === NONE && 'font-normal text-muted-foreground')}>
                                        {chosen === NONE ? t('wordRelated:startFromWord.noTranslation') : labelOf(row.words[chosen])}
                                    </span>
                                    <span className="hint truncate">{hint}</span>
                                </div>
                                <button
                                    type="button"
                                    className="icon-btn"
                                    disabled={!hasWords}
                                    aria-expanded={isOpen}
                                    aria-label={t(isOpen ? 'wordRelated:translationFormGeneric.collapse' : 'wordRelated:translationFormGeneric.expand')}
                                    onClick={() => setExpanded((prev) => ({ ...prev, [row.language]: !isOpen }))}
                                >
                                    {isOpen ? <CaretUpIcon size={16} /> : <CaretDownIcon size={16} />}
                                </button>
                            </div>
                            {isOpen && (
                                <RadioGroup
                                    className="flex-col gap-2 border-t border-border px-4 py-3"
                                    value={String(chosen)}
                                    onValueChange={(value) =>
                                        setChosenOverride((prev) => ({ ...prev, [row.language]: value === NONE ? NONE : Number(value) }))
                                    }
                                    aria-label={native}
                                >
                                    {row.words.map((word, index) => (
                                        <label key={`${word.word}-${index}`} className="flex items-center gap-2 text-sm">
                                            <RadioGroupItem value={String(index)} />
                                            {labelOf(word)}
                                        </label>
                                    ))}
                                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <RadioGroupItem value={NONE} />
                                        {t('wordRelated:startFromWord.noTranslation')}
                                    </label>
                                </RadioGroup>
                            )}
                        </div>
                    );
                })}
            </div>
            {picks.length === 0 && <p className="text-sm text-muted-foreground">{t('wordRelated:startFromWord.noneSelected')}</p>}
            {draft.isError && <p role="alert" className="text-sm text-destructive">{t('wordRelated:startFromWord.draftFailed')}</p>}
            <div>
                <Button
                    type="button"
                    disabled={picks.length === 0 || draft.isPending}
                    onClick={() => draft.mutate({ partOfSpeech: suggestion.partOfSpeech, picks }, { onSuccess: onDraft })}
                >
                    {draft.isPending ? t('wordRelated:startFromWord.creating') : t('wordRelated:startFromWord.createDraft')}
                </Button>
            </div>
        </div>
    );
}
