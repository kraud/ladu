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
 * fill to trigger it. With `typeAhead` (Slice E) that field is a `TypeAheadInput`: the same input,
 * plus the list of dictionary words that start with the typed text.
 *
 * When `reserveMessageSpace` is set, the field reserves a strip of room under
 * its control (`FIELD_ITEM`), and its validation message is positioned inside
 * that strip out of the normal flow (`FIELD_MESSAGE`, `position: absolute`).
 * So a message appearing or disappearing never changes the field's height — no
 * row jumps, no field pushed down, and bottom-aligned rows (`TranslationCard`'s
 * `items-end`) stay aligned. `TranslationCard` sets it for a row only when at
 * least one field in that row is mandatory (the rows where a message is
 * expected); every other row keeps the plain layout, where a message, should
 * one appear, takes its own line. `displayOnly` fields have no messages and
 * never reserve anything.
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
import { TypeAheadInput, type TypeAheadConfig } from './TypeAheadInput';
import { matchesVisibility, type FieldConfig } from './configs/types';
import { capitalizeFirst, isEmptyValue, isHiddenInDisplayOnly } from './fieldLayout';
import { cn } from '@/lib/utils';

/** The strip reserved under an editable field for its message — one 16px line (`pb-4`, `leading-4` below). */
const FIELD_ITEM = 'relative pb-4';
/** The message itself: out of flow, pinned to the bottom of that strip, one line (an over-long one is cut with an ellipsis; `FormMessage` puts the full text in `title`). */
const FIELD_MESSAGE = 'absolute inset-x-0 bottom-0 truncate leading-4';

export interface FieldRendererProps {
    field: FieldConfig;
    displayOnly?: boolean;
    /** The RHF field name that drives this (lang, pos) pair's autocomplete lookup, if any. */
    autocompleteFieldName?: string;
    /** Turns the autocomplete query field into a `TypeAheadInput` (Slice E). Ignored for every other field. */
    typeAhead?: TypeAheadConfig;
    /** Reserve a strip under the control and show its validation message out of the flow (see the file header). Ignored in `displayOnly`. */
    reserveMessageSpace?: boolean;
    /** `displayOnly` on a phone: label and value share one line, to keep grids short. */
    compact?: boolean;
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

export function FieldRenderer({
    field,
    displayOnly = false,
    autocompleteFieldName,
    typeAhead,
    reserveMessageSpace = false,
    compact = false,
}: FieldRendererProps) {
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
    const itemClass = reserveMessageSpace ? FIELD_ITEM : undefined;
    const messageClass = reserveMessageSpace ? FIELD_MESSAGE : undefined;

    const adornmentSource = field.adornment?.watchField;
    const watchedAdornmentValue = useWatch({ control, name: adornmentSource ?? field.name });
    const adornmentText = field.adornment
        ? (field.adornment.text ?? field.adornment.values?.[String(watchedAdornmentValue ?? '')])
        : undefined;

    // `derivedWhen` (D20): while it matches, the field is read-only text built from a sibling — the
    // Estonian superlative "kõige " + comparative. Same dummy-name trick as above when unused.
    const derivation = field.kind === 'text' ? field.derivedWhen : undefined;
    const derivationControl = useWatch({ control, name: derivation?.when.field ?? field.name });
    const derivationSource = useWatch({ control, name: derivation?.fromField ?? field.name });
    const derivedText =
        derivation && matchesVisibility(derivation.when, derivationControl)
            ? `${derivation.prefix}${String(derivationSource ?? '').trim() || '…'}`
            : undefined;

    if (!isVisible) {
        return null;
    }


    return (
        <FormField
            control={control}
            name={field.name}
            render={({ field: rhf }) => {
                if (derivedText !== undefined) {
                    // Before the display-only "empty optional field is hidden" rule: the stored value is empty on purpose.
                    return displayOnly ? (
                        <FormItem className={compact ? 'flex flex-row flex-wrap items-baseline gap-x-2 gap-y-0' : undefined}>
                            <FormLabel className="text-xs! font-normal! text-muted-foreground!">{label}</FormLabel>
                            <p className="text-sm text-foreground" data-testid={`derived-${field.name}`}>
                                {derivedText}
                            </p>
                        </FormItem>
                    ) : (
                        <FormItem className={itemClass}>
                            <FieldLabelRow label={label} required={false} />
                            <FormControl>
                                <Input value={derivedText} readOnly data-testid={`derived-${field.name}`} className="bg-muted text-muted-foreground" />
                            </FormControl>
                        </FormItem>
                    );
                }
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
                    const empty = isEmptyValue(displayValue);
                    return (
                        <FormItem className={compact ? 'flex flex-row flex-wrap items-baseline gap-x-2 gap-y-0' : undefined}>
                            {/* `!`: the base `.label` class sets a colour and weight of its own. */}
                            <FormLabel className="text-xs! font-normal! text-muted-foreground!">{label}</FormLabel>
                            <p className="text-sm text-foreground">
                                {/* The auxiliary verb (or other prefix) reads as a hint, not as part of the stored value. */}
                                {adornmentText && !empty && (
                                    <span className="text-foreground/65 italic">{adornmentText} </span>
                                )}
                                {empty ? '—' : displayValue}
                            </p>
                        </FormItem>
                    );
                }

                if (field.kind === 'text') {
                    const toStored = (text: string) => (field.capitalize ? capitalizeFirst(text) : text);
                    const placeholder = isAutocompleteTrigger
                        ? t('wordRelated:wordForm.autocompleteTranslationButton.inputPlaceholder')
                        : undefined;
                    const inputClass = isAutocompleteTrigger ? 'border-2 border-(--border-strong) pl-8' : undefined;
                    const input =
                        isAutocompleteTrigger && typeAhead ? (
                            <TypeAheadInput
                                config={typeAhead}
                                ref={rhf.ref}
                                name={rhf.name}
                                onBlur={rhf.onBlur}
                                disabled={rhf.disabled}
                                value={rhf.value ?? ''}
                                onValueChange={(text) => rhf.onChange(toStored(text))}
                                placeholder={placeholder}
                                className={inputClass}
                            />
                        ) : (
                            <Input
                                {...rhf}
                                value={rhf.value ?? ''}
                                onChange={(event) => rhf.onChange(toStored(event.target.value))}
                                placeholder={placeholder}
                                className={inputClass}
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
                        <FormItem className={itemClass}>
                            <FieldLabelRow label={label} required={field.required} bold={isAutocompleteTrigger} />
                            {adornmentText ? (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm text-muted-foreground">{adornmentText}</span>
                                    {control}
                                </div>
                            ) : (
                                control
                            )}
                            <FormMessage className={messageClass} />
                        </FormItem>
                    );
                }

                if (field.kind === 'radio') {
                    return (
                        <FormItem className={itemClass}>
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
                            <FormMessage className={messageClass} />
                        </FormItem>
                    );
                }

                if (field.kind === 'toggle') {
                    return (
                        <FormItem className={itemClass}>
                            <FieldLabelRow label={label} required={field.required} />
                            <FormControl>
                                <SegmentedToggle
                                    value={rhf.value}
                                    onValueChange={rhf.onChange}
                                    options={field.options}
                                    aria-label={label}
                                />
                            </FormControl>
                            <FormMessage className={messageClass} />
                        </FormItem>
                    );
                }

                if (field.kind === 'select') {
                    return (
                        <FormItem className={itemClass}>
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
                            <FormMessage className={messageClass} />
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
                        <FormItem className={itemClass}>
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
                            <FormMessage className={messageClass} />
                        </FormItem>
                    );
                }

                return (
                    <FormItem className={cn(itemClass, 'flex flex-row items-center gap-2')}>
                        <FormControl>
                            <Checkbox checked={!!rhf.value} onCheckedChange={rhf.onChange} />
                        </FormControl>
                        <FieldLabelRow label={label} required={field.required} />
                        <FormMessage className={messageClass} />
                    </FormItem>
                );
            }}
        />
    );
}
