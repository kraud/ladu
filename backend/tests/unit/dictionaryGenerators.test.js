/**
 * The rule-based library fallbacks (services/dictionary/generators.ts), against the real libraries.
 * The lexicon answers first; these run only for a word it does not have.
 */
const { germanVerb } = require('../../services/dictionary/generators');

const german = async (word) =>
    Object.fromEntries((await germanVerb(word, {})).cases.map((c) => [c.caseName, c.word]));

describe('German verb fallback', () => {
    // german-verbs-dict 3.4 gives a separable verb in two parts: ["stehe", "auf"].
    test('a separable verb stores the joined form, as the lexicon does', async () => {
        expect(await german('aufstehen')).toMatchObject({
            indicativePresent1sDE: 'aufstehe',
            indicativePresent3sDE: 'aufsteht',
            indicativeSimplePast1sDE: 'aufstand',
            indicativePerfect1sDE: 'aufgestanden',
            indicativeSimpleFuture1sDE: 'aufstehen',
        });
    });

    test('a verb that is not separable stays as it is', async () => {
        expect(await german('verstehen')).toMatchObject({
            indicativePresent1sDE: 'verstehe',
            indicativeSimplePast1sDE: 'verstand',
            indicativePerfect1sDE: 'verstanden',
        });
    });
});
