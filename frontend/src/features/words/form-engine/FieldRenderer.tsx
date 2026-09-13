/**
 * One `FieldConfig` -> a shadcn/RHF control. Honours `displayOnly`: a
 * non-required field with an empty value is hidden entirely (the old app's
 * `getDisabledInputFieldDisplayLogic`); a required field, or any field that
 * has a value, always renders — as static text in `displayOnly` mode, as an
 * editable control otherwise.
 *
 * Two config features are resolved here, ahead of the field's own control:
 *  - `visibleWhen` — the field renders nothing at all (in either mode) unless
 *    the named sibling field currently equals the configured value.
 *  - `adornment` — a read-only prefix shown before a `text` field's input,
 *    looked up from a sibling field's current value.
 */
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FieldConfig } from './configs/types';

export interface FieldRendererProps {
    field: FieldConfig;
    displayOnly?: boolean;
}

function isEmptyValue(value: unknown): boolean {
    if (Array.isArray(value)) return value.length === 0;
    return value === undefined || value === null || value === '';
}

function optionLabel(options: { value: string; label: string }[], value: unknown): string {
    return options.find((option) => option.value === value)?.label ?? String(value ?? '');
}

export function FieldRenderer({ field, displayOnly = false }: FieldRendererProps) {
    const { control } = useFormContext();
    const { t } = useTranslation();
    const label = field.label ?? t(field.labelKey ?? '');

    // Dummy fallback name (the field's own) when there's nothing to watch —
    // watching a field's own value is a harmless no-op, and keeps this a
    // single unconditional hook call regardless of whether `visibleWhen` /
    // `adornment` are configured.
    const controllingValue = useWatch({ control, name: field.visibleWhen?.field ?? field.name });
    const isVisible = !field.visibleWhen || controllingValue === field.visibleWhen.equals;

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
                const hidden = displayOnly && !field.required && isEmptyValue(rhf.value);
                if (hidden) {
                    return <></>;
                }

                if (displayOnly) {
                    let displayValue: string;
                    if (field.kind === 'radio' || field.kind === 'select') {
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
                    const input = <Input {...rhf} value={rhf.value ?? ''} />;
                    return (
                        <FormItem>
                            <FormLabel>{label}</FormLabel>
                            {adornmentText ? (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm text-muted-foreground">{adornmentText}</span>
                                    <FormControl>{input}</FormControl>
                                </div>
                            ) : (
                                <FormControl>{input}</FormControl>
                            )}
                            <FormMessage />
                        </FormItem>
                    );
                }

                if (field.kind === 'radio') {
                    return (
                        <FormItem>
                            <FormLabel>{label}</FormLabel>
                            <FormControl>
                                <RadioGroup value={rhf.value ?? ''} onValueChange={rhf.onChange}>
                                    {field.options.map((option) => (
                                        <label key={option.value} className="flex items-center gap-1.5 text-sm">
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

                if (field.kind === 'select') {
                    return (
                        <FormItem>
                            <FormLabel>{label}</FormLabel>
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
                            <FormLabel>{label}</FormLabel>
                            <FormControl>
                                <div className="flex flex-col gap-1.5">
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
                        <FormLabel>{label}</FormLabel>
                        <FormMessage />
                    </FormItem>
                );
            }}
        />
    );
}
