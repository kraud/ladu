import type { ReactNode } from 'react';
import { cn } from 'cn';
import { Skeleton } from '@/components/ui/skeleton';

interface StatCardProps {
    value: string;
    label: string;
    /** A one-line sub-caption below the number, or below the meter when both are given. */
    sub?: ReactNode;
    /** Renders a filled `.meter` bar between the number and `sub` (0-100, clamped). */
    meterPercent?: number;
    /** Accessible name of the meter, when it measures something other than `label`. */
    meterLabel?: string;
    /** Amber number + amber meter fill (not used by the dashboard cards now). */
    warn?: boolean;
}

/** Fill width in percent: clamped to 0-100, and at least 2% while there is progress, so a small share is still visible. */
const meterWidth = (percent: number) => (percent <= 0 ? 0 : Math.min(100, Math.max(2, percent)));

/**
 * One `dash-grid` stat tile: a big number, a label, and either a text
 * sub-line or a percent meter. Pure presentation — `UserInfoPanel` derives
 * every value via `selectors.ts` and owns the loading/data split.
 */
export function StatCard({ value, label, sub, meterPercent, meterLabel, warn }: StatCardProps) {
    return (
        <div className={cn('card stat-card', warn && 'warn')}>
            <div className="s-num num">{value}</div>
            <div className="s-label">{label}</div>
            {meterPercent != null && (
                <div
                    className="meter"
                    role="progressbar"
                    aria-label={meterLabel ?? label}
                    aria-valuenow={meterPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <span style={{ width: `${meterWidth(meterPercent)}%` }} />
                </div>
            )}
            {sub && <div className="s-sub">{sub}</div>}
        </div>
    );
}

/** Loading placeholder for `StatCard`, matching the mockup's `.sk-num`/`.sk-label` sizes. */
export function StatCardSkeleton() {
    return (
        <div className="card stat-card">
            <Skeleton className="sk-num" />
            <Skeleton className="sk-label" />
        </div>
    );
}
