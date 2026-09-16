import * as React from 'react';
import { cn } from 'cn';

export interface SegmentedToggleOption {
    value: string;
    label: React.ReactNode;
}

export interface SegmentedToggleProps {
    /** The active option's value, or `''`/`null`/`undefined` when neither option is selected. */
    value: string | null | undefined;
    onValueChange: (value: string) => void;
    /** Exactly two options — see the component doc comment below. */
    options: SegmentedToggleOption[];
    /**
     * Whether clicking the already-active option clears the value. Defaults
     * to `true` (the original toggle-to-unselect behaviour, matched to the
     * `radio`/`select` field kinds this was built for). The Phase 3.5
     * dashboard charts pass `false` — a chart's X-axis/grouping control is
     * binary state, not an optional field, so it must always keep exactly
     * one option selected.
     */
    allowDeselect?: boolean;
    'aria-label'?: string;
    className?: string;
}

/**
 * A two-option pill toggle that shows both choices at once — an alternative
 * to `Select` for a binary field (German verb's `auxiliaryVerb`: haben/sein),
 * styled after the ported mockup `.chip`/`.switch` pill aesthetic (light
 * muted track, sliding highlight). Edit-mode only: `FieldRenderer`'s own
 * `displayOnly` branch already renders a `toggle` field as plain matched-
 * option text, same as `radio`/`select`, so this component never needs a
 * read-only mode of its own.
 *
 * Clicking the already-active option clears the value (`onValueChange('')`)
 * instead of doing nothing — the same toggle-to-unselect behaviour as the
 * radio group, since neither option is inherently a default.
 */
const SegmentedToggle = React.forwardRef<HTMLDivElement, SegmentedToggleProps>(
    ({ value, onValueChange, options, allowDeselect = true, className, 'aria-label': ariaLabel }, ref) => {
        const activeIndex = options.findIndex((option) => option.value === value);

        return (
            <div ref={ref} role="radiogroup" aria-label={ariaLabel} className={cn('segmented-toggle', className)}>
                <span
                    aria-hidden="true"
                    className="segmented-toggle-thumb"
                    data-active={activeIndex >= 0}
                    style={{ transform: `translateX(${Math.max(activeIndex, 0) * 100}%)` }}
                />
                {options.map((option, index) => (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={index === activeIndex}
                        data-active={index === activeIndex}
                        className="segmented-toggle-segment"
                        onClick={() => {
                            if (index === activeIndex) {
                                if (allowDeselect) onValueChange('');
                                return;
                            }
                            onValueChange(option.value);
                        }}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        );
    },
);
SegmentedToggle.displayName = 'SegmentedToggle';

export { SegmentedToggle };
