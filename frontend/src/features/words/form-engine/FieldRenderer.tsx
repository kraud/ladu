/**
 * One `FieldConfig` -> a shadcn/RHF control. Honours `displayOnly`: a
 * non-required field with an empty value is hidden entirely (the old app's
 * `getDisabledInputFieldDisplayLogic`); a required field, or any field that
 * has a value, always renders — as static text in `displayOnly` mode, as an
 * editable control otherwise.
 *
 * Two config features are resolved here, ahead of the field's own control:
 *  - `visibleWhen` — the field renders nothing at all (in either mode) unless
 *    `matchesVisibility` (`configs/types.ts`) says so.
 *  - `adornment` — a read-only prefix shown before a `text` field's input,
 *    looked up from a sibling field's current value.
 *
 * A required (non-`displayOnly`) field prints a red `*` next to its label —
 * as a sibling of `FormLabel`, never inside it: `<label>`'s own text content
 * is what both the browser's real accessible-name computation AND Testing
 * Library's `getByLabelText` key off, and the latter (unlike the former)
 * doesn't exclude `aria-hidden` content, so the marker has to sit outside the
 * `<label>` element entirely to avoid turning every required field's
 * accessible name into "Singular *" and breaking every existing
 * `getByLabelText('Singular')`-style query across the test suite.
 *
 * `autocompleteFieldName` (from `TranslationCard`'s
 * `getAutocompleteEndpoint(lang, pos)`) names the one `text` field, if any,
 * whose value drives this (lang, pos) pair's autocomplete lookup —
 * `AutocompleteRow` (now in the card's footer) owns the actual fetch, this
 * only renders that one field with a heavier border, a bold label, a
 * magnifying-glass icon and a placeholder so it's obvious which field to
 * fill to trigger it.
 */
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { matchesVisibility, type FieldConfig } from './configs/types';
import { isEmptyValue, isHiddenInDisplayOnly } from './fieldLayout';

export interface FieldRendererProps {
    field: FieldConfig;
    displayOnly?: boolean;
    /** The RHF field name that drives this (lang, pos) pair's autocomplete lookup, if any. */
    autocompleteFieldName?: string;
}

function optionLabel(options: { value: string; label: string }[], value: unknown): string {
    return options.find((option) => option.value === value)?.label ?? String(value ?? '');
}

/** A field's label plus its red required-marker — see the file header for why the marker is a sibling, not a child, of `FormLabel`. */
function FieldLabelRow({ label, required, bold }: { label: string; required: boolean; bold?: boolean }) {
    return (
        <div className="flex items-center gap-1">
            <FormLabel className={bold ? 'font-bold' : undefined}>{label}</FormLabel>
            {required && (
                <span aria-hidden="true" className="text-destructive">
                    *
                </span>
            )}
        </div>
    );
}

export function FieldRenderer({ field, displayOnly = false, autocompleteFieldName }: FieldRendererProps) {
    const { control } = useFormContext();
    const { t } = useTranslation();
    const label = field.label ?? t(field.labelKey ?? '');
    const isAutocompleteTrigger = !displayOnly && field.kind === 'text' && field.name === autocompleteFieldName;

    // Dummy fallback name (the field's own) when there's nothing to watch —
    // watching a field's own value is a harmless no-op, and keeps this a
    // single unconditional hook call regardless of whether `visibleWhen` /
    // `adornment` are configured.
    const controllingValue = useWatch({ control, name: field.visibleWhen?.field ?? field.name });
    const isVisible = !field.visibleWhen || matchesVisibility(field.visibleWhen, controllingValue);

    const adornmentSource = field.adornment?.watchField;
    const watchedAdornmentValue = useWatch({ control, name: adornmentSource ?? field.name });
    const adornmentText = field.adornment ? field.adornment.values[String(watchedAdornmentValue ?? '')] : undefined;

    if (!isVisible) {
        return null;
    }

    return (
        <FormField
            control={control}
            name={field.name}
            render={({ field: rhf }) => {
                const hidden = isHiddenInDisplayOnly(field, rhf.value, displayOnly);
                if (hidden) {
                    return <></>;
                }

                if (displayOnly) {
                    let displayValue: string;
                    if (field.kind === 'radio' || field.kind === 'select' || field.kind === 'toggle') {
                        displayValue = optionLabel(field.options, rhf.value);
                    } else if (field.kind === 'multi-select') {
                        const selected: unknown[] = Array.isArray(rhf.value) ? rhf.value : [];
                        displayValue = selected.map((value) => optionLabel(field.options, value)).join(', ');
                    } else {
                        displayValue = String(rhf.value ?? '');
                    }
                    return (
                        <FormItem>
                            <FormLabel>{label}</FormLabel>
                            <p className="text-sm text-foreground">{isEmptyValue(displayValue) ? '—' : displayValue}</p>
                        </FormItem>
                    );
                }

                if (field.kind === 'text') {
                    const input = (
                        <Input
                            {...rhf}
                            value={rhf.value ?? ''}
                            placeholder={
                                isAutocompleteTrigger
                                    ? t('wordRelated:wordForm.autocompleteTranslationButton.inputPlaceholder')
                                    : undefined
                            }
                            className={isAutocompleteTrigger ? 'border-2 border-(--border-strong) pl-8' : undefined}
                        />
                    );
                    const control = isAutocompleteTrigger ? (
                        <div className="relative">
                            <MagnifyingGlassIcon
                                size={14}
                                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                            />
                            <FormControl>{input}</FormControl>
                        </div>
                    ) : (
                        <FormControl>{input}</FormControl>
                    );
                    return (
                        <FormItem>
                            <FieldLabelRow label={label} required={field.required} bold={isAutocompleteTrigger} />
                            {adornmentText ? (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm text-muted-foreground">{adornmentText}</span>
                                    {control}
                                </div>
                            ) : (
                                control
                            )}
                            <FormMessage />
                        </FormItem>
                    );
                }

                if (field.kind === 'radio') {
                    return (
                        <FormItem>
                            <FieldLabelRow label={label} required={field.required} />
                            <FormControl>
                                <RadioGroup value={rhf.value ?? ''} onValueChange={rhf.onChange}>
                                    {field.options.map((option) => (
                                        <label
                                            key={option.value}
                                            className="flex items-center gap-1.5 text-sm"
                                            // Base UI's own radio click never fires `onValueChange` again for a
                                            // re-click of the already-selected option (native radio semantics:
                                            // clicking a checked radio can't uncheck it). Intercepted here, ahead
                                            // of that internal handling, so a re-click clears the field instead —
                                            // `stopPropagation` (capture phase, before the click reaches the
                                            // radio itself) keeps Base UI from re-selecting the same value right
                                            // back afterward.
                                            onClickCapture={(event) => {
                                                if (rhf.value === option.value) {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    rhf.onChange('');
                                                }
                                            }}
                                        >
                                            <RadioGroupItem value={option.value} />
                                            {option.label}
                                        </label>
                                    ))}
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    );
                }

                if (field.kind === 'toggle') {
                    return (
                        <FormItem>
                            <FieldLabelRow label={label} required={field.required} />
                            <FormControl>
                                <SegmentedToggle
                                    value={rhf.value}
                                    onValueChange={rhf.onChange}
                                    options={field.options}
                                    aria-label={label}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    );
                }

                if (field.kind === 'select') {
                    return (
                        <FormItem>
                            <FieldLabelRow label={label} required={field.required} />
                            <FormControl>
                                <Select value={rhf.value ?? ''} onValueChange={rhf.onChange}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {field.options.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    );
                }

                if (field.kind === 'multi-select') {
                    const selected: string[] = Array.isArray(rhf.value) ? rhf.value : [];
                    const toggle = (optionValue: string, checked: boolean) => {
                        rhf.onChange(
                            checked ? [...selected, optionValue] : selected.filter((value) => value !== optionValue)
                        );
                    };
                    return (
                        <FormItem>
                            <FieldLabelRow label={label} required={field.required} />
                            <FormControl>
                                <div className="flex flex-row flex-wrap gap-x-4 gap-y-1.5">
                                    {field.options.map((option) => (
                                        <label key={option.value} className="flex items-center gap-1.5 text-sm">
                                            <Checkbox
                                                checked={selected.includes(option.value)}
                                                onCheckedChange={(checked) => toggle(option.value, !!checked)}
                                            />
                                            {option.label}
                                        </label>
                                    ))}
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    );
                }

                return (
                    <FormItem className="flex flex-row items-center gap-2">
                        <FormControl>
                            <Checkbox checked={!!rhf.value} onCheckedChange={rhf.onChange} />
                        </FormControl>
                        <FieldLabelRow label={label} required={field.required} />
                        <FormMessage />
                    </FormItem>
                );
            }}
        />
    );
}
