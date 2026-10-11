/**
 * The preview of a picked sense (Slice G, step G4): one row per language of the user's account, with
 * the words of the sense in that language. The user switches languages on or off, chooses between
 * several words of a language, and presses "Create draft".
 *
 * - The sense is chosen already (in the type-ahead list); this screen never asks for it again.
 * - Only the account languages appear (decision G-i). The start language comes first and its picked
 *   word is selected; the others select the first word (Wiktionary lists the common one first).
 * - A row is on by default when it has a word. One row on is enough (decision G-h): the user adds
 *   the other languages by hand in the normal form, and Save still needs two.
 * - Estonian with no word in the table shows the Ekilex words, marked "from Ekilex" (D22), or says
 *   they are not available now.
 * - "Create draft" asks the draft route for the forms of the chosen words and hands the result up.
 *   Nothing is saved here.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { FlagIcon } from '@/components/common/FlagIcon';
import { useCreateDraft, useSense } from '@/features/autocomplete/hooks';
import type { SenseSuggestion, TranslationWord, WordDraft } from '@/features/autocomplete/types';
import { languageByLabel } from '@/lib/language';

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
    const [enabledOverride, setEnabledOverride] = useState<Record<string, boolean>>({});
    const [chosenOverride, setChosenOverride] = useState<Record<string, number>>({});

    if (sense.isPending) {
        return (
            <div className="flex flex-col gap-3" data-testid="sense-preview" aria-busy="true">
                <Header suggestion={suggestion} onBack={onBack} />
                <p className="sr-only" role="status">{t('wordRelated:startFromWord.loading')}</p>
                {languages.map((language) => <Skeleton key={language} className="h-12 w-full" />)}
            </div>
        );
    }
    if (sense.isError) {
        return (
            <div className="flex flex-col gap-3" data-testid="sense-preview">
                <Header suggestion={suggestion} onBack={onBack} />
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

    const chosenIndex = (row: Row): number => {
        const override = chosenOverride[row.language];
        if (override !== undefined && override < row.words.length) return override;
        if (row.language === startLanguage) {
            const picked = row.words.findIndex((w) => w.word.toLowerCase() === suggestion.word.toLowerCase());
            if (picked >= 0) return picked;
        }
        return 0;
    };
    const isOn = (row: Row) => (row.words.length > 0 ? (enabledOverride[row.language] ?? true) : false);
    const picks = rows.filter(isOn).map((row) => {
        const word = row.words[chosenIndex(row)];
        return { language: row.language, word: word.word, ...(word.gender ? { gender: word.gender } : {}) };
    });

    return (
        <div className="flex flex-col gap-4" data-testid="sense-preview">
            <Header suggestion={suggestion} onBack={onBack} />
            <ul className="flex flex-col gap-2">
                {rows.map((row) => {
                    const native = languageByLabel(row.language)?.native ?? row.language;
                    const hasWord = row.words.length > 0;
                    return (
                        <li
                            key={row.language}
                            data-testid={`preview-row-${row.language}`}
                            className="flex items-start gap-3 rounded-lg border border-(--border) px-3 py-2.5"
                        >
                            <Checkbox
                                className="mt-1"
                                checked={isOn(row)}
                                disabled={!hasWord}
                                onCheckedChange={(checked) => setEnabledOverride((prev) => ({ ...prev, [row.language]: checked === true }))}
                                aria-label={t('wordRelated:startFromWord.useLanguage', { language: native })}
                            />
                            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                <span className="flex items-center gap-2 text-sm font-medium">
                                    <FlagIcon lang={row.language} />
                                    {native}
                                    {row.fromEkilex && (
                                        <span className="text-xs font-normal text-muted-foreground">
                                            {t('wordRelated:startFromWord.fromEkilex')}
                                        </span>
                                    )}
                                </span>
                                {!hasWord && (
                                    <span className="text-sm text-muted-foreground">
                                        {row.ekilexUnavailable
                                            ? t('wordRelated:startFromWord.ekilexUnavailable')
                                            : t('wordRelated:startFromWord.noWord')}
                                    </span>
                                )}
                                {row.words.length === 1 && <span className="text-sm">{labelOf(row.words[0])}</span>}
                                {row.words.length > 1 && (
                                    <RadioGroup
                                        className="flex-col gap-1"
                                        value={String(chosenIndex(row))}
                                        onValueChange={(value) => setChosenOverride((prev) => ({ ...prev, [row.language]: Number(value) }))}
                                        aria-label={native}
                                    >
                                        {row.words.map((word, index) => (
                                            <label key={`${word.word}-${index}`} className="flex items-center gap-2 text-sm">
                                                <RadioGroupItem value={String(index)} />
                                                {labelOf(word)}
                                            </label>
                                        ))}
                                    </RadioGroup>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
            {picks.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('wordRelated:startFromWord.noneSelected')}</p>
            )}
            {draft.isError && (
                <p role="alert" className="text-sm text-destructive">{t('wordRelated:startFromWord.draftFailed')}</p>
            )}
            <div>
                <Button
                    type="button"
                    disabled={picks.length === 0 || draft.isPending}
                    onClick={() =>
                        draft.mutate({ partOfSpeech: suggestion.partOfSpeech, picks }, { onSuccess: onDraft })
                    }
                >
                    {draft.isPending ? t('wordRelated:startFromWord.creating') : t('wordRelated:startFromWord.createDraft')}
                </Button>
            </div>
        </div>
    );
}

function Header({ suggestion, onBack }: { suggestion: SenseSuggestion; onBack: () => void }) {
    const { t } = useTranslation();
    return (
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
                <h2 className="h2">{t('wordRelated:startFromWord.previewTitle')}</h2>
            </div>
            <p className="text-sm text-muted-foreground">
                {suggestion.gender ? `${suggestion.gender} ` : ''}
                {suggestion.word}
                {suggestion.sense ? ` — ${suggestion.sense}` : ''}
            </p>
        </div>
    );
}
