import { WelcomeBanner } from '@/features/metrics/components/WelcomeBanner';
import { UserInfoPanel } from '@/features/metrics/components/UserInfoPanel';
import { MetricsPanel } from '@/features/metrics/components/MetricsPanel';
import { useAuthStore } from '@/stores/authStore';

/** Home (`/`) — the stat cards (`UserInfoPanel`) plus the chart panel (`MetricsPanel`), Phase 3.5. */
export function DashboardPage() {
    const name = useAuthStore((s) => s.user?.name ?? '');

    return (
        <div className="flex flex-col gap-8">
            <WelcomeBanner name={name} />
            <div className="dash-grid">
                <UserInfoPanel />
                <MetricsPanel />
            </div>
        </div>
    );
}
