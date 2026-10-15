import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { TimerIcon } from '@phosphor-icons/react';
import { buttonVariants } from '@/components/ui/button';
import { useUserMetrics } from '@/features/metrics/hooks';
import { useAuthStore } from '@/stores/authStore';
import { useDemoTimeLeft } from '../hooks';
import { formatTimeLeft } from '../session';

/**
 * The demo block at the top of the Account page (demo-access.md D6): what a demo is, the time
 * left, and how many words and tags the visitor can still add (D9): the caps frozen on the session
 * minus the totals from the user metrics. The end of the demo is handled by the header badge.
 * Word and tag changes refresh the metrics, so the counters follow.
 */
export function DemoAccountCard() {
    const { t } = useTranslation();
    const left = useDemoTimeLeft();
    const user = useAuthStore((s) => s.user);
    const metrics = useUserMetrics();
    if (left === null) return null;

    // Never below 0: a cap that was reached shows 0, not a negative number.
    const room = (limit: number | null | undefined, used: number | undefined) =>
        typeof limit === 'number' && used !== undefined ? Math.max(0, limit - used) : null;
    const wordsLeft = room(user?.demoWordLimit, metrics.data?.totalWords);
    const tagsLeft = room(user?.demoTagLimit, metrics.data?.totalTags);

    return (
        <section aria-labelledby="demo-account-title" className="card max-w-2xl p-5">
            <h2 id="demo-account-title" className="h2 mb-1 flex items-center gap-2 text-lg">
                <TimerIcon size={20} aria-hidden="true" className="text-(--accent)" />
                {t('demo:account.title')}
            </h2>
            <p className="mb-3 text-sm font-semibold tabular-nums" role="timer">
                {t('demo:account.timeLeft', { time: formatTimeLeft(left) })}
            </p>
            {wordsLeft !== null && tagsLeft !== null && (
                <ul className="mb-3 flex flex-wrap gap-1.5" aria-label={t('demo:account.title')}>
                    <li className="chip tabular-nums">{t('demo:account.wordsLeft', { count: wordsLeft })}</li>
                    <li className="chip tabular-nums">{t('demo:account.tagsLeft', { count: tagsLeft })}</li>
                </ul>
            )}
            <p className="meta mb-4">{t('demo:account.text')}</p>
            <Link to="/register" className={buttonVariants({ variant: 'outline' })}>
                {t('demo:account.createAccount')}
            </Link>
        </section>
    );
}
