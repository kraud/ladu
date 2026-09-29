import { useTranslation } from 'react-i18next';
import { htmlLangByI18nCode } from '@/lib/language';
import { cn } from '@/lib/utils';
import { answerCaseStat } from '../session';
import type { Exercise } from '../types';

const WINDOW = 4;

/**
 * Knowledge of this exact form (Part C §C.4 item 4): the last up to 4 attempts
 * (oldest first, empty slots when fewer), the knowledge percentage, the date of
 * the last practice, and the Mastered / Revise status. A form that was never
 * practised reads "New" — never "0 %" or an invalid date.
 */
export function PerformanceIndicator({ exercise }: { exercise: Exercise }) {
    const { t, i18n } = useTranslation();
    const stat = answerCaseStat(exercise);
    const performance = exercise.performance;
    const record = stat?.record.slice(-WINDOW) ?? [];
    const slots = Array.from({ length: WINDOW }, (_, i) => record[i] ?? null);

    const lastDate = stat ? new Date(stat.lastDate) : null;
    const lastLabel =
        lastDate && !Number.isNaN(lastDate.getTime())
            ? lastDate.toLocaleDateString(htmlLangByI18nCode(i18n.language), { dateStyle: 'medium' })
            : null;

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" data-testid="indicator">
            <ul className="flex items-center gap-1" aria-label={t('practice:indicator.attempts')}>
                {slots.map((attempt, i) => (
                    <li
                        key={i}
                        className={cn(
                            'flex size-6 items-center justify-center rounded-full border text-xs',
                            attempt === true && 'border-(--success) bg-(--success-soft)',
                            attempt === false && 'border-(--danger) bg-(--danger-soft)',
                            attempt === null && 'border-dashed border-border text-muted-foreground',
                        )}
                    >
                        <span aria-hidden>{attempt === true ? '✓' : attempt === false ? '✕' : '·'}</span>
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

            {performance?.modifier && (
                <span
                    className="inline-flex items-center rounded-full border border-(--accent-soft2) bg-(--accent-soft) px-3 py-0.5 font-semibold text-(--accent-strong)"
                    data-testid="status"
                >
                    {t(`practice:status.${performance.modifier}`)}
                    {performance.modifier === 'Revise' && (
                        <span className="font-normal">
                            {' · '}
                            {t('practice:status.reviseProgress', { count: performance.reviseCounter })}
                        </span>
                    )}
                </span>
            )}
        </div>
    );
}
