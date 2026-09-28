/**
 * Search -> table -> selected list -> auto-clear (phase-4-tags.md D18).
 * Shared by the create-tag dialog's optional "Add words now" section
 * (Slice 5, embedded inline) and `/tag/:id`'s "Add words" action (Slice 6,
 * wrapped in its own `Dialog`) — this component renders no dialog chrome of
 * its own, just the picker itself, so either call site can host it.
 *
 * Reuses `buildLanguageColumns`/`WordCell` (`features/words/review/
 * columns.tsx`) for the results table rather than a third row-rendering
 * style, and `useWordsInfinite` (`features/words/hooks.ts`) for the search
 * itself — filtered client-side to the caller's own words (D10: a user's own
 * tags can only ever hold their own words), same as `wordHandlers.ts`'s own
 * fake models it.
 *
 * D18 asked for checkbox-select AND click-anywhere-on-the-row to each be
 * tried and compared before shipping. They turn out not to be in tension:
 * the checkbox is a visual affordance, but the whole `<tr>` carries the
 * click handler, so clicking the checkbox (which doesn't stop propagation)
 * and clicking anywhere else in the row both pick the same way. No flag
 * needed — both interactions ship, because they were never actually
 * exclusive.
 */
import { useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import { buildLanguageColumns, buildPartOfSpeechColumn } from '@/features/words/review/columns';
import { accountLanguageOrder } from '@/features/words/review/search';
import { useWordsInfinite } from '@/features/words/hooks';
import type { WordSimpleBE } from '@/features/words/types';

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = 3;

export interface PickedWord {
    id: string;
    /** The row's headline word in whichever language had one — shown in the selected list. */
    label: string;
}

export interface WordPickerProps {
    selected: PickedWord[];
    onSelectedChange: (next: PickedWord[]) => void;
    /**
     * Word ids to hide from the results regardless of `selected` — used by
     * `/tag/:id`'s "Add words" dialog (Slice 6) to keep words already on the
     * tag out of the pool, distinct from words picked in *this* session.
     */
    excludeIds?: ReadonlySet<string>;
}

/** The first stored headline word across the account's language order — matches `cellTitle.ts`'s "pick any language" fallback logic, simplified for a label rather than a dialog title. */
function headlineLabel(row: WordSimpleBE, languages: readonly string[]): string {
    for (const lang of languages) {
        const value = row[`data${lang}` as keyof WordSimpleBE];
        if (typeof value === 'string' && value) return value;
    }
    return row.id;
}

export function WordPicker({ selected, onSelectedChange, excludeIds }: WordPickerProps) {
    const { t } = useTranslation();
    const userId = useAuthStore((s) => s.user?.id ?? '');
    const userLanguages = useAuthStore((s) => s.user?.languages ?? []);
    const languages = useMemo(() => accountLanguageOrder(userLanguages), [userLanguages]);

    const [query, setQuery] = useState('');
    const debouncedQuery = useDebouncedCallback(query, SEARCH_DEBOUNCE_MS);

    const wordsQuery = useWordsInfinite({ q: debouncedQuery || undefined });
    const selectedIds = useMemo(() => new Set(selected.map((w) => w.id)), [selected]);
    const rows = useMemo(
        () =>
            (wordsQuery.data?.pages.flatMap((page) => page.items) ?? []).filter(
                (row) => row.user === userId && !selectedIds.has(row.id) && !excludeIds?.has(row.id),
            ),
        [wordsQuery.data, userId, selectedIds, excludeIds],
    );

    function pick(row: WordSimpleBE) {
        onSelectedChange([...selected, { id: row.id, label: headlineLabel(row, languages) }]);
        setQuery('');
    }

    function unpick(id: string) {
        onSelectedChange(selected.filter((w) => w.id !== id));
    }

    const languageColumns = buildLanguageColumns({ languages, userId, showGender: true, showProgress: false });
    const columns: ColumnDef<WordSimpleBE>[] = [
        {
            id: 'pick',
            size: 32,
            header: '',
            // Purely decorative — `pointer-events-none` lets every click in
            // this cell fall through to the `<tr>`'s own handler, which is
            // what actually picks the row (see the module note above).
            cell: () => <Checkbox checked={false} tabIndex={-1} aria-hidden className="pointer-events-none" />,
        },
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

    return (
        <div>
            <div className="flex items-center justify-between gap-2">
                <span className="label">{t('tags:wordPicker.label')}</span>
                <span className="pick-count">{t('tags:wordPicker.selectedCount', { count: selected.length })}</span>
            </div>
            <div className="searchbox mt-1">
                <MagnifyingGlassIcon size={14} />
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('tags:wordPicker.searchPlaceholder')}
                    aria-label={t('tags:wordPicker.searchLabel')}
                />
            </div>
            <div className="pick-list">
                {wordsQuery.isPending ? (
                    Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                        <div key={index} className="pick-row">
                            <Skeleton className="h-4 w-full" />
                        </div>
                    ))
                ) : rows.length === 0 ? (
                    <p className="hint px-3 py-3 text-sm text-(--muted)">
                        {debouncedQuery ? t('tags:wordPicker.noMatches') : t('tags:wordPicker.noWords')}
                    </p>
                ) : (
                    <table className="w-full">
                        <tbody>
                            {table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className="pick-row"
                                    aria-pressed={false}
                                    onClick={() => pick(row.original)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            {selected.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                    {selected.map((word) => (
                        <li
                            key={word.id}
                            className="inline-flex items-center gap-1 rounded-full bg-(--fg-soft) px-2 py-1 text-xs"
                        >
                            <span className="truncate max-w-32">{word.label}</span>
                            <button
                                type="button"
                                onClick={() => unpick(word.id)}
                                aria-label={t('tags:wordPicker.removeSelected', { word: word.label })}
                                className="grid size-3.5 place-items-center rounded-full text-(--muted) hover:bg-(--fg-soft2) hover:text-(--fg)"
                            >
                                <XIcon size={10} weight="bold" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {wordsQuery.hasNextPage && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => void wordsQuery.fetchNextPage()}
                    disabled={wordsQuery.isFetchingNextPage}
                >
                    {t('review:table.loadMore')}
                </Button>
            )}
        </div>
    );
}
