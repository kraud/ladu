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
 * Post-Slice-6 fix: everything that mutates the tag's own word membership or
 * its cases — the "Remove from tag" column and a cell's "+" (add
 * translation) affordance — is gated behind `editMode`, which `TagViewPage`
 * only turns on for an owned tag. Outside edit mode the table is read-only,
 * matching the rest of the app's "look first, opt into editing" posture.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { MagnifyingGlassIcon, TrashIcon } from '@phosphor-icons/react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { buildLanguageColumns, buildPartOfSpeechColumn } from '@/features/words/review/columns';
import { DisplayOptions } from '@/features/words/review/DisplayOptions';
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
    /** The word-membership/case-editing affordances (remove column, cell "+") only render while this is on. */
    editMode: boolean;
    onRemove?: (wordId: string, label: string) => void;
    /** The empty-state CTA for an owned tag with zero words — absent elsewhere. */
    onAddWords?: () => void;
    onOpenCell?: (wordId: string, langKey: LangKey) => void;
    showGender: boolean;
    onShowGenderChange: (next: boolean) => void;
    showProgress: boolean;
    onShowProgressChange: (next: boolean) => void;
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
    editMode,
    onRemove,
    onAddWords,
    onOpenCell,
    showGender,
    onShowGenderChange,
    showProgress,
    onShowProgressChange,
}: TagWordsTableProps) {
    const { t } = useTranslation();
    const showRemoveColumn = canRemove && editMode;
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
        editable: editMode,
        onOpenCell,
    });
    const columns: ColumnDef<WordSimpleBE>[] = [
        buildPartOfSpeechColumn(t),
        ...languageColumns,
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
    ];

    const table = useReactTable({
        data: rows,
        columns,
        getRowId: (row) => row.id,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        manualFiltering: true,
    });

    if (isError) {
        return <ErrorState error={error instanceof Error ? error : undefined} resetErrorBoundary={onRetry} />;
    }

    return (
        <section>
            <div className="toolrow">
                <div className="searchbox">
                    <MagnifyingGlassIcon size={14} />
                    <input
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder={t('tags:words.searchPlaceholder')}
                        aria-label={t('tags:words.searchLabel')}
                    />
                </div>
                <DisplayOptions
                    showGenderSwitch={hasNounRows}
                    showGender={showGender}
                    onShowGenderChange={onShowGenderChange}
                    showProgress={showProgress}
                    onShowProgressChange={onShowProgressChange}
                />
                {!isPending && (
                    <span className="meta" style={{ marginLeft: 'auto' }}>
                        {debouncedQuery ? (
                            t('tags:words.resultCount', { shown: rows.length, total })
                        ) : (
                            <>
                                {total} {t('tags:card.wordCount', { count: total })}
                            </>
                        )}
                    </span>
                )}
            </div>

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
                                            const isShrinkCol = header.column.id === 'partOfSpeech' || header.column.id === 'remove';
                                            return (
                                                <th
                                                    key={header.id}
                                                    className={isLangCol ? 'lang-col' : isShrinkCol ? 'shrink-col' : undefined}
                                                    style={isLangCol ? { width: langColWidth } : undefined}
                                                >
                                                    {header.isPlaceholder
                                                        ? null
                                                        : flexRender(header.column.columnDef.header, header.getContext())}
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
                                            const isShrinkCol = cell.column.id === 'partOfSpeech' || cell.column.id === 'remove';
                                            return (
                                                <td
                                                    key={cell.id}
                                                    className={isLangCol ? 'word-cell' : isShrinkCol ? 'shrink-col' : undefined}
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
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onFetchNextPage}
                                disabled={isFetchingNextPage}
                            >
                                {t('review:table.loadMore')}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
