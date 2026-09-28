/**
 * The whole content of the word editor's sidebar: Clue, plus a real Tags
 * section (phase-4-tags.md Slice 8) — chips for the word's current tags and
 * an "Add tag" button. The actions (Save word, Change word type, …) live in
 * the bottom bar, not here.
 *
 * `onClueChange` absent means read-only (`WordPage`'s view state) — clue
 * renders as plain text and only when non-empty. Tags are a *separate*
 * read-only switch: `onAddTag` absent means the tags section itself renders
 * disabled with a "managed by the tag's owner" note, regardless of the clue's
 * own state — a word reached via a followed tag has its tags controlled by
 * the tag's owner even though the page showing it may otherwise be in an
 * editable state, and conversely `WordPage`'s own read-only view state still
 * lets the caller add/remove tags immediately (phase-4-tags.md Risks: tag
 * mutations apply right away, independent of the word's own Save).
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
import { PencilSimpleIcon, PencilSimpleLineIcon, PlusIcon, TagIcon } from '@phosphor-icons/react';
import { Textarea } from '@/components/ui/textarea';
import { TagChip } from '@/components/common/TagChip';
import { useWordSidebar } from './useWordSidebar';
import type { WordTagRef } from '../types';

export interface SidebarFieldsProps {
    clue: string;
    onClueChange?: (value: string) => void;
    /** The word's current tags. Empty by default (a brand-new word). */
    tags?: WordTagRef[];
    /**
     * Both absent means the tags section is read-only (a word reached via a
     * followed tag) — chips render with no `×`, "Add tag" is hidden, and an
     * inline note explains why.
     */
    onRemoveTag?: (tagId: string) => void;
    onAddTag?: () => void;
}

export function SidebarFields({ clue, onClueChange, tags = [], onRemoveTag, onAddTag }: SidebarFieldsProps) {
    const { t } = useTranslation();
    const { collapsed, setCollapsed } = useWordSidebar();
    const readOnly = !onClueChange;
    const tagsReadOnly = !onAddTag;
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
                    data-filled={tags.length > 0 || undefined}
                    onClick={() => setCollapsed(false)}
                >
                    <TagIcon size={18} weight={tags.length > 0 ? 'duotone' : 'regular'} />
                    {tags.length > 0 && (
                        <span
                            data-testid="tag-count"
                            className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-(--accent) px-1 text-[10px] font-semibold leading-4 text-(--accent-ink)"
                        >
                            {tags.length}
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
                <div
                    className="card flex min-h-9 flex-wrap items-center gap-1.5 p-2"
                    role="group"
                    aria-labelledby="sidebar-tags-label"
                >
                    {tags.map((tag) => (
                        <TagChip
                            key={tag.id}
                            label={tag.label}
                            locked={tag.visibility === 'Private'}
                            removable={!tagsReadOnly}
                            onRemove={() => onRemoveTag?.(tag.id)}
                            removeAriaLabel={t('tags:combobox.removeSelected', { label: tag.label })}
                        />
                    ))}
                    {!tagsReadOnly && (
                        <button type="button" className="btn btn-sm btn-secondary" onClick={onAddTag}>
                            <PlusIcon size={12} />
                            {t('wordRelated:wordForm.sidebar.addTag')}
                        </button>
                    )}
                </div>
                <p className="hint">
                    {tagsReadOnly
                        ? t('wordRelated:wordForm.sidebar.tagsManagedByOwner')
                        : t('wordRelated:wordForm.sidebar.tagsHint')}
                </p>
            </div>
        </div>
    );
}
