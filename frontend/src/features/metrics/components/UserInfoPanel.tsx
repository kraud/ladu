import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useUserMetrics } from '../hooks';
import { practicedPercent, totalTranslations, translationsPerWord, wordsAddedThisMonth } from '../selectors';
import { QuickActions } from './QuickActions';
import { StatCard, StatCardSkeleton } from './StatCard';

/**
 * The `dash-grid`'s left column: three `StatCard`s over `useUserMetrics()`.
 * The third card counts the unpracticed words (no case with an answer yet) and its meter shows the
 * share of translations practiced at least once. Both cover the words practice sees: own and followed. An
 * account with no translations to practice (no words, or no stored cases) gets an empty card with a link to add words:
 * a "0" and an empty meter would say nothing there.
 *
 * Under the cards, on a desktop, `QuickActions` (random practice, new word); the phone menu has them there.
 */
export function UserInfoPanel() {
    const { t } = useTranslation('dashboard');
    const { data: metrics, isPending } = useUserMetrics();

    if (isPending || !metrics) {
        return (
            <div className="stat-stack">
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <QuickActions />
            </div>
        );
    }

    const percent = practicedPercent(metrics);

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
            {metrics.translationsInPractice === 0 ? (
                <StatCard
                    value="—"
                    label={t('userInfoCards.unpracticedWords')}
                    sub={<Link to="/addWord/{-$partOfSpeech}">{t('userInfoCards.noWordsYet')}</Link>}
                />
            ) : (
                <StatCard
                    value={String(metrics.unpracticedWordsCount)}
                    label={t('userInfoCards.unpracticedWords')}
                    meterPercent={percent}
                    meterLabel={t('userInfoCards.practicedMeter')}
                    sub={t('userInfoCards.sub.practicedShare', { value: percent, done: metrics.practicedTranslations, total: metrics.translationsInPractice })}
                />
            )}
            <QuickActions />
        </div>
    );
}
