import type { CSSProperties } from 'react';

/**
 * The small conic-gradient ring next to a Review table cell (`.ring` /
 * `.ring-wrap` / `.ring-detail`, ported from `MOCKUPS/assets/app.css`). The
 * hover reveal of `.ring-detail` is pure CSS (`td:hover .ring-wrap .ring-detail`)
 * — this component always renders the detail text, and the stylesheet hides
 * it until hover.
 *
 * Renders nothing when `total <= 0` (D12/completion.ts: no config exists for
 * this part-of-speech/language pair — showing a 0% ring there would be
 * actively misleading, since there's nothing to be 0% of).
 *
 * `detail` is pre-translated by the caller (e.g. `review:table.ringDetail`,
 * "N of M cases") rather than built in here — this component stays i18n-agnostic,
 * matching `EmptyState`'s convention of taking already-localized text as props.
 */
export function CompletionRing({
    value,
    total,
    detail,
}: {
    value: number;
    total: number;
    detail: string;
}) {
    if (total <= 0) return null;

    // Clamped: a v1-authored word can carry more stored cases than the v2
    // config's field count (e.g. Spanish verbs render 28 of the registry's
    // 42 rows) — the arc must never exceed a full circle.
    const pct = Math.min(100, Math.round((value / total) * 100));

    return (
        <span className="ring-wrap">
            <span className="ring" style={{ '--pct': pct } as CSSProperties} aria-hidden="true" />
            <span className="ring-detail meta">{detail}</span>
        </span>
    );
}
