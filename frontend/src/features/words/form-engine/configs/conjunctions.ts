/**
 * Conjunction form configs — new in the conjunctions-and-prepositions plan (`.context/plans/conjunctions-prepositions.md`).
 * Every language has the same four fields: the word, an optional "Coordinating / Subordinating" radio
 * (Q2, changed: learners often do not know the type), a "Paired" checkbox (Q1) and the second part of a
 * pair ("weder" + "noch"), required while the box is on. Spanish adds a verb-mood select for
 * subordinating conjunctions ("para que" + subjunctive). French adds one too, with a fourth value: the
 * conditional ("au cas où", "quand bien même").
 *
 * Layout (Q5): one grid of two columns. The word and the second part share the first row, the type and
 * the "Paired" box the second row, the Spanish mood a third row. Field order follows the rows.
 *
 * The type, the checkbox and the mood are properties of the word (prefixes in `PROPERTY_PREFIXES`
 * on the backend): they are saved, but search and exercises never read them as written forms.
 */
import { ConjunctionCases, Lang, PartOfSpeech } from '@/ts/enums';
import type { FieldConfig, FieldVisibility, RadioOption, TranslationFormConfig } from './types';

function labelKey(key: string): string {
    return `wordRelated:wordForm.conjunction.fields.${key}`;
}

/** `wordRelated:wordForm.conjunction.errors.form{EN,ES,DE,EE}.<key>` */
function conjunctionErrorKey(suffix: string, key: string): string {
    return `wordRelated:wordForm.conjunction.errors.form${suffix}.${key}`;
}

const TYPE_OPTIONS: RadioOption[] = [
    { value: 'Coordinating', label: 'Coordinating' },
    { value: 'Subordinating', label: 'Subordinating' },
];

const MOOD_OPTIONS: RadioOption[] = [
    { value: 'Indicative', label: 'Indicative' },
    { value: 'Subjunctive', label: 'Subjunctive' },
    { value: 'Depends on meaning', label: 'Depends on meaning' },
];

/** French: the conditional follows "au cas où", "quand bien même" and "alors même que" (Le Robert, guide "Conjonctions de subordination"). */
const MOOD_OPTIONS_FR: RadioOption[] = [
    { value: 'Indicative', label: 'Indicative' },
    { value: 'Subjunctive', label: 'Subjunctive' },
    { value: 'Conditional', label: 'Conditional' },
    { value: 'Depends on meaning', label: 'Depends on meaning' },
];

/** Grid cells (see `FieldLayout`): rows `word`, `meta`, `mood`; columns `first`, `second`. */
const cell = (row: string, column: string) => ({ row, column });

const whenPaired: FieldVisibility = { field: 'correlative', equals: true };
const whenSubordinating: FieldVisibility = { field: 'conjunctionType', equals: 'Subordinating' };

/** The conjunction itself, required, lowercase (a German conjunction is not a noun). */
function wordField(suffix: string, caseName: ConjunctionCases): FieldConfig {
    return {
        kind: 'text',
        name: 'conjunction',
        caseName,
        labelKey: labelKey(caseName),
        required: true,
        requiredMessageKey: conjunctionErrorKey(suffix, 'conjunctionRequired'),
        lowercase: true,
        layout: cell('word', 'first'),
    };
}

function typeRadio(suffix: string, caseName: ConjunctionCases): FieldConfig {
    return {
        kind: 'radio',
        name: 'conjunctionType',
        caseName,
        labelKey: labelKey(caseName),
        required: false,
        invalidMessageKey: conjunctionErrorKey(suffix, 'typeInvalid'),
        options: TYPE_OPTIONS,
        layout: cell('meta', 'first'),
    };
}

function pairedCheckbox(caseName: ConjunctionCases): FieldConfig {
    return { kind: 'checkbox', name: 'correlative', caseName, labelKey: labelKey(caseName), required: false, layout: cell('meta', 'second') };
}

/** Visible, and therefore required, only while the "Paired" box is on. */
function secondPartField(suffix: string, caseName: ConjunctionCases): FieldConfig {
    return {
        kind: 'text',
        name: 'secondPart',
        caseName,
        labelKey: labelKey(caseName),
        required: true,
        requiredMessageKey: conjunctionErrorKey(suffix, 'secondPartRequired'),
        lowercase: true,
        visibleWhen: whenPaired,
        layout: cell('word', 'second'),
    };
}

function buildConfig(lang: Lang, suffix: string, cases: Record<'word' | 'type' | 'paired' | 'second', ConjunctionCases>, extra: FieldConfig[] = []): TranslationFormConfig {
    return {
        pos: PartOfSpeech.conjunction,
        lang,
        fields: [
            wordField(suffix, cases.word),
            secondPartField(suffix, cases.second),
            typeRadio(suffix, cases.type),
            pairedCheckbox(cases.paired),
            ...extra,
        ],
    };
}

/** Spanish and French: "porque" takes the indicative, "para que" the subjunctive, "aunque" both. */
function moodSelect(caseName: ConjunctionCases, options: RadioOption[]): FieldConfig {
    return {
        kind: 'select',
        name: 'mood',
        caseName,
        labelKey: labelKey(caseName),
        required: false,
        options,
        visibleWhen: whenSubordinating,
        layout: cell('mood', 'first'),
    };
}

export const CONJUNCTION_CONFIGS: Partial<Record<Lang, TranslationFormConfig>> = {
    [Lang.EN]: buildConfig(Lang.EN, 'EN', {
        word: ConjunctionCases.conjunctionEN,
        type: ConjunctionCases.conjunctionTypeEN,
        paired: ConjunctionCases.correlativeEN,
        second: ConjunctionCases.secondPartEN,
    }),
    [Lang.ES]: buildConfig(
        Lang.ES,
        'ES',
        {
            word: ConjunctionCases.conjunctionES,
            type: ConjunctionCases.conjunctionTypeES,
            paired: ConjunctionCases.correlativeES,
            second: ConjunctionCases.secondPartES,
        },
        [moodSelect(ConjunctionCases.moodES, MOOD_OPTIONS)]
    ),
    [Lang.DE]: buildConfig(Lang.DE, 'DE', {
        word: ConjunctionCases.conjunctionDE,
        type: ConjunctionCases.conjunctionTypeDE,
        paired: ConjunctionCases.correlativeDE,
        second: ConjunctionCases.secondPartDE,
    }),
    [Lang.EE]: buildConfig(Lang.EE, 'EE', {
        word: ConjunctionCases.conjunctionEE,
        type: ConjunctionCases.conjunctionTypeEE,
        paired: ConjunctionCases.correlativeEE,
        second: ConjunctionCases.secondPartEE,
    }),
    [Lang.FR]: buildConfig(
        Lang.FR,
        'FR',
        {
            word: ConjunctionCases.conjunctionFR,
            type: ConjunctionCases.conjunctionTypeFR,
            paired: ConjunctionCases.correlativeFR,
            second: ConjunctionCases.secondPartFR,
        },
        [moodSelect(ConjunctionCases.moodFR, MOOD_OPTIONS_FR)]
    ),
};
