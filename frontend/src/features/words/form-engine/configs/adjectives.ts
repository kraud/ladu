/**
 * Adjective form configs, one per language. Unlike nouns/verbs there is no
 * `WordCasesData` registry entry for adjectives at all — these are authored
 * directly from the `AdjectiveCases` enum against
 * `forms-adjectives-adverbs.md`, the same way that snapshot's own old forms
 * were hand-written rather than registry-driven.
 *
 * Field order and lists key off that snapshot's "Rendered field order" per
 * language. Spanish branches its whole field set on a `gender` radio that has
 * no backing case at all (`persisted: false`) via `visibleWhen` — the engine
 * primitive Slice 1 built for exactly this shape.
 */
import { AdjectiveCases, Lang, PartOfSpeech } from '@/ts/enums';
import type { FieldConfig, FieldDerivation, FieldLayout, FieldVisibility, RadioOption, TextFieldConfig, TranslationFormConfig } from './types';

function labelKey(key: string): string {
    return `wordRelated:wordForm.adjective.fields.${key}`;
}

/** `wordRelated:wordForm.adjective.errors.form{EN,ES,DE,EE}.<key>` — the per-language adjective error block already in `wordRelated.json`. */
function adjectiveErrorKey(suffix: string, key: string): string {
    return `wordRelated:wordForm.adjective.errors.form${suffix}.${key}`;
}

function degreeField(
    caseName: AdjectiveCases,
    name: string,
    required: boolean,
    requiredMessageKey?: string,
    visibleWhen?: FieldVisibility,
    layout?: FieldLayout,
    derivedWhen?: FieldDerivation
): TextFieldConfig {
    return {
        kind: 'text',
        name,
        caseName,
        labelKey: labelKey(caseName),
        required,
        requiredMessageKey,
        lowercase: true,
        visibleWhen,
        layout,
        derivedWhen,
    };
}

function buildEnConfig(): TranslationFormConfig {
    const suffix = 'EN';
    return {
        pos: PartOfSpeech.adjective,
        lang: Lang.EN,
        fields: [
            degreeField(AdjectiveCases.positiveEN, 'positive', true, adjectiveErrorKey(suffix, 'positiveDegreeRequired')),
            degreeField(AdjectiveCases.comparativeEN, 'comparative', false),
            degreeField(AdjectiveCases.superlativeEN, 'superlative', false),
        ],
    };
}

function buildDeConfig(): TranslationFormConfig {
    const suffix = 'DE';
    return {
        pos: PartOfSpeech.adjective,
        lang: Lang.DE,
        fields: [
            degreeField(AdjectiveCases.positiveDE, 'positive', true, adjectiveErrorKey(suffix, 'positiveDegreeRequired')),
            degreeField(AdjectiveCases.komparativDE, 'komparativ', false),
            // D25: stored without "am"; the form shows it, so a hand-typed word does not repeat it.
            { ...degreeField(AdjectiveCases.superlativDE, 'superlativ', false), adornment: { text: 'am' } },
        ],
    };
}

const GENDER_OPTIONS: RadioOption[] = [
    { value: 'Neutral', label: 'Neutral' },
    { value: 'M/F', label: 'M/F' },
];

function buildEsConfig(): TranslationFormConfig {
    const suffix = 'ES';
    const genderRequiredKey = adjectiveErrorKey(suffix, 'genderRequired');
    const gender: FieldConfig = {
        kind: 'radio',
        name: 'gender',
        labelKey: labelKey('gender'),
        required: true,
        requiredMessageKey: genderRequiredKey,
        invalidMessageKey: genderRequiredKey,
        persisted: false,
        options: GENDER_OPTIONS,
        // Autocomplete picks the branch: a result with neutral cases is "Neutral", one with male cases "M/F".
        fromLookup: (cases) =>
            cases.has(AdjectiveCases.neutralSingularES) ? 'Neutral' : cases.has(AdjectiveCases.maleSingularES) ? 'M/F' : undefined,
    };
    const neutralWhen: FieldVisibility = { field: 'gender', equals: 'Neutral' };
    const mfWhen: FieldVisibility = { field: 'gender', equals: 'M/F' };

    // Singular/plural share a row; M/F additionally stacks male above female —
    // 1 row x 2 columns for Neutral, 2 rows x 2 columns for M/F.
    const singularColumn = 'Singular';
    const pluralColumn = 'Plural';

    return {
        pos: PartOfSpeech.adjective,
        lang: Lang.ES,
        fields: [
            gender,
            // Neutral branch: both fields required.
            degreeField(AdjectiveCases.neutralSingularES, 'neutralSingular', true, adjectiveErrorKey(suffix, 'singularNeutralDegreeRequired'), neutralWhen, { row: 'neutral', column: singularColumn }),
            degreeField(AdjectiveCases.neutralPluralES, 'neutralPlural', true, adjectiveErrorKey(suffix, 'pluralNeutralDegreeRequired'), neutralWhen, { row: 'neutral', column: pluralColumn }),
            // M/F branch: only the singulars are required, the plurals stay optional — verbatim old-app asymmetry.
            degreeField(AdjectiveCases.maleSingularES, 'maleSingular', true, adjectiveErrorKey(suffix, 'singularMasculineDegreeRequired'), mfWhen, { row: 'male', column: singularColumn }),
            degreeField(AdjectiveCases.malePluralES, 'malePlural', false, undefined, mfWhen, { row: 'male', column: pluralColumn }),
            degreeField(AdjectiveCases.femaleSingularES, 'femaleSingular', true, adjectiveErrorKey(suffix, 'singularFemaleDegreeRequired'), mfWhen, { row: 'female', column: singularColumn }),
            degreeField(AdjectiveCases.femalePluralES, 'femalePlural', false, undefined, mfWhen, { row: 'female', column: pluralColumn }),
        ],
    };
}

function buildEeConfig(): TranslationFormConfig {
    const suffix = 'EE';
    // Positive/comparative/superlative share one row (3 columns); the
    // omastav and osastav singular/plural pairs each share a row (2
    // columns) the same way nouns pair singular/plural per declension case.
    const singularColumn = 'Singular';
    const pluralColumn = 'Plural';
    return {
        pos: PartOfSpeech.adjective,
        lang: Lang.EE,
        fields: [
            degreeField(AdjectiveCases.algvorreEE, 'algvorre', true, adjectiveErrorKey(suffix, 'algvorreFormRequired'), undefined, { row: 'degree', column: 'Positive' }),
            // keskvorre: required (D4 fix — the old app had it both `.nullable()` AND `.required()`, a contradiction).
            degreeField(AdjectiveCases.keskvorreEE, 'keskvorre', true, adjectiveErrorKey(suffix, 'keskvorreFormRequired'), undefined, { row: 'degree', column: 'Comparative' }),
            // ulivorre: optional since D20. With `periphrasticSuperlative` checked it shows "kõige " + the comparative,
            // read-only, and is not stored (the checkbox is).
            degreeField(AdjectiveCases.ulivorreEE, 'ulivorre', false, undefined, undefined, { row: 'degree', column: 'Superlative' }, {
                when: { field: 'periphrasticSuperlative', equals: true },
                prefix: 'kõige ',
                fromField: 'keskvorre',
            }),
            {
                kind: 'checkbox',
                name: 'periphrasticSuperlative',
                caseName: AdjectiveCases.periphrasticSuperlativeEE,
                labelKey: labelKey(AdjectiveCases.periphrasticSuperlativeEE),
                required: false,
            },
            degreeField(AdjectiveCases.pluralNimetavEE, 'pluralNimetav', false),
            degreeField(AdjectiveCases.singularOmastavEE, 'singularOmastav', false, undefined, undefined, { row: 'omastav', column: singularColumn }),
            degreeField(AdjectiveCases.pluralOmastavEE, 'pluralOmastav', false, undefined, undefined, { row: 'omastav', column: pluralColumn }),
            degreeField(AdjectiveCases.singularOsastavEE, 'singularOsastav', false, undefined, undefined, { row: 'osastav', column: singularColumn }),
            degreeField(AdjectiveCases.pluralOsastavEE, 'pluralOsastav', false, undefined, undefined, { row: 'osastav', column: pluralColumn }),
        ],
    };
}

export const ADJECTIVE_CONFIGS: Record<Lang, TranslationFormConfig> = {
    [Lang.EN]: buildEnConfig(),
    [Lang.ES]: buildEsConfig(),
    [Lang.DE]: buildDeConfig(),
    [Lang.EE]: buildEeConfig(),
};
