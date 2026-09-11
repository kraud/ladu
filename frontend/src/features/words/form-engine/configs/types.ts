import type { AdjectiveCases, AdverbCases, Lang, NounCases, PartOfSpeech, VerbCases } from '@/ts/enums';

/** Every case-name enum a `FieldConfig` can point at, across all four parts of speech. */
export type CaseName = NounCases | VerbCases | AdjectiveCases | AdverbCases;

export type FieldKind = 'text' | 'radio' | 'checkbox';

/** One selectable value in a `radio` field. Values are displayed verbatim (no i18n) — they are the grammatical terms themselves (`"el"`, `"der"`, `"regular"`...), matching the old app. */
export interface RadioOption {
    value: string;
    label: string;
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
    /** i18n key for the "not a valid choice" message on a `radio` field (yup `.oneOf()` / regex mismatch). */
    invalidMessageKey?: string;
}

export interface TextFieldConfig extends FieldConfigBase {
    kind: 'text';
    /** Lowercase the value before persisting. Noun text cases: all languages except German (which keeps capitalization). */
    lowercase: boolean;
}

export interface RadioFieldConfig extends FieldConfigBase {
    kind: 'radio';
    options: RadioOption[];
}

export interface CheckboxFieldConfig extends FieldConfigBase {
    kind: 'checkbox';
}

export type FieldConfig = TextFieldConfig | RadioFieldConfig | CheckboxFieldConfig;

export interface TranslationFormConfig {
    pos: PartOfSpeech;
    lang: Lang;
    fields: FieldConfig[];
}
