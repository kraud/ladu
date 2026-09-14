import { useMemo } from 'react';
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    type OnChangeFn,
    type RowSelectionState,
} from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@phosphor-icons/react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { LangKey, WordSimpleBE } from '@/features/words/types';
import { buildWordColumns } from './columns';

const SKELETON_ROWS = 8;
const SKELETON_MORE_ROWS = 3;

export interface ReviewTableProps {
    rows: WordSimpleBE[];
    /** Column order and set — `resolveLanguageOrder(search.lang, user.languages)` (D6). */
    languages: LangKey[];
    userId: string;
    userName: string;
    showGender: boolean;
    isPending: boolean;
    isFetchingNextPage: boolean;
    isError: boolean;
    error: unknown;
    hasNextPage: boolean;
    /** Filtered total (D8) — constant across pages of the same filter set. */
    total: number;
    onFetchNextPage: () => void;
    onRetry: () => void;
    rowSelection: RowSelectionState;
    onRowSelectionChange: OnChangeFn<RowSelectionState>;
    /** Picks between the two empty states. */
    hasActiveFilters: boolean;
    onClearFilters: () => void;
    /** The "no words yet" empty state's CTA — a callback, not a `<Link>`, so this component stays router-free. */
    onAddWord: () => void;
    /** Unset in Slice 6 — Slice 8 wires the cell editor dialog. */
    onOpenCell?: (wordId: string, langKey: LangKey) => void;
}

/**
 * The Review table shell. Deliberately router- and store-free — every input
 * arrives as a prop, including navigation as callbacks rather than `<Link>`
 * elements — so it stays testable through `renderWithProviders` (which
 * supplies QueryClient + i18n but no router context) rather than needing the
 * full `renderApp`. `ReviewPage` owns `useWordsInfinite`, `useAuthStore` and
 * the URL search params, and wires them in here.
 */
export function ReviewTable({
    rows,
    languages,
    userId,
    userName,
    showGender,
    isPending,
    isFetchingNextPage,
    isError,
    error,
    hasNextPage,
    total,
    onFetchNextPage,
    onRetry,
    rowSelection,
    onRowSelectionChange,
    hasActiveFilters,
    onClearFilters,
    onAddWord,
    onOpenCell,
}: ReviewTableProps) {
    const { t } = useTranslation();

    const columns = useMemo(
        () => buildWordColumns({ languages, userId, userName, showGender, t, onOpenCell }),
        [languages, userId, userName, showGender, t, onOpenCell],
    );

    const table = useReactTable({
        data: rows,
        columns,
        getRowId: (row) => row.id,
        getCoreRowModel: getCoreRowModel(),
        state: { rowSelection },
        onRowSelectionChange,
        // Own words only — keeps the backend's 401 "not authorized to delete"
        // branch (which would otherwise trip the axios client's any-401-clears-
        // the-session interceptor) unreachable from this UI.
        enableRowSelection: (row) => row.original.user === userId,
        manualPagination: true,
        manualFiltering: true,
        manualSorting: true,
    });

    if (isError) {
        return (
            <ErrorState error={error instanceof Error ? error : undefined} resetErrorBoundary={onRetry} />
        );
    }

    if (!isPending && rows.length === 0) {
        if (hasActiveFilters) {
            return (
                <EmptyState
                    title={t('review:empty.noMatches.title')}
                    description={t('review:empty.noMatches.description')}
                    action={
                        <Button variant="outline" onClick={onClearFilters}>
                            {t('review:empty.noMatches.action')}
                        </Button>
                    }
                />
            );
        }
        return (
            <EmptyState
                icon={<PlusIcon size={20} />}
                title={t('review:empty.noWords.title')}
                description={t('review:empty.noWords.description')}
                action={<Button onClick={onAddWord}>{t('review:empty.noWords.action')}</Button>}
            />
        );
    }

    return (
        <div className="main-col">
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
                        {isPending
                            ? Array.from({ length: SKELETON_ROWS }).map((_, rowIndex) => (
                                  <tr key={`skeleton-${rowIndex}`}>
                                      {columns.map((_, colIndex) => (
                                          <td key={colIndex}>
                                              <Skeleton className="h-4 w-24" />
                                          </td>
                                      ))}
                                  </tr>
                              ))
                            : table.getRowModel().rows.map((row) => (
                                  <tr key={row.id} className={row.getIsSelected() ? 'selected' : undefined}>
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
                            Array.from({ length: SKELETON_MORE_ROWS }).map((_, rowIndex) => (
                                <tr key={`skeleton-more-${rowIndex}`}>
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
            <div className="footer-row">
                <span className="meta">
                    {hasNextPage
                        ? t('review:table.loaded', { loaded: rows.length, total })
                        : t('review:table.allLoaded', { total })}
                </span>
                {hasNextPage && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onFetchNextPage}
                        disabled={isFetchingNextPage}
                    >
                        {t('review:table.loadMore')}
                    </Button>
                )}
            </div>
        </div>
    );
}
