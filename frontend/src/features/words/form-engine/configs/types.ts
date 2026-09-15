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
 * One stacked heading line above a field — e.g. a verb's mood ("Indicativo")
 * or the tense block under it ("Presente"). `heading` is displayed verbatim,
 * like `RadioOption.label` — these are the target language's own grammatical
 * terms, invariant across interface language, not i18n-translated UI copy.
 * Purely presentational: never affects validation or persistence.
 */
export interface FieldGroup {
    heading: string;
    /** 1 = a top-level heading; 2 = a heading nested under it. Reused for further nesting (Spanish stacks two level-2 lines under one level-1 heading). */
    level: 1 | 2;
}

/**
 * A field only renders — and only validates against its own rules — when the
 * sibling field named `field` currently equals `equals` (or, when `invert` is
 * true, when it does *not* — German adverb's comparative/superlative are
 * visible by default and hidden only once `gradable === 'Non-gradable'` is
 * explicitly chosen). Hidden fields validate as optional and their value is
 * dropped on save (Spanish adjective's gender-driven field set, German
 * adverb's non-gradable branch). `equals` is `boolean` for a checkbox sibling
 * (Estonian's `searchInEnglish` relaxing `infinitiveMa`'s pattern), `string`
 * for a radio/select one.
 */
export interface FieldVisibility {
    field: string;
    equals: string | boolean;
    /** Flips the comparison: visible when the sibling does NOT equal `equals`. Defaults to `false`. */
    invert?: boolean;
}

/** The one comparison `visibleWhen` means everywhere it's consumed (schema, render, persistence) — kept in one place so `invert` can't drift between them. */
export function matchesVisibility(visibility: FieldVisibility, value: unknown): boolean {
    const equal = value === visibility.equals;
    return visibility.invert ? !equal : equal;
}

/**
 * Groups this field into a 2D layout block with every sibling field that
 * shares `row`/`column` identity and sits in the same consecutive run (see
 * `fieldLayout.ts`) — a noun case's singular next to its plural, a Spanish
 * adjective's gender/number grid, a verb's tense-as-column grid. Purely
 * presentational: never affects validation, visibility or persistence, and
 * has no bearing on `config.fields`'s own order (the source of truth the
 * regression tests pin).
 */
export interface FieldLayout {
    /** Row identity within the block; fields sharing it render side by side. */
    row: string;
    /** Column identity within the block. */
    column: string;
    /** Caption printed once above the column. Omit for no caption (nouns, adjectives). */
    columnHeading?: string;
    /**
     * Explicit block-boundary key: two adjacent layout fields merge into the
     * same grid only when this matches (`undefined` merges with
     * `undefined`, the default for every existing config). Needed only when
     * two *different* row/column vocabularies sit back-to-back with nothing
     * non-`layout` between them to end the block naturally — e.g. German
     * verb's `infinitive`/`auxiliaryVerb`/`prefix` row immediately followed
     * by its `regularity`/`verbCases` row. Without it those five fields
     * would merge into one sparse 2x5 grid instead of two clean rows.
     */
    block?: string;
}

/**
 * An extra `.matches()` layered on top of a text field's base rules (Spanish
 * infinitive must end in `ar`/`er`/`ir`, German in `en`/`ern`/`eln`, Estonian
 * `-ma` infinitive in `ma`).
 */
export interface FieldPattern {
    regex: RegExp;
    messageKey: string;
    /**
     * Skip the `.matches()` entirely while the named sibling field currently
     * equals `equals` — the pattern still applies otherwise, and `required`
     * is never affected (Estonian's `-ma` ending is optional once
     * `searchInEnglish` is checked, but the field itself stays required).
     */
    relaxedWhen?: FieldVisibility;
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
    /**
     * The persisted case enum value (language-suffixed), e.g.
     * `NounCases.singularEN`. Omit only for a `persisted: false` field with no
     * backing case at all (Estonian `searchInEnglish`) — `caseName` is never
     * read once `persisted` is `false`.
     */
    caseName?: CaseName;
    /** `wordRelated` i18n key for the field's label (D4 — keyed by `caseName`, so EN/ES text can differ even for the "same" case). Omit when `label` is set. */
    labelKey?: string;
    /**
     * A literal, already-resolved label — bypasses `t()` entirely, like
     * `RadioOption.label`. For text tied to the target language itself
     * rather than the interface language (a verb conjugation's pronoun:
     * "Yo", "Ich", "Mina" — the same word regardless of which of the four
     * interface languages is active). Takes precedence over `labelKey`.
     */
    label?: string;
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
    /** Outer-to-inner stack of headings printed before this field, whenever they differ from the previous field's (see `FieldGroup`). */
    group?: FieldGroup[];
    visibleWhen?: FieldVisibility;
    adornment?: FieldAdornment;
    layout?: FieldLayout;
}

export interface TextFieldConfig extends FieldConfigBase {
    kind: 'text';
    caseName: CaseName;
    /** Lowercase the value before persisting. Noun text cases: all languages except German (which keeps capitalization). */
    lowercase: boolean;
    pattern?: FieldPattern;
}

/** `caseName` stays optional, inherited from the base — a radio can be a genuinely case-less UI branch selector (Spanish adjective's `gender`), same as a checkbox can (Estonian's `searchInEnglish`). */
export interface RadioFieldConfig extends FieldConfigBase {
    kind: 'radio';
    options: RadioOption[];
}

export interface CheckboxFieldConfig extends FieldConfigBase {
    kind: 'checkbox';
}

export interface SelectFieldConfig extends FieldConfigBase {
    kind: 'select';
    caseName: CaseName;
    options: RadioOption[];
}

export interface MultiSelectFieldConfig extends FieldConfigBase {
    kind: 'multi-select';
    caseName: CaseName;
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
