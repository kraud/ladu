/**
 * Estonian paradigm transforms (services/dictionary/eki.ts) on the Ekilex paradigm shape
 * (`api/paradigm/details/{id}`): forms with a `morphCode` (decision D18).
 */
const { adverbComparisonCases, comparisonCases, transformAdjective, transformAdverb, transformNoun, transformVerb } = require('../../services/dictionary/eki');

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

    it('adds the comparative and the superlative from the relation groups (D20)', () => {
        const details = relations({ komp: ['parem'], superl: ['kõige parem', 'parim'] });
        expect(casesOf(transformAdjective(paradigm('noomen', [['SgN', 'hea']]), details))).toEqual({
            algvorreEE: 'hea',
            keskvorreEE: 'parem',
            ulivorreEE: 'parim',
            periphrasticSuperlativeEE: 'false',
        });
    });
});

const relations = (groups) => ({
    wordRelationDetails: {
        level1WordRelationGroups: Object.entries(groups).map(([groupTypeCode, words]) => ({ groupTypeCode, members: words.map((wordValue) => ({ wordValue })) })),
    },
});

describe('comparisonCases (D20)', () => {
    it('a one-word superlative fills the field and leaves the checkbox unchecked', () => {
        expect(comparisonCases(relations({ komp: ['suurem'], superl: ['kõige suurem', 'suurim'] }))).toEqual([
            ['keskvorreEE', 'suurem'],
            ['ulivorreEE', 'suurim'],
            ['periphrasticSuperlativeEE', 'false'],
        ]);
    });

    it('only "kõige …": no superlative is sent, the checkbox is checked', () => {
        expect(comparisonCases(relations({ komp: ['toredam'], superl: ['kõige toredam'] }))).toEqual([
            ['keskvorreEE', 'toredam'],
            ['periphrasticSuperlativeEE', 'true'],
        ]);
    });

    it('no comparison relations at all (a non-gradable adjective): nothing, the checkbox is left alone', () => {
        expect(comparisonCases(relations({ 'ls-esiosaga': ['eestikeelsus'] }))).toEqual([]);
        expect(comparisonCases({})).toEqual([]);
    });
});

describe('transformAdverb and adverbComparisonCases (Slice H4, D27)', () => {
    const adverb = paradigm('muutumatu', [['ID', 'kiiresti']]);

    it('the adverb is the one form `ID`; with no relations nothing else is sent', () => {
        expect(casesOf(transformAdverb(adverb))).toEqual({ adverbEE: 'kiiresti' });
        expect(transformAdverb(undefined)).toEqual({ status: 'not-found', cases: [] });
    });

    it('"kõige …" is preferred over a one-word superlative: the box is checked and no superlative is sent', () => {
        const details = relations({ komp: ['kiiremini'], superl: ['kõige kiiremini', 'kiireimini'] });
        expect(adverbComparisonCases(details)).toEqual([['comparativeEE', 'kiiremini'], ['periphrasticSuperlativeEE', 'true']]);
        expect(casesOf(transformAdverb(adverb, details))).toEqual({
            adverbEE: 'kiiresti', comparativeEE: 'kiiremini', periphrasticSuperlativeEE: 'true',
        });
    });

    it('a one-word superlative fills the field only when no "kõige …" form is listed (box unchecked)', () => {
        expect(adverbComparisonCases(relations({ komp: ['tihemini'], superl: ['tihtaimini'] }))).toEqual([
            ['comparativeEE', 'tihemini'], ['superlativeEE', 'tihtaimini'], ['periphrasticSuperlativeEE', 'false'],
        ]);
    });

    it('a comparative alone (no superlative listed): the comparative only, the box is left alone', () => {
        expect(adverbComparisonCases(relations({ komp: ['kauem'] }))).toEqual([['comparativeEE', 'kauem']]);
    });

    it('no comparison relations at all: nothing', () => {
        expect(adverbComparisonCases(relations({ 'deriv_base': ['kiire'] }))).toEqual([]);
        expect(adverbComparisonCases({})).toEqual([]);
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
