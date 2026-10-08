/**
 * Estonian response transforms (services/dictionary/eki.ts), ported with their tests from
 * frontend/src/features/autocomplete/transforms.test.ts (Slice A moves them to the backend).
 */
const { transformAdjective, transformNoun, transformVerb } = require('../../services/dictionary/eki');

const casesOf = (result) => Object.fromEntries(result.cases.map(({ caseName, word }) => [caseName, word]));

describe('transformNoun', () => {
    it('found: maps SgN/PlN/SgG/PlG/SgP/PlP and the short form', () => {
        const result = transformNoun({
            searchResult: [{
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
            }],
        });
        expect(result.status).toBe('found');
        expect(casesOf(result)).toEqual({
            singularNimetavEE: 'maja',
            pluralNimetavEE: 'majad',
            singularOmastavEE: 'maja',
            pluralOmastavEE: 'majade',
            singularOsastavEE: 'maja',
            pluralOsastavEE: 'maju',
            shortFormEE: 'majja',
        });
    });

    it('omits the short form when SgAdt is absent', () => {
        const result = transformNoun({ searchResult: [{ wordClasses: ['noomen'], wordForms: [{ code: 'SgN', value: 'maja' }] }] });
        expect(casesOf(result)).toEqual({ singularNimetavEE: 'maja' });
    });

    it('not-found: wrong word class, or no result', () => {
        expect(transformNoun({ searchResult: [{ wordClasses: ['verb'], wordForms: [] }] })).toEqual({ status: 'not-found', cases: [] });
        expect(transformNoun({ searchResult: [] }).status).toBe('not-found');
        expect(transformNoun({}).status).toBe('not-found');
    });
});

describe('transformAdjective', () => {
    it('found: gates on meanings[0].partOfSpeech[0].code === "adj"', () => {
        const result = transformAdjective({
            searchResult: [{
                meanings: [{ partOfSpeech: [{ code: 'adj' }] }],
                wordForms: [{ code: 'SgN', value: 'hea' }, { code: 'SgG', value: 'hea' }],
            }],
        });
        expect(result.status).toBe('found');
        expect(casesOf(result)).toEqual({ algvorreEE: 'hea', singularOmastavEE: 'hea' });
    });

    it('not-found: a different part of speech', () => {
        const result = transformAdjective({ searchResult: [{ meanings: [{ partOfSpeech: [{ code: 'noun' }] }], wordForms: [] }] });
        expect(result.status).toBe('not-found');
    });
});

describe('transformVerb', () => {
    it('found: maps infinitives, present and simple past, and the shared past-perfect participle', () => {
        const result = transformVerb({
            searchResult: [{
                wordClasses: ['verb'],
                wordForms: [
                    { code: 'Sup', value: 'jooksma' },
                    { code: 'Inf', value: 'joosta' },
                    { code: 'IndPrSg1', value: 'jooksen' },
                    { code: 'IndPrPl3', value: 'jooksevad' },
                    { code: 'IndIpfSg1', value: 'jooksin' },
                    { code: 'PtsPtPs', value: 'jooksnud' },
                ],
            }],
        });
        const cases = casesOf(result);
        expect(result.status).toBe('found');
        expect(cases).toMatchObject({
            infinitiveMaEE: 'jooksma',
            infinitiveDaEE: 'joosta',
            kindelPresent1sEE: 'jooksen',
            kindelPresent3plEE: 'jooksevad',
            kindelSimplePast1sEE: 'jooksin',
        });
        // The same "PtsPtPs" form fills all six past-perfect persons.
        for (const slot of ['1s', '2s', '3s', '1pl', '2pl', '3pl']) expect(cases[`kindelPastPerfect${slot}EE`]).toBe('jooksnud');
        // Codes the answer does not have are left out.
        expect(cases.kindelPresent2sEE).toBeUndefined();
    });

    it('not-found: wrong word class', () => {
        expect(transformVerb({ searchResult: [{ wordClasses: ['noomen'], wordForms: [] }] }).status).toBe('not-found');
    });
});
