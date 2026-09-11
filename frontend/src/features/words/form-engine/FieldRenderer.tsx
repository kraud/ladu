/**
 * One `FieldConfig` -> a shadcn/RHF control. Honours `displayOnly`: a
 * non-required field with an empty value is hidden entirely (the old app's
 * `getDisabledInputFieldDisplayLogic`); a required field, or any field that
 * has a value, always renders — as static text in `displayOnly` mode, as an
 * editable control otherwise.
 */
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { FieldConfig } from './configs/types';

export interface FieldRendererProps {
    field: FieldConfig;
    displayOnly?: boolean;
}

function isEmptyValue(value: unknown): boolean {
    return value === undefined || value === null || value === '';
}

export function FieldRenderer({ field, displayOnly = false }: FieldRendererProps) {
    const { control } = useFormContext();
    const { t } = useTranslation();
    const label = t(field.labelKey);

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
                    const displayValue =
                        field.kind === 'radio'
                            ? (field.options.find((option) => option.value === rhf.value)?.label ?? rhf.value)
                            : rhf.value;
                    return (
                        <FormItem>
                            <FormLabel>{label}</FormLabel>
                            <p className="text-sm text-foreground">{isEmptyValue(displayValue) ? '—' : String(displayValue)}</p>
                        </FormItem>
                    );
                }

                if (field.kind === 'text') {
                    return (
                        <FormItem>
                            <FormLabel>{label}</FormLabel>
                            <FormControl>
                                <Input {...rhf} value={rhf.value ?? ''} />
                            </FormControl>
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
