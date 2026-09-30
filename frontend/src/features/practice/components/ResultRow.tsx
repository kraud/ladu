import { ArrowRightIcon, ListBulletsIcon, PencilSimpleLineIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { FlagIcon } from '@/components/common/FlagIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { pronounFor } from '@/lib/cases';
import { languageByLabel } from '@/lib/language';
import type { GivenAnswer } from '../session';
import type { Exercise, ExerciseSide } from '../types';
import { FormLabel } from './FormLabel';
import { ResultIcon } from './ResultIcon';

const languageName = (label: string) => languageByLabel(label)?.native ?? label;

/**
 * One row of the results list (Part C §C.5, mockup `.res-row`). The whole row is
 * one button that opens the exercise. Wide screens: status | style icon | word type · form (short, with tooltips) | prompt → expected. The
 * word type and the form of the answer side are shown once, in their own column (for a
 * cross-language pair both sides share the form; for a drill it is the property asked).
 * The user's own answer is not in the row, so every row has the same height (it is on the
 * opened card). Narrow screens: 2 columns, without
 * the style and the arrow. The status is icon + text, never colour alone. A save that
 * failed shows "Not saved" here; the retry is on the banner ("Retry all") and on the card.
 */
export function ResultRow({
    exercise,
    answer,
    onOpen,
}: {
    exercise: Exercise;
    answer: GivenAnswer;
    onOpen: () => void;
}) {
    const { t } = useTranslation();
    const { prompt, answer: expected } = exercise;
    const styleLabel = exercise.type === 'Text-Input' ? t('practice:results.typed') : t('practice:results.chosen');
    const statusKey = answer.result === 'partial' ? 'practice:results.statusPartial' : `practice:feedback.${answer.result}`;

    return (
        <li data-testid="result-row" className="border-b border-border last:border-b-0">
            <button
                type="button"
                className="grid w-full grid-cols-[118px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-1 py-2.5 text-left text-[13.5px] hover:bg-(--hover) md:grid-cols-[118px_20px_minmax(0,0.8fr)_minmax(0,1fr)_18px_minmax(0,1fr)]"
                onClick={onOpen}
            >
                <span className="flex flex-col gap-0.5">
                    <b className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <ResultIcon result={answer.result} />
                        {t(statusKey)}
                    </b>
                    {answer.saveStatus === 'unsaved' && (
                        <span className="text-xs font-semibold text-(--danger)">{t('practice:save.notSaved')}</span>
                    )}
                    {answer.saveStatus === 'saving' && (
                        <span className="text-xs text-muted-foreground">{t('practice:save.saving')}</span>
                    )}
                </span>

                <Tooltip>
                    <TooltipTrigger
                        delay={1000}
                        render={<span className="hidden text-muted-foreground md:inline-flex" />}
                    >
                        {exercise.type === 'Text-Input' ? (
                            <PencilSimpleLineIcon aria-hidden weight="bold" size={16} />
                        ) : (
                            <ListBulletsIcon aria-hidden weight="bold" size={16} />
                        )}
                        <span className="sr-only">{styleLabel}</span>
                    </TooltipTrigger>
                    <TooltipContent>{styleLabel}</TooltipContent>
                </Tooltip>

                <FormLabel
                    partOfSpeech={exercise.partOfSpeech}
                    caseName={expected.caseName}
                    className="col-start-2 font-mono text-[11.5px] text-muted-foreground md:col-start-auto"
                />

                <Side side={prompt} exercise={exercise} className="col-start-2 md:col-start-auto" />

                <ArrowRightIcon aria-hidden size={14} className="hidden text-muted-foreground md:block" />

                <Side
                    side={expected}
                    exercise={exercise}
                    label={t('practice:results.expectedAnswer')}
                    className="col-start-2 md:col-start-auto"
                />
                <span className="sr-only">{t('practice:results.open')}</span>
            </button>
        </li>
    );
}

/** `[flag] [word]` — the word type and the form are in their own column. */
function Side({
    side,
    exercise,
    label,
    className,
}: {
    side: ExerciseSide;
    exercise: Exercise;
    label?: string;
    className?: string;
}) {
    const pronoun = pronounFor(exercise.partOfSpeech, side.caseName);
    return (
        <span className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 ${className ?? ''}`}>
            {label && <span className="sr-only">{label}: </span>}
            <FlagIcon lang={side.language} title={languageName(side.language)} width={19} height={14} />
            <span className="font-medium break-words">
                {pronoun && <span className="mr-1 text-muted-foreground">{pronoun}</span>}
                {side.value}
            </span>
        </span>
    );
}
