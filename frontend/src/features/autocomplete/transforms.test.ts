import { describe, expect, it } from 'vitest';
import { AdjectiveCases, Lang, NounCases, PartOfSpeech, VerbCases } from '@/ts/enums';
import {
    AUTOCOMPLETE_REGISTRY,
    getAutocompleteEndpoint,
    transformEEAdjective,
    transformEENoun,
    transformEEVerb,
    transformGenericLookup,
} from './transforms';

// The exported registry entries are exercised indirectly through the fixtures
// below (each `fetch` closure composes an api call with a transform); the
// transforms themselves are what's unit-tested directly since they're the
// part with real branching logic.

describe('getAutocompleteEndpoint — coverage table', () => {
    it('only the documented (language, PoS) pairs have an entry', () => {
        const present: string[] = [];
        for (const lang of Object.values(Lang)) {
            for (const pos of Object.values(PartOfSpeech)) {
                if (getAutocompleteEndpoint(lang, pos)) present.push(`${lang}/${pos}`);
            }
        }
        expect(present.sort()).toEqual(
            [
                'English/Verb',
                'Spanish/Verb',
                'Spanish/Noun',
                'German/Verb',
                'German/Noun',
                'Estonian/Verb',
                'Estonian/Noun',
                'Estonian/Adjective',
            ].sort()
        );
    });

    it('EE verb is the only entry with an extraFieldName (searchInEnglish)', () => {
        expect(AUTOCOMPLETE_REGISTRY[Lang.EE]?.[PartOfSpeech.verb]?.extraFieldName).toBe('searchInEnglish');
        expect(AUTOCOMPLETE_REGISTRY[Lang.EE]?.[PartOfSpeech.noun]?.extraFieldName).toBeUndefined();
        expect(AUTOCOMPLETE_REGISTRY[Lang.EE]?.[PartOfSpeech.adjective]?.extraFieldName).toBeUndefined();
    });
});

describe('transformEENoun', () => {
    it('found: maps SgN/PlN/SgG/PlG/SgP/PlP and the short form', () => {
        const result = transformEENoun({
            searchResult: [
                {
                    wordClasses: ['noomen'],
                    wordForms: [
                        { code: 'SgN', value: 'maja' },
                        { code: 'PlN', value: 'majad' },
                        { code: 'SgG', value: 'maja' },
                        { code: 'PlG', value: 'majade' },
                        { code: 'SgP', value: 'maja' },
                        { code: 'PlP', value: 'maju' },
                        { code: 'SgAdt', value: 'majja,koju' },
                    ],
                },
            ],
        });
        expect(result.status).toBe('found');
        expect(result.cases.get(NounCases.singularNimetavEE)).toBe('maja');
        expect(result.cases.get(NounCases.pluralNimetavEE)).toBe('majad');
        expect(result.cases.get(NounCases.shortFormEE)).toBe('majja');
    });

    it('omits the short form when SgAdt is absent', () => {
        const result = transformEENoun({
            searchResult: [{ wordClasses: ['noomen'], wordForms: [{ code: 'SgN', value: 'maja' }] }],
        });
        expect(result.cases.has(NounCases.shortFormEE)).toBe(false);
    });

    it('not-found: wrong word class', () => {
        const result = transformEENoun({ searchResult: [{ wordClasses: ['verb'], wordForms: [] }] });
        expect(result.status).toBe('not-found');
        expect(result.cases.size).toBe(0);
    });

    it('not-found: empty searchResult', () => {
        const result = transformEENoun({ searchResult: [] });
        expect(result.status).toBe('not-found');
    });
});

describe('transformEEAdjective', () => {
    it('found: gates on meanings[0].partOfSpeech[0].code === "adj"', () => {
        const result = transformEEAdjective({
            searchResult: [
                {
                    meanings: [{ partOfSpeech: [{ code: 'adj' }] }],
                    wordForms: [
                        { code: 'SgN', value: 'hea' },
                        { code: 'SgG', value: 'hea' },
                    ],
                },
            ],
        });
        expect(result.status).toBe('found');
        expect(result.cases.get(AdjectiveCases.algvorreEE)).toBe('hea');
        expect(result.cases.get(AdjectiveCases.singularOmastavEE)).toBe('hea');
    });

    it('not-found: a different part of speech', () => {
        const result = transformEEAdjective({
            searchResult: [{ meanings: [{ partOfSpeech: [{ code: 'noun' }] }], wordForms: [] }],
        });
        expect(result.status).toBe('not-found');
    });
});

describe('transformEEVerb', () => {
    it('found: maps infinitives, present/simple-past tenses, and the shared past-perfect form', () => {
        const result = transformEEVerb({
            searchResult: [
                {
                    wordClasses: ['verb'],
                    wordForms: [
                        { code: 'Sup', value: 'jooksma' },
                        { code: 'Inf', value: 'joosta' },
                        { code: 'IndPrSg1', value: 'jooksen' },
                        { code: 'IndIpfSg1', value: 'jooksin' },
                        { code: 'PtsPtPs', value: 'jooksnud' },
                    ],
                },
            ],
        });
        expect(result.status).toBe('found');
        expect(result.cases.get(VerbCases.infinitiveMaEE)).toBe('jooksma');
        expect(result.cases.get(VerbCases.infinitiveDaEE)).toBe('joosta');
        expect(result.cases.get(VerbCases.kindelPresent1sEE)).toBe('jooksen');
        expect(result.cases.get(VerbCases.kindelSimplePast1sEE)).toBe('jooksin');
        // The same "PtsPtPs" form is shared by all six past-perfect pronoun slots.
        expect(result.cases.get(VerbCases.kindelPastPerfect1sEE)).toBe('jooksnud');
        expect(result.cases.get(VerbCases.kindelPastPerfect3plEE)).toBe('jooksnud');
    });

    it('not-found: wrong word class', () => {
        const result = transformEEVerb({ searchResult: [{ wordClasses: ['noomen'], wordForms: [] }] });
        expect(result.status).toBe('not-found');
    });
});

describe('transformGenericLookup — shared by EN/ES/DE verb, DE noun, ES noun-gender', () => {
    it('found: foundVerb true -> status "found" with the response cases', () => {
        const result = transformGenericLookup(
            { foundVerb: true, verbData: { language: 'English', cases: [{ caseName: VerbCases.simplePresent1sEN, word: 'run' }] } },
            'foundVerb',
            'verbData'
        );
        expect(result.status).toBe('found');
        expect(result.cases.get(VerbCases.simplePresent1sEN)).toBe('run');
    });

    it('drops empty-word cases from the response', () => {
        const result = transformGenericLookup(
            {
                foundVerb: true,
                verbData: {
                    language: 'English',
                    cases: [
                        { caseName: VerbCases.simplePresent1sEN, word: 'run' },
                        { caseName: VerbCases.simplePresent2sEN, word: '' },
                    ],
                },
            },
            'foundVerb',
            'verbData'
        );
        expect(result.cases.has(VerbCases.simplePresent2sEN)).toBe(false);
    });

    it('partial: foundNoun false but nounData present (Spanish noun-gender\'s possibleMatch) -> status "partial"', () => {
        const result = transformGenericLookup(
            {
                foundNoun: false,
                possibleMatch: true,
                nounData: { language: 'Spanish', cases: [{ caseName: NounCases.genderES, word: 'la' }] },
            },
            'foundNoun',
            'nounData'
        );
        expect(result.status).toBe('partial');
        expect(result.cases.get(NounCases.genderES)).toBe('la');
    });

    it('not-found: no data at all (German noun\'s genuine miss)', () => {
        const result = transformGenericLookup({ foundNoun: false }, 'foundNoun', 'nounData');
        expect(result.status).toBe('not-found');
        expect(result.cases.size).toBe(0);
    });
});

describe('registry query field names — pinned per (language, PoS)', () => {
    it('EN verb queries off simplePresent1s (no stored infinitive case exists for English)', () => {
        expect(getAutocompleteEndpoint(Lang.EN, PartOfSpeech.verb)?.queryFieldName).toBe('simplePresent1s');
    });

    it('ES verb, DE verb query off their own infinitive fields', () => {
        expect(getAutocompleteEndpoint(Lang.ES, PartOfSpeech.verb)?.queryFieldName).toBe('infinitiveNonFiniteSimple');
        expect(getAutocompleteEndpoint(Lang.DE, PartOfSpeech.verb)?.queryFieldName).toBe('infinitive');
    });

    it('ES noun query field is "singular", DE noun is "singularNominativ"', () => {
        expect(getAutocompleteEndpoint(Lang.ES, PartOfSpeech.noun)?.queryFieldName).toBe('singular');
        expect(getAutocompleteEndpoint(Lang.DE, PartOfSpeech.noun)?.queryFieldName).toBe('singularNominativ');
    });

    it('EE verb queries off infinitiveMa, EE noun off singularNimetav, EE adjective off algvorre', () => {
        expect(getAutocompleteEndpoint(Lang.EE, PartOfSpeech.verb)?.queryFieldName).toBe('infinitiveMa');
        expect(getAutocompleteEndpoint(Lang.EE, PartOfSpeech.noun)?.queryFieldName).toBe('singularNimetav');
        expect(getAutocompleteEndpoint(Lang.EE, PartOfSpeech.adjective)?.queryFieldName).toBe('algvorre');
    });
});
