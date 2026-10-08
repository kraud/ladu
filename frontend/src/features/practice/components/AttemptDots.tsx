import { CheckIcon, DotIcon, XIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { answerCaseStat } from '../session';
import type { Exercise } from '../types';

export const ATTEMPT_WINDOW = 4;

/**
 * The last up to 4 attempts at this exact form, oldest first, with empty slots when there are fewer.
 * Right = green check, wrong = red cross. Made of spans (not `ul`/`li`) so it can sit inside a button,
 * as in a results row (the caller's classes place them); the roles keep the list semantics.
 */
export function AttemptDots({
    exercise,
    size = 'md',
    className,
}: {
    exercise: Exercise;
    size?: 'sm' | 'md';
    className?: string;
}) {
    const { t } = useTranslation();
    const record = answerCaseStat(exercise)?.record.slice(-ATTEMPT_WINDOW) ?? [];
    const slots = Array.from({ length: ATTEMPT_WINDOW }, (_, i) => record[i] ?? null);
    const iconSize = size === 'sm' ? 10 : 12;

    return (
        <span role="list" className={cn('flex items-center gap-1', className)} aria-label={t('practice:indicator.attempts')}>
            {slots.map((attempt, i) => (
                <span
                    key={i}
                    role="listitem"
                    className={cn(
                        'flex items-center justify-center rounded-full border',
                        size === 'sm' ? 'size-5' : 'size-6',
                        attempt === true && 'border-(--success) bg-(--success-soft) text-(--success)',
                        attempt === false && 'border-(--danger) bg-(--danger-soft) text-(--danger)',
                        attempt === null && 'border-dashed border-border text-muted-foreground',
                    )}
                >
                    {attempt === true && <CheckIcon aria-hidden weight="bold" size={iconSize} />}
                    {attempt === false && <XIcon aria-hidden weight="bold" size={iconSize} />}
                    {attempt === null && <DotIcon aria-hidden weight="bold" size={iconSize} />}
                    <span className="sr-only">
                        {t(
                            attempt === true
                                ? 'practice:indicator.attemptRight'
                                : attempt === false
                                  ? 'practice:indicator.attemptWrong'
                                  : 'practice:indicator.attemptEmpty',
                        )}
                    </span>
                </span>
            ))}
        </span>
    );
}
