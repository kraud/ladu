import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
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
import { TablePagination } from '@/components/common/TablePagination';
import type { PageSize } from '@/lib/pagination';
import type { LangKey, WordSimpleBE } from '@/features/words/types';
import { buildWordColumns } from './columns';
import type { LanguageSort } from './useLanguageSort';

const SKELETON_ROWS = 8;

const LONG_PRESS_MS = 450;
/** A finger that moves farther than this (px) is scrolling, not pressing. */
const LONG_PRESS_SLOP = 10;

const SHRINK_COLUMNS = new Set(['select', 'owner', 'partOfSpeech', 'tags']);

/** select, owner, `partOfSpeech`, and `tags` (the newest tag + "+N") shrink to their own content's width (`.shrink-col`, CSS `width: 1%` trick); language columns get the wider `.lang-col`/`.word-cell` treatment. */
function headerClassName(columnId: string): string | undefined {
    if (SHRINK_COLUMNS.has(columnId)) return 'shrink-col';
    if (columnId.startsWith('lang_')) return 'lang-col';
    return undefined;
}

function cellClassName(columnId: string): string | undefined {
    if (SHRINK_COLUMNS.has(columnId)) return 'shrink-col';
    if (columnId.startsWith('lang_')) return 'word-cell';
    return undefined;
}

export interface ReviewTableProps {
    rows: WordSimpleBE[];
    /** Column order and set — `resolveLanguageOrder(search.lang, user.languages)` (D6). */
    languages: LangKey[];
    userId: string;
    userName: string;
    showGender: boolean;
    /** Toolbar "Display progress" switch — gates the completion ring per cell. */
    showProgress: boolean;
    isPending: boolean;
    /** A new page is loading while the old one stays on screen. */
    isFetching?: boolean;
    isError: boolean;
    error: unknown;
    /** Filtered total (D8) — constant across pages of the same filter set. */
    total: number;
    /** Current numbered page (1-based) and rows per page. */
    page: number;
    pageSize: PageSize;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: PageSize) => void;
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
    /** Toolbar "Display owner" switch — gates the owner column. */
    showOwner: boolean;
    /** Toolbar "Display word type" switch — gates the word-type column. */
    showPos: boolean;
    /** A click on a Tags cell. */
    onOpenTags?: (wordId: string) => void;
    /** The active column sort, and the click on a language header. */
    sort?: LanguageSort | null;
    onSort?: (lang: LangKey) => void;
    /**
     * Phone layout: the footer has the page controls only, without the "Showing …" text. Rows have no
     * checkbox either: a long press selects the first row, then a tap selects or unselects any row.
     */
    compact?: boolean;
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
    showProgress,
    showOwner,
    showPos,
    isPending,
    isFetching = false,
    isError,
    error,
    total,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    onRetry,
    rowSelection,
    onRowSelectionChange,
    hasActiveFilters,
    onClearFilters,
    onAddWord,
    onOpenCell,
    onOpenTags,
    sort,
    onSort,
    compact = false,
}: ReviewTableProps) {
    const { t } = useTranslation();

    const columns = useMemo(
        () =>
            buildWordColumns({
                languages,
                userId,
                userName,
                showGender,
                showProgress,
                selectable: !compact,
                showOwner,
                showPos,
                t,
                onOpenCell,
                onOpenTags,
                sort,
                onSort,
            }),
        [languages, userId, userName, showGender, showProgress, compact, showOwner, showPos, t, onOpenCell, onOpenTags, sort, onSort],
    );

    const table = useReactTable({
        data: rows,
        columns,
        getRowId: (row) => row.id,
        getCoreRowModel: getCoreRowModel(),
        state: { rowSelection },
        onRowSelectionChange,
        manualPagination: true,
        manualFiltering: true,
        manualSorting: true,
    });

    // Phone: long press selects, and once something is selected a tap toggles (the cells' own buttons stay quiet).
    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pressStart = useRef<{ x: number; y: number } | null>(null);
    const pressFired = useRef(false);
    const hasSelection = Object.values(rowSelection).some(Boolean);

    function cancelPress() {
        if (pressTimer.current) clearTimeout(pressTimer.current);
        pressTimer.current = null;
        pressStart.current = null;
    }

    function startPress(event: ReactPointerEvent, toggle: () => void) {
        pressStart.current = { x: event.clientX, y: event.clientY };
        pressTimer.current = setTimeout(() => {
            pressFired.current = true;
            pressTimer.current = null;
            toggle();
        }, LONG_PRESS_MS);
    }

    function movePress(event: ReactPointerEvent) {
        const start = pressStart.current;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > LONG_PRESS_SLOP) cancelPress();
    }

    if (isError) {
        return (
            <ErrorState error={error instanceof Error ? error : undefined} resetErrorBoundary={onRetry} />
        );
    }

    // A page past the last one has no rows but a total above 0: that is not an empty list (the page corrects itself).
    if (!isPending && rows.length === 0 && total === 0) {
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
        <div className="main-col min-h-0 flex-1">
            <div className="tablewrap tablewrap-fill min-h-0 max-[920px]:flex-1" aria-busy={isFetching} style={isFetching ? { opacity: 0.6 } : undefined}>
                <table className="dtable">
                    <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th key={header.id} className={headerClassName(header.column.id)}>
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
                                  <tr
                                      key={row.id}
                                      className={[row.getIsSelected() && 'selected', compact && 'press-select']
                                          .filter(Boolean)
                                          .join(' ') || undefined}
                                      {...(compact && row.getCanSelect()
                                          ? {
                                                onPointerDown: (event: ReactPointerEvent) => {
                                                    pressFired.current = false;
                                                    if (!hasSelection) startPress(event, () => row.toggleSelected(true));
                                                },
                                                onPointerMove: movePress,
                                                onPointerUp: cancelPress,
                                                onPointerCancel: cancelPress,
                                                onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
                                                onClickCapture: (event: React.MouseEvent) => {
                                                    // The click that ends a long press, or a tap while selecting, is for the row only.
                                                    if (pressFired.current) {
                                                        pressFired.current = false;
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                    } else if (hasSelection) {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        row.toggleSelected();
                                                    }
                                                },
                                            }
                                          : {})}
                                  >
                                      {row.getVisibleCells().map((cell) => (
                                          <td key={cell.id} className={cellClassName(cell.column.id)}>
                                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                          </td>
                                      ))}
                                  </tr>
                              ))}
                    </tbody>
                </table>
            </div>
            {!isPending && (
                <TablePagination
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={onPageChange}
                    onPageSizeChange={onPageSizeChange}
                    disabled={isFetching}
                    compact={compact}
                />
            )}
        </div>
    );
}
