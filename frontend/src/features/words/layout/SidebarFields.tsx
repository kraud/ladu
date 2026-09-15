/**
 * The sidebar's non-grammatical fields: Clue, plus a visibly disabled Tags
 * placeholder (tags stay deferred to Phase 4 — D1 — this only makes the
 * final shape legible and gives Phase 4 its insertion point).
 *
 * `onClueChange` absent means read-only (`WordPage`'s view state) — clue
 * renders as plain text and only when non-empty, matching the old inline
 * render it replaces (`WordPage.tsx`'s former `{word.clue && …}` block).
 *
 * Collapsed (icon rail) hides this whole block — there's no icon-only form
 * for a textarea worth the width — restored below 920px regardless of the
 * rail preference, since the sidebar is always a full drawer there
 * (`WordEditorLayout`). The rail's own collapse toggle is how a user gets
 * back to it.
 */
import { useTranslation } from 'react-i18next';
import { TagIcon } from '@phosphor-icons/react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface SidebarFieldsProps {
    clue: string;
    onClueChange?: (value: string) => void;
    collapsed?: boolean;
}

export function SidebarFields({ clue, onClueChange, collapsed }: SidebarFieldsProps) {
    const { t } = useTranslation();
    const readOnly = !onClueChange;

    if (readOnly && !clue) {
        if (collapsed) return null;
        return (
            <div className="flex flex-col gap-3">
                <TagsPlaceholder />
            </div>
        );
    }

    return (
        <div className={cn('flex flex-col gap-3', collapsed && 'hidden max-[920px]:flex')}>
            <div className="field">
                {readOnly ? (
                    <p className="label">{t('wordRelated:formComponentLabel.clue')}</p>
                ) : (
                    <label className="label" htmlFor="word-clue">
                        {t('wordRelated:formComponentLabel.clue')}
                    </label>
                )}
                {readOnly ? (
                    <p className="text-sm text-foreground">{clue}</p>
                ) : (
                    <Textarea id="word-clue" value={clue} onChange={(e) => onClueChange?.(e.target.value)} />
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
