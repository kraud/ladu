import { useState } from 'react';
import { niceTicks } from '@/components/charts/scale';
import { cn } from '@/lib/utils';
import { formatCount } from '@/features/stats/format';

export interface ColumnPoint {
    /** Unique and stable: the React key. */
    key: string;
    /** The full name of the point, shown in the tooltip and the table: "Sat, 12 Sep 2026". */
    label: string;
    /** The short name on the x axis, if this point gets one. */
    axisLabel: string;
    /** `null`: no data for this point. A bar of height 0 is a real 0. */
    value: number | null;
    /** A lower bound, or a period that is not over yet: drawn lighter, and said so in the tooltip. */
    partial?: boolean;
    /** Why a value is partial, or missing. Shown in the tooltip and the table. */
    note?: string;
}

interface Props {
    points: ColumnPoint[];
    /** What one unit is: "new accounts". The tooltip says "5 new accounts". */
    unit: string;
    /** Names the whole chart for a screen reader. */
    ariaLabel: string;
    /**
     * Every n-th point gets its axis label, and the last point always does. A regular label closer
     * than n points to the last one is left out, so the two never run into each other on a narrow screen.
     */
    axisLabelEvery: number;
    /** Shown inside the plot when every value is 0 or missing. The frame stays. */
    emptyMessage: string;
    /** The first column of the table view. */
    tableHeading: string;
}

const PLOT_HEIGHT = 176;

/**
 * A column chart in plain HTML and CSS, so it scales to any width and its text stays real text.
 * One series, one color: the title names it, so there is no legend. Marks are thin (at most 24px),
 * round at the top and square at the baseline. The value of the newest point is written on its
 * column; every other value is in the tooltip (hover and keyboard focus) and in the table view.
 */
export function ColumnChart({ points, unit, ariaLabel, axisLabelEvery, emptyMessage, tableHeading }: Props) {
    const [active, setActive] = useState<number | null>(null);

    const values = points.map((p) => p.value ?? 0);
    const ticks = niceTicks(Math.max(0, ...values));
    const top = ticks[ticks.length - 1];
    const isEmpty = points.every((p) => !p.value);
    const last = points.length - 1;
    const activePoint = active === null ? null : points[active];

    const heightOf = (value: number | null) => (value === null ? 0 : (value / top) * 100);
    const describe = (p: ColumnPoint) =>
        p.value === null ? `${p.label}: no data${p.note ? `. ${p.note}` : ''}` : `${p.label}: ${formatCount(p.value)} ${unit}${p.partial ? ` (${p.note ?? 'not final'})` : ''}`;

    return (
        <figure role="group" aria-label={ariaLabel} className="flex flex-col gap-2">
            <div className="grid grid-cols-[2.5rem_1fr] gap-x-2">
                {/* y axis: the ticks carry the values that are not written on a column */}
                <div className="relative" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
                    {ticks.map((tick) => (
                        <span
                            key={tick}
                            className="absolute right-0 translate-y-1/2 text-xs text-muted-foreground"
                            style={{ bottom: `${(tick / top) * 100}%` }}
                        >
                            {formatCount(tick)}
                        </span>
                    ))}
                </div>

                <div className="flex flex-col">
                    <div className="relative" style={{ height: PLOT_HEIGHT }} onPointerLeave={() => setActive(null)}>
                        {/* hairline grid: solid, one step off the surface, behind the data */}
                        {ticks.map((tick) => (
                            <div
                                key={tick}
                                aria-hidden="true"
                                className={cn('absolute inset-x-0 border-t', tick === 0 ? 'border-foreground/25' : 'border-border')}
                                style={{ bottom: `${(tick / top) * 100}%` }}
                            />
                        ))}

                        <div className="absolute inset-0 flex items-end">
                            {points.map((p, i) => (
                                <div
                                    key={p.key}
                                    role="img"
                                    tabIndex={0}
                                    aria-label={describe(p)}
                                    data-testid="column"
                                    data-value={p.value ?? 'none'}
                                    data-partial={p.partial ? 'true' : undefined}
                                    // The whole slot is the hit target, not only the painted bar: it is full height and wider.
                                    className="group flex h-full min-w-0 flex-1 items-end justify-center outline-none"
                                    onPointerEnter={() => setActive(i)}
                                    onFocus={() => setActive(i)}
                                    onBlur={() => setActive(null)}
                                >
                                    {p.value !== null && p.value > 0 && (
                                        <div
                                            className={cn(
                                                'relative w-[70%] max-w-6 rounded-t-[4px] bg-(--accent) transition-colors',
                                                active === i && 'bg-(--accent-strong)',
                                                'group-focus-visible:ring-2 group-focus-visible:ring-ring',
                                            )}
                                            style={{ height: `${heightOf(p.value)}%`, opacity: p.partial && active !== i ? 0.5 : 1 }}
                                        >
                                            {/* Only the newest value is written on its column: a number on every bar is noise. */}
                                            {i === last && (
                                                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap text-foreground">
                                                    {formatCount(p.value)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {i === last && p.value === 0 && (
                                        <span className="absolute bottom-1 text-xs font-medium text-foreground">0</span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {isEmpty && (
                            <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
                                {emptyMessage}
                            </p>
                        )}

                        {activePoint && active !== null && (
                            <div
                                role="tooltip"
                                className={cn(
                                    'pointer-events-none absolute z-10 w-max max-w-56 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md',
                                    active < 3 ? '' : active > last - 3 ? '-translate-x-full' : '-translate-x-1/2',
                                )}
                                style={{
                                    left: `${((active + (active < 3 ? 0 : active > last - 3 ? 1 : 0.5)) / points.length) * 100}%`,
                                    bottom: `calc(${Math.min(heightOf(activePoint.value), 85)}% + 10px)`,
                                }}
                            >
                                <div className="text-sm font-semibold text-foreground">
                                    {activePoint.value === null ? 'No data' : `${formatCount(activePoint.value)} ${unit}`}
                                </div>
                                <div className="text-muted-foreground">{activePoint.label}</div>
                                {activePoint.note && <div className="text-muted-foreground">{activePoint.note}</div>}
                            </div>
                        )}
                    </div>

                    {/* x axis */}
                    <div className="flex pt-1.5" aria-hidden="true">
                        {points.map((p, i) => (
                            <div key={p.key} className="relative h-4 min-w-0 flex-1">
                                {(i === last || (i % axisLabelEvery === 0 && i <= last - axisLabelEvery)) && (
                                    <span
                                        className={cn(
                                            'absolute top-0 text-xs whitespace-nowrap text-muted-foreground',
                                            i === 0 ? 'left-0' : i === last ? 'right-0' : 'left-1/2 -translate-x-1/2',
                                        )}
                                    >
                                        {p.axisLabel}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* The table view: every value, with no need to hover. */}
            <details className="text-sm">
                <summary className="w-fit cursor-pointer text-xs text-muted-foreground hover:text-foreground">Show as table</summary>
                <div className="mt-2 max-h-64 overflow-auto rounded-md border">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 border-b bg-muted text-xs text-muted-foreground">
                            <tr>
                                <th scope="col" className="px-3 py-1.5 font-medium">
                                    {tableHeading}
                                </th>
                                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                                    Count
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...points].reverse().map((p) => (
                                <tr key={p.key} className="border-b last:border-0">
                                    <td className="px-3 py-1">
                                        {p.label}
                                        {p.note && <span className="ml-2 text-xs text-muted-foreground">{p.note}</span>}
                                    </td>
                                    <td className="px-3 py-1 text-right tabular-nums">{p.value === null ? '–' : formatCount(p.value)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </figure>
    );
}
