/**
 * The whole content of the word editor's sidebar: Clue, plus the Tags
 * section. Tags have exactly one editable state now: the shared
 * `TagCombobox` (D15/D17), embedded inline, and it only ever appears when the
 * caller passes `tagPicker` — i.e. `WordForm`'s create/edit forms. Everywhere
 * else (`WordPage`'s view state) tags are read-only chips, because tag
 * editing is no longer possible outside the create/edit form (a 2026-09-28
 * reversal of the original "mutations apply instantly, independent of the
 * word's own Save" design — see `phase-4-tags.md`'s Risks). The actions
 * (Save word, Change word type, …) live in the bottom bar, not here.
 *
 * `onClueChange` absent means read-only (`WordPage`'s view state) — clue
 * renders as plain text and only when non-empty. `tagPicker` absent means the
 * tags section is read-only too, for either of two different reasons the
 * caller distinguishes via `tagsHint`: a word reached via a followed tag
 * (tags are the tag owner's to manage) or the caller's own word just being
 * viewed, not edited (tags are still that caller's own, but changing them
 * now requires entering edit mode first).
 *
 * Collapsed (desktop icon rail, `useWordSidebar`) this shows two icon
 * buttons instead: Clue and Tags. The icon says whether there is something
 * in them — a clue with text swaps `PencilSimple` for `PencilSimpleLine`;
 * tags swap the plain tag for a duotone one with a count badge. A click
 * expands the sidebar, and the Clue button also moves focus into the clue
 * field. Below 920px the sidebar is always a full drawer, so the rail never
 * shows there.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PencilSimpleIcon, PencilSimpleLineIcon, TagIcon } from '@phosphor-icons/react';
import { Textarea } from '@/components/ui/textarea';
import { TagChip } from '@/components/common/TagChip';
import { TagCombobox, type TagComboboxItem } from '@/features/tags/components/TagCombobox';
import { useWordSidebar } from './useWordSidebar';
import type { WordTagRef } from '../types';

export interface SidebarFieldsProps {
    clue: string;
    onClueChange?: (value: string) => void;
    /** The word's current tags, read-only display. Ignored when `tagPicker` is set. */
    tags?: WordTagRef[];
    /** Shown under the read-only chip list, explaining why tags can't be changed here. */
    tagsHint?: string;
    /** Create/edit mode only — renders the tag combobox inline instead of a static list. */
    tagPicker?: {
        selected: TagComboboxItem[];
        onSelectedChange: (next: TagComboboxItem[]) => void;
    };
}

export function SidebarFields({ clue, onClueChange, tags = [], tagsHint, tagPicker }: SidebarFieldsProps) {
    const { t } = useTranslation();
    const { collapsed, setCollapsed } = useWordSidebar();
    const readOnly = !onClueChange;
    const tagCount = tagPicker ? tagPicker.selected.length : tags.length;
    const clueRef = useRef<HTMLTextAreaElement>(null);
    const focusClueOnExpand = useRef(false);

    // The Clue rail button expands the sidebar; the textarea only exists after
    // that render, so the focus request waits for it here.
    useEffect(() => {
        if (collapsed || !focusClueOnExpand.current) return;
        focusClueOnExpand.current = false;
        clueRef.current?.focus();
    }, [collapsed]);

    const clueLabel = t('wordRelated:formComponentLabel.clue');
    const tagsLabel = t('wordRelated:formComponentLabel.tags');
    const hasClue = clue.trim() !== '';

    if (collapsed) {
        const ClueIcon = hasClue ? PencilSimpleLineIcon : PencilSimpleIcon;
        return (
            <div className="flex flex-col items-center gap-1">
                {/* A read-only word without a clue has nothing to show under Clue. */}
                {(!readOnly || hasClue) && (
                    <button
                        type="button"
                        className="icon-btn"
                        aria-label={clueLabel}
                        title={clueLabel}
                        data-filled={hasClue || undefined}
                        onClick={() => {
                            focusClueOnExpand.current = !readOnly;
                            setCollapsed(false);
                        }}
                    >
                        <ClueIcon size={18} />
                    </button>
                )}
                <button
                    type="button"
                    className="icon-btn relative"
                    aria-label={tagsLabel}
                    title={tagsLabel}
                    data-filled={tagCount > 0 || undefined}
                    onClick={() => setCollapsed(false)}
                >
                    <TagIcon size={18} weight={tagCount > 0 ? 'duotone' : 'regular'} />
                    {tagCount > 0 && (
                        <span
                            data-testid="tag-count"
                            className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-(--accent) px-1 text-[10px] font-semibold leading-4 text-(--accent-ink)"
                        >
                            {tagCount}
                        </span>
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {/* A read-only word without a clue has nothing to show under Clue. */}
            {(!readOnly || hasClue) && (
                <div className="field">
                    {readOnly ? (
                        <p className="label">{clueLabel}</p>
                    ) : (
                        <label className="label" htmlFor="word-clue">
                            {clueLabel}
                        </label>
                    )}
                    {readOnly ? (
                        <p className="text-sm text-foreground">{clue}</p>
                    ) : (
                        <Textarea
                            id="word-clue"
                            ref={clueRef}
                            value={clue}
                            onChange={(e) => onClueChange?.(e.target.value)}
                        />
                    )}
                </div>
            )}

            <div className="field">
                <span className="label flex items-center gap-1.5" id="sidebar-tags-label">
                    <TagIcon size={14} />
                    {tagsLabel}
                </span>
                {tagPicker ? (
                    <TagCombobox mode="add" selected={tagPicker.selected} onSelectedChange={tagPicker.onSelectedChange} />
                ) : (
                    <>
                        <div
                            className="card flex min-h-9 flex-wrap items-center gap-1.5 p-2"
                            role="group"
                            aria-labelledby="sidebar-tags-label"
                        >
                            {tags.map((tag) => (
                                <TagChip key={tag.id} label={tag.label} locked={tag.visibility === 'Private'} />
                            ))}
                        </div>
                        {tagsHint && <p className="hint">{tagsHint}</p>}
                    </>
                )}
            </div>
        </div>
    );
}
