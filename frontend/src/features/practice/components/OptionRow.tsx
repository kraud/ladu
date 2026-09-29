import type { ReactNode } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useIsMobile } from '@/lib/useMediaQuery';
import { ChipGroup } from './ChipGroup';

export interface OptionRowOption<T extends string | number> {
    value: T;
    label: string;
    /** One line under the label (desktop list); on the phone the selected option's line shows under the chips. */
    description?: string;
}

/**
 * One choice in the Advanced block (choice difficulty, typing strictness, word
 * order, native language). Desktop: the mockup's radio list — every option with
 * its description at once. Phone: the compact chips, with the selected option's
 * description under them. It renders in exactly one place per breakpoint, so
 * each control keeps a single accessible name.
 *
 * `hint` is the "when is this used" line under the name. A `disabled` row stays
 * visible: the hint says why it does nothing for the current choices.
 */
export function OptionRow<T extends string | number>({
    label,
    hint,
    value,
    options,
    onChange,
    disabled,
}: {
    label: string;
    hint?: ReactNode;
    value: T;
    options: OptionRowOption<T>[];
    onChange: (next: T) => void;
    disabled?: boolean;
}) {
    const mobile = useIsMobile();

    if (mobile) {
        const selected = options.find((option) => option.value === value);
        return (
            <div className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
                <span className="text-[13.5px] font-semibold">{label}</span>
                <ChipGroup
                    label={label}
                    value={value}
                    disabled={disabled}
                    onChange={onChange}
                    options={options.map(({ value: optionValue, label: optionLabel }) => ({
                        value: optionValue,
                        label: optionLabel,
                    }))}
                />
                {!disabled && selected?.description && <p className="hint">{selected.description}</p>}
                {hint && <p className="hint">{hint}</p>}
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-border py-3 last:border-b-0">
            <span className="min-w-44 text-[13.5px] font-semibold">
                {label}
                {hint && <span className="hint block font-normal">{hint}</span>}
            </span>
            <RadioGroup
                aria-label={label}
                value={String(value)}
                disabled={disabled}
                className="flex min-w-60 flex-1 flex-col gap-1.5"
                onValueChange={(next: string) => {
                    const match = options.find((option) => String(option.value) === next);
                    if (match) onChange(match.value);
                }}
            >
                {options.map((option) => (
                    <label key={option.value} className="flex items-start gap-2.5 text-sm">
                        <RadioGroupItem value={String(option.value)} className="mt-0.5" />
                        <span>
                            {option.label}
                            {option.description && (
                                <span className="block text-xs text-muted-foreground">{option.description}</span>
                            )}
                        </span>
                    </label>
                ))}
            </RadioGroup>
        </div>
    );
}
