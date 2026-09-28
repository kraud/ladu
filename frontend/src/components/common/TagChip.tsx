import { LockIcon, XIcon } from '@phosphor-icons/react';

/**
 * The small label pill for a tag attached to a word (D20) — `.tagchip`,
 * ported from `MOCKUPS/assets/app.css`, distinct from `.chip` (the generic
 * toggle button used for scope rails and gender/PoS filters). Two current
 * consumers: Review's read-only Tags column (`locked` only, no `×`, no
 * `onClick` — D14) and, later, the word editor sidebar's attached-tag list
 * (`removable`).
 *
 * Pre-translated text only, matching `EmptyState`'s own convention — this
 * component doesn't know about i18n namespaces.
 */
export interface TagChipProps {
    label: string;
    /** Shows a small lock glyph — a Private tag. */
    locked?: boolean;
    /** Shows a trailing `×` that calls `onRemove`. */
    removable?: boolean;
    onRemove?: () => void;
    /** Accessible label for the `×` button, e.g. `"Remove Kitchen"` — required whenever `removable` is set. */
    removeAriaLabel?: string;
    title?: string;
}

export function TagChip({ label, locked, removable, onRemove, removeAriaLabel, title }: TagChipProps) {
    return (
        <span className="tagchip" title={title ?? label}>
            {locked && <LockIcon size={10} weight="bold" />}
            <span className="truncate">{label}</span>
            {removable && (
                <button type="button" className="x" onClick={onRemove} aria-label={removeAriaLabel}>
                    <XIcon size={9} weight="bold" />
                </button>
            )}
        </span>
    );
}
