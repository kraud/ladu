/**
 * `/tag/:id`'s word list — a compact, read-only table reusing Review's own
 * per-language cell rendering (`buildLanguageColumns`/`WordCell`) rather than
 * a second table renderer, per phase-4-tags.md's Slice 6 architecture note.
 *
 * Deliberately router-, store- and query-free, mirroring `ReviewTable`'s own
 * convention exactly: `TagViewPage` owns the single `useWordsInfinite({tag:
 * [tagId], q})` call (and the search box's local/debounced state) and passes
 * every result down as a prop, so this stays testable through
 * `renderWithProviders` alone and so the page can reuse the same loaded rows
 * to compute `AddWordsDialog`'s `excludeIds` without a second query.
 */
import { useTranslation } from 'react-i18next';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { buildLanguageColumns, buildPartOfSpeechColumn } from '@/features/words/review/columns';
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
    /** Owned tags get a trailing "Remove from tag" column; others don't. */
    canRemove: boolean;
    onRemove?: (wordId: string, label: string) => void;
    /** The empty-state CTA for an owned tag with zero words — absent elsewhere. */
    onAddWords?: () => void;
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
    onRemove,
    onAddWords,
}: TagWordsTableProps) {
    const { t } = useTranslation();

    const languageColumns = buildLanguageColumns({ languages, userId, showGender: true, showProgress: true });
    const columns: ColumnDef<WordSimpleBE>[] = [
        buildPartOfSpeechColumn(t),
        ...languageColumns,
        ...(canRemove
            ? [
                  {
                      id: 'remove',
                      size: 128,
                      header: '',
                      cell: ({ row }: { row: { original: WordSimpleBE } }) => (
                          <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-(--muted) hover:text-(--danger)"
                              onClick={() => onRemove?.(row.original.id, headlineLabel(row.original, languages))}
                          >
                              {t('tags:words.removeFromTag')}
                          </Button>
                      ),
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
                {!isPending && (
                    <span className="meta">
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
                                        {headerGroup.headers.map((header) => (
                                            <th
                                                key={header.id}
                                                className={header.column.id.startsWith('lang_') ? 'lang-col' : undefined}
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                                {table.getRowModel().rows.map((row) => (
                                    <tr key={row.id}>
                                        {row.getVisibleCells().map((cell) => (
                                            <td
                                                key={cell.id}
                                                className={cell.column.id.startsWith('lang_') ? 'word-cell' : undefined}
                                            >
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
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
