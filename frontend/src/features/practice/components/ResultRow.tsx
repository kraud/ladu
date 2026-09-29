import { useTranslation } from 'react-i18next';
import { FlagIcon } from '@/components/common/FlagIcon';
import { Button } from '@/components/ui/button';
import { caseLabel, pronounFor } from '@/lib/cases';
import { languageByLabel } from '@/lib/language';
import { partOfSpeechLabelKey } from '@/lib/words';
import type { GivenAnswer } from '../session';
import type { Exercise, ExerciseSide } from '../types';

const ICON = { correct: '✓', partial: '≈', wrong: '✕' } as const;

const languageName = (label: string) => languageByLabel(label)?.native ?? label;

/** One line of the results list (Part C §C.5). The status is icon + text, never colour alone. */
export function ResultRow({
    exercise,
    answer,
    onOpen,
    onRetry,
}: {
    exercise: Exercise;
    answer: GivenAnswer;
    onOpen: () => void;
    onRetry: () => void;
}) {
    const { t } = useTranslation();
    const { partOfSpeech, prompt, answer: expected } = exercise;
    const differs = answer.given !== expected.value;

    return (
        <li className="card card-pad flex flex-col gap-2" data-testid="result-row">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <b>
                    <span aria-hidden>{ICON[answer.result]} </span>
                    {t(`practice:feedback.${answer.result}`)}
                </b>
                <span className="meta">
                    {exercise.type === 'Text-Input' ? t('practice:results.typed') : t('practice:results.chosen')}
                </span>
                <span className="meta">{t(partOfSpeechLabelKey(partOfSpeech))}</span>
                {answer.saveStatus === 'unsaved' && (
                    <>
                        <span className="font-semibold text-(--danger)">{t('practice:save.notSaved')}</span>
                        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                            {t('practice:save.retry')}
                        </Button>
                    </>
                )}
                {answer.saveStatus === 'saving' && <span className="meta">{t('practice:save.saving')}</span>}
                <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onOpen}>
                    {t('practice:results.open')}
                </Button>
            </div>

            <Side side={prompt} exercise={exercise} />
            <Side side={expected} exercise={exercise} label={t('practice:results.expectedAnswer')} />
            {differs && (
                <p className="text-sm break-words">
                    <span className="text-muted-foreground">{t('practice:results.yourAnswer')}: </span>
                    <span data-testid="given">{answer.given}</span>
                </p>
            )}
        </li>
    );
}

function Side({ side, exercise, label }: { side: ExerciseSide; exercise: Exercise; label?: string }) {
    const { t } = useTranslation();
    const pronoun = pronounFor(exercise.partOfSpeech, side.caseName);
    return (
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
            {label && <span className="text-muted-foreground">{label}:</span>}
            <FlagIcon lang={side.language} title={languageName(side.language)} />
            <span className="font-medium break-words">
                {pronoun && <span className="mr-1 text-muted-foreground">{pronoun}</span>}
                {side.value}
            </span>
            <span className="meta">{caseLabel(t, exercise.partOfSpeech, side.caseName)}</span>
        </p>
    );
}
