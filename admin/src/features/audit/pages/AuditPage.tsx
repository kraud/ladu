import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { errorMessage } from '@/api/client';
import { FilterSelect } from '@/components/FilterSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AUDIT_PAGE_SIZE } from '@/features/audit/api';
import { describeMetadata, describeTarget } from '@/features/audit/describe';
import { useAudit, useAuditFilters } from '@/features/audit/hooks';
import type { AuditSearch } from '@/features/audit/search';
import { formatDateTime, NONE } from '@/features/users/format';

const COLUMNS = ['When', 'Staff', 'Action', 'About', 'Reason', 'Details'];

export function AuditPage() {
    const search = useSearch({ from: '/_protected/audit' });
    const navigate = useNavigate({ from: '/audit' });
    const { data, error, isError, isPending, isFetching, refetch } = useAudit(search);
    const filters = useAuditFilters();

    // Any change to a filter starts again at page 1.
    const update = (patch: Partial<AuditSearch>, options: { keepPage?: boolean } = {}) =>
        void navigate({
            search: (prev) => ({ ...prev, ...patch, ...(options.keepPage ? {} : { page: undefined }) }),
            replace: true,
        });

    const page = data?.page ?? search.page ?? 1;
    const from = data && data.total > 0 ? (page - 1) * data.pageSize + 1 : 0;
    const to = data ? Math.min(page * data.pageSize, data.total) : 0;
    const lastPage = data ? Math.max(1, Math.ceil(data.total / (data.pageSize || AUDIT_PAGE_SIZE))) : 1;
    const goToPage = (next: number) => update({ page: next > 1 ? next : undefined }, { keepPage: true });
    const hasFilter = Boolean(search.staff || search.action || search.from || search.to);

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-semibold">Audit log</h1>

            <div className="flex flex-wrap items-end gap-3">
                <FilterSelect
                    label="Staff"
                    value={search.staff}
                    options={[{ value: 'system', label: 'System (nightly job)' }, ...(filters.data?.staff.map((s) => ({ value: s.id, label: s.name })) ?? [])]}
                    onChange={(staff) => update({ staff })}
                />
                <FilterSelect
                    label="Action"
                    value={search.action}
                    options={filters.data?.actions.map((a) => ({ value: a, label: a })) ?? []}
                    onChange={(action) => update({ action })}
                />
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    From
                    <Input type="date" value={search.from ?? ''} max={search.to} onChange={(e) => update({ from: e.target.value || undefined })} className="w-40 font-normal" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    To
                    <Input type="date" value={search.to ?? ''} min={search.from} onChange={(e) => update({ to: e.target.value || undefined })} className="w-40 font-normal" />
                </label>
                {hasFilter && (
                    <Button variant="ghost" size="sm" onClick={() => update({ staff: undefined, action: undefined, from: undefined, to: undefined })}>
                        Clear filters
                    </Button>
                )}
            </div>

            {isError && (
                <div role="alert" className="flex items-center gap-3 rounded-md border border-destructive/40 bg-card p-3 text-sm">
                    <span className="text-destructive">{errorMessage(error, 'Could not load the audit log')}</span>
                    <Button size="sm" variant="outline" onClick={() => void refetch()}>
                        Try again
                    </Button>
                </div>
            )}

            <div className="overflow-x-auto rounded-lg border bg-card">
                <table className="w-full text-left text-sm">
                    <thead className="border-b bg-muted text-xs text-muted-foreground">
                        <tr>
                            {COLUMNS.map((label) => (
                                <th key={label} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className={isFetching && !isPending ? 'opacity-60' : undefined}>
                        {isPending && (
                            <tr>
                                <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-muted-foreground">
                                    Loading…
                                </td>
                            </tr>
                        )}
                        {data?.items.length === 0 && (
                            <tr>
                                <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-muted-foreground">
                                    {hasFilter ? 'No entries match these filters.' : 'No entries yet.'}
                                </td>
                            </tr>
                        )}
                        {data?.items.map((entry) => {
                            const target = describeTarget(entry);
                            return (
                                <tr key={entry.id} className="border-b align-top last:border-0">
                                    <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(entry.createdAt)}</td>
                                    <td className="px-3 py-2">{entry.staffName}</td>
                                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{entry.action}</td>
                                    <td className="px-3 py-2">
                                        {target.userId ? (
                                            <Link to="/users/$userId" params={{ userId: target.userId }} className="text-(--accent-strong) hover:underline">
                                                {target.text}
                                            </Link>
                                        ) : (
                                            target.text
                                        )}
                                    </td>
                                    <td className="px-3 py-2">{entry.reason ?? NONE}</td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">{describeMetadata(entry.metadata) || NONE}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span aria-live="polite">{data ? `${from}–${to} of ${data.total}` : ''}</span>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                        Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => goToPage(page + 1)}>
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
