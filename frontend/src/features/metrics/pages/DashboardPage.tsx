import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@phosphor-icons/react';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { WelcomeBanner } from '@/features/metrics/components/WelcomeBanner';
import { useAuthStore } from '@/stores/authStore';

/**
 * Home (`/`). Phase 1: the welcome banner + an empty-state CTA to add words.
 * The full Dashboard — `getUserMetrics`, stat cards, the PoS pie and the
 * per-language / per-month bar — is Phase 3.5, and grows into this same
 * `features/metrics/` folder.
 */
export function DashboardPage() {
    const { t } = useTranslation();
    const name = useAuthStore((s) => s.user?.name ?? '');

    return (
        <div className="flex flex-col gap-8">
            <WelcomeBanner name={name} />
            <div className="card card-pad">
                <EmptyState
                    icon={<PlusIcon size={20} />}
                    title={t('dashboard:home.emptyTitle')}
                    description={t('dashboard:home.emptyDescription')}
                    action={
                        <Link to="/addWord/{-$partOfSpeech}" className={buttonVariants()}>
                            {t('dashboard:home.addFirstWords')}
                        </Link>
                    }
                />
            </div>
        </div>
    );
}
