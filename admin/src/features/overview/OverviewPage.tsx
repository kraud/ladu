import { useState, type ReactNode } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react';
import { errorMessage } from '@/api/client';
import { ColumnChart, type ColumnPoint } from '@/components/charts/ColumnChart';
import { HorizontalBars } from '@/components/charts/HorizontalBars';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StatTile } from '@/components/StatTile';
import { Button } from '@/components/ui/button';
import { useStats } from '@/features/stats/hooks';
import { formatCount, formatDayLong, formatDayShort, formatShare, formatWeek } from '@/features/stats/format';
import type { StatsResponse } from '@/features/stats/types';
import { formatDateTime } from '@/features/users/format';
import { useAuthStore } from '@/stores/authStore';

type SignupRange = 'daily' | 'weekly';
type ActiveWindow = 'daily' | 'weekly' | 'monthly';

function Card({ title, subtitle, controls, children }: { title: string; subtitle?: string; controls?: ReactNode; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-4 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-sm font-semibold">{title}</h2>
                    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                </div>
                {controls}
            </div>
            {children}
        </section>
    );
}

/** The number of new accounts in the newest 7 days, for the "Users" tile. */
const signupsLastWeek = (stats: StatsResponse) => stats.signups.daily.slice(-7).reduce((sum, day) => sum + day.count, 0);

function signupPoints(stats: StatsResponse, range: SignupRange): ColumnPoint[] {
    if (range === 'weekly') {
        const last = stats.signups.weekly.length - 1;
        return stats.signups.weekly.map((week, i) => ({
            key: week.weekStart,
            label: formatWeek(week.weekStart),
            axisLabel: formatDayShort(week.weekStart),
            value: week.count,
            partial: i === last,
            note: i === last ? 'This week is not over yet' : undefined,
        }));
    }
    return stats.signups.daily.map((day) => ({
        key: day.day,
        label: formatDayLong(day.day),
        axisLabel: formatDayShort(day.day),
        value: day.count,
        partial: day.day === stats.today,
        note: day.day === stats.today ? 'Today is not over yet' : undefined,
    }));
}

function activePoints(stats: StatsResponse, window: ActiveWindow): ColumnPoint[] {
    const { since } = stats.active;
    const prefix = window === 'weekly' ? '7 days to ' : window === 'monthly' ? '30 days to ' : '';

    return stats.active.points.map((point) => {
        const { count, partial } = point[window];
        const notes: string[] = [];
        if (count === null) notes.push(since ? `Counting started on ${formatDayShort(since)}` : 'Nothing is recorded yet');
        else if (partial) notes.push(window === 'daily' ? 'First day of counting: incomplete' : 'Counting started inside this period: a lower bound');
        if (point.day === stats.today && count !== null) notes.push('Today is not over yet');
        return {
            key: point.day,
            label: `${prefix}${formatDayLong(point.day)}`,
            axisLabel: formatDayShort(point.day),
            value: count,
            // Today's bar is not final either, so it is drawn like a lower bound.
            partial: partial || (point.day === stats.today && count !== null),
            note: notes.join('. ') || undefined,
        };
    });
}

/** "Active users" tile: the window that ends today. */
function activeTile(stats: StatsResponse, window: 'weekly' | 'monthly') {
    const today = stats.active.points[stats.active.points.length - 1];
    const { count, partial } = today?.[window] ?? { count: null, partial: false };
    if (count === null) return { value: '–', note: 'No data yet' };
    return { value: formatCount(count), note: partial && stats.active.since ? `Counting started on ${formatDayShort(stats.active.since)}: at least this many` : undefined };
}

export function OverviewPage() {
    const name = useAuthStore((s) => s.staff?.name);
    const { data, error, isPending, isError, isFetching, refetch, dataUpdatedAt } = useStats();
    const [signupRange, setSignupRange] = useState<SignupRange>('daily');
    const [activeWindow, setActiveWindow] = useState<ActiveWindow>('daily');

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Overview</h1>
                    <p className="text-sm text-muted-foreground">{name ? `Welcome, ${name}. ` : ''}Days and weeks are in UTC, and a week starts on Monday.</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {dataUpdatedAt > 0 && <span>Updated {formatDateTime(new Date(dataUpdatedAt).toISOString())}</span>}
                    <Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
                        <ArrowClockwise />
                        Refresh
                    </Button>
                </div>
            </div>

            {isPending && <p className="text-muted-foreground">Loading…</p>}

            {isError && (
                <div role="alert" className="flex flex-col items-start gap-2 rounded-md border border-destructive/40 bg-card p-3 text-sm">
                    <span className="font-medium text-destructive">The statistics could not be loaded.</span>
                    <span className="text-muted-foreground">{errorMessage(error, 'Could not load the statistics')}</span>
                    <Button size="sm" variant="outline" onClick={() => void refetch()}>
                        Try again
                    </Button>
                </div>
            )}

            {data && (
                // A reload keeps the page where it is, and only dims it: no skeleton, no jump.
                <div className={isFetching ? 'flex flex-col gap-6 opacity-60 transition-opacity' : 'flex flex-col gap-6 transition-opacity'}>
                    <div className="flex flex-col gap-2">
                        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                            <StatTile
                                label="Users"
                                value={formatCount(data.totals.users)}
                                note={`${signupsLastWeek(data) > 0 ? '+' : ''}${formatCount(signupsLastWeek(data))} in the last 7 days`}
                            />
                            <StatTile label="Verified" value={formatCount(data.totals.verified)} note={`${formatShare(data.totals.verified, data.totals.users)} of users`} />
                            <StatTile
                                label="Not verified"
                                value={formatCount(data.totals.unverified)}
                                note={`${formatShare(data.totals.unverified, data.totals.users)} of users`}
                            />
                            <StatTile label="Active, last 7 days" {...activeTile(data, 'weekly')} />
                            <StatTile label="Active, last 30 days" {...activeTile(data, 'monthly')} />
                            <StatTile label="Words" value={formatCount(data.totals.words)} />
                            <StatTile label="Translations" value={formatCount(data.totals.translations)} />
                            <StatTile label="Practised translations" value={formatCount(data.totals.practisedTranslations)} note="With a practice record" />
                            <StatTile label="Saved practice sessions" value={formatCount(data.totals.savedSessions)} note="Saved and not expired" />
                            <StatTile label="Tags" value={formatCount(data.totals.tags)} />
                        </dl>
                        <p className="text-xs text-muted-foreground">
                            Banned: {formatCount(data.totals.banned)} (counted as users) · Waiting to be deleted for good:{' '}
                            {formatCount(data.totals.pendingDeletion)} (not counted as users)
                        </p>
                    </div>

                    <Card
                        title="New accounts"
                        subtitle={signupRange === 'daily' ? 'Accounts created on each of the last 30 days' : 'Accounts created in each of the last 12 weeks'}
                        controls={
                            <SegmentedControl
                                label="Range"
                                value={signupRange}
                                onChange={setSignupRange}
                                options={[
                                    { value: 'daily', label: '30 days' },
                                    { value: 'weekly', label: '12 weeks' },
                                ]}
                            />
                        }
                    >
                        <ColumnChart
                            points={signupPoints(data, signupRange)}
                            unit="new accounts"
                            ariaLabel={signupRange === 'daily' ? 'New accounts for each of the last 30 days' : 'New accounts for each of the last 12 weeks'}
                            axisLabelEvery={signupRange === 'daily' ? 6 : 4}
                            emptyMessage="No new accounts in this period."
                            tableHeading={signupRange === 'daily' ? 'Day' : 'Week'}
                        />
                        <p className="text-xs text-muted-foreground">Accounts that were deleted for good are no longer counted.</p>
                    </Card>

                    <Card
                        title="Active users"
                        subtitle="Users who used the app on a day, or in the 7 or 30 days that end on it"
                        controls={
                            <SegmentedControl
                                label="Window"
                                value={activeWindow}
                                onChange={setActiveWindow}
                                options={[
                                    { value: 'daily', label: 'Each day' },
                                    { value: 'weekly', label: '7 days' },
                                    { value: 'monthly', label: '30 days' },
                                ]}
                            />
                        }
                    >
                        <ColumnChart
                            points={activePoints(data, activeWindow)}
                            unit="active users"
                            ariaLabel="Active users for each of the last 30 days"
                            axisLabelEvery={6}
                            emptyMessage={
                                data.active.since === null
                                    ? 'Nothing is recorded yet. Counting starts with the first request after this release.'
                                    : 'No active users in this period.'
                            }
                            tableHeading="Day"
                        />
                        <p className="text-xs text-muted-foreground">
                            {data.active.since === null
                                ? 'A user counts once for each day on which they used the app.'
                                : `Counting started on ${formatDayShort(data.active.since)}. Earlier days have no data. Lighter columns are lower bounds: the counting period is shorter than the window, or the day is not over yet.`}
                        </p>
                    </Card>

                    <Card title="Languages" subtitle="Users who chose each language. A user can choose several, so the shares add up to more than 100%.">
                        <HorizontalBars
                            rows={data.languages.map((row) => ({ label: row.language, value: row.users }))}
                            total={data.totals.users}
                            unit="users"
                            emptyMessage="No user has chosen a language yet."
                        />
                    </Card>
                </div>
            )}
        </div>
    );
}
