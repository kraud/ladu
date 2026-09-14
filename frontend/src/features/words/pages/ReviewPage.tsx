/**
 * The word list (`/review`). Slice 6 scope: browse, page in more, select
 * rows (own words only), and both empty states. Filters read from the URL
 * are already applied server-side (D10) — the UI to WRITE them (chips,
 * search box, language drag) is Slice 7; the cell dialog is Slice 8.
 */
import { useEffect, useMemo, useState } from 'react';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { RowSelectionState } from '@tanstack/react-table';
import { EmptyState } from '@/components/common/EmptyState';
import { buttonVariants } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { useWordsInfinite } from '../hooks';
import { ReviewTable } from '../review/ReviewTable';
import { hasActiveFilters, resolveLanguageOrder, reviewSearchToFilters } from '../review/search';

const route = getRouteApi('/_protected/review');

export function ReviewPage() {
    const { t } = useTranslation();
    const search = route.useSearch();
    const navigate = route.useNavigate();

    const user = useAuthStore((s) => s.user);
    const userId = user?.id ?? '';
    const userName = user?.name ?? '';
    const userLanguages = user?.languages ?? [];

    const languages = useMemo(
        () => resolveLanguageOrder(search.lang, userLanguages),
        [search.lang, userLanguages],
    );

    const filters = useMemo(() => reviewSearchToFilters(search), [search]);
    const filtersKey = JSON.stringify(filters);

    const wordsQuery = useWordsInfinite(filters);
    const rows = useMemo(
        () => wordsQuery.data?.pages.flatMap((page) => page.items) ?? [],
        [wordsQuery.data],
    );
    const total = wordsQuery.data?.pages[0]?.total ?? 0;

    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    // A row selected under one filter set can drop out of the result set
    // under another — `getSelectedRowModel()` only sees loaded rows, so a
    // stale id in `rowSelection` would otherwise target an invisible word.
    useEffect(() => {
        setRowSelection({});
    }, [filtersKey]);

    // The header's language gate already blocks navigating here below two
    // languages, but a direct URL bypasses it (`_protected.beforeLoad` only
    // checks the token) — guard the zero-column case rather than rendering
    // an empty table.
    if (languages.length === 0) {
        return (
            <EmptyState
                title={t('review:empty.noLanguages.title')}
                description={t('review:empty.noLanguages.description')}
                action={
                    <Link to="/user" className={buttonVariants()}>
                        {t('review:empty.noLanguages.action')}
                    </Link>
                }
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <h1 className="h1">{t('common:header.review')}</h1>
            <ReviewTable
                rows={rows}
                languages={languages}
                userId={userId}
                userName={userName}
                showGender
                isPending={wordsQuery.isPending}
                isFetchingNextPage={wordsQuery.isFetchingNextPage}
                isError={wordsQuery.isError}
                error={wordsQuery.error}
                hasNextPage={wordsQuery.hasNextPage}
                total={total}
                onFetchNextPage={() => void wordsQuery.fetchNextPage()}
                onRetry={() => void wordsQuery.refetch()}
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
                hasActiveFilters={hasActiveFilters(search)}
                onClearFilters={() => void navigate({ search: (prev) => ({ lang: prev.lang }) })}
                onAddWord={() => void navigate({ to: '/addWord/{-$partOfSpeech}' })}
            />
        </div>
    );
}
