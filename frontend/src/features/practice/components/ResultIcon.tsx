import { ApproximateEqualsIcon, CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { AnswerResult } from '../types';

const ICONS = { correct: CheckCircleIcon, partial: ApproximateEqualsIcon, wrong: XCircleIcon } as const;
const COLORS = { correct: 'text-(--success)', partial: 'text-(--warning)', wrong: 'text-(--danger)' } as const;

/**
 * The icon of an answer result (correct / almost / wrong). Decorative: the
 * result is always written next to it, so the state never depends on colour or
 * on the icon alone.
 */
export function ResultIcon({ result, size = 16, className }: { result: AnswerResult; size?: number; className?: string }) {
    const Icon = ICONS[result];
    return <Icon aria-hidden weight="bold" size={size} className={cn('shrink-0', COLORS[result], className)} />;
}
