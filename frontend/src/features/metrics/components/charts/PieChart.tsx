/**
 * Donut chart + legend, ported from the mockup's `polar`/`donutSeg`/`renderPie`
 * (`MOCKUPS/dashboard.html:289-334`). Props-only and router-free: the caller
 * (`MetricsPanel`, Slice 6) resolves colours (`chartColors.ts`), translates
 * every string, and decides what clicking the worst segment does
 * (`useNavigate()` per D7 in the phase plan) — this component only renders
 * and calls `onWorstClick`.
 *
 * Only the legend row is an interactive element; the wedge itself is
 * visual-only (dashed outline marks the worst segment) so the accessible
 * surface is the legend, matching how this component is tested.
 */
const CX = 110;
const CY = 110;
const OUTER_RADIUS = 86;
const INNER_RADIUS = 56;

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function donutSegPath(a0: number, a1: number): string {
    const large = a1 - a0 > 180 ? 1 : 0;
    const [x0, y0] = polar(CX, CY, OUTER_RADIUS, a0);
    const [x1, y1] = polar(CX, CY, OUTER_RADIUS, a1);
    const [x2, y2] = polar(CX, CY, INNER_RADIUS, a1);
    const [x3, y3] = polar(CX, CY, INNER_RADIUS, a0);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} A${INNER_RADIUS} ${INNER_RADIUS} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`;
}

export interface PieChartSegment {
    /** Stable identity — a `PartOfSpeech` enum value or a `UI_LANGUAGES` label; not shown. */
    key: string;
    /** Translated display name. */
    label: string;
    count: number;
    /** A CSS colour, e.g. `var(--accent)` — see `chartColors.ts`. */
    color: string;
}

export interface PieChartProps {
    segments: PieChartSegment[];
    total: number;
    /** Translated unit noun ("words" / "translations"), shown uppercase under the centre total. */
    unitLabel: string;
    /** The smallest segment, or `null` for an empty chart (defensive — callers gate on `totalWords === 0` first). */
    worst: PieChartSegment | null;
    onWorstClick?: () => void;
    /** `role="img"` label for the whole chart. */
    ariaLabel: string;
}

export function PieChart({ segments, total, unitLabel, worst, onWorstClick, ariaLabel }: PieChartProps) {
    let angle = 0;
    const wedges = segments.map((segment) => {
        const sweep = total > 0 ? (segment.count / total) * 360 : 0;
        const isWorst = worst != null && segment.key === worst.key;
        const path = (
            <path
                key={segment.key}
                d={donutSegPath(angle, angle + sweep)}
                fill={segment.color}
                stroke={isWorst ? 'var(--fg)' : undefined}
                strokeWidth={isWorst ? 1.5 : undefined}
                strokeDasharray={isWorst ? '3 3' : undefined}
            />
        );
        angle += sweep;
        return path;
    });

    return (
        <div className="pie-wrap">
            <svg width={220} height={220} viewBox="0 0 220 220" role="img" aria-label={ariaLabel}>
                {wedges}
                <text x={CX} y={CY - 4} textAnchor="middle" className="pie-total">
                    {total.toLocaleString()}
                </text>
                <text x={CX} y={CY + 16} textAnchor="middle" className="pie-unit">
                    {unitLabel}
                </text>
            </svg>
            <ul className="pie-legend">
                {segments.map((segment) => {
                    const percent = total > 0 ? Math.round((segment.count / total) * 100) : 0;
                    const isWorst = worst != null && segment.key === worst.key;
                    const row = (
                        <>
                            <span className="dot" style={{ background: segment.color }} aria-hidden="true" />
                            <span className="l-name">{segment.label}</span>
                            <span className="l-count">{segment.count.toLocaleString()}</span>
                            <span className="l-pct">{percent}%</span>
                        </>
                    );
                    return (
                        <li key={segment.key}>
                            {isWorst ? (
                                <button type="button" className="legend-row" onClick={onWorstClick}>
                                    {row}
                                </button>
                            ) : (
                                <span className="legend-row">{row}</span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
