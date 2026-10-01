interface Option {
    value: string;
    label: string;
}

/** A native select: a filter needs no custom popup, and it stays keyboard- and phone-friendly. */
export function FilterSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string | undefined;
    options: Option[];
    onChange: (value: string | undefined) => void;
}) {
    return (
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {label}
            <select
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value || undefined)}
                className="h-9 rounded-md border border-input bg-card px-2 text-sm font-normal text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-(--accent-soft)"
            >
                <option value="">All</option>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
