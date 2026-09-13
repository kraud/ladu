import type { AdjectiveCases, AdverbCases, Lang, NounCases, PartOfSpeech, VerbCases } from '@/ts/enums';

/** Every case-name enum a `FieldConfig` can point at, across all four parts of speech. */
export type CaseName = NounCases | VerbCases | AdjectiveCases | AdverbCases;

export type FieldKind = 'text' | 'radio' | 'checkbox' | 'select' | 'multi-select';

/** One selectable value in a `radio`/`select`/`multi-select` field. Values are displayed verbatim (no i18n) — they are the grammatical terms themselves (`"el"`, `"der"`, `"regular"`...), matching the old app. */
export interface RadioOption {
    value: string;
    label: string;
}

/**
 * A field starts a new visual group when it carries one of these and the
 * previous field's `group` (if any) has a different `headingKey` — e.g. a
 * verb tense block ("Present", "Simple past"...). Purely presentational:
 * never affects validation or persistence.
 */
export interface FieldGroup {
    headingKey: string;
    /** 1 = a top-level heading (a verb's mood, e.g. "Indicative"); 2 = the tense block under it. */
    level: 1 | 2;
}

/**
 * A field only renders — and only validates against its own rules — when the
 * sibling field named `field` currently equals `equals`. Hidden fields
 * validate as optional and their value is dropped on save (Spanish
 * adjective's gender-driven field set, German adverb's non-gradable branch).
 */
export interface FieldVisibility {
    field: string;
    equals: string;
}

/**
 * An extra `.matches()` layered on top of a text field's base rules (Spanish
 * infinitive must end in `ar`/`er`/`ir`, German in `en`/`ern`/`eln`, Estonian
 * `-ma` infinitive in `ma`).
 */
export interface FieldPattern {
    regex: RegExp;
    messageKey: string;
}

/**
 * A read-only prefix shown before a text field's input, driven by a sibling
 * field's current value (German perfect/future tenses show the conjugated
 * auxiliary verb ahead of each pronoun's input). `values` maps the watched
 * field's current value to this field's own prefix text; a value with no
 * entry shows no prefix.
 */
export interface FieldAdornment {
    watchField: string;
    values: Record<string, string>;
}

interface FieldConfigBase {
    /**
     * RHF field name — the old app's own per-language, unsuffixed field name
     * (`"singular"`, `"singularNominativ"`, `"gender"`...), derived mechanically
     * from `caseName` by stripping the trailing language code. This is the name
     * the regression test pins against `forms-nouns.md`.
     */
    name: string;
    /** The persisted case enum value (language-suffixed), e.g. `NounCases.singularEN`. */
    caseName: CaseName;
    /** `wordRelated` i18n key for the field's label (D4 — keyed by `caseName`, so EN/ES text can differ even for the "same" case). */
    labelKey: string;
    required: boolean;
    /** i18n key for the yup `.required()` message. Present when `required` is true. */
    requiredMessageKey?: string;
    /** i18n key for the "not a valid choice" message on a `radio`/`select` field (yup `.oneOf()` / regex mismatch). */
    invalidMessageKey?: string;
    /**
     * `false` when this field is form-only: it drives validation, visibility,
     * or an autocomplete lookup but is never written as a persisted case
     * (Estonian `searchInEnglish`, Spanish adjective `gender`). Defaults to
     * `true` when omitted.
     */
    persisted?: boolean;
    group?: FieldGroup;
    visibleWhen?: FieldVisibility;
    adornment?: FieldAdornment;
}

export interface TextFieldConfig extends FieldConfigBase {
    kind: 'text';
    /** Lowercase the value before persisting. Noun text cases: all languages except German (which keeps capitalization). */
    lowercase: boolean;
    pattern?: FieldPattern;
}

export interface RadioFieldConfig extends FieldConfigBase {
    kind: 'radio';
    options: RadioOption[];
}

export interface CheckboxFieldConfig extends FieldConfigBase {
    kind: 'checkbox';
}

export interface SelectFieldConfig extends FieldConfigBase {
    kind: 'select';
    options: RadioOption[];
}

export interface MultiSelectFieldConfig extends FieldConfigBase {
    kind: 'multi-select';
    options: RadioOption[];
    /** Selected option values -> the single persisted case string (German verb cases: `['accusativeDE','genitiveDE'] -> "AG"`). */
    encode: (selected: string[]) => string;
    /** The persisted case string -> selected option values — `encode`'s inverse, used to hydrate the checkbox group from a stored word. */
    decode: (word: string) => string[];
}

export type FieldConfig =
    | TextFieldConfig
    | RadioFieldConfig
    | CheckboxFieldConfig
    | SelectFieldConfig
    | MultiSelectFieldConfig;

export interface TranslationFormConfig {
    pos: PartOfSpeech;
    lang: Lang;
    fields: FieldConfig[];
}
