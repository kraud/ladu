/**
 * The shared "type to find a tag" primitive (D15/D17) — now a real
 * `Combobox` (`@base-ui/react/combobox`, `components/ui/combobox.tsx`):
 * picked tags render as removable chips *inside* the search box, and matches
 * open in a floating popover instead of an always-visible list below the
 * input. Replaces the earlier "always-visible list + separate pill row"
 * build (see git history), which grew the Review filter bar's height
 * unpredictably — the popover fixes that by construction. Reused in two
 * hosts that only differ in which tags are disabled and whether quick-create
 * is offered:
 *
 *  - **`mode="filter"`** (Review's `FilterBar`, inline, applies instantly):
 *    scoped to the caller's owned + followed tags (`scope=all`); a followed
 *    tag that's currently unavailable (D9) still matches, shown disabled
 *    with a tooltip, since picking it would silently return nothing.
 *  - **`mode="add"`** (`TagPickerDialog`, bulk "Add tags", staged until
 *    Save; also embedded directly in the word editor sidebar, D4a): same
 *    `scope=all` search, but only *owned* tags are pickable — a followed tag
 *    can never be attached to the caller's own word (D10) — shown disabled
 *    with a tooltip instead of hidden, for context rather than a dead end.
 *    Typing a label with no exact match offers an inline "Create new tag"
 *    row (Private by default, D13's uniqueness check surfaces the same way
 *    the full create form's does).
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
 *
 * `items` is server-filtered already (`useTags({ q })`), so `filter={null}`
 * disables the primitive's own client-side text filtering — it would only
 * re-filter an already-filtered, already-debounced list.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { LockIcon, MagnifyingGlassIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import {
    Combobox,
    ComboboxChip,
    ComboboxChipRemove,
    ComboboxChips,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from '@/components/ui/combobox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import { useCreateTag, useTags } from '../hooks';
import { tagErrorKey } from '../errors';
import type { TagScope, TagSummary, TagVisibility } from '../types';

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = 3;

export type TagComboboxMode = 'filter' | 'add' | 'remove';

/**
 * The only shape `TagCombobox` actually needs for a *picked* tag — rendering
 * a chip (label + a lock icon on Private) and excluding it from the search
 * results by id. A full `TagSummary` satisfies this, but so does a word's own
 * `WordTagRef` (`features/words/types.ts`, id/label/visibility + authorId),
 * which is what the word editor's embedded combobox (D4a) drives `selected`
 * from directly — no need to round-trip through a full tag fetch just to
 * hand this component something it would only pick three fields back out of.
 */
export interface TagComboboxItem {
    id: string;
    label: string;
    visibility: TagVisibility;
}

export interface TagComboboxProps {
    mode: TagComboboxMode;
    selected: TagComboboxItem[];
    onSelectedChange: (next: TagComboboxItem[]) => void;
    /** `mode="remove"` only — narrows matches to the tags actually present on the target word(s). */
    restrictToIds?: ReadonlySet<string>;
    /**
     * Tags that are already chosen elsewhere and must not be offered again. For a host that keeps
     * its picks outside the box (`selected` stays empty, as in Practice's tag picker); a tag in
     * `selected` is never offered anyway.
     */
    excludeIds?: ReadonlySet<string>;
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

function isSameTag(a: TagComboboxItem, b: TagComboboxItem): boolean {
    return a.id === b.id;
}

export function TagCombobox({ mode, selected, onSelectedChange, restrictToIds, excludeIds }: TagComboboxProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    // Picking a tag closes the list and clears the search: the next pick starts fresh.
    const [open, setOpen] = useState(false);
    const debouncedQuery = useDebouncedCallback(query, SEARCH_DEBOUNCE_MS);

    const scope: TagScope = mode === 'remove' ? 'owned' : 'all';
    const tagsQuery = useTags({ scope, q: debouncedQuery || undefined });
    const createTag = useCreateTag();

    const results = useMemo(() => tagsQuery.data?.pages[0]?.items ?? [], [tagsQuery.data]);
    const selectedIds = useMemo(() => new Set(selected.map((tag) => tag.id)), [selected]);
    const rows = useMemo(
        () =>
            results.filter(
                (tag) =>
                    !selectedIds.has(tag.id) &&
                    !excludeIds?.has(tag.id) &&
                    (!restrictToIds || restrictToIds.has(tag.id)),
            ),
        [results, selectedIds, excludeIds, restrictToIds],
    );

    const trimmedQuery = query.trim();
    const hasExactMatch = results.some((tag) => tag.label.toLowerCase() === trimmedQuery.toLowerCase());
    const showQuickCreate = mode === 'add' && trimmedQuery !== '' && !hasExactMatch;
    const placeholder = t(`tags:combobox.${mode}Placeholder`);

    function handleCreate() {
        createTag.mutate(
            { label: trimmedQuery, visibility: 'Private' },
            {
                onSuccess: (created) => {
                    onSelectedChange([...selected, created]);
                    setQuery('');
                },
            },
        );
    }

    return (
        <div className="flex flex-col gap-1.5">
            <Combobox
                items={rows}
                filter={null}
                multiple
                value={selected}
                onValueChange={(next) => {
                    onSelectedChange(next);
                    setQuery('');
                    setOpen(false);
                }}
                open={open}
                onOpenChange={setOpen}
                isItemEqualToValue={isSameTag}
                itemToStringLabel={(tag: TagComboboxItem) => tag.label}
                inputValue={query}
                onInputValueChange={setQuery}
            >
                <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-(--accent-soft)">
                    <MagnifyingGlassIcon size={14} className="shrink-0 text-(--muted)" />
                    <ComboboxChips>
                        {selected.map((tag) => (
                            <ComboboxChip key={tag.id}>
                                {tag.visibility === 'Private' && <LockIcon size={10} weight="bold" />}
                                <span className="max-w-32 truncate">{tag.label}</span>
                                <ComboboxChipRemove aria-label={t('tags:combobox.removeSelected', { label: tag.label })}>
                                    <XIcon size={10} weight="bold" />
                                </ComboboxChipRemove>
                            </ComboboxChip>
                        ))}
                        <ComboboxInput placeholder={placeholder} aria-label={placeholder} />
                    </ComboboxChips>
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
                <ComboboxContent>
                    <ComboboxEmpty>
                        {tagsQuery.isPending ? undefined : trimmedQuery ? t('tags:combobox.noMatches') : t('tags:combobox.noTags')}
                    </ComboboxEmpty>
                    {tagsQuery.isPending ? (
                        <div className="flex flex-col gap-1 px-1 py-1">
                            {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                                <Skeleton key={index} className="h-7 w-full" />
                            ))}
                        </div>
                    ) : (
                        <ComboboxList>
                            {(tag: TagSummary) => {
                                const reason = disabledReason(tag, mode, t);
                                const item = (
                                    <ComboboxItem key={tag.id} value={tag} disabled={Boolean(reason)}>
                                        <span className="truncate">{tag.label}</span>
                                        {tag.visibility === 'Private' && <span className="hint">{t('tags:visibility.private')}</span>}
                                    </ComboboxItem>
                                );
                                // A disabled item never fires pointer events in a real browser, so
                                // the tooltip trigger has to be a separate, non-disabled wrapper
                                // (base-ui's own recipe for "tooltip on a disabled control") —
                                // `display: contents` keeps it invisible to the listbox's layout.
                                return reason ? (
                                    <Tooltip key={tag.id}>
                                        <TooltipTrigger render={<span className="contents" />}>{item}</TooltipTrigger>
                                        <TooltipContent>{reason}</TooltipContent>
                                    </Tooltip>
                                ) : (
                                    item
                                );
                            }}
                        </ComboboxList>
                    )}
                    {showQuickCreate && (
                        <button
                            type="button"
                            className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-(--accent-strong) hover:bg-(--hover) disabled:cursor-default disabled:opacity-60"
                            disabled={createTag.isPending}
                            onClick={handleCreate}
                        >
                            <PlusIcon size={13} weight="bold" />
                            <span className="truncate">{t('tags:combobox.createTag', { label: trimmedQuery })}</span>
                        </button>
                    )}
                </ComboboxContent>
            </Combobox>
            {createTag.isError && <p className="text-xs text-(--danger)">{t(tagErrorKey(createTag.error))}</p>}
        </div>
    );
}
