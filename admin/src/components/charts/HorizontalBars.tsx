import type { CSSProperties } from 'react';
import { formatCount, formatShare } from '@/features/stats/format';

export interface BarRow {
    label: string;
    value: number;
}

/**
 * One bar for each category, longest first. The categories have no order of their own, so every
 * bar has the same color: a color that grows with the value would only repeat the length.
 * The value sits at the tip of its bar. The list is its own table view.
 */
export function HorizontalBars({ rows, total, unit, emptyMessage }: { rows: BarRow[]; total: number; unit: string; emptyMessage: string }) {
    if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;

    const max = Math.max(...rows.map((row) => row.value), 1);

    return (
        <ul className="flex flex-col gap-2.5">
            {rows.map((row) => (
                <li key={row.label} className="grid grid-cols-[6rem_1fr] items-center gap-3 text-sm">
                    <span className="truncate">{row.label}</span>
                    <div className="flex items-center gap-2">
                        {/* The bar leaves room at the end for the value, so a full bar never pushes it out. */}
                        <div
                            role="img"
                            aria-label={`${row.label}: ${formatCount(row.value)} ${unit}, ${formatShare(row.value, total)} of all`}
                            data-testid="bar"
                            className="h-4 w-[calc((100%-7rem)*var(--ratio))] rounded-r-[4px] bg-(--accent)"
                            style={{ '--ratio': row.value / max, minWidth: row.value > 0 ? 2 : undefined } as CSSProperties}
                        />
                        <span className="text-xs whitespace-nowrap text-foreground">
                            <span className="font-medium">{formatCount(row.value)}</span>
                            <span className="text-muted-foreground"> · {formatShare(row.value, total)}</span>
                        </span>
                    </div>
                </li>
            ))}
        </ul>
    );
}
