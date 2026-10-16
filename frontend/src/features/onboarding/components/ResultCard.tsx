import { XIcon } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { dismissOnboardingResult, useOnboardingResult } from '../resultCard';

/**
 * The dashboard card after Create (onboarding.md D28): how many words and topics were added, one link
 * per new tag, a way into practice, and a close button. It stays until closed, per browser.
 */
export function ResultCard() {
    const { t } = useTranslation();
    const userId = useAuthStore((s) => s.user?.id);
    const result = useOnboardingResult(userId);
    if (!result) return null;

    // The core vocabulary tag is not a picked topic.
    const topics = result.tags.filter((tag) => tag.topic !== 'core').length;

    return (
        <section className="banner info flex flex-col gap-3" aria-label={t('onboarding:result.label')}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                    <h2 className="font-semibold">{t('onboarding:result.title', { words: result.words, topics })}</h2>
                    <p className="hint">{t('onboarding:result.text')}</p>
                </div>
                <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('common:buttons.close')}
                    onClick={dismissOnboardingResult}
                >
                    <XIcon size={18} />
                </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {result.tags.map((tag) => (
                    <Link key={tag.id} to="/tag/$tagId" params={{ tagId: tag.id }} className="chip">
                        {tag.label} · {tag.words}
                    </Link>
                ))}
            </div>
            <Link to="/practice" className={buttonVariants({ className: 'self-start' })}>
                {t('onboarding:result.practise')}
            </Link>
        </section>
    );
}
