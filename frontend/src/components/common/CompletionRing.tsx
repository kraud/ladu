import type { CSSProperties } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * The small conic-gradient ring next to a Review table cell (`.ring`, ported
 * from `MOCKUPS/assets/app.css`). The completion detail (`detail`) shows in a
 * floating `Tooltip` on hover/focus — previously an inline `.ring-detail`
 * span revealed by CSS on hover, which pushed the rest of the cell's content
 * sideways; a real tooltip renders in a portal and never displaces layout.
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
        <Tooltip>
            <TooltipTrigger
                render={<span tabIndex={0} className="ring" style={{ '--pct': pct } as CSSProperties} />}
            />
            <TooltipContent>{detail}</TooltipContent>
        </Tooltip>
    );
}
