import type { ReactNode } from 'react';
import { ArrowClockwise, ArrowSquareOut } from '@phosphor-icons/react';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/features/users/format';
import { useHealth } from '@/features/health/hooks';
import { formatAgo, formatBytes, formatUptime, TABLE_LABELS } from '@/features/health/format';
import { EXTERNAL_LINKS } from '@/features/health/links';
import type { BackupEvent, HealthResponse } from '@/features/health/types';

// A nightly backup that is older than this has missed a night (with some slack);
// the weekly restore test, likewise.
const BACKUP_STALE_HOURS = 26;
const RESTORE_TEST_STALE_DAYS = 8;

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">{title}</h2>
            {children}
        </section>
    );
}

function Field({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
    return (
        <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm break-words" title={title}>
                {children}
            </dd>
        </div>
    );
}

const Grid = ({ children }: { children: ReactNode }) => (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">{children}</dl>
);

function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'bad'; children: ReactNode }) {
    const styles = { ok: 'bg-emerald-100 text-emerald-800', warn: 'bg-amber-100 text-amber-900', bad: 'bg-red-100 text-red-800' };
    return <span className={cn('rounded-md px-1.5 py-0.5 text-xs font-medium', styles[tone])}>{children}</span>;
}

/** One backup or restore-test line: when it ran, how long ago, and whether it needs attention. */
function EventRow({ label, event, staleAfterHours, emptyText }: { label: string; event: BackupEvent | null; staleAfterHours: number; emptyText: string }) {
    if (!event) {
        return (
            <Field label={label}>
                <span className="text-muted-foreground">{emptyText}</span>
            </Field>
        );
    }
    const stale = Date.now() - new Date(event.at).getTime() > staleAfterHours * 3_600_000;
    return (
        <Field label={label}>
            <div className="flex flex-wrap items-center gap-2">
                <span>{formatDateTime(event.at)}</span>
                <span className="text-muted-foreground">({formatAgo(event.at)})</span>
                {!event.ok && <Pill tone="bad">Failed</Pill>}
                {event.ok && stale && <Pill tone="warn">Overdue</Pill>}
                {event.ok && !stale && <Pill tone="ok">OK</Pill>}
            </div>
            {event.detail && <div className="text-xs text-muted-foreground">{event.detail}</div>}
        </Field>
    );
}

function ServiceSection({ service }: { service: HealthResponse['service'] }) {
    return (
        <Section title="Service">
            <Grid>
                <Field label="Database">
                    {service.database === 'ok' ? <Pill tone="ok">Answers</Pill> : <Pill tone="bad">Does not answer</Pill>}
                </Field>
                <Field label="Environment">{service.environment}</Field>
                <Field label="Version (commit)" title={service.sha}>
                    <code className="font-mono">{service.sha.slice(0, 7)}</code>
                </Field>
                <Field label="Backend uptime">{formatUptime(service.uptimeSeconds)}</Field>
                <Field label="Node.js">{service.nodeVersion}</Field>
            </Grid>
        </Section>
    );
}

export function HealthPage() {
    const { data, error, isPending, isError, isFetching, refetch, dataUpdatedAt } = useHealth();

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold">Health</h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {dataUpdatedAt > 0 && <span>Checked {formatDateTime(new Date(dataUpdatedAt).toISOString())}</span>}
                    <Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
                        <ArrowClockwise />
                        Refresh
                    </Button>
                </div>
            </div>

            {isPending && <p className="text-muted-foreground">Loading…</p>}

            {isError && (
                <div role="alert" className="flex flex-col items-start gap-2 rounded-md border border-destructive/40 bg-card p-3 text-sm">
                    <span className="font-medium text-destructive">The admin API did not answer the health check.</span>
                    <span className="text-muted-foreground">{errorMessage(error, 'Could not load the health data')}</span>
                </div>
            )}

            {data && (
                <>
                    <ServiceSection service={data.service} />

                    <Section title="Database">
                        {data.database ? (
                            <>
                                <Grid>
                                    <Field label="Size">{formatBytes(data.database.sizeBytes)}</Field>
                                    <Field label="Latest migration">
                                        {data.database.migration.latest ?? <span className="text-muted-foreground">Not in this build</span>}
                                    </Field>
                                    <Field label="Migrations applied">{data.database.migration.appliedCount}</Field>
                                </Grid>
                                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                                    {Object.entries(data.database.tables).map(([name, n]) => (
                                        <div key={name} className="rounded-md bg-muted p-3">
                                            <dt className="text-xs text-muted-foreground">{TABLE_LABELS[name] ?? name}</dt>
                                            <dd className="text-xl font-semibold">{n.toLocaleString('en-GB')}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">Not available: the database does not answer.</p>
                        )}
                    </Section>

                    <Section title="Backups">
                        {data.backups ? (
                            <>
                                <Grid>
                                    <EventRow
                                        label="Last nightly backup"
                                        event={data.backups.lastBackup}
                                        staleAfterHours={BACKUP_STALE_HOURS}
                                        emptyText="None recorded"
                                    />
                                    <EventRow
                                        label="Last restore test"
                                        event={data.backups.lastRestoreTest}
                                        staleAfterHours={RESTORE_TEST_STALE_DAYS * 24}
                                        emptyText="None recorded"
                                    />
                                </Grid>
                                {!data.backups.lastBackup && !data.backups.lastRestoreTest && (
                                    <p className="text-sm text-muted-foreground">
                                        Only production is backed up, so staging never shows a backup. On production, a first backup
                                        appears after the next nightly run with the updated script.
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">Not available: the database does not answer.</p>
                        )}
                    </Section>
                </>
            )}

            <Section title="More detail in other tools">
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {EXTERNAL_LINKS.map((link) => (
                        <li key={link.href}>
                            <a
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
                            >
                                <span>
                                    <span className="font-medium text-(--accent-strong)">{link.label}</span>
                                    <span className="block text-xs text-muted-foreground">{link.description}</span>
                                </span>
                                <ArrowSquareOut size={14} className="mt-1 text-muted-foreground" />
                            </a>
                        </li>
                    ))}
                </ul>
            </Section>
        </div>
    );
}
