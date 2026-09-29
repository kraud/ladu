import type { ReactNode } from 'react';

export interface ChipOption<T extends string | number> {
    value: T;
    label: ReactNode;
    disabled?: boolean;
}

/** A single-choice row of `.chip` pills (the parameters screen's answer style, mode, levels…). */
export function ChipGroup<T extends string | number>({
    value,
    options,
    onChange,
    label,
    disabled,
}: {
    value: T;
    options: ChipOption<T>[];
    onChange: (next: T) => void;
    label: string;
    disabled?: boolean;
}) {
    return (
        <div role="group" aria-label={label} className="flex flex-wrap gap-2">
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    className="chip disabled:cursor-not-allowed disabled:opacity-45"
                    aria-pressed={option.value === value}
                    disabled={disabled || option.disabled}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
