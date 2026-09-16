import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@phosphor-icons/react';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { WelcomeBanner } from '@/features/metrics/components/WelcomeBanner';
import { UserInfoPanel } from '@/features/metrics/components/UserInfoPanel';
import { useAuthStore } from '@/stores/authStore';

/**
 * Home (`/`). Phase 3.5 Slice 3 adds the `getUserMetrics`-backed stat cards
 * (`UserInfoPanel`) in the `dash-grid`'s left column; the right column (the
 * PoS pie + month/language bar) is Slices 4-5, and the empty-state gate on
 * `totalWords === 0` (currently unconditional) is Slice 6.
 */
export function DashboardPage() {
    const { t } = useTranslation();
    const name = useAuthStore((s) => s.user?.name ?? '');

    return (
        <div className="flex flex-col gap-8">
            <WelcomeBanner name={name} />
            <div className="dash-grid">
                <UserInfoPanel />
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
        </div>
    );
}
