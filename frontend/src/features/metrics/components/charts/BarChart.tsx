/**
 * Grouped/stacked bar chart, ported from the mockup's `renderBar`
 * (`MOCKUPS/dashboard.html:345-397`). Props-only, same isolation as
 * `PieChart`: no router, no i18n, no data fetching — `MetricsPanel`
 * (Slice 6) resolves colours/labels and owns the month-vs-language and
 * group-vs-separate toggle state (D1/D4 in the phase plan).
 *
 * The mockup only ever renders one series per group (grouped-by-language);
 * D1 needs both a grouped (`stacked: false`, one bar per PoS side by side)
 * and a stacked (`stacked: true`, one bar per X-value, PoS segments stacked)
 * layout, so the bar-width/x-position maths below generalises the mockup's
 * `barW`/`bx` logic to a variable bar count per group instead of porting it
 * verbatim.
 */
const W = 640;
const H = 240;
const PAD_L = 40;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 26;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;
const GROUP_GAP = 18;
const BAR_GAP = 2;
const MAX_BAR_WIDTH_GROUPED = 14;
const MAX_BAR_WIDTH_STACKED = 32;

export interface BarSeriesMeta {
    /** Stable identity — a `PartOfSpeech` enum value. */
    key: string;
    /** Translated display name. */
    label: string;
    /** A CSS colour, e.g. `var(--accent)` — see `chartColors.ts`. */
    color: string;
}

export interface BarChartGroup {
    /** X-axis label (a `"YYYY-MM"` month or a language name). */
    xLabel: string;
    /** One count per `series` entry, same order/index. */
    values: number[];
}

export interface BarChartProps {
    groups: BarChartGroup[];
    series: BarSeriesMeta[];
    /** `true` = one bar per group, PoS segments stacked. `false` = one bar per PoS, side by side. */
    stacked: boolean;
    /** Translated unit noun ("words" / "translations"), used in each bar's native tooltip. */
    unitLabel: string;
    ariaLabel: string;
}

export function BarChart({ groups, series, stacked, unitLabel, ariaLabel }: BarChartProps) {
    const maxVal = stacked
        ? Math.max(0, ...groups.map((g) => g.values.reduce((sum, v) => sum + v, 0)))
        : Math.max(0, ...groups.flatMap((g) => g.values));
    // 4 gridline steps: the tallest bar is sized to fit within the first 3, so
    // the top step is always exactly 1 tick of headroom above it — never a
    // fixed "20" regardless of how little data there is.
    const yStep = Math.max(1, Math.ceil(maxVal / 3));
    const niceMax = yStep * 4;

    const groupW = groups.length > 0 ? PLOT_W / groups.length : PLOT_W;
    const barsPerGroup = stacked ? 1 : Math.max(series.length, 1);
    const maxBarWidth = stacked ? MAX_BAR_WIDTH_STACKED : MAX_BAR_WIDTH_GROUPED;
    const barWidth = Math.min(
        (groupW - GROUP_GAP - BAR_GAP * Math.max(barsPerGroup - 1, 0)) / barsPerGroup,
        maxBarWidth,
    );

    const yTicks = [0, 1, 2, 3, 4].map((i) => ({
        y: PAD_T + PLOT_H - (PLOT_H * i) / 4,
        value: Math.round((niceMax * i) / 4),
    }));

    return (
        <div className="bar-wrap">
            <svg className="bar-svg" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel}>
                {yTicks.map(({ y, value }) => (
                    <g key={value}>
                        <line className="grid-line" x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} />
                        <text x={PAD_L - 6} y={y + 3} textAnchor="end">
                            {value}
                        </text>
                    </g>
                ))}
                {groups.map((group, groupIndex) => {
                    const gx = PAD_L + groupIndex * groupW;
                    const totalWidth = barsPerGroup * barWidth + Math.max(barsPerGroup - 1, 0) * BAR_GAP;
                    let bx = gx + (groupW - totalWidth) / 2;
                    let cumulativeHeight = 0;

                    return (
                        <g key={group.xLabel}>
                            {series.map((s, seriesIndex) => {
                                const value = group.values[seriesIndex] ?? 0;
                                const x = bx;
                                if (!stacked) bx += barWidth + BAR_GAP;
                                if (value <= 0) return null;

                                const height = Math.max(1, (value / niceMax) * PLOT_H);
                                const y = stacked
                                    ? PAD_T + PLOT_H - cumulativeHeight - height
                                    : PAD_T + PLOT_H - height;
                                if (stacked) cumulativeHeight += height;

                                return (
                                    <rect
                                        key={s.key}
                                        className="bar"
                                        x={x}
                                        y={y}
                                        width={barWidth}
                                        height={height}
                                        rx={2.5}
                                        fill={s.color}
                                    >
                                        <title>{`${s.label}: ${value.toLocaleString()} ${unitLabel}`}</title>
                                    </rect>
                                );
                            })}
                            <text x={gx + groupW / 2} y={H - 8} textAnchor="middle">
                                {group.xLabel}
                            </text>
                        </g>
                    );
                })}
            </svg>
            <div className="bar-legend">
                {series.map((s) => (
                    <span key={s.key}>
                        <span className="dot" style={{ background: s.color }} aria-hidden="true" />
                        {s.label}
                    </span>
                ))}
            </div>
        </div>
    );
}
