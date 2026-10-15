import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { TimerIcon } from '@phosphor-icons/react';
import { buttonVariants } from '@/components/ui/button';
import { useDemoTimeLeft } from '../hooks';
import { formatTimeLeft } from '../session';

/**
 * The demo block at the top of the Account page (demo-access.md D6): what a demo is, and the
 * time left. The words-left and tags-left counters join it in Slice 2 (D9). The end of the demo
 * is handled by the header badge, not here.
 */
export function DemoAccountCard() {
    const { t } = useTranslation();
    const left = useDemoTimeLeft();
    if (left === null) return null;

    return (
        <section aria-labelledby="demo-account-title" className="card max-w-2xl p-5">
            <h2 id="demo-account-title" className="h2 mb-1 flex items-center gap-2 text-lg">
                <TimerIcon size={20} aria-hidden="true" className="text-(--accent)" />
                {t('demo:account.title')}
            </h2>
            <p className="mb-3 text-sm font-semibold tabular-nums" role="timer">
                {t('demo:account.timeLeft', { time: formatTimeLeft(left) })}
            </p>
            <p className="meta mb-4">{t('demo:account.text')}</p>
            <Link to="/register" className={buttonVariants({ variant: 'outline' })}>
                {t('demo:account.createAccount')}
            </Link>
        </section>
    );
}
