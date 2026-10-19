import { errorMessage } from '@/api/client';
import { StatTile } from '@/components/StatTile';
import { HorizontalBars } from '@/components/charts/HorizontalBars';
import { cn } from '@/lib/utils';
import { formatCount, formatShare } from '@/features/stats/format';
import { formatDateTime, NONE } from '@/features/users/format';
import { useDemoStats, useDemoUsers } from '@/features/access/hooks';
import { DEMO_USERS_LIMIT, type DemoRefusalCode, type DemoUserRow } from '@/features/access/types';

/**
 * The demo usage banner and the demo accounts table, under the demo settings (demo-access.md D19,
 * D20). Read-only. The numbers come from the start log, which stays after the nightly purge; the
 * table shows the demo accounts that are on the DB now.
 */
export function DemoActivity() {
    return (
        <>
            <DemoUsage />
            <DemoAccounts />
        </>
    );
}

const REFUSALS: { code: DemoRefusalCode; label: string }[] = [
    { code: 'demo_busy', label: 'All live demos in use' },
    { code: 'demo_rate_limited', label: 'Too many from one network' },
    { code: 'demo_disabled', label: 'Demo off' },
    { code: 'demo_unavailable', label: 'No demo template' },
    { code: 'captcha_failed', label: 'Failed human check' },
];

const average = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });

function DemoUsage() {
    const { data, error, isPending } = useDemoStats();

    return (
        <section aria-labelledby="demo-usage-heading" className="flex flex-col gap-4 rounded-lg border bg-card p-4">
            <div>
                <h3 id="demo-usage-heading" className="text-lg font-semibold">
                    Demo usage
                </h3>
                <p className="text-sm text-muted-foreground">
                    From the log of demo starts. It keeps the numbers after the nightly purge deletes the demo accounts.
                </p>
            </div>

            {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {errorMessage(error, 'Could not load the demo usage')}
                </p>
            )}

            {data && (
                <>
                    <dl aria-label="Demo starts" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <StatTile label="Started, last 24 hours" value={formatCount(data.starts.last24h)} />
                        <StatTile label="Started, last 7 days" value={formatCount(data.starts.last7d)} />
                        <StatTile label="Started, last 30 days" value={formatCount(data.starts.last30d)} />
                        <StatTile label="Started, all time" value={formatCount(data.starts.total)} />
                        <StatTile label="Live now" value={formatCount(data.runningNow)} />
                    </dl>

                    <div className="flex flex-col gap-2">
                        <h4 className="text-sm font-semibold">
                            What visitors do <span className="font-normal text-muted-foreground">(demos started in the last {data.windowDays} days: {formatCount(data.engagement.demos)})</span>
                        </h4>
                        <dl aria-label="What visitors do" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <StatTile label="Words added per demo" value={average(data.engagement.avgWordsAdded)} />
                            <StatTile label="Tags added per demo" value={average(data.engagement.avgTagsAdded)} />
                            <StatTile label="Translations practised per demo" value={average(data.engagement.avgTranslationsPractised)} />
                            <StatTile
                                label="Added at least one word"
                                value={formatShare(data.engagement.addedAWord, data.engagement.demos)}
                                note={`${formatCount(data.engagement.addedAWord)} of ${formatCount(data.engagement.demos)} demos`}
                            />
                            <StatTile
                                label="Reached the word cap"
                                value={formatShare(data.caps.reachedWordCap, data.caps.wordCapDemos)}
                                note={`${formatCount(data.caps.reachedWordCap)} of ${formatCount(data.caps.wordCapDemos)} demos with a word cap`}
                            />
                            <StatTile
                                label="Reached the tag cap"
                                value={formatShare(data.caps.reachedTagCap, data.caps.tagCapDemos)}
                                note={`${formatCount(data.caps.reachedTagCap)} of ${formatCount(data.caps.tagCapDemos)} demos with a tag cap`}
                            />
                        </dl>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="flex flex-col gap-2">
                            <h4 className="text-sm font-semibold">Refused starts, last {data.refusalWindowDays} days</h4>
                            <dl aria-label="Refused starts" className="flex flex-col gap-1 text-sm">
                                {REFUSALS.map(({ code, label }) => (
                                    <div key={code} className="flex justify-between gap-3">
                                        <dt className="text-muted-foreground">{label}</dt>
                                        <dd className="font-medium">{formatCount(data.refusals[code])}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                        <div className="flex flex-col gap-2">
                            <h4 className="text-sm font-semibold">Languages picked</h4>
                            <HorizontalBars
                                rows={data.languages.map((l) => ({ label: l.language, value: l.count }))}
                                total={data.starts.last30d}
                                unit="demos"
                                emptyMessage="No demo yet."
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <h4 className="text-sm font-semibold">App language</h4>
                            <HorizontalBars
                                rows={data.uiLanguages.map((l) => ({ label: l.language, value: l.count }))}
                                total={data.starts.last30d}
                                unit="demos"
                                emptyMessage="No demo yet."
                            />
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}

const STATUS: Record<DemoUserRow['status'], { label: string; className: string }> = {
    live: { label: 'Live', className: 'bg-emerald-100 text-emerald-800' },
    expired: { label: 'Expired', className: 'bg-muted text-muted-foreground' },
};

/** "3 / 30": what the demo added against its cap; only the count when there is no cap to show. */
const ofCap = (value: number | null, cap: number | null) => (value === null ? NONE : cap === null ? String(value) : `${value} / ${cap}`);

function DemoAccounts() {
    const { data, error, isPending } = useDemoUsers();

    return (
        <section aria-labelledby="demo-accounts-heading" className="flex flex-col gap-4 rounded-lg border bg-card p-4">
            <div>
                <h3 id="demo-accounts-heading" className="text-lg font-semibold">
                    Demo accounts {data && <span className="text-sm font-normal text-muted-foreground">({formatCount(data.total)})</span>}
                </h3>
                <p className="text-sm text-muted-foreground">
                    The demo accounts on the database now. An expired demo stays until the nightly purge deletes it. Words and tags are the
                    ones the visitor added on top of the sample data, against the demo's cap.
                    {data && data.total > data.rows.length && ` Only the newest ${DEMO_USERS_LIMIT} are shown.`}
                </p>
            </div>

            {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {errorMessage(error, 'Could not load the demo accounts')}
                </p>
            )}

            {data && (
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b bg-muted text-xs text-muted-foreground">
                            <tr>
                                {['Status', 'Started', 'Ends', 'Languages', 'App language', 'Words', 'Tags', 'Saved configs', 'Practised'].map((label) => (
                                    <th key={label} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                                        {label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                                        There is no demo account on the database.
                                    </td>
                                </tr>
                            )}
                            {data.rows.map((row) => (
                                <tr key={row.id} className="border-b last:border-0">
                                    <td className="px-3 py-2">
                                        <span className={cn('rounded-md px-1.5 py-0.5 text-xs font-medium', STATUS[row.status].className)}>
                                            {STATUS[row.status].label}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.startedAt)}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.expiresAt)}</td>
                                    <td className="px-3 py-2">{row.languages.join(', ')}</td>
                                    <td className="px-3 py-2">{row.uiLanguage ?? NONE}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{ofCap(row.wordsAdded, row.maxWords)}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{ofCap(row.tagsAdded, row.maxTags)}</td>
                                    <td className="px-3 py-2">{row.configsAdded ?? NONE}</td>
                                    <td className="px-3 py-2">{row.translationsPractised ?? NONE}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
