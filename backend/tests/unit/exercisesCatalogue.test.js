const { isPropertyCase } = require('../../services/exercises');

describe('isPropertyCase', () => {
    it.each(['gradableEN', 'gradableES', 'gradableDE', 'gradableEE', 'periphrasticEN', 'periphrasticComparativeES', 'periphrasticSuperlativeEE'])(
        '%s is a property, not a written form',
        (caseName) => expect(isPropertyCase(caseName)).toBe(true)
    );

    it.each(['conjunctionTypeEN', 'conjunctionTypeDE', 'correlativeES', 'correlativeEE', 'moodES', 'reflexivityES'])(
        '%s is a property, not a written form',
        (caseName) => expect(isPropertyCase(caseName)).toBe(true)
    );

    it.each(['positionEN', 'positionDE', 'governedCaseDE', 'governedCasePreEE', 'governedCasePostEE', 'spatialSeriesEE', 'contractsDE', 'positionFR', 'hasVowelFormFR'])(
        '%s is a property, not a written form',
        (caseName) => expect(isPropertyCase(caseName)).toBe(true)
    );

    it.each(['prepositionEN', 'prepositionDE', 'withDemDE', 'withDerDE', 'withDasDE', 'directionToEE', 'directionFromEE', 'positiveEN', 'positiveDE', 'vowelFormFR'])(
        '%s is a written form',
        (caseName) => expect(isPropertyCase(caseName)).toBe(false)
    );

    it.each(['genderFR', 'regularityFR'])(
        '%s is a property, not a written form',
        (caseName) => expect(isPropertyCase(caseName)).toBe(true)
    );

    it.each(['singularFR', 'pluralFR', 'maleSingularFR', 'femalePluralFR', 'comparativeFR', 'superlativeFR'])(
        '%s is a written form',
        (caseName) => expect(isPropertyCase(caseName)).toBe(false)
    );

    // French verb (slice 5): the group radio and the auxiliary are properties; the participles and every tense form are written forms.
    it.each(['verbGroupFR', 'auxVerbFR', 'reflexivityFR'])(
        '%s is a property, not a written form',
        (caseName) => expect(isPropertyCase(caseName)).toBe(true)
    );

    it.each([
        'infinitiveFR', 'pastParticipleFR', 'presentParticipleFR',
        'indicativePresent1sFR', 'indicativePresent3plFR', 'indicativeImperfect2sFR',
        'indicativePerfect1plFR', 'indicativeSimpleFuture3sFR',
    ])('%s is a written form', (caseName) => expect(isPropertyCase(caseName)).toBe(false));

    it.each(['adverbEN', 'comparativeEN', 'superlativeEE', 'conjunctionEN', 'conjunctionDE', 'secondPartDE', 'secondPartEE'])(
        '%s is a written form',
        (caseName) => expect(isPropertyCase(caseName)).toBe(false)
    );
});
