import { describe, expect, it } from 'vitest';
import { Lang, NounCases, PartOfSpeech, VerbCases } from '@/ts/enums';
import { getFormConfig } from '@/features/words/form-engine/configs';
import { activeQueryField, AUTOCOMPLETE_REGISTRY, getAutocompleteEndpoint, toAutocompleteResult } from './transforms';

// The Estonian response transforms moved to the backend in Slice A
// (backend/tests/unit/dictionaryEki.test.js); every pair now answers the same { status, cases }.

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
                'English/Noun',
                'English/Adjective',
                'English/Adverb',
                'Spanish/Verb',
                'Spanish/Noun',
                'Spanish/Adjective',
                'Spanish/Adverb',
                'German/Verb',
                'German/Noun',
                'German/Adjective',
                'German/Adverb',
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

describe('the query field of each adjective and adverb card (Slice H3)', () => {
    it('every registered query field is a text field of that card', () => {
        for (const lang of [Lang.EN, Lang.ES, Lang.DE]) {
            for (const pos of [PartOfSpeech.adjective, PartOfSpeech.adverb]) {
                const endpoint = getAutocompleteEndpoint(lang, pos)!;
                const fields = getFormConfig(pos, lang)!.fields;
                for (const name of [endpoint.queryFieldName, ...(endpoint.alternativeQueryFieldNames ?? [])]) {
                    expect(fields.find((field) => field.name === name)?.kind, `${lang}/${pos}/${name}`).toBe('text');
                }
            }
        }
    });

    it('Spanish adjective: the query is the field of the branch the card shows', () => {
        const endpoint = getAutocompleteEndpoint(Lang.ES, PartOfSpeech.adjective)!;
        const fields = getFormConfig(PartOfSpeech.adjective, Lang.ES)!.fields;
        expect(activeQueryField(endpoint, fields, { gender: 'M/F' })).toBe('maleSingular');
        expect(activeQueryField(endpoint, fields, { gender: 'Neutral' })).toBe('neutralSingular');
        // No gender chosen yet: neither input is shown; the primary name is returned.
        expect(activeQueryField(endpoint, fields, {})).toBe('maleSingular');
    });

    it('a card without branches always uses its one query field', () => {
        const endpoint = getAutocompleteEndpoint(Lang.DE, PartOfSpeech.adjective)!;
        const fields = getFormConfig(PartOfSpeech.adjective, Lang.DE)!.fields;
        expect(activeQueryField(endpoint, fields, {})).toBe('positive');
    });
});

describe('toAutocompleteResult — the one transform for every (language, PoS)', () => {
    it('keeps the status and turns the cases into a map', () => {
        const result = toAutocompleteResult({ status: 'found', cases: [{ caseName: VerbCases.simplePresent1sEN, word: 'run' }] });
        expect(result.status).toBe('found');
        expect(result.cases.get(VerbCases.simplePresent1sEN)).toBe('run');
    });

    it('drops empty-word cases', () => {
        const result = toAutocompleteResult({
            status: 'found',
            cases: [
                { caseName: VerbCases.simplePresent1sEN, word: 'run' },
                { caseName: VerbCases.simplePresent2sEN, word: '' },
            ],
        });
        expect(result.cases.has(VerbCases.simplePresent2sEN)).toBe(false);
    });

    it('keeps partial (the guessed Spanish gender) and not-found', () => {
        expect(toAutocompleteResult({ status: 'partial', cases: [{ caseName: NounCases.genderES, word: 'la' }] }).status).toBe('partial');
        const missing = toAutocompleteResult({ status: 'not-found', cases: [] });
        expect(missing.status).toBe('not-found');
        expect(missing.cases.size).toBe(0);
    });
});

describe('registry query field names — pinned per (language, PoS)', () => {
    it('EN verb queries off simplePresent1s (no stored infinitive case exists for English)', () => {
        expect(getAutocompleteEndpoint(Lang.EN, PartOfSpeech.verb)?.queryFieldName).toBe('simplePresent1s');
    });

    it('EN noun queries off singular (Slice C2)', () => {
        expect(getAutocompleteEndpoint(Lang.EN, PartOfSpeech.noun)?.queryFieldName).toBe('singular');
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
