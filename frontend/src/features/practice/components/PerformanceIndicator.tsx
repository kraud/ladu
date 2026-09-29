import { CheckIcon, DotIcon, XIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { htmlLangByI18nCode } from '@/lib/language';
import { cn } from '@/lib/utils';
import { answerCaseStat, type GivenAnswer } from '../session';
import type { Exercise } from '../types';
import { ModifierButtons, useModifierChange } from './ModifierActions';
import { SaveStatus } from './SaveStatus';

const WINDOW = 4;

const PILL = {
    Mastered: 'bg-(--success-soft) text-[color-mix(in_oklch,var(--success)_82%,var(--fg))]',
    Revise: 'bg-(--warning-soft) text-[color-mix(in_oklch,var(--warning)_82%,var(--fg))]',
} as const;

/**
 * Knowledge of this exact form (Part C §C.4 items 4 and 5). Top row: the label,
 * the Mastered / Revise pill (with a remove button once answered) and, at the
 * end, the two icon buttons. Second row: the last up to 4 attempts (oldest first,
 * empty slots when fewer), the knowledge percentage, the date of the last
 * practice, and the state of the save. A form that was never practised reads
 * "New" — never "0 %" or an invalid date.
 */
export function PerformanceIndicator({
    exercise,
    answer,
    onRetry,
}: {
    exercise: Exercise;
    answer: GivenAnswer | null;
    onRetry: () => void;
}) {
    const { t, i18n } = useTranslation();
    const change = useModifierChange(exercise, answer);
    const stat = answerCaseStat(exercise);
    const modifier = exercise.performance?.modifier ?? null;
    const record = stat?.record.slice(-WINDOW) ?? [];
    const slots = Array.from({ length: WINDOW }, (_, i) => record[i] ?? null);

    const lastDate = stat ? new Date(stat.lastDate) : null;
    const lastLabel =
        lastDate && !Number.isNaN(lastDate.getTime())
            ? lastDate.toLocaleDateString(htmlLangByI18nCode(i18n.language), { dateStyle: 'medium' })
            : null;

    return (
        <div className="flex flex-col gap-2.5 text-sm" data-testid="indicator">
            <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow">{t('practice:indicator.title')}</span>

                {modifier && (
                    <span
                        data-testid="status"
                        title={
                            modifier === 'Revise'
                                ? t('practice:status.reviseProgress', { count: exercise.performance?.reviseCounter ?? 0 })
                                : undefined
                        }
                        className={cn(
                            'inline-flex h-5 items-center gap-1 rounded-full px-2 font-mono text-[10.5px] font-bold tracking-wide whitespace-nowrap uppercase',
                            PILL[modifier],
                        )}
                    >
                        {t(`practice:status.${modifier}`)}
                        {modifier === 'Revise' && (
                            <span>
                                {' · '}
                                {t('practice:status.reviseShort', { count: exercise.performance?.reviseCounter ?? 0 })}
                            </span>
                        )}
                        {change.answered && (
                            <button
                                type="button"
                                aria-label={t('practice:status.remove')}
                                aria-disabled={!change.ready || undefined}
                                className="-mr-1 grid size-4 place-items-center rounded-full hover:bg-(--fg-soft2) aria-disabled:cursor-not-allowed aria-disabled:opacity-45"
                                onClick={() => change.ready && change.ask('remove')}
                            >
                                <XIcon aria-hidden weight="bold" size={10} />
                            </button>
                        )}
                    </span>
                )}

                <span className="ml-auto flex items-center gap-0.5">
                    <ModifierButtons change={change} />
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <ul className="flex items-center gap-1" aria-label={t('practice:indicator.attempts')}>
                    {slots.map((attempt, i) => (
                        <li
                            key={i}
                            className={cn(
                                'flex size-6 items-center justify-center rounded-full border',
                                attempt === true && 'border-(--success) bg-(--success-soft) text-(--success)',
                                attempt === false && 'border-(--danger) bg-(--danger-soft) text-(--danger)',
                                attempt === null && 'border-dashed border-border text-muted-foreground',
                            )}
                        >
                            {attempt === true && <CheckIcon aria-hidden weight="bold" size={12} />}
                            {attempt === false && <XIcon aria-hidden weight="bold" size={12} />}
                            {attempt === null && <DotIcon aria-hidden weight="bold" size={12} />}
                            <span className="sr-only">
                                {t(
                                    attempt === true
                                        ? 'practice:indicator.attemptRight'
                                        : attempt === false
                                          ? 'practice:indicator.attemptWrong'
                                          : 'practice:indicator.attemptEmpty',
                                )}
                            </span>
                        </li>
                    ))}
                </ul>

                {stat ? (
                    <>
                        <b>{t('practice:indicator.knowledge', { percent: Math.round(stat.knowledge) })}</b>
                        {lastLabel && (
                            <span className="text-muted-foreground">
                                {t('practice:indicator.lastPracticed', { date: lastLabel })}
                            </span>
                        )}
                    </>
                ) : (
                    <b className="text-muted-foreground">{t('practice:indicator.new')}</b>
                )}

                <SaveStatus answer={answer} onRetry={onRetry} className="ml-auto" />
            </div>

            {change.failed && (
                <p className="err show" role="alert">
                    {t('practice:dialogs.failed')}
                </p>
            )}
            {change.dialog}
        </div>
    );
}
