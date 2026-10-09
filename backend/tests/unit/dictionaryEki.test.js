/**
 * Estonian paradigm transforms (services/dictionary/eki.ts) on the Ekilex paradigm shape
 * (`api/paradigm/details/{id}`): forms with a `morphCode` (decision D18).
 */
const { transformAdjective, transformNoun, transformVerb } = require('../../services/dictionary/eki');

const casesOf = (result) => Object.fromEntries(result.cases.map(({ caseName, word }) => [caseName, word]));
const paradigm = (wordClass, forms) => ({
    wordClass,
    paradigmForms: forms.map(([morphCode, value, questionable]) => ({ morphCode, value, questionable })),
});

describe('transformNoun', () => {
    it('maps SgN/PlN/SgG/PlG/SgP/PlP and the short form', () => {
        const result = transformNoun(paradigm('noomen', [
            ['SgN', 'maja'], ['PlN', 'majad'], ['SgG', 'maja'], ['PlG', 'majade'],
            ['SgP', 'maja'], ['PlP', 'maju'], ['SgAdt', 'majja'], ['SgIll', 'majasse'],
        ]));
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

    it('takes the first listed variant, and a questionable form only when there is no other (D19)', () => {
        const result = transformNoun(paradigm('noomen', [
            ['SgN', 'hea'], ['PlP', 'häid'], ['PlP', 'heasid'], ['SgG', 'heaa', true], ['SgG', 'hea'],
        ]));
        expect(casesOf(result)).toMatchObject({ pluralOsastavEE: 'häid', singularOmastavEE: 'hea' });
    });

    it('omits the short form when there is none', () => {
        expect(casesOf(transformNoun(paradigm('noomen', [['SgN', 'maja']])))).toEqual({ singularNimetavEE: 'maja' });
    });

    it('not-found: no paradigm, or a paradigm with no usable form', () => {
        expect(transformNoun(undefined)).toEqual({ status: 'not-found', cases: [] });
        expect(transformNoun(paradigm('noomen', [['SgIll', 'majasse']])).status).toBe('not-found');
    });
});

describe('transformAdjective', () => {
    it('declines like a noun (Ekilex gives adjectives the word class "noomen")', () => {
        const result = transformAdjective(paradigm('noomen', [['SgN', 'hea'], ['SgG', 'hea'], ['PlN', 'head']]));
        expect(casesOf(result)).toEqual({ algvorreEE: 'hea', singularOmastavEE: 'hea', pluralNimetavEE: 'head' });
    });
});

describe('transformVerb', () => {
    it('maps infinitives, present and simple past, and the shared past-perfect participle', () => {
        const cases = casesOf(transformVerb(paradigm('verb', [
            ['Sup', 'jooksma'], ['Inf', 'joosta'], ['IndPrSg1', 'jooksen'], ['IndPrPl3', 'jooksevad'],
            ['IndIpfSg1', 'jooksin'], ['PtsPtPs', 'jooksnud'],
        ])));
        expect(cases).toMatchObject({
            infinitiveMaEE: 'jooksma',
            infinitiveDaEE: 'joosta',
            kindelPresent1sEE: 'jooksen',
            kindelPresent3plEE: 'jooksevad',
            kindelSimplePast1sEE: 'jooksin',
        });
        // The same "PtsPtPs" form fills all six past-perfect persons.
        for (const slot of ['1s', '2s', '3s', '1pl', '2pl', '3pl']) expect(cases[`kindelPastPerfect${slot}EE`]).toBe('jooksnud');
        // Codes the paradigm does not have are left out.
        expect(cases.kindelPresent2sEE).toBeUndefined();
    });
});
