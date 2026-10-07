/**
 * `/tag/:id`'s word list — a compact table reusing Review's own per-language
 * cell rendering (`buildLanguageColumns`/`WordCell`) rather than a second
 * table renderer, per phase-4-tags.md's Slice 6 architecture note.
 *
 * Deliberately router-, store- and query-free, mirroring `ReviewTable`'s own
 * convention exactly: `TagViewPage` owns the single `useWordsInfinite({tag:
 * [tagId], q})` call (and the search box's local/debounced state, the
 * display-option state, and the cell-dialog target) and passes every result
 * down as a prop, so this stays testable through `renderWithProviders` alone
 * and so the page can reuse the same loaded rows to compute
 * `AddWordsDialog`'s `excludeIds` without a second query.
 *
 * An owned tag's toolbar holds "Add words" and "Remove words". Remove mode
 * (`removeMode`, owned by `TagViewPage`) puts a trash column on the *left* of
 * the table, so it stays in view however many language columns there are, and
 * disables "Add words". A cell's "+" (add translation) shows for an owned tag.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { MagnifyingGlassIcon, PlusIcon, SlidersHorizontalIcon, TrashIcon, XIcon } from '@phosphor-icons/react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { buildLanguageColumns, buildPartOfSpeechColumn } from '@/features/words/review/columns';
import { DisplayOptions } from '@/features/words/review/DisplayOptions';
import type { LanguageSort } from '@/features/words/review/useLanguageSort';
import { useIsMobile } from '@/lib/useMediaQuery';
import { PartOfSpeech } from '@/ts/enums';
import type { LangKey, WordSimpleBE } from '@/features/words/types';

const SKELETON_ROWS = 5;

export interface TagWordsTableProps {
    rows: WordSimpleBE[];
    languages: LangKey[];
    userId: string;
    isPending: boolean;
    isFetchingNextPage: boolean;
    isError: boolean;
    error: unknown;
    hasNextPage: boolean;
    total: number;
    onFetchNextPage: () => void;
    onRetry: () => void;
    query: string;
    debouncedQuery: string;
    onQueryChange: (query: string) => void;
    /** Owned tags can remove words at all; others never can, edit mode or not. */
    canRemove: boolean;
    /** While on, the trash column shows and "Add words" is disabled. Only has an effect when `canRemove`. */
    removeMode: boolean;
    onRemoveModeChange: (next: boolean) => void;
    onRemove?: (wordId: string, label: string) => void;
    /** The empty-state CTA for an owned tag with zero words — absent elsewhere. */
    onAddWords?: () => void;
    onOpenCell?: (wordId: string, langKey: LangKey) => void;
    showGender: boolean;
    onShowGenderChange: (next: boolean) => void;
    showProgress: boolean;
    onShowProgressChange: (next: boolean) => void;
    /** The active column sort, and the click on a language header. */
    sort?: LanguageSort | null;
    onSort?: (lang: LangKey) => void;
}

function headlineLabel(row: WordSimpleBE, languages: readonly string[]): string {
    for (const lang of languages) {
        const value = row[`data${lang}` as keyof WordSimpleBE];
        if (typeof value === 'string' && value) return value;
    }
    return row.id;
}

export function TagWordsTable({
    rows,
    languages,
    userId,
    isPending,
    isFetchingNextPage,
    isError,
    error,
    hasNextPage,
    total,
    onFetchNextPage,
    onRetry,
    query,
    debouncedQuery,
    onQueryChange,
    canRemove,
    removeMode,
    onRemoveModeChange,
    onRemove,
    onAddWords,
    onOpenCell,
    showGender,
    onShowGenderChange,
    showProgress,
    onShowProgressChange,
    sort,
    onSort,
}: TagWordsTableProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const [filtersOpen, setFiltersOpen] = useState(false);
    const showRemoveColumn = canRemove && removeMode;
    // D14's own rule, reapplied here: the gender switch is only useful once a
    // noun is actually on screen.
    const hasNounRows = useMemo(() => rows.some((row) => row.partOfSpeech === PartOfSpeech.noun), [rows]);

    // Equal width for every language column, so N columns always fill the
    // table instead of leaving space on the right when there are only a few.
    const langColWidth = languages.length > 0 ? `${100 / languages.length}%` : undefined;

    const languageColumns = buildLanguageColumns({
        languages,
        userId,
        showGender,
        showProgress,
        editable: canRemove,
        onOpenCell,
        sort,
        onSort,
        t,
    });
    const columns: ColumnDef<WordSimpleBE>[] = [
        ...(showRemoveColumn
            ? [
                  {
                      id: 'remove',
                      size: 44,
                      header: '',
                      cell: ({ row }: { row: { original: WordSimpleBE } }) => {
                          const label = headlineLabel(row.original, languages);
                          return (
                              <Tooltip>
                                  <TooltipTrigger
                                      render={
                                          <button
                                              type="button"
                                              aria-label={t('tags:words.removeFromTag')}
                                              className="icon-btn text-(--muted) hover:bg-(--danger-soft) hover:text-(--danger)"
                                              onClick={() => onRemove?.(row.original.id, label)}
                                          >
                                              <TrashIcon size={14} />
                                          </button>
                                      }
                                  />
                                  <TooltipContent>{t('tags:words.removeFromTag')}</TooltipContent>
                              </Tooltip>
                          );
                      },
                  } satisfies ColumnDef<WordSimpleBE>,
              ]
            : []),
        buildPartOfSpeechColumn(t),
        ...languageColumns,
    ];

    const table = useReactTable({
        data: rows,
        columns,
        getRowId: (row) => row.id,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        manualFiltering: true,
    });

    // Soft colour coding (blue add, red remove), the same on desktop and phone. Desktop matches the
    // search box height (32px); on a phone the two share a row, half each.
    const sizeClass = isMobile ? 'flex-1' : 'h-8 px-3';
    const addTone =
        'bg-(--accent-soft) text-(--accent-strong) hover:bg-[color-mix(in_srgb,var(--accent-soft),var(--accent)_12%)]';
    const removeTone =
        'bg-(--danger-soft) text-(--danger) hover:bg-[color-mix(in_srgb,var(--danger-soft),var(--danger)_12%)]';
    const wordActions = (
        <>
            <Button
                size={isMobile ? 'default' : 'sm'}
                variant="secondary"
                className={`${sizeClass} ${addTone}`}
                onClick={onAddWords}
                disabled={removeMode}
            >
                <PlusIcon size={14} aria-hidden="true" />
                {t('tags:card.addWords')}
            </Button>
            <Button
                size={isMobile ? 'default' : 'sm'}
                variant={removeMode ? 'outline' : 'secondary'}
                className={`${sizeClass} ${removeMode ? '' : removeTone}`}
                onClick={() => onRemoveModeChange(!removeMode)}
                disabled={!removeMode && rows.length === 0}
            >
                {!removeMode && <TrashIcon size={14} aria-hidden="true" />}
                {removeMode ? t('common:buttons.cancel') : t('tags:words.removeWords')}
            </Button>
        </>
    );
    const displayOptions = (
        <DisplayOptions
            showGenderSwitch={hasNounRows}
            showGender={showGender}
            onShowGenderChange={onShowGenderChange}
            showProgress={showProgress}
            onShowProgressChange={onShowProgressChange}
        />
    );
    const countLabel = !isPending && (
        <span className="meta">
            {debouncedQuery ? (
                t('tags:words.resultCount', { shown: rows.length, total })
            ) : (
                <>
                    {total} {t('tags:card.wordCount', { count: total })}
                </>
            )}
        </span>
    );

    if (isError) {
        return <ErrorState error={error instanceof Error ? error : undefined} resetErrorBoundary={onRetry} />;
    }

    return (
        <section>
            <div className={isMobile ? 'flex flex-col gap-2' : 'flex flex-wrap items-center gap-3 mb-2'}>
                <div className={isMobile ? 'flex items-center gap-2' : 'flex min-w-0 items-center gap-2'}>
                    {isMobile && (
                        <Button
                            variant="outline"
                            className="gap-2"
                            aria-label={t('review:filters.title')}
                            aria-expanded={filtersOpen}
                            onClick={() => setFiltersOpen(true)}
                        >
                            <SlidersHorizontalIcon size={16} />
                            {t('review:filters.title')}
                        </Button>
                    )}
                    <div
                        className="searchbox"
                        style={isMobile ? { flex: 1, minWidth: 0 } : { flex: '0 1 220px', minWidth: 250 }}
                    >
                        <MagnifyingGlassIcon size={14} />
                        <input
                            value={query}
                            onChange={(event) => onQueryChange(event.target.value)}
                            placeholder={t('tags:words.searchPlaceholder')}
                            aria-label={t('tags:words.searchLabel')}
                        />
                    </div>
                    {canRemove && !isMobile && wordActions}
                </div>
                {canRemove && isMobile && <div className="flex gap-2">{wordActions}</div>}
                {!isMobile && (
                    <div className="ml-auto flex items-center gap-3">
                        {displayOptions}
                        {countLabel}
                    </div>
                )}
                {isMobile && <div className="text-right">{countLabel}</div>}
            </div>

            {isMobile && (
                <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <SheetContent
                        side="left"
                        showCloseButton={false}
                        className="w-72 max-w-[85vw] overflow-y-auto p-4 sm:max-w-none"
                    >
                        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                            <SheetTitle>{t('review:filters.title')}</SheetTitle>
                            <button
                                type="button"
                                className="icon-btn"
                                aria-label={t('common:sidebar.close')}
                                onClick={() => setFiltersOpen(false)}
                            >
                                <XIcon size={16} />
                            </button>
                        </div>
                        <SheetDescription className="sr-only">{t('review:filters.title')}</SheetDescription>
                        <section className="flex flex-col gap-2">
                            <h2 className="label flex items-center gap-1.5">
                                <SlidersHorizontalIcon size={14} aria-hidden="true" />
                                {t('review:filters.display')}
                            </h2>
                            <div className="flex flex-col gap-3">{displayOptions}</div>
                        </section>
                    </SheetContent>
                </Sheet>
            )}

            {isPending ? (
                <div className="tablewrap">
                    <table className="dtable">
                        <tbody>
                            {Array.from({ length: SKELETON_ROWS }).map((_, rowIndex) => (
                                <tr key={rowIndex}>
                                    {columns.map((_, colIndex) => (
                                        <td key={colIndex}>
                                            <Skeleton className="h-4 w-24" />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : rows.length === 0 ? (
                debouncedQuery ? (
                    <EmptyState
                        icon={<MagnifyingGlassIcon size={20} />}
                        title={t('tags:words.emptySearch.title', { query: debouncedQuery })}
                        description={t('tags:words.emptySearch.description')}
                        action={
                            <Button size="sm" variant="outline" onClick={() => onQueryChange('')}>
                                {t('tags:words.emptySearch.action')}
                            </Button>
                        }
                    />
                ) : (
                    <EmptyState
                        title={canRemove ? t('tags:words.emptyOwned.title') : t('tags:words.emptyOther.title')}
                        action={
                            canRemove && onAddWords ? (
                                <Button size="sm" onClick={onAddWords}>
                                    {t('tags:card.addWords')}
                                </Button>
                            ) : undefined
                        }
                    />
                )
            ) : (
                <>
                    <div className="tablewrap">
                        <table className="dtable">
                            <thead>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => {
                                            const isLangCol = header.column.id.startsWith('lang_');
                                            const isShrinkCol =
                                                header.column.id === 'partOfSpeech' || header.column.id === 'remove';
                                            return (
                                                <th
                                                    key={header.id}
                                                    className={
                                                        isLangCol ? 'lang-col' : isShrinkCol ? 'shrink-col' : undefined
                                                    }
                                                    style={isLangCol ? { width: langColWidth } : undefined}
                                                >
                                                    {header.isPlaceholder
                                                        ? null
                                                        : flexRender(
                                                              header.column.columnDef.header,
                                                              header.getContext(),
                                                          )}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                                {table.getRowModel().rows.map((row) => (
                                    <tr key={row.id}>
                                        {row.getVisibleCells().map((cell) => {
                                            const isLangCol = cell.column.id.startsWith('lang_');
                                            const isShrinkCol =
                                                cell.column.id === 'partOfSpeech' || cell.column.id === 'remove';
                                            return (
                                                <td
                                                    key={cell.id}
                                                    className={
                                                        isLangCol ? 'word-cell' : isShrinkCol ? 'shrink-col' : undefined
                                                    }
                                                >
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                {isFetchingNextPage &&
                                    Array.from({ length: 2 }).map((_, rowIndex) => (
                                        <tr key={`more-${rowIndex}`}>
                                            {columns.map((_, colIndex) => (
                                                <td key={colIndex}>
                                                    <Skeleton className="h-4 w-24" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                    {hasNextPage && (
                        <div className="footer-row">
                            <span className="meta">{t('tags:words.loaded', { loaded: rows.length, total })}</span>
                            <Button variant="outline" size="sm" onClick={onFetchNextPage} disabled={isFetchingNextPage}>
                                {t('review:table.loadMore')}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
