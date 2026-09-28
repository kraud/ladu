/**
 * Search -> table -> selected list (phase-4-tags.md D18, revised after
 * Slice 6 feedback). Shared by the create-tag dialog's optional "Add words
 * now" section (embedded inline) and `/tag/:id`'s "Add words" action
 * (wrapped in `AddWordsDialog`) — this component renders no dialog chrome of
 * its own, just the picker itself, so either call site can host it.
 *
 * Revisions from the original D18 build:
 *  - **Default list is "recently added", not the full account, and is
 *    small.** No query -> a `PICKER_PAGE_SIZE`-at-a-time feed of the
 *    caller's newest words (the same default order `GET /api/words/simple`
 *    already returns — newest `createdAt` first — so no new backend sort is
 *    needed). Past `PICKER_DEFAULT_CAP` loaded, "Load more" is replaced by a
 *    "Go to Review" action: this picker is for quickly grabbing a handful of
 *    words while making a tag, not for browsing the whole collection.
 *  - **Picking no longer clears the search box.** A search that matched
 *    several words the user wants would otherwise be destroyed by the first
 *    pick. A dedicated clear (×) button inside the search box does that job
 *    instead, only shown once there's something to clear.
 *  - **Rows show a compact, dash-joined list of the languages that DO have a
 *    translation — no per-language `WordCell`/"+" affordance.** This is a
 *    picker, not an editor; a missing translation isn't something to fix
 *    from here.
 *  - **"Load more" is the list's own last row, not a button floating below
 *    it** — labelled with exactly how many more will load
 *    ("Load more (3)"), computed from the backend's own `total` for the
 *    current filter. Once nothing more can load it turns into a disabled
 *    "All words loaded" row instead of disappearing, so the list always ends
 *    in something legible rather than just stopping.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import { partOfSpeechLabelKey } from '@/lib/words';
import { posAbbrKey } from '@/features/words/review/columns';
import { accountLanguageOrder } from '@/features/words/review/search';
import { useWordsInfinite } from '@/features/words/hooks';
import type { LangKey, WordSimpleBE } from '@/features/words/types';

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = 3;
const PICKER_PAGE_SIZE = 5;
/** Past this many loaded in the default (no-query) "recent" feed, "Load more" gives way to a "Go to Review" link. */
const PICKER_DEFAULT_CAP = 20;

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
    /**
     * Past `PICKER_DEFAULT_CAP` in the default feed, a "Go to Review" action
     * replaces "Load more". A callback rather than a `<Link>`, matching
     * `ReviewTable`'s own "navigation as callbacks, so this stays testable
     * through `renderWithProviders`" convention — this component is embedded
     * in dialogs that are themselves tested without a router. The owning
     * page (which already has `useNavigate`) supplies it.
     */
    onGoToReview?: () => void;
}

/** The first stored headline word across the account's language order — matches `cellTitle.ts`'s "pick any language" fallback logic, simplified for a label rather than a dialog title. */
function headlineLabel(row: WordSimpleBE, languages: readonly string[]): string {
    for (const lang of languages) {
        const value = row[`data${lang}` as keyof WordSimpleBE];
        if (typeof value === 'string' && value) return value;
    }
    return row.id;
}

/** Every language that has a translation, in account order, dash-joined — no placeholder for the ones that don't. */
function availableTranslationsSummary(row: WordSimpleBE, languages: readonly LangKey[]): string {
    return languages
        .map((lang) => row[`data${lang}` as keyof WordSimpleBE])
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join(' - ');
}

export function WordPicker({ selected, onSelectedChange, excludeIds, onGoToReview }: WordPickerProps) {
    const { t } = useTranslation();
    const userId = useAuthStore((s) => s.user?.id ?? '');
    const userLanguages = useAuthStore((s) => s.user?.languages ?? []);
    const languages = useMemo(() => accountLanguageOrder(userLanguages), [userLanguages]);

    const [query, setQuery] = useState('');
    const debouncedQuery = useDebouncedCallback(query, SEARCH_DEBOUNCE_MS);
    const isSearching = debouncedQuery !== '';

    const wordsQuery = useWordsInfinite({ q: debouncedQuery || undefined }, PICKER_PAGE_SIZE);
    const selectedIds = useMemo(() => new Set(selected.map((w) => w.id)), [selected]);
    const rows = useMemo(
        () =>
            (wordsQuery.data?.pages.flatMap((page) => page.items) ?? []).filter(
                (row) => row.user === userId && !selectedIds.has(row.id) && !excludeIds?.has(row.id),
            ),
        [wordsQuery.data, userId, selectedIds, excludeIds],
    );

    const atDefaultCap = !isSearching && rows.length >= PICKER_DEFAULT_CAP;
    const showLoadMore = wordsQuery.hasNextPage && !atDefaultCap;
    const showGoToReview = wordsQuery.hasNextPage && atDefaultCap;

    // How many the next "Load more" click will actually fetch — the raw
    // (pre-client-filter) count already loaded vs. the backend's own `total`
    // for this filter, capped at one page. An approximation when
    // `selected`/`excludeIds` have trimmed some already-loaded rows out of
    // `rows`, but close enough for a hint label.
    const rawLoadedCount = wordsQuery.data?.pages.reduce((sum, page) => sum + page.items.length, 0) ?? 0;
    const total = wordsQuery.data?.pages[0]?.total ?? 0;
    const nextBatchSize = Math.min(PICKER_PAGE_SIZE, Math.max(0, total - rawLoadedCount));

    function pick(row: WordSimpleBE) {
        onSelectedChange([...selected, { id: row.id, label: headlineLabel(row, languages) }]);
    }

    function unpick(id: string) {
        onSelectedChange(selected.filter((w) => w.id !== id));
    }

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
                {query !== '' && (
                    <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label={t('tags:wordPicker.clearSearch')}
                        className="grid size-4 shrink-0 place-items-center rounded-full text-(--muted) hover:bg-(--fg-soft2) hover:text-(--fg)"
                    >
                        <XIcon size={11} weight="bold" />
                    </button>
                )}
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
                        {isSearching ? t('tags:wordPicker.noMatches') : t('tags:wordPicker.noWords')}
                    </p>
                ) : (
                    <table className="w-full">
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id} className="pick-row" aria-pressed={false} onClick={() => pick(row)}>
                                    <td>
                                        {/* Purely decorative — `pointer-events-none` lets every click in
                                            this cell fall through to the `<tr>`'s own handler, which is
                                            what actually picks the row. */}
                                        <Checkbox
                                            checked={false}
                                            tabIndex={-1}
                                            aria-hidden
                                            className="pointer-events-none"
                                        />
                                    </td>
                                    <td>
                                        <span className="pos-abbr" title={t(partOfSpeechLabelKey(row.partOfSpeech))}>
                                            {t(posAbbrKey(row.partOfSpeech))}
                                        </span>
                                    </td>
                                    <td className="truncate text-sm">{availableTranslationsSummary(row, languages)}</td>
                                </tr>
                            ))}
                            {showLoadMore && (
                                <tr
                                    className={`pick-row justify-center text-center${wordsQuery.isFetchingNextPage ? ' pointer-events-none opacity-60' : ''}`}
                                    onClick={() => {
                                        if (!wordsQuery.isFetchingNextPage) void wordsQuery.fetchNextPage();
                                    }}
                                >
                                    <td colSpan={3} className="text-center text-(--accent-strong) font-medium">
                                        {t('tags:wordPicker.loadMoreCount', { count: nextBatchSize })}
                                    </td>
                                </tr>
                            )}
                            {showGoToReview && (
                                <tr className="pick-row justify-center text-center" onClick={onGoToReview}>
                                    <td colSpan={3} className="text-center text-(--accent-strong) font-medium">
                                        {t('tags:wordPicker.goToReview')}
                                    </td>
                                </tr>
                            )}
                            {!wordsQuery.hasNextPage && (
                                <tr className="pick-row pointer-events-none justify-center text-center opacity-60" aria-disabled="true">
                                    <td colSpan={3} className="text-center text-(--muted)">
                                        {t('tags:wordPicker.allLoaded')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
            {selected.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                    {selected.map((word) => (
                        <li
                            key={word.id}
                            className="inline-flex items-center gap-1 rounded-full bg-(--accent-soft) px-2 py-1 text-xs font-medium text-(--accent-strong)"
                        >
                            <span className="truncate max-w-32">{word.label}</span>
                            <button
                                type="button"
                                onClick={() => unpick(word.id)}
                                aria-label={t('tags:wordPicker.removeSelected', { word: word.label })}
                                className="grid size-3.5 place-items-center rounded-full text-(--accent-strong) hover:bg-(--accent-soft2)"
                            >
                                <XIcon size={10} weight="bold" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
