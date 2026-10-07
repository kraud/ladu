/**
 * The word list (`/review`). Slice 6 shipped browse/page/select/both-empty-
 * states; Slice 7 adds the UI that WRITES the URL filters — the toolbar and
 * the bulk action bar (`.main-col` > toolbar + bulk bar + `<ReviewTable>`, per
 * the phase plan's "Composition" section — `ReviewTable` itself needs no
 * change, since its own early-return empty/error states would otherwise
 * swallow a toolbar nested inside it). Slice 8 adds the cell dialog.
 *
 * The filters live in the shared `SidebarLayout` (docked column on desktop,
 * slide-in menu on a phone — `sidebar-layout.md`); `useFilterSections` builds
 * their sections. On a phone the two display switches join them as a last
 * section, and the toolbar gets the "Filters" button that opens the menu.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { RowSelectionState } from '@tanstack/react-table';
import { PlusIcon, SlidersHorizontalIcon } from '@phosphor-icons/react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageColumn } from '@/components/layout/PageColumn';
import { SidebarLayout, SidebarTrigger, type SidebarSection } from '@/components/layout/sidebar/SidebarLayout';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/useMediaQuery';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { resolveLoadingToastError, resolveLoadingToastSuccess, startLoadingToast } from '@/lib/toast';
import { PartOfSpeech } from '@/ts/enums';
import { toPreselectedWord } from '@/features/practice/preselection';
import { useTagsByIds } from '@/features/tags/hooks';
import type { TagSummary } from '@/features/tags/types';
import { useBulkDeleteWords, useWordsInfinite } from '../hooks';
import { wordErrorKey } from '../errors';
import type { LangKey } from '../types';
import { BulkActionBar } from '../review/BulkActionBar';
import { CellDialog } from '../review/CellDialog';
import { DisplayOptions } from '../review/DisplayOptions';
import { activeFilterCount, useFilterSections } from '../review/FilterBar';
import { TagsDialog } from '../review/TagsDialog';
import { ReviewTable } from '../review/ReviewTable';
import { TableToolbar } from '../review/TableToolbar';
import { sortFilters, useLanguageSort } from '../review/useLanguageSort';
import {
    accountLanguageOrder,
    hasActiveFilters,
    resolveLanguageOrder,
    reviewSearchToFilters,
    type ReviewSearch,
} from '../review/search';

const route = getRouteApi('/_protected/words');

export function ReviewPage() {
    const { t } = useTranslation();
    const search = route.useSearch();
    const navigate = route.useNavigate();

    const isMobile = useIsMobile();

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

    const { sort, toggleSort } = useLanguageSort();
    const wordsQuery = useWordsInfinite({ ...filters, ...sortFilters(sort) });
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
    const [showOwner, setShowOwner] = useState(true);
    const [showPos, setShowPos] = useState(true);

    const bulkDelete = useBulkDeleteWords();

    // `useCallback` is load-bearing, not tidiness: `onOpenCell` sits in
    // `ReviewTable`'s own `columns` `useMemo` dep array (`ReviewTable.tsx`),
    // so an inline arrow here would rebuild every column on every render.
    const [cellTarget, setCellTarget] = useState<{ wordId: string; langKey: LangKey } | null>(null);
    const handleOpenCell = useCallback((wordId: string, langKey: LangKey) => setCellTarget({ wordId, langKey }), []);
    const closeCellDialog = useCallback(() => setCellTarget(null), []);
    const [tagsTarget, setTagsTarget] = useState<string | null>(null);
    const handleOpenTags = useCallback((wordId: string) => setTagsTarget(wordId), []);
    const closeTagsDialog = useCallback(() => setTagsTarget(null), []);
    const tagsRow = tagsTarget ? rows.find((row) => row.id === tagsTarget) : undefined;

    function updateSearch(patch: Partial<ReviewSearch>) {
        void navigate({ search: (prev) => ({ ...prev, ...patch }) });
    }

    const selectedIds = useMemo(
        () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
        [rowSelection],
    );

    // Ids-only in the URL (`ReviewSearch.tag`) resolved to full `TagSummary`s
    // for `TagCombobox`'s pill row — see `useTagsByIds`'s own doc comment.
    const selectedTagsQuery = useTagsByIds(search.tag ?? []);

    function handleView() {
        const [id] = selectedIds;
        if (id) void navigate({ to: '/word/$wordId', params: { wordId: id } });
    }

    // Selected rows -> the practice parameters screen (Phase 5, C4). Ids only are not enough: the
    // screen shows the words and limits the word types, so the rows' own data goes along.
    function handlePractice() {
        const chosen = new Set(selectedIds);
        const words = rows.filter((row) => chosen.has(row.id)).map((row) => toPreselectedWord(row, languages));
        if (words.length === 0) return;
        useUiStore.getState().setPracticePreselection(words);
        void navigate({ to: '/practice' });
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

    // `TagPickerDialog` (inside `BulkActionBar`) already ran the mutation by
    // the time this fires — just the toast + clearing the selection, same as
    // `handleBulkDelete` does after its own mutation succeeds. The toast
    // reports how many *words* were affected (`selectedIds`, captured before
    // the clear below), not how many tags were picked.
    function handleTagsApplied() {
        resolveLoadingToastSuccess(
            startLoadingToast(t('common:status.saving')),
            t('review:bulk.tagsAddedToast', { count: selectedIds.length }),
        );
        setRowSelection({});
    }

    const filterBarProps = {
        gender: search.gender ?? [],
        pos: search.pos ?? [],
        hasQuery: search.q !== undefined,
        selectedTags: selectedTagsQuery.data,
        activeLanguages: languages,
        allLanguages,
        onGenderChange: (next: string[] | undefined) => updateSearch({ gender: next }),
        onPosChange: (next: PartOfSpeech[] | undefined) => updateSearch({ pos: next }),
        onSelectedTagsChange: (next: TagSummary[]) =>
            updateSearch({ tag: next.length > 0 ? next.map((tag) => tag.id) : undefined }),
        onLanguagesChange: (next: LangKey[]) => updateSearch({ lang: next }),
    };

    const filterSections = useFilterSections(filterBarProps);
    // A phone has no room for the switches in the toolbar: they close the menu instead.
    const sections: SidebarSection[] = isMobile
        ? [
              ...filterSections,
              {
                  id: 'display',
                  label: t('review:filters.display'),
                  icon: <SlidersHorizontalIcon size={18} />,
                  content: (
                      <div className="flex flex-col gap-3">
                          <DisplayOptions
                              showGenderSwitch={hasNounRows}
                              showGender={showGender}
                              onShowGenderChange={setShowGender}
                              showProgress={showProgress}
                              onShowProgressChange={setShowProgress}
                              showOwner={showOwner}
                              onShowOwnerChange={setShowOwner}
                              showPos={showPos}
                              onShowPosChange={setShowPos}
                          />
                      </div>
                  ),
              },
          ]
        : filterSections;
    const activeCount = activeFilterCount(filterBarProps.gender, filterBarProps.pos, filterBarProps.hasQuery, filterBarProps.selectedTags.length);

    // The header's language gate already blocks navigating here below two
    // languages, but a direct URL bypasses it (`_protected.beforeLoad` only
    // checks the token) — guard the zero-column case rather than rendering
    // an empty table.
    if (languages.length === 0) {
        return (
            <PageColumn>
                <EmptyState
                    title={t('review:empty.noLanguages.title')}
                    description={t('review:empty.noLanguages.description')}
                    action={
                        <Link to="/user" className={buttonVariants()}>
                            {t('review:empty.noLanguages.action')}
                        </Link>
                    }
                />
            </PageColumn>
        );
    }

    return (
        <SidebarLayout
            id="review"
            label={t('review:filters.title')}
            sections={sections}
            fillHeight
            header={
                <div className="flex items-center justify-between gap-2">
                    <h1 className="h1">{t('review:page.title')}</h1>
                    <Link to="/addWord/{-$partOfSpeech}" className={buttonVariants()}>
                        <PlusIcon size={15} weight="bold" />
                        {t('review:page.newWord')}
                    </Link>
                </div>
            }
        >
            <div className="main-col min-h-0 flex-1">
                <TableToolbar
                    initialQuery={search.q ?? ''}
                    onQueryChange={(next) => updateSearch({ q: next })}
                    showSwitch={hasNounRows}
                    showGender={showGender}
                    onShowGenderChange={setShowGender}
                    showProgress={showProgress}
                    onShowProgressChange={setShowProgress}
                    showOwner={showOwner}
                    onShowOwnerChange={setShowOwner}
                    showPos={showPos}
                    onShowPosChange={setShowPos}
                    loadedCount={rows.length}
                    total={total}
                    compact={isMobile}
                    leading={
                        <SidebarTrigger
                            label={t('review:filters.title')}
                            className={cn(buttonVariants({ variant: 'outline', className: 'gap-2' }))}
                        >
                            <SlidersHorizontalIcon size={16} />
                            {t('review:filters.title')}
                            {activeCount > 0 && <span className="active-pill">{activeCount}</span>}
                        </SidebarTrigger>
                    }
                />
                    <BulkActionBar
                        selectedCount={selectedIds.length}
                        selectedWordIds={selectedIds}
                        onView={handleView}
                        onPractice={handlePractice}
                        onDelete={handleBulkDelete}
                        onTagsApplied={handleTagsApplied}
                        onClear={isMobile ? () => setRowSelection({}) : undefined}
                    />
                    <ReviewTable
                        rows={rows}
                        languages={languages}
                        userId={userId}
                        userName={userName}
                        showGender={showGender}
                        showProgress={showProgress}
                        showOwner={showOwner}
                        showPos={showPos}
                        isPending={wordsQuery.isPending}
                        isFetchingNextPage={wordsQuery.isFetchingNextPage}
                        isError={wordsQuery.isError}
                        error={wordsQuery.error}
                        hasNextPage={wordsQuery.hasNextPage}
                        total={total}
                        onFetchNextPage={() => void wordsQuery.fetchNextPage()}
                        onRetry={() => void wordsQuery.refetch()}
                        sort={sort}
                        onSort={toggleSort}
                        rowSelection={rowSelection}
                        onRowSelectionChange={setRowSelection}
                        hasActiveFilters={hasActiveFilters(search)}
                        onClearFilters={() => void navigate({ search: (prev) => ({ lang: prev.lang }) })}
                        onAddWord={() => void navigate({ to: '/addWord/{-$partOfSpeech}' })}
                        onOpenCell={handleOpenCell}
                        onOpenTags={handleOpenTags}
                        compact={isMobile}
                    />
            </div>

            {tagsRow && (
                <TagsDialog
                    key={tagsRow.id}
                    wordId={tagsRow.id}
                    tags={tagsRow.tags}
                    canEdit={tagsRow.user === userId}
                    onClose={closeTagsDialog}
                />
            )}

            {cellTarget && (
                <CellDialog
                    key={`${cellTarget.wordId}:${cellTarget.langKey}`}
                    wordId={cellTarget.wordId}
                    langKey={cellTarget.langKey}
                    onClose={closeCellDialog}
                    nativeLanguage={user?.nativeLanguage}
                    userLanguages={userLanguages}
                />
            )}
        </SidebarLayout>
    );
}
