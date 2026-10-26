/**
 * Preposition form configs — slice 2 of the conjunctions-and-prepositions plan
 * (`.context/plans/conjunctions-prepositions.md`). The word is required; everything else is optional
 * (decision Q6: learners often do not know the position or the case).
 *
 * - All languages: a position radio ("Before the noun" / "After the noun" / "Before or after the noun").
 * - German: the article contractions (zu + dem = zum), shown under the word while the "Contracts with
 *   the article" box is on; then the position and the cases the noun takes (multi-select, stored like
 *   the verb cases), both listed in a column.
 * - French: the word and the position radio only. Nearly every French preposition stands before the noun;
 *   "durant" can follow it ("trois heures durant"). The contractions au, aux, du, des are a general rule
 *   for "à" and "de", not a field (as for Spanish "al" and "del").
 * - Estonian: a "where to / where / where from" series (sisse : sees : seest) can be added under the word;
 *   most adpositions follow the noun, so the case of the noun is asked per position.
 *
 * Position, cases and the two boxes are properties of the word (prefixes in `PROPERTY_PREFIXES` on
 * the backend); the contraction and direction fields are written forms.
 */
import { Lang, PartOfSpeech, PrepositionCases, VerbCaseTypeDE } from '@/ts/enums';
import type { FieldConfig, FieldVisibility, OptionsLayout, RadioOption, TranslationFormConfig } from './types';

function labelKey(key: string): string {
    return `wordRelated:wordForm.preposition.fields.${key}`;
}

/** `wordRelated:wordForm.preposition.errors.form{EN,ES,DE,EE}.<key>` */
function prepositionErrorKey(suffix: string, key: string): string {
    return `wordRelated:wordForm.preposition.errors.form${suffix}.${key}`;
}

const BEFORE = 'Before the noun';
const AFTER = 'After the noun';

const POSITION_OPTIONS: RadioOption[] = [
    { value: BEFORE, label: BEFORE },
    { value: AFTER, label: AFTER },
    { value: 'Before or after the noun', label: 'Before or after the noun' },
];

function wordField(suffix: string, caseName: PrepositionCases): FieldConfig {
    return {
        kind: 'text',
        name: 'preposition',
        caseName,
        labelKey: labelKey(caseName),
        required: true,
        requiredMessageKey: prepositionErrorKey(suffix, 'prepositionRequired'),
        lowercase: true,
    };
}

function positionRadio(
    suffix: string,
    caseName: PrepositionCases,
    layout?: FieldConfig['layout'],
    optionsLayout?: OptionsLayout
): FieldConfig {
    return {
        kind: 'radio',
        name: 'position',
        caseName,
        labelKey: labelKey(caseName),
        required: false,
        invalidMessageKey: prepositionErrorKey(suffix, 'positionInvalid'),
        options: POSITION_OPTIONS,
        optionsLayout,
        layout,
    };
}

// ---- German: governed cases (multi-select, the same letters as the verb cases) ----
const CASE_OPTIONS_DE: RadioOption[] = [
    { value: VerbCaseTypeDE.accusativeDE, label: 'Accusative' },
    { value: VerbCaseTypeDE.dativeDE, label: 'Dative' },
    { value: VerbCaseTypeDE.genitiveDE, label: 'Genitive' },
];
const CASE_LETTER: Record<string, string> = {
    [VerbCaseTypeDE.accusativeDE]: 'A',
    [VerbCaseTypeDE.dativeDE]: 'D',
    [VerbCaseTypeDE.genitiveDE]: 'G',
};
const CASE_FROM_LETTER: Record<string, string> = Object.fromEntries(Object.entries(CASE_LETTER).map(([value, letter]) => [letter, value]));

/** "wegen" -> `["genitiveDE"]` -> "G"; "wechsel" prepositions (in, auf) -> "AD". Always in the order A, D, G. */
function encodeCasesDE(selected: string[]): string {
    return CASE_OPTIONS_DE.filter((option) => selected.includes(option.value))
        .map((option) => CASE_LETTER[option.value])
        .join('');
}

function decodeCasesDE(word: string): string[] {
    return word
        .split('')
        .map((letter) => CASE_FROM_LETTER[letter])
        .filter((value): value is string => !!value);
}

// ---- Estonian: the case of the noun (only the cases that adpositions govern) ----
const CASE_OPTIONS_EE: RadioOption[] = ['Genitive', 'Partitive', 'Elative', 'Allative', 'Comitative', 'Terminative', 'Abessive'].map((value) => ({
    value,
    label: value,
}));

/** Shown unless the position rules the field out; an empty position keeps both visible. */
const notAfter: FieldVisibility = { field: 'position', equals: AFTER, invert: true };
const notBefore: FieldVisibility = { field: 'position', equals: BEFORE, invert: true };

function caseSelectEE(name: string, caseName: PrepositionCases, visibleWhen: FieldVisibility, column: string): FieldConfig {
    return {
        kind: 'select',
        name,
        caseName,
        labelKey: labelKey(caseName),
        required: false,
        options: CASE_OPTIONS_EE,
        visibleWhen,
        layout: { row: 'cases', column, block: 'casesEE' },
    };
}

/** A stored checkbox that reveals the fields after it. */
function revealBox(name: string, caseName: PrepositionCases): FieldConfig {
    return { kind: 'checkbox', name, caseName, labelKey: labelKey(caseName), required: false };
}

/** An optional written form, shown while `box` is on. The forms of one block share a single row, on a phone too (`fitRow`). */
function revealedForm(name: string, caseName: PrepositionCases, box: string, block: string, column: string): FieldConfig {
    return {
        kind: 'text',
        name,
        caseName,
        labelKey: labelKey(caseName),
        required: false,
        lowercase: true,
        visibleWhen: { field: box, equals: true },
        layout: { row: 'forms', column, block, fitRow: true },
    };
}

function buildEnConfig(): TranslationFormConfig {
    return {
        pos: PartOfSpeech.preposition,
        lang: Lang.EN,
        fields: [wordField('EN', PrepositionCases.prepositionEN), positionRadio('EN', PrepositionCases.positionEN)],
    };
}

function buildEsConfig(): TranslationFormConfig {
    return {
        pos: PartOfSpeech.preposition,
        lang: Lang.ES,
        fields: [wordField('ES', PrepositionCases.prepositionES), positionRadio('ES', PrepositionCases.positionES)],
    };
}

function buildFrConfig(): TranslationFormConfig {
    return {
        pos: PartOfSpeech.preposition,
        lang: Lang.FR,
        fields: [wordField('FR', PrepositionCases.prepositionFR), positionRadio('FR', PrepositionCases.positionFR)],
    };
}

function buildDeConfig(): TranslationFormConfig {
    return {
        pos: PartOfSpeech.preposition,
        lang: Lang.DE,
        fields: [
            wordField('DE', PrepositionCases.prepositionDE),
            // The box and the three forms it reveals sit right under the word; the forms share one row.
            revealBox('contracts', PrepositionCases.contractsDE),
            revealedForm('withDem', PrepositionCases.withDemDE, 'contracts', 'contractionsDE', 'dem'),
            revealedForm('withDer', PrepositionCases.withDerDE, 'contracts', 'contractionsDE', 'der'),
            revealedForm('withDas', PrepositionCases.withDasDE, 'contracts', 'contractionsDE', 'das'),
            // Row: the position beside the governed cases, both listed in a column.
            positionRadio('DE', PrepositionCases.positionDE, { row: 'meta', column: 'position', block: 'metaDE' }, 'column'),
            {
                kind: 'multi-select',
                name: 'governedCase',
                caseName: PrepositionCases.governedCaseDE,
                labelKey: labelKey(PrepositionCases.governedCaseDE),
                required: false,
                options: CASE_OPTIONS_DE,
                optionsLayout: 'column',
                encode: encodeCasesDE,
                decode: decodeCasesDE,
                layout: { row: 'meta', column: 'governedCase', block: 'metaDE' },
            },
        ],
    };
}

function buildEeConfig(): TranslationFormConfig {
    return {
        pos: PartOfSpeech.preposition,
        lang: Lang.EE,
        fields: [
            wordField('EE', PrepositionCases.prepositionEE),
            // The box and the two forms it reveals sit right under the word; the forms share one row (50-50).
            revealBox('spatialSeries', PrepositionCases.spatialSeriesEE),
            revealedForm('directionTo', PrepositionCases.directionToEE, 'spatialSeries', 'seriesEE', 'to'),
            revealedForm('directionFrom', PrepositionCases.directionFromEE, 'spatialSeries', 'seriesEE', 'from'),
            positionRadio('EE', PrepositionCases.positionEE),
            caseSelectEE('governedCasePre', PrepositionCases.governedCasePreEE, notAfter, 'pre'),
            caseSelectEE('governedCasePost', PrepositionCases.governedCasePostEE, notBefore, 'post'),
        ],
    };
}

export const PREPOSITION_CONFIGS: Partial<Record<Lang, TranslationFormConfig>> = {
    [Lang.EN]: buildEnConfig(),
    [Lang.ES]: buildEsConfig(),
    [Lang.DE]: buildDeConfig(),
    [Lang.EE]: buildEeConfig(),
    [Lang.FR]: buildFrConfig(),
};
