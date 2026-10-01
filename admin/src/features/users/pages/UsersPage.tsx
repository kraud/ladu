import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowDown, ArrowUp } from '@phosphor-icons/react';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FilterSelect } from '@/components/FilterSelect';
import { StatusBadge } from '@/features/users/components/StatusBadge';
import { formatDate, formatDateTimeWithCountry, NONE } from '@/features/users/format';
import { useUsers } from '@/features/users/hooks';
import { DEFAULT_ORDER, DEFAULT_SORT, type SortKey, type UsersSearch } from '@/features/users/search';

const SEARCH_DELAY_MS = 300;

const COLUMNS: { label: string; sort?: SortKey }[] = [
    { label: 'Name', sort: 'name' },
    { label: 'Email', sort: 'email' },
    { label: 'Status' },
    { label: 'Sign-in' },
    { label: 'Registered', sort: 'createdAt' },
    { label: 'Last login', sort: 'lastLoginAt' },
    { label: 'Last seen', sort: 'lastSeenAt' },
];

export function UsersPage() {
    const search = useSearch({ from: '/_protected/users' });
    const navigate = useNavigate({ from: '/users' });
    const { data, error, isError, isPending, isFetching, refetch } = useUsers(search);

    // Any change to the filters, the sort or the text starts again at page 1.
    const update = (patch: Partial<UsersSearch>, options: { keepPage?: boolean } = {}) =>
        void navigate({
            search: (prev) => ({ ...prev, ...patch, ...(options.keepPage ? {} : { page: undefined }) }),
            replace: true,
        });

    // The box keeps its own text so typing is not slowed by the request; the
    // URL (and so the query) follows after a short pause.
    const [text, setText] = useState(search.q ?? '');
    useEffect(() => {
        const trimmed = text.trim();
        if (trimmed === (search.q ?? '')) return;
        const timer = setTimeout(() => update({ q: trimmed || undefined }), SEARCH_DELAY_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `update` is recreated each render; only the text and the URL value matter.
    }, [text, search.q]);

    const sort = search.sort ?? DEFAULT_SORT;
    const order = search.order ?? DEFAULT_ORDER;
    const toggleSort = (key: SortKey) => {
        if (key === sort) update({ order: order === 'asc' ? 'desc' : 'asc' });
        // A text column starts A–Z; a date column starts newest first.
        else update({ sort: key, order: key === 'name' || key === 'email' ? 'asc' : 'desc' });
    };

    const page = data?.page ?? search.page ?? 1;
    const from = data && data.total > 0 ? (page - 1) * data.pageSize + 1 : 0;
    const to = data ? Math.min(page * data.pageSize, data.total) : 0;
    const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
    const goToPage = (next: number) => update({ page: next > 1 ? next : undefined }, { keepPage: true });

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-semibold">Users</h1>

            <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Search
                    <Input
                        type="search"
                        placeholder="Email, username or name"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="font-normal"
                    />
                </label>
                <FilterSelect
                    label="Status"
                    value={search.status}
                    options={[
                        { value: 'active', label: 'Active' },
                        { value: 'banned', label: 'Banned' },
                        { value: 'deleted', label: 'Deleted' },
                    ]}
                    onChange={(status) => update({ status: status as UsersSearch['status'] })}
                />
                <FilterSelect
                    label="Verified"
                    value={search.verified}
                    options={[
                        { value: 'true', label: 'Verified' },
                        { value: 'false', label: 'Not verified' },
                    ]}
                    onChange={(verified) => update({ verified: verified as UsersSearch['verified'] })}
                />
                <FilterSelect
                    label="Sign-in method"
                    value={search.method}
                    options={[
                        { value: 'password', label: 'Password' },
                        { value: 'google', label: 'Google' },
                    ]}
                    onChange={(method) => update({ method: method as UsersSearch['method'] })}
                />
            </div>

            {isError && (
                <div role="alert" className="flex items-center gap-3 rounded-md border border-destructive/40 bg-card p-3 text-sm">
                    <span className="text-destructive">{errorMessage(error, 'Could not load users')}</span>
                    <Button size="sm" variant="outline" onClick={() => void refetch()}>
                        Try again
                    </Button>
                </div>
            )}

            <div className="overflow-x-auto rounded-lg border bg-card">
                <table className="w-full text-left text-sm">
                    <thead className="border-b bg-muted text-xs text-muted-foreground">
                        <tr>
                            {COLUMNS.map((column) => (
                                <th
                                    key={column.label}
                                    scope="col"
                                    className="px-3 py-2 font-medium whitespace-nowrap"
                                    aria-sort={column.sort === sort ? (order === 'asc' ? 'ascending' : 'descending') : undefined}
                                >
                                    {column.sort ? (
                                        <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(column.sort as SortKey)}>
                                            {column.label}
                                            {column.sort === sort && (order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                        </button>
                                    ) : (
                                        column.label
                                    )}
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
                                    No users match.
                                </td>
                            </tr>
                        )}
                        {data?.items.map((user) => (
                            <tr key={user.id} className="border-b last:border-0 hover:bg-muted/50">
                                <td className="px-3 py-2">
                                    <Link to="/users/$userId" params={{ userId: user.id }} className="font-medium text-(--accent-strong) hover:underline">
                                        {user.name}
                                    </Link>
                                    <div className="text-xs text-muted-foreground">@{user.username}</div>
                                </td>
                                <td className="px-3 py-2">{user.email}</td>
                                <td className="px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-1">
                                        <StatusBadge status={user.status} />
                                        {!user.verified && <span className="text-xs text-muted-foreground">not verified</span>}
                                    </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    {[user.hasPassword && 'Password', user.hasGoogle && 'Google'].filter(Boolean).join(' + ') || NONE}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">{formatDate(user.createdAt)}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{formatDateTimeWithCountry(user.lastLoginAt, user.lastLoginCountry)}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{formatDateTimeWithCountry(user.lastSeenAt, null)}</td>
                            </tr>
                        ))}
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
