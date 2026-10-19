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
import { FunnelIcon, PlusIcon, SlidersHorizontalIcon, TranslateIcon } from '@phosphor-icons/react';
import { PageTitle } from '@/components/common/PageTitle';
import { EmptyState } from '@/components/common/EmptyState';
import { PageColumn } from '@/components/layout/PageColumn';
import { SidebarLayout, SidebarTrigger, type SidebarSection } from '@/components/layout/sidebar/SidebarLayout';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/useMediaQuery';
import { pageCountFor, readStoredPageSize, storePageSize, type PageSize } from '@/lib/pagination';
import { useAuthStore } from '@/stores/authStore';
import { resolveLoadingToastError, resolveLoadingToastSuccess, startLoadingToast } from '@/lib/toast';
import { PartOfSpeech } from '@/ts/enums';
import { useTagsByIds } from '@/features/tags/hooks';
import type { TagSummary } from '@/features/tags/types';
import { useBulkDeleteWords, useWordsPage } from '../hooks';
import { wordErrorKey } from '../errors';
import type { LangKey, WordOwner } from '../types';
import { BulkActionBar } from '../review/BulkActionBar';
import { CellDialog } from '../review/CellDialog';
import { OpenWordDialog } from '../review/OpenWordDialog';
import { buildDisplaySection } from '../review/DisplayOptions';
import { LanguageOrderControl } from '../review/LanguageOrderControl';
import { activeFilterCount, useFilterSections } from '../review/FilterBar';
import { TagsDialog } from '../review/TagsDialog';
import { ReviewTable } from '../review/ReviewTable';
import { TableToolbar } from '../review/TableToolbar';
import { useWordSelection } from '../review/useWordSelection';
import { nextLanguageSort, sortFilters } from '../review/useLanguageSort';
import {
    accountLanguageOrder,
    hasActiveFilters,
    resolveLanguageOrder,
    reviewSearchToFilters,
    reviewSearchToSort,
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

    // Sort, page and page size live in the URL (the page size falls back to the one the user chose last).
    const sort = useMemo(
        () => reviewSearchToSort({ sort: search.sort, dir: search.dir }),
        [search.sort, search.dir],
    );
    const storedPageSize = useMemo(readStoredPageSize, []);
    const pageSize: PageSize = search.size ?? storedPageSize;
    const page = search.page ?? 1;

    const wordsQuery = useWordsPage({ ...filters, ...sortFilters(sort) }, { page, pageSize });
    const rows = useMemo(() => wordsQuery.data?.items ?? [], [wordsQuery.data]);
    const total = wordsQuery.data?.total ?? 0;
    const pageCount = pageCountFor(total, pageSize);
    // D14: the Display-gender switch is only useful once a noun is actually
    // on screen — driven by the loaded rows themselves, not by whether the
    // PoS *filter* happens to be narrowed to Noun (nouns show up in the
    // unfiltered list too).
    const hasNounRows = useMemo(() => rows.some((row) => row.partOfSpeech === PartOfSpeech.noun), [rows]);

    // The selection (stable ids, kept across pages) and its table-wide actions, shared with `/tag/:id`.
    const selection = useWordSelection({ rows, languages, filters, filtersKey });
    const { rowSelection, setRowSelection, selectedIds } = selection;

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
    function handleToggleTagFilter(tagId: string) {
        const current = search.tag ?? [];
        const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
        updateSearch({ tag: next.length > 0 ? next : undefined });
    }
    const tagsRow = tagsTarget ? rows.find((row) => row.id === tagsTarget) : undefined;

    // Any real change of filter, sort or page size goes back to page 1, unless `keepPage` says it is not about
    // the list. A write that changes nothing keeps the page: the search box writes `q` once on mount (twice in
    // React's dev StrictMode), and that must not throw the user off page 2 after a reload.
    function updateSearch(patch: Partial<ReviewSearch>, options: { keepPage?: boolean; replace?: boolean } = {}) {
        void navigate({
            search: (prev) => {
                const changed = Object.entries(patch).some(
                    ([key, value]) => JSON.stringify(prev[key as keyof ReviewSearch]) !== JSON.stringify(value),
                );
                return { ...prev, ...(options.keepPage || !changed ? {} : { page: undefined }), ...patch };
            },
            replace: options.replace,
        });
    }

    const toggleSort = useCallback(
        (lang: LangKey) => {
            const next = nextLanguageSort(sort, lang);
            void navigate({ search: (prev) => ({ ...prev, sort: next?.lang, dir: next?.dir, page: undefined }) });
        },
        [sort, navigate],
    );

    function handlePageChange(next: number) {
        updateSearch({ page: next > 1 ? next : undefined }, { keepPage: true });
    }

    function handlePageSizeChange(size: PageSize) {
        storePageSize(size);
        updateSearch({ size });
    }

    // A page past the last one (the last rows were deleted, or a stale link) goes to the last page.
    useEffect(() => {
        if (!wordsQuery.data || wordsQuery.isPlaceholderData || page <= pageCount) return;
        updateSearch({ page: pageCount > 1 ? pageCount : undefined }, { keepPage: true, replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wordsQuery.data, wordsQuery.isPlaceholderData, page, pageCount]);

    // Ids-only in the URL (`ReviewSearch.tag`) resolved to full `TagSummary`s
    // for `TagCombobox`'s pill row — see `useTagsByIds`'s own doc comment.
    const selectedTagsQuery = useTagsByIds(search.tag ?? []);

    // A click on a row asks first (a dialog), then opens `/word/$wordId`.
    const [openWordId, setOpenWordId] = useState<string | null>(null);
    const handleOpenWord = useCallback((wordId: string) => setOpenWordId(wordId), []);
    const openWordRow = openWordId ? rows.find((row) => row.id === openWordId) : undefined;
    const openWordLabel = openWordRow ? languages.map((lang) => openWordRow[`data${lang}`]).find(Boolean) : undefined;

    // Add tags and Delete need every selected word to be the user's own. A selected word that is not known
    // (should not happen: each one was seen on screen) counts as not own.
    const allSelectedOwn = selectedIds.every((id) => selection.selectedRow(id)?.user === userId);

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
        owner: search.owner,
        selectedTags: selectedTagsQuery.data,
        onGenderChange: (next: string[] | undefined) => updateSearch({ gender: next }),
        onPosChange: (next: PartOfSpeech[] | undefined) => updateSearch({ pos: next }),
        onOwnerChange: (next: WordOwner | undefined) => updateSearch({ owner: next }),
        onSelectedTagsChange: (next: TagSummary[]) =>
            updateSearch({ tag: next.length > 0 ? next.map((tag) => tag.id) : undefined }),
    };

    const filterSections = useFilterSections(filterBarProps);
    // The display switches are pinned to the bottom of the side menu, apart from the filters above them.
    const sections: SidebarSection[] = [
        ...filterSections,
        buildDisplaySection(t('review:filters.display'), {
            languageOrder: (
                <LanguageOrderControl
                    active={languages}
                    allLanguages={allLanguages}
                    onChange={(next: LangKey[]) => updateSearch({ lang: next }, { keepPage: true })}
                    stacked
                    hideLabel
                />
            ),
            showGenderSwitch: hasNounRows,
            showGender,
            onShowGenderChange: setShowGender,
            showProgress,
            onShowProgressChange: setShowProgress,
            showOwner,
            onShowOwnerChange: setShowOwner,
            showPos,
            onShowPosChange: setShowPos,
        }),
    ];
    const activeCount = activeFilterCount(filterBarProps.gender, filterBarProps.pos, filterBarProps.hasQuery, filterBarProps.selectedTags.length, search.owner !== undefined);

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
            labelIcon={<FunnelIcon size={18} />}
            sections={sections}
            fillHeight
            header={
                <div className="flex items-center justify-between gap-2">
                    <PageTitle icon={TranslateIcon} section>{t('review:page.title')}</PageTitle>
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
                        canEdit={allSelectedOwn}
                        onPractice={selection.practice}
                        onDelete={handleBulkDelete}
                        onTagsApplied={handleTagsApplied}
                        onClear={isMobile ? selection.clear : undefined}
                        onSelectAll={isMobile && !selection.pageFullySelected ? selection.selectPage : undefined}
                        compact={isMobile}
                        allPages={selection.allPagesFor(total)}
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
                        isFetching={wordsQuery.isFetching}
                        isError={wordsQuery.isError}
                        error={wordsQuery.error}
                        total={total}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                        onRetry={() => void wordsQuery.refetch()}
                        sort={sort}
                        onSort={toggleSort}
                        rowSelection={rowSelection}
                        onRowSelectionChange={setRowSelection}
                        hasActiveFilters={hasActiveFilters(search)}
                        onClearFilters={() =>
                            void navigate({ search: (prev) => ({ lang: prev.lang, size: prev.size, sort: prev.sort, dir: prev.dir }) })
                        }
                        onAddWord={() => void navigate({ to: '/addWord/{-$partOfSpeech}' })}
                        onOpenCell={handleOpenCell}
                        onOpenWord={handleOpenWord}
                        onOpenTags={handleOpenTags}
                        compact={isMobile}
                    />
            </div>

            <OpenWordDialog
                wordId={openWordId}
                label={openWordLabel}
                onClose={() => setOpenWordId(null)}
                onOpen={(wordId) => void navigate({ to: '/word/$wordId', params: { wordId } })}
            />

            {tagsRow && (
                <TagsDialog
                    key={tagsRow.id}
                    wordId={tagsRow.id}
                    tags={tagsRow.tags}
                    canEdit={tagsRow.user === userId}
                    filteredTagIds={search.tag ?? []}
                    onFilter={handleToggleTagFilter}
                    onOpenTag={(tagId) => void navigate({ to: '/tag/$tagId', params: { tagId } })}
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
                    readOnly={rows.find((row) => row.id === cellTarget.wordId)?.user !== userId}
                />
            )}
        </SidebarLayout>
    );
}
