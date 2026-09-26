/**
 * The word list (`/review`). Slice 6 shipped browse/page/select/both-empty-
 * states; Slice 7 adds the UI that WRITES the URL filters — the collapsible
 * filter bar, the toolbar, and the bulk action bar (`.layout` > filter bar +
 * `.main-col` > toolbar + bulk bar + `<ReviewTable>`, per the phase plan's
 * "Composition" section — `ReviewTable` itself needs no change, since its own
 * early-return empty/error states would otherwise swallow a toolbar nested
 * inside it). Slice 8 adds the cell dialog.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { RowSelectionState } from '@tanstack/react-table';
import { EmptyState } from '@/components/common/EmptyState';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/useMediaQuery';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { resolveLoadingToastError, resolveLoadingToastSuccess, startLoadingToast } from '@/lib/toast';
import { PartOfSpeech } from '@/ts/enums';
import { useBulkDeleteWords, useWordsInfinite } from '../hooks';
import { wordErrorKey } from '../errors';
import type { LangKey } from '../types';
import { BulkActionBar } from '../review/BulkActionBar';
import { CellDialog } from '../review/CellDialog';
import { FilterBar } from '../review/FilterBar';
import { MobileFilters } from '../review/MobileFilters';
import { ReviewTable } from '../review/ReviewTable';
import { TableToolbar } from '../review/TableToolbar';
import {
    accountLanguageOrder,
    hasActiveFilters,
    resolveLanguageOrder,
    reviewSearchToFilters,
    type ReviewSearch,
} from '../review/search';

const route = getRouteApi('/_protected/review');

export function ReviewPage() {
    const { t } = useTranslation();
    const search = route.useSearch();
    const navigate = route.useNavigate();

    const isMobile = useIsMobile();
    // Top/sidebar is a desktop choice; a phone gets the side menu (`MobileFilters`) instead.
    const filterPosition = useUiStore((s) => s.reviewFilterPosition);
    const filtersInSidebar = !isMobile && filterPosition === 'sidebar';

    const user = useAuthStore((s) => s.user);
    const userId = user?.id ?? '';
    const userName = user?.name ?? '';
    const userLanguages = user?.languages ?? [];

    const allLanguages = useMemo(() => accountLanguageOrder(userLanguages), [userLanguages]);
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
    // D14: the Display-gender switch is only useful once a noun is actually
    // on screen — driven by the loaded rows themselves, not by whether the
    // PoS *filter* happens to be narrowed to Noun (nouns show up in the
    // unfiltered list too).
    const hasNounRows = useMemo(() => rows.some((row) => row.partOfSpeech === PartOfSpeech.noun), [rows]);

    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    // A row selected under one filter set can drop out of the result set
    // under another — `getSelectedRowModel()` only sees loaded rows, so a
    // stale id in `rowSelection` would otherwise target an invisible word.
    useEffect(() => {
        setRowSelection({});
    }, [filtersKey]);

    // Not persisted in the URL (matches the mockup) — a display concern, not a filter.
    const [showGender, setShowGender] = useState(true);
    const [showProgress, setShowProgress] = useState(false);

    const bulkDelete = useBulkDeleteWords();

    // `useCallback` is load-bearing, not tidiness: `onOpenCell` sits in
    // `ReviewTable`'s own `columns` `useMemo` dep array (`ReviewTable.tsx`),
    // so an inline arrow here would rebuild every column on every render.
    const [cellTarget, setCellTarget] = useState<{ wordId: string; langKey: LangKey } | null>(null);
    const handleOpenCell = useCallback((wordId: string, langKey: LangKey) => setCellTarget({ wordId, langKey }), []);
    const closeCellDialog = useCallback(() => setCellTarget(null), []);

    function updateSearch(patch: Partial<ReviewSearch>) {
        void navigate({ search: (prev) => ({ ...prev, ...patch }) });
    }

    const selectedIds = useMemo(
        () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
        [rowSelection],
    );

    function handleView() {
        const [id] = selectedIds;
        if (id) void navigate({ to: '/word/$wordId', params: { wordId: id } });
    }

    function handleBulkDelete() {
        const ids = selectedIds;
        if (ids.length === 0) return;
        const toastId = startLoadingToast(t('common:status.saving'));
        bulkDelete.mutate(ids, {
            onSuccess: () => {
                resolveLoadingToastSuccess(toastId, t('review:bulk.deletedToast', { count: ids.length }));
                setRowSelection({});
            },
            onError: (error) => {
                resolveLoadingToastError(toastId, t(wordErrorKey(error)));
            },
        });
    }

    // Shared by the inline `FilterBar` (desktop) and `MobileFilters` (phone).
    const filterBarProps = {
        gender: search.gender ?? [],
        pos: search.pos ?? [],
        hasQuery: search.q !== undefined,
        activeLanguages: languages,
        allLanguages,
        onGenderChange: (next: string[] | undefined) => updateSearch({ gender: next }),
        onPosChange: (next: PartOfSpeech[] | undefined) => updateSearch({ pos: next }),
        onLanguagesChange: (next: LangKey[]) => updateSearch({ lang: next }),
    };

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
            <div
                className={cn('layout', filtersInSidebar && 'flex items-start gap-4')}
            >
                {!isMobile && <FilterBar {...filterBarProps} />}
                <div className={cn('main-col', filtersInSidebar && 'flex-1')}>
                    <TableToolbar
                        initialQuery={search.q ?? ''}
                        onQueryChange={(next) => updateSearch({ q: next })}
                        showSwitch={hasNounRows}
                        showGender={showGender}
                        onShowGenderChange={setShowGender}
                        showProgress={showProgress}
                        onShowProgressChange={setShowProgress}
                        loadedCount={rows.length}
                        total={total}
                        hideDisplayOptions={isMobile}
                        leading={
                            isMobile ? (
                                <MobileFilters
                                    {...filterBarProps}
                                    showGenderSwitch={hasNounRows}
                                    showGender={showGender}
                                    onShowGenderChange={setShowGender}
                                    showProgress={showProgress}
                                    onShowProgressChange={setShowProgress}
                                />
                            ) : undefined
                        }
                    />
                    <BulkActionBar
                        selectedCount={selectedIds.length}
                        onView={handleView}
                        onDelete={handleBulkDelete}
                    />
                    <ReviewTable
                        rows={rows}
                        languages={languages}
                        userId={userId}
                        userName={userName}
                        showGender={showGender}
                        showProgress={showProgress}
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
                        onOpenCell={handleOpenCell}
                    />
                </div>
            </div>

            {cellTarget && (
                <CellDialog
                    key={`${cellTarget.wordId}:${cellTarget.langKey}`}
                    wordId={cellTarget.wordId}
                    langKey={cellTarget.langKey}
                    onClose={closeCellDialog}
                />
            )}
        </div>
    );
}
