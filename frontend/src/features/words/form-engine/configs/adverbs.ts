/**
 * Adverb form configs — EN, ES, DE as in the old app; Estonian is new (Slice H4, decision D27).
 * Every language has the required "Gradable / Non-gradable" radio (German from the start; EN, ES and
 * EE since the gradable-radio plan, decision Q1): an adverb with no degrees is complete, not unfinished.
 *
 * The `comparative`/`superlative` fields are visible by default and hidden only once `gradable` is
 * explicitly set to `"Non-gradable"` — the one `visibleWhen` that needs `invert` rather than a positive
 * match, since every other branch in the engine shows fields only once a sibling matches.
 *
 * A periphrastic checkbox (EN "more / most", ES "más", EE "kõige") locks the field it derives and fills
 * it with the prefix + the base word. The derived text is stored together with the checkbox (decision Q9).
 */
import { AdverbCases, Lang, PartOfSpeech } from '@/ts/enums';
import type { FieldConfig, FieldDerivation, FieldLayout, FieldVisibility, RadioOption, TranslationFormConfig } from './types';

function labelKey(key: string): string {
    return `wordRelated:wordForm.adverb.fields.${key}`;
}

/** `wordRelated:wordForm.adverb.errors.form{EN,ES,DE}.<key>` — the per-language adverb error block already in `wordRelated.json`. */
function adverbErrorKey(suffix: string, key: string): string {
    return `wordRelated:wordForm.adverb.errors.form${suffix}.${key}`;
}

function degreeField(
    caseName: AdverbCases,
    name: string,
    required: boolean,
    requiredMessageKey?: string,
    visibleWhen?: FieldVisibility,
    layout?: FieldLayout,
    derivedWhen?: FieldDerivation
): FieldConfig {
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

const GRADABLE_OPTIONS: RadioOption[] = [
    { value: 'Gradable', label: 'Gradable' },
    { value: 'Non-gradable', label: 'Non-gradable' },
];

/** The required radio every adverb form opens with. */
function gradableRadio(suffix: string, caseName: AdverbCases): FieldConfig {
    return {
        kind: 'radio',
        name: 'gradable',
        caseName,
        labelKey: labelKey(caseName),
        required: true,
        requiredMessageKey: adverbErrorKey(suffix, 'gradableRequired'),
        invalidMessageKey: adverbErrorKey(suffix, 'gradableRequired'),
        options: GRADABLE_OPTIONS,
    };
}

// Visible unless the user explicitly picked "Non-gradable" — shown by default, including on a brand-new blank card.
const hiddenWhenNonGradable: FieldVisibility = { field: 'gradable', equals: 'Non-gradable', invert: true };

function periphrasticCheckbox(name: string, caseName: AdverbCases): FieldConfig {
    return { kind: 'checkbox', name, caseName, labelKey: labelKey(caseName), required: false, visibleWhen: hiddenWhenNonGradable };
}

/** A degree field that, while `checkbox` is on, shows `prefix` + `fromField` (read-only) and saves that text. */
function derivedFrom(checkbox: string, prefix: string, fromField: string): FieldDerivation {
    return { when: { field: checkbox, equals: true }, prefix, fromField, store: true };
}

function buildEnConfig(): TranslationFormConfig {
    const suffix = 'EN';
    return {
        pos: PartOfSpeech.adverb,
        lang: Lang.EN,
        fields: [
            gradableRadio(suffix, AdverbCases.gradableEN),
            degreeField(AdverbCases.adverbEN, 'adverb', true, adverbErrorKey(suffix, 'adverbRequired')),
            degreeField(AdverbCases.comparativeEN, 'comparative', false, undefined, hiddenWhenNonGradable, undefined, derivedFrom('periphrastic', 'more ', 'adverb')),
            degreeField(AdverbCases.superlativeEN, 'superlative', false, undefined, hiddenWhenNonGradable, undefined, derivedFrom('periphrastic', 'most ', 'adverb')),
            periphrasticCheckbox('periphrastic', AdverbCases.periphrasticEN),
        ],
    };
}

function buildEsConfig(): TranslationFormConfig {
    const suffix = 'ES';
    return {
        pos: PartOfSpeech.adverb,
        lang: Lang.ES,
        fields: [
            gradableRadio(suffix, AdverbCases.gradableES),
            degreeField(AdverbCases.adverbES, 'adverb', true, adverbErrorKey(suffix, 'adverbRequired')),
            degreeField(AdverbCases.comparativeES, 'comparative', false, undefined, hiddenWhenNonGradable, undefined, derivedFrom('periphrasticComparative', 'más ', 'adverb')),
            // Always typed: "prontísimo" has no prefix (decision Q8).
            degreeField(AdverbCases.superlativeES, 'superlative', false, undefined, hiddenWhenNonGradable),
            periphrasticCheckbox('periphrasticComparative', AdverbCases.periphrasticComparativeES),
        ],
    };
}

function buildDeConfig(): TranslationFormConfig {
    const suffix = 'DE';
    return {
        pos: PartOfSpeech.adverb,
        lang: Lang.DE,
        fields: [
            gradableRadio(suffix, AdverbCases.gradableDE),
            degreeField(AdverbCases.adverbDE, 'adverb', true, adverbErrorKey(suffix, 'adverbRequired')),
            degreeField(AdverbCases.comparativeDE, 'comparative', false, undefined, hiddenWhenNonGradable),
            // D25: stored without "am"; the form shows it.
            { ...degreeField(AdverbCases.superlativeDE, 'superlative', false, undefined, hiddenWhenNonGradable), adornment: { text: 'am' } },
        ],
    };
}

function buildEeConfig(): TranslationFormConfig {
    const suffix = 'EE';
    return {
        pos: PartOfSpeech.adverb,
        lang: Lang.EE,
        fields: [
            gradableRadio(suffix, AdverbCases.gradableEE),
            degreeField(AdverbCases.adverbEE, 'adverb', true, adverbErrorKey(suffix, 'adverbRequired'), undefined, { row: 'degree', column: 'Positive' }),
            degreeField(AdverbCases.comparativeEE, 'comparative', false, undefined, hiddenWhenNonGradable, { row: 'degree', column: 'Comparative' }),
            // With `periphrasticSuperlative` checked the field shows "kõige " + the comparative, read-only, and saves that text (D20, D27, Q9).
            degreeField(AdverbCases.superlativeEE, 'superlative', false, undefined, hiddenWhenNonGradable, { row: 'degree', column: 'Superlative' }, derivedFrom('periphrasticSuperlative', 'kõige ', 'comparative')),
            periphrasticCheckbox('periphrasticSuperlative', AdverbCases.periphrasticSuperlativeEE),
        ],
    };
}

export const ADVERB_CONFIGS: Partial<Record<Lang, TranslationFormConfig>> = {
    [Lang.EN]: buildEnConfig(),
    [Lang.ES]: buildEsConfig(),
    [Lang.DE]: buildDeConfig(),
    [Lang.EE]: buildEeConfig(),
};
