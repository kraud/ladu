/**
 * Adverb form configs — EN, ES, DE only. There is no `Lang.EE` branch in the
 * old app's `getAdverbForm()` router at all, so `ADVERB_CONFIGS` simply omits
 * the Estonian key; `getFormConfig(adverb, EE)` falls through to `undefined`
 * and `TranslationCard` shows its existing "language not available"
 * fallback, matching the old app's own missing route.
 *
 * German's `comparative`/`superlative` are visible by default and hidden
 * only once `gradable` is explicitly set to `"Non-gradable"` — the one
 * `visibleWhen` in this phase that needs `invert` rather than a positive
 * match, since every other branch in the engine so far shows fields only
 * once a sibling matches, never by default.
 */
import { AdverbCases, Lang, PartOfSpeech } from '@/ts/enums';
import type { FieldConfig, FieldVisibility, RadioOption, TranslationFormConfig } from './types';

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
    visibleWhen?: FieldVisibility
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
    };
}

function buildEnConfig(): TranslationFormConfig {
    const suffix = 'EN';
    return {
        pos: PartOfSpeech.adverb,
        lang: Lang.EN,
        fields: [
            degreeField(AdverbCases.adverbEN, 'adverb', true, adverbErrorKey(suffix, 'adverbRequired')),
            degreeField(AdverbCases.comparativeEN, 'comparative', false),
            degreeField(AdverbCases.superlativeEN, 'superlative', false),
        ],
    };
}

function buildEsConfig(): TranslationFormConfig {
    const suffix = 'ES';
    return {
        pos: PartOfSpeech.adverb,
        lang: Lang.ES,
        fields: [
            degreeField(AdverbCases.adverbES, 'adverb', true, adverbErrorKey(suffix, 'adverbRequired')),
            degreeField(AdverbCases.comparativeES, 'comparative', false),
            degreeField(AdverbCases.superlativeES, 'superlative', false),
        ],
    };
}

const GRADABLE_OPTIONS: RadioOption[] = [
    { value: 'Gradable', label: 'Gradable' },
    { value: 'Non-gradable', label: 'Non-gradable' },
];

function buildDeConfig(): TranslationFormConfig {
    const suffix = 'DE';
    const gradable: FieldConfig = {
        kind: 'radio',
        name: 'gradable',
        caseName: AdverbCases.gradableDE,
        labelKey: labelKey(AdverbCases.gradableDE),
        required: true,
        requiredMessageKey: adverbErrorKey(suffix, 'gradableRequired'),
        invalidMessageKey: adverbErrorKey(suffix, 'gradableRequired'),
        options: GRADABLE_OPTIONS,
    };
    // Visible unless the user explicitly picked "Non-gradable" — shown by default, including on a brand-new blank card.
    const hiddenWhenNonGradable: FieldVisibility = { field: 'gradable', equals: 'Non-gradable', invert: true };

    return {
        pos: PartOfSpeech.adverb,
        lang: Lang.DE,
        fields: [
            gradable,
            degreeField(AdverbCases.adverbDE, 'adverb', true, adverbErrorKey(suffix, 'adverbRequired')),
            degreeField(AdverbCases.comparativeDE, 'comparative', false, undefined, hiddenWhenNonGradable),
            degreeField(AdverbCases.superlativeDE, 'superlative', false, undefined, hiddenWhenNonGradable),
        ],
    };
}

export const ADVERB_CONFIGS: Partial<Record<Lang, TranslationFormConfig>> = {
    [Lang.EN]: buildEnConfig(),
    [Lang.ES]: buildEsConfig(),
    [Lang.DE]: buildDeConfig(),
};
