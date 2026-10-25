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

    it.each(['adverbEN', 'comparativeEN', 'superlativeEE', 'conjunctionEN', 'conjunctionDE', 'secondPartDE', 'secondPartEE'])(
        '%s is a written form',
        (caseName) => expect(isPropertyCase(caseName)).toBe(false)
    );
});
