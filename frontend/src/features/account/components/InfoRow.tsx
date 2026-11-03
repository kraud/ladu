import type { ReactNode } from 'react';

/**
 * One label and value of a read-only Account card. `stacked` puts the value under the label, for
 * a value that needs the full width of the card (chips).
 */
export function InfoRow({ label, children, stacked }: { label: string; children: ReactNode; stacked?: boolean }) {
    return (
        <div className={stacked ? 'flex flex-col gap-1.5 py-1' : 'grid grid-cols-[96px_1fr] items-baseline gap-3 py-1'}>
            <dt className="meta">{label}</dt>
            <dd className="min-w-0 break-words text-sm font-medium">{children}</dd>
        </div>
    );
}
