import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useUserMetrics } from '../hooks';
import { incompletePercent, totalTranslations, translationsPerWord, wordsAddedThisMonth } from '../selectors';
import { StatCard, StatCardSkeleton } from './StatCard';

/**
 * The `dash-grid`'s left column: three `StatCard`s over `useUserMetrics()`.
 * The incomplete-words card reads `user.languages` from `authStore` (not the
 * metrics response) to tell "genuinely 0% incomplete" apart from "the
 * endpoint can't compute this without languages" (D10 — `getUserMetrics`
 * returns `incompleteWordsCount: 0` unconditionally for a language-less
 * account, which would otherwise render as a false 0%).
 */
export function UserInfoPanel() {
    const { t } = useTranslation('dashboard');
    const hasLanguages = useAuthStore((s) => (s.user?.languages.length ?? 0) > 0);
    const { data: metrics, isPending } = useUserMetrics();

    if (isPending || !metrics) {
        return (
            <div className="stat-stack">
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
            </div>
        );
    }

    const percent = incompletePercent(metrics);

    return (
        <div className="stat-stack">
            <StatCard
                value={String(metrics.totalWords)}
                label={t('userInfoCards.totalWords')}
                sub={t('userInfoCards.sub.wordsThisMonth', { count: wordsAddedThisMonth(metrics) })}
            />
            <StatCard
                value={String(totalTranslations(metrics))}
                label={t('userInfoCards.totalTranslations')}
                sub={t('userInfoCards.sub.perWordAverage', { value: translationsPerWord(metrics).toFixed(1) })}
            />
            <StatCard
                warn
                value={hasLanguages ? `${percent}%` : '—'}
                label={t('userInfoCards.incompleteWords')}
                meterPercent={hasLanguages ? percent : undefined}
                sub={
                    hasLanguages ? undefined : (
                        <Link to="/user">{t('userInfoCards.noLanguages')}</Link>
                    )
                }
            />
        </div>
    );
}
