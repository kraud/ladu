import { TagIcon, XIcon } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { dismissOnboardingResult, useOnboardingResult } from '../resultCard';

/**
 * The dashboard card after Create (onboarding.md D28, `MOCKUPS/onboarding.html` banner): how many
 * words and topics were added, one link per new tag, a way into practice, and a close button.
 * It stays until closed, per browser.
 */
export function ResultCard() {
    const { t } = useTranslation();
    const userId = useAuthStore((s) => s.user?.id);
    const result = useOnboardingResult(userId);
    if (!result) return null;

    // The core vocabulary tag is not a picked topic.
    const topics = result.tags.filter((tag) => tag.topic !== 'core').length;

    return (
        <section className="ob-banner" aria-label={t('onboarding:result.label')}>
            <div className="ob-banner-head">
                <h2 className="ob-banner-title">{t('onboarding:result.title', { words: result.words, topics })}</h2>
                <p className="ob-banner-sub">{t('onboarding:result.text')}</p>
            </div>
            <Link to="/practice" className={buttonVariants({ size: 'sm', className: 'ob-banner-practise' })}>
                {t('onboarding:result.practise')}
            </Link>
            <button
                type="button"
                className="icon-btn ob-banner-close"
                aria-label={t('common:buttons.close')}
                onClick={dismissOnboardingResult}
            >
                <XIcon size={15} />
            </button>
            <div className="ob-banner-chips">
                {result.tags.map((tag) => (
                    <Link key={tag.id} to="/tag/$tagId" params={{ tagId: tag.id }} className="ob-banner-chip">
                        <TagIcon size={14} weight="bold" aria-hidden="true" />
                        {tag.label} <span className="c-num">· {tag.words}</span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
