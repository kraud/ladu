/**
 * The whole content of the word editor's sidebar: Clue, plus a visibly
 * disabled Tags placeholder (tags stay deferred to Phase 4 — D1 — this only
 * makes the final shape legible and gives Phase 4 its insertion point). The
 * actions (Save word, Change word type, …) live in the bottom bar, not here.
 *
 * `onClueChange` absent means read-only (`WordPage`'s view state) — clue
 * renders as plain text and only when non-empty.
 *
 * Collapsed (desktop icon rail, `useWordSidebar`) this shows two icon
 * buttons instead: Clue and Tags. The icon says whether there is something
 * in them — a clue with text swaps `PencilSimple` for `PencilSimpleLine`;
 * tags swap the plain tag for a duotone one with a count badge (`tagCount`,
 * always 0 until Phase 4). A click expands the sidebar, and the Clue button
 * also moves focus into the clue field. Below 920px the sidebar is always a
 * full drawer, so the rail never shows there.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PencilSimpleIcon, PencilSimpleLineIcon, TagIcon } from '@phosphor-icons/react';
import { Textarea } from '@/components/ui/textarea';
import { useWordSidebar } from './useWordSidebar';

export interface SidebarFieldsProps {
    clue: string;
    onClueChange?: (value: string) => void;
    /** How many tags the word has — 0 until tags ship (Phase 4). */
    tagCount?: number;
}

export function SidebarFields({ clue, onClueChange, tagCount = 0 }: SidebarFieldsProps) {
    const { t } = useTranslation();
    const { collapsed, setCollapsed } = useWordSidebar();
    const readOnly = !onClueChange;
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

    if (readOnly && !hasClue) {
        return (
            <div className="flex flex-col gap-3">
                <TagsPlaceholder />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
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
            <TagsPlaceholder />
        </div>
    );
}

function TagsPlaceholder() {
    const { t } = useTranslation();
    return (
        <div className="field opacity-60">
            <span className="label flex items-center gap-1.5">
                <TagIcon size={14} />
                {t('wordRelated:formComponentLabel.tags')}
            </span>
            <p className="hint">{t('wordRelated:wordForm.sidebar.tagsComingSoon')}</p>
        </div>
    );
}
