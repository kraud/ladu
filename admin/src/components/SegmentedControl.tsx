import { cn } from '@/lib/utils';

interface Option<T extends string> {
    value: T;
    label: string;
}

/** A small set of choices, one of which is always on. Plain buttons, so the keyboard works without extra code. */
export function SegmentedControl<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: Option<T>[];
    onChange: (value: T) => void;
}) {
    return (
        <div role="group" aria-label={label} className="inline-flex rounded-md border bg-card p-0.5 text-sm">
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={option.value === value}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'rounded-[5px] px-2.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        option.value === value ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
