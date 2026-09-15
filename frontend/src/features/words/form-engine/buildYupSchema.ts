/**
 * `TranslationFormConfig` -> a yup object schema, one field per `FieldConfig.name`.
 * Message strings come from the config itself (`requiredMessageKey` /
 * `invalidMessageKey`) plus one shared `noNumbers` key — this file has no
 * knowledge of which part of speech or language it is validating.
 *
 * Two config features change *which* schema a field gets, not just its rules:
 *  - `pattern` (text fields only) layers one more `.matches()` on top of the
 *    base rules (Spanish infinitive `ar|er|ir`, German `en|ern|eln`, Estonian
 *    `-ma`) — optionally dropped while `pattern.relaxedWhen`'s sibling field
 *    matches (Estonian's `-ma` ending relaxes once `searchInEnglish` is
 *    checked; the field stays required either way).
 *  - `visibleWhen` swaps in an unconstrained, optional fallback schema
 *    whenever the field is hidden per `matchesVisibility` (see `configs/types.ts`)
 *    — a hidden field always validates as present-but-optional, regardless of
 *    its own `required` flag (Spanish adjective's gender branch, German
 *    adverb's non-gradable branch — `forms-adjectives-adverbs.md`).
 */
import * as yup from 'yup';
import { matchesVisibility, type FieldConfig, type FieldKind, type TranslationFormConfig } from './configs/types';

/** Just enough of i18next's `t` for message lookup — no interpolation needed. */
export type TranslateFn = (key: string) => string;

const NO_NUMBERS_KEY = 'wordRelated:wordForm.errors.noNumbers';

function escapeForRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textFieldSchema(field: Extract<FieldConfig, { kind: 'text' }>, t: TranslateFn): yup.AnySchema {
    const noNumbers = t(NO_NUMBERS_KEY);
    const base = field.required
        ? yup
              .string()
              .required(t(field.requiredMessageKey ?? NO_NUMBERS_KEY))
              .matches(/^[^0-9]+$/, noNumbers)
        : yup
              .string()
              .nullable()
              .matches(/^[^0-9]+$|^$/, noNumbers);
    if (!field.pattern) return base;
    const withPattern = base.matches(field.pattern.regex, t(field.pattern.messageKey));
    const relaxedWhen = field.pattern.relaxedWhen;
    if (!relaxedWhen) return withPattern;
    return base.when(relaxedWhen.field, {
        is: (value: unknown) => matchesVisibility(relaxedWhen, value),
        then: () => base,
        otherwise: () => withPattern,
    });
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

/** Shared by `select` and `toggle` — both are a plain "one of these option values, or empty" field. */
function selectFieldSchema(field: Extract<FieldConfig, { kind: 'select' | 'toggle' }>, t: TranslateFn): yup.AnySchema {
    const values = field.options.map((option) => option.value);
    if (field.required) {
        const message = t(field.requiredMessageKey ?? field.invalidMessageKey ?? NO_NUMBERS_KEY);
        return yup.string().required(message).oneOf(values, message);
    }
    return yup.string().nullable();
}

/** Always optional — no consumer needs a required multi-select today (German verb cases). */
function multiSelectFieldSchema(): yup.AnySchema {
    return yup.array().of(yup.string()).default([]);
}

function baseFieldSchema(field: FieldConfig, t: TranslateFn): yup.AnySchema {
    switch (field.kind) {
        case 'text':
            return textFieldSchema(field, t);
        case 'radio':
            return radioFieldSchema(field, t);
        case 'checkbox':
            return yup.boolean();
        case 'select':
        case 'toggle':
            return selectFieldSchema(field, t);
        case 'multi-select':
            return multiSelectFieldSchema();
    }
}

/** An unconstrained, always-optional schema of the right base shape — what a `visibleWhen` field falls back to while hidden. */
function hiddenFallbackSchema(kind: FieldKind): yup.AnySchema {
    if (kind === 'checkbox') return yup.boolean();
    if (kind === 'multi-select') return multiSelectFieldSchema();
    return yup.string().nullable();
}

export function buildYupSchema(config: TranslationFormConfig, t: TranslateFn): yup.AnyObjectSchema {
    const shape: Record<string, yup.AnySchema> = {};
    for (const field of config.fields) {
        const schema = baseFieldSchema(field, t);
        const visibility = field.visibleWhen;
        shape[field.name] = visibility
            ? schema.when(visibility.field, {
                  is: (value: unknown) => matchesVisibility(visibility, value),
                  then: () => schema,
                  otherwise: () => hiddenFallbackSchema(field.kind),
              })
            : schema;
    }
    return yup.object(shape);
}
