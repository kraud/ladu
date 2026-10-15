import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { TimerIcon } from '@phosphor-icons/react';
import { useDemoExpiry, useDemoTimeLeft } from '../hooks';
import { formatTimeLeft } from '../session';

/**
 * The demo indicator in the app header (demo-access.md D6): "Demo 12:34", counting down, on every
 * screen size (below 480px only the clock). It links to the Account page, which explains the
 * demo. It also owns the end of the demo (`useDemoExpiry`): the header is on every protected page,
 * so the demo ends wherever the visitor is. Renders nothing for a normal account.
 */
export function DemoBadge() {
    const { t } = useTranslation();
    const left = useDemoTimeLeft();
    useDemoExpiry();

    if (left === null) return null;
    const time = formatTimeLeft(left);

    return (
        <Link to="/user" className="chip shrink-0 tabular-nums" aria-label={t('demo:badge.label', { time })}>
            <TimerIcon size={16} aria-hidden="true" className="text-(--accent)" />
            <span className="max-[480px]:hidden" aria-hidden="true">
                {t('demo:badge.demo')}
            </span>
            <span aria-hidden="true">{time}</span>
        </Link>
    );
}
