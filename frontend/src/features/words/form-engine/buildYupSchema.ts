/**
 * `TranslationFormConfig` -> a yup object schema, one field per `FieldConfig.name`.
 * Message strings come from the config itself (`requiredMessageKey` /
 * `invalidMessageKey`) plus one shared `noNumbers` key — this file has no
 * knowledge of which part of speech or language it is validating.
 */
import * as yup from 'yup';
import type { FieldConfig, TranslationFormConfig } from './configs/types';

/** Just enough of i18next's `t` for message lookup — no interpolation needed. */
export type TranslateFn = (key: string) => string;

const NO_NUMBERS_KEY = 'wordRelated:wordForm.errors.noNumbers';

function escapeForRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textFieldSchema(field: Extract<FieldConfig, { kind: 'text' }>, t: TranslateFn): yup.AnySchema {
    const noNumbers = t(NO_NUMBERS_KEY);
    if (field.required) {
        return yup
            .string()
            .required(t(field.requiredMessageKey ?? NO_NUMBERS_KEY))
            .matches(/^[^0-9]+$/, noNumbers);
    }
    return yup
        .string()
        .nullable()
        .matches(/^[^0-9]+$|^$/, noNumbers);
}

function radioFieldSchema(field: Extract<FieldConfig, { kind: 'radio' }>, t: TranslateFn): yup.AnySchema {
    const values = field.options.map((option) => option.value);
    if (field.required) {
        const message = t(field.requiredMessageKey ?? field.invalidMessageKey ?? NO_NUMBERS_KEY);
        return yup.string().required(message).oneOf(values, message);
    }
    const noNumbers = t(NO_NUMBERS_KEY);
    const optionsPattern = new RegExp(`^(${values.map(escapeForRegExp).join('|')})?$`);
    return yup
        .string()
        .matches(/^[^0-9]+$|^$/, noNumbers)
        .matches(optionsPattern, t(field.invalidMessageKey ?? NO_NUMBERS_KEY));
}

export function buildYupSchema(config: TranslationFormConfig, t: TranslateFn): yup.AnyObjectSchema {
    const shape: Record<string, yup.AnySchema> = {};
    for (const field of config.fields) {
        switch (field.kind) {
            case 'text':
                shape[field.name] = textFieldSchema(field, t);
                break;
            case 'radio':
                shape[field.name] = radioFieldSchema(field, t);
                break;
            case 'checkbox':
                shape[field.name] = yup.boolean();
                break;
        }
    }
    return yup.object(shape);
}
