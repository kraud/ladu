/**
 * The exercise catalogue: which grammatical forms can be practised.
 * Spec: .context/plans/phase-5-practice.md §A.5. Adjectives and adverbs have no entries.
 *
 * Multi-language: a "group" maps one grammatical slot to the matching caseName per language.
 * Single-language: a "drill" asks for one case of a translation, given another case of the same translation.
 */

import type { CardType, Language, PartOfSpeech } from './types';

export type SlotByLanguage = Partial<Record<Language, string>>;
/** group (e.g. "singular") → slot (e.g. "nominative") → caseName per language. */
export type MultiLanguageCatalogue = Record<string, Record<string, SlotByLanguage>>;

export interface Drill {
    /** caseName shown as the prompt. */
    questionWord: string;
    /** caseName the user must give. */
    correctValue: string;
    /** Fixed option list (multiple-choice drills only). */
    otherValues?: string[];
}
export type SingleLanguageCatalogue = Record<Language, Record<CardType, Drill[]>>;

const nouns: MultiLanguageCatalogue = {
    singular: {
        nominative: { English: 'singularEN', Spanish: 'singularES', German: 'singularNominativDE', Estonian: 'singularNimetavEE' },
        accusative: { German: 'singularAkkusativDE', Estonian: 'singularOsastavEE' },
        genitive: { German: 'singularGenitivDE', Estonian: 'singularOmastavEE' },
        dative: { German: 'singularDativDE' },
        // Gender is deliberately not compared across languages (a feminine noun in Spanish
        // is not always feminine in German).
    },
    plural: {
        nominative: { English: 'pluralEN', Spanish: 'pluralES', German: 'pluralNominativDE', Estonian: 'pluralNimetavEE' },
        accusative: { German: 'pluralAkkusativDE', Estonian: 'pluralOsastavEE' },
        genitive: { German: 'pluralGenitivDE', Estonian: 'pluralOmastavEE' },
        dative: { German: 'pluralDativDE' },
    },
};

// Verb persons. There is no 2nd person plural.
const PERSONS: Array<[slot: string, code: string]> = [
    ['firstSingular', '1s'],
    ['secondSingular', '2s'],
    ['thirdSingular', '3s'],
    ['firstPlural', '1pl'],
    ['thirdPlural', '3pl'],
];

// Case-name stem per language, per tense. A missing language has no such tense.
const VERB_TENSES: Record<string, SlotByLanguage> = {
    present: { English: 'simplePresent', Spanish: 'indicativePresent', German: 'indicativePresent', Estonian: 'kindelPresent' },
    past: { English: 'simplePast', Spanish: 'indicativePerfectSimplePast', German: 'indicativeSimplePast', Estonian: 'kindelSimplePast' },
    future: { English: 'simpleFuture', Spanish: 'indicativeFuture', German: 'indicativeSimpleFuture' },
};
const LANGUAGE_SUFFIX: Record<Language, string> = { English: 'EN', Spanish: 'ES', German: 'DE', Estonian: 'EE' };

const verbs: MultiLanguageCatalogue = Object.fromEntries(
    Object.entries(VERB_TENSES).map(([tense, stems]) => [
        tense,
        Object.fromEntries(
            PERSONS.map(([slot, code]) => [
                slot,
                Object.fromEntries(
                    Object.entries(stems).map(([language, stem]) => [
                        language,
                        `${stem}${code}${LANGUAGE_SUFFIX[language as Language]}`,
                    ]),
                ),
            ]),
        ),
    ]),
);

export const MULTI_LANGUAGE: Partial<Record<PartOfSpeech, MultiLanguageCatalogue>> = {
    Noun: nouns,
    Verb: verbs,
};

const noDrills = { 'Multiple-Choice': [], 'Text-Input': [] } as Record<CardType, Drill[]>;

const nounDrills: SingleLanguageCatalogue = {
    Spanish: {
        'Multiple-Choice': [{ questionWord: 'singularES', correctValue: 'genderES', otherValues: ['el', 'la', 'el/la'] }],
        'Text-Input': [],
    },
    German: {
        'Multiple-Choice': [{ questionWord: 'singularNominativDE', correctValue: 'genderDE', otherValues: ['der', 'die', 'das'] }],
        'Text-Input': [],
    },
    Estonian: {
        'Multiple-Choice': [],
        'Text-Input': [{ questionWord: 'singularNimetavEE', correctValue: 'shortFormEE' }],
    },
    English: noDrills,
};

const verbDrills: SingleLanguageCatalogue = {
    Spanish: {
        'Multiple-Choice': [{ questionWord: 'infinitiveNonFiniteSimpleES', correctValue: 'regularityES', otherValues: ['regular', 'irregular'] }],
        'Text-Input': [
            { questionWord: 'infinitiveNonFiniteSimpleES', correctValue: 'participleNonFiniteSimpleES' },
            { questionWord: 'infinitiveNonFiniteSimpleES', correctValue: 'gerundNonFiniteSimpleES' },
        ],
    },
    English: {
        'Multiple-Choice': [{ questionWord: 'simplePresent1sEN', correctValue: 'regularityEN', otherValues: ['regular', 'irregular'] }],
        'Text-Input': [],
    },
    German: {
        'Multiple-Choice': [{ questionWord: 'infinitiveDE', correctValue: 'auxVerbDE', otherValues: ['haben', 'sein'] }],
        'Text-Input': [],
    },
    Estonian: noDrills,
};

export const SINGLE_LANGUAGE: Partial<Record<PartOfSpeech, SingleLanguageCatalogue>> = {
    Noun: nounDrills,
    Verb: verbDrills,
};

/** Case-name prefixes that describe a property (gender, regularity…), not a written form. */
const PROPERTY_PREFIXES = ['gender', 'gradable', 'regularity', 'auxVerb', 'caseType', 'prefix'];
export const isPropertyCase = (caseName: string): boolean =>
    PROPERTY_PREFIXES.some((prefix) => caseName.startsWith(prefix));
