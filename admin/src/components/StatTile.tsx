import type { ReactNode } from 'react';

/**
 * A single number with its name, and an optional line under it. The value uses
 * the font's normal (proportional) digits: equal-width digits look loose at this size.
 */
export function StatTile({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
    return (
        <div className="flex flex-col gap-0.5 rounded-lg border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-3xl leading-tight font-semibold">{value}</dd>
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
    );
}
