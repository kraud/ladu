/**
 * The shared "type to find a tag" primitive (D15/D17) — a search box, an
 * always-visible list of matches below it (the same search -> list shape
 * `WordPicker` already established, not a floating dropdown: one fewer
 * interaction pattern to build/test, and consistent with picking words
 * elsewhere in this feature), and a row of removable pills for what's
 * already picked. Reused in two hosts that only differ in which tags are
 * disabled and whether quick-create is offered:
 *
 *  - **`mode="filter"`** (Review's `FilterBar`, inline, applies instantly):
 *    scoped to the caller's owned + followed tags (`scope=all`); a followed
 *    tag that's currently unavailable (D9) still matches, shown disabled
 *    with a tooltip, since picking it would silently return nothing.
 *  - **`mode="add"`** (`TagPickerDialog`, bulk "Add tags", staged until
 *    Save): same `scope=all` search, but only *owned* tags are pickable — a
 *    followed tag can never be attached to the caller's own word (D10) —
 *    shown disabled with a tooltip instead of hidden, for context rather
 *    than a dead end. Typing a label with no exact match offers an inline
 *    "Create new tag" row (Private by default, D13's uniqueness check
 *    surfaces the same way the full create form's does).
 *  - **`mode="remove"`** (`TagPickerDialog`, bulk "Remove tags"): scoped to
 *    `scope=owned` and narrowed further by the caller's `restrictToIds` (the
 *    tags actually present on every selected word) — nothing here is ever
 *    disabled, since by D10 a caller's own word can only ever carry the
 *    caller's own tags.
 *
 * Deliberately self-contained (owns its own debounced search query and, in
 * add mode, its own create-tag mutation) rather than a dumb props-driven
 * component — matches `WordPicker`'s own precedent for a shared picker, not
 * `ReviewTable`/`TagWordsTable`'s "page owns the query" convention, since
 * there's no page-level state here worth lifting (unlike those tables' rows,
 * which a page also needs for other computations).
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { MagnifyingGlassIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import { useCreateTag, useTags } from '../hooks';
import { tagErrorKey } from '../errors';
import type { TagScope, TagSummary } from '../types';

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = 3;

export type TagComboboxMode = 'filter' | 'add' | 'remove';

export interface TagComboboxProps {
    mode: TagComboboxMode;
    selected: TagSummary[];
    onSelectedChange: (next: TagSummary[]) => void;
    /** `mode="remove"` only — narrows matches to the tags actually present on the target word(s). */
    restrictToIds?: ReadonlySet<string>;
}

function disabledReason(tag: TagSummary, mode: TagComboboxMode, t: TFunction): string | undefined {
    if (mode === 'remove') return undefined;
    if (mode === 'filter') {
        return tag.isAvailable ? undefined : t('tags:combobox.unavailableTooltip');
    }
    // mode === 'add'
    if (tag.isOwner) return undefined;
    return tag.isAvailable
        ? t('tags:combobox.followedReadOnlyTooltip', { author: tag.author.username })
        : t('tags:combobox.unavailableTooltip');
}

export function TagCombobox({ mode, selected, onSelectedChange, restrictToIds }: TagComboboxProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebouncedCallback(query, SEARCH_DEBOUNCE_MS);

    const scope: TagScope = mode === 'remove' ? 'owned' : 'all';
    const tagsQuery = useTags({ scope, q: debouncedQuery || undefined });
    const createTag = useCreateTag();

    const results = useMemo(() => tagsQuery.data?.pages[0]?.items ?? [], [tagsQuery.data]);
    const selectedIds = useMemo(() => new Set(selected.map((tag) => tag.id)), [selected]);
    const rows = useMemo(
        () => results.filter((tag) => !selectedIds.has(tag.id) && (!restrictToIds || restrictToIds.has(tag.id))),
        [results, selectedIds, restrictToIds],
    );

    const trimmedQuery = query.trim();
    const hasExactMatch = results.some((tag) => tag.label.toLowerCase() === trimmedQuery.toLowerCase());
    const showQuickCreate = mode === 'add' && trimmedQuery !== '' && !hasExactMatch;

    function pick(tag: TagSummary) {
        onSelectedChange([...selected, tag]);
    }

    function unpick(id: string) {
        onSelectedChange(selected.filter((tag) => tag.id !== id));
    }

    function handleCreate() {
        createTag.mutate(
            { label: trimmedQuery, visibility: 'Private' },
            { onSuccess: (created) => onSelectedChange([...selected, created]) },
        );
    }

    return (
        <div>
            {selected.length > 0 && (
                <div className="flex items-center justify-end">
                    <span className="pick-count">{t('tags:wordPicker.selectedCount', { count: selected.length })}</span>
                </div>
            )}
            <div className="searchbox">
                <MagnifyingGlassIcon size={14} />
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t(`tags:combobox.${mode}Placeholder`)}
                    aria-label={t(`tags:combobox.${mode}Placeholder`)}
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
                {tagsQuery.isPending ? (
                    Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                        <div key={index} className="pick-row">
                            <Skeleton className="h-4 w-full" />
                        </div>
                    ))
                ) : rows.length === 0 && !showQuickCreate ? (
                    <p className="hint px-3 py-3 text-sm text-(--muted)">
                        {trimmedQuery ? t('tags:combobox.noMatches') : t('tags:combobox.noTags')}
                    </p>
                ) : (
                    <>
                        {rows.map((tag) => {
                            const reason = disabledReason(tag, mode, t);
                            const row = (
                                <div
                                    key={tag.id}
                                    className="pick-row"
                                    aria-disabled={reason ? 'true' : undefined}
                                    onClick={() => !reason && pick(tag)}
                                >
                                    <span className="pw truncate">{tag.label}</span>
                                    {tag.visibility === 'Private' && (
                                        <span className="hint">{t('tags:visibility.private')}</span>
                                    )}
                                </div>
                            );
                            return reason ? (
                                <Tooltip key={tag.id}>
                                    <TooltipTrigger render={row} />
                                    <TooltipContent>{reason}</TooltipContent>
                                </Tooltip>
                            ) : (
                                row
                            );
                        })}
                        {showQuickCreate && (
                            <div
                                className="pick-row pick-row-create"
                                aria-disabled={createTag.isPending ? 'true' : undefined}
                                onClick={() => !createTag.isPending && handleCreate()}
                            >
                                <PlusIcon size={13} weight="bold" />
                                <span className="truncate">{t('tags:combobox.createTag', { label: trimmedQuery })}</span>
                            </div>
                        )}
                    </>
                )}
            </div>
            {createTag.isError && <p className="text-xs text-(--danger)">{t(tagErrorKey(createTag.error))}</p>}
            {selected.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                    {selected.map((tag) => (
                        <li
                            key={tag.id}
                            className="inline-flex items-center gap-1 rounded-full bg-(--accent-soft) px-2 py-1 text-xs font-medium text-(--accent-strong)"
                        >
                            <span className="truncate max-w-32">{tag.label}</span>
                            <button
                                type="button"
                                onClick={() => unpick(tag.id)}
                                aria-label={t('tags:combobox.removeSelected', { label: tag.label })}
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
