// Builders for the pure exercise-domain tests (no database).
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-29T12:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * DAY);

/** translations: { English: { singularEN: 'house' }, Spanish: {...} } */
const word = (id, partOfSpeech, translations, performances = []) => ({
    id,
    partOfSpeech,
    translations: Object.entries(translations).map(([language, cases]) => ({
        id: `${id}-${language}`,
        language,
        cases: Object.entries(cases).map(([caseName, w]) => ({ caseName, word: w })),
    })),
    performances,
});

const stat = (caseName, knowledge, lastDate, record = [true]) => ({ caseName, knowledge, lastDate, record });

const perf = (translationId, language, overrides = {}) => ({
    translationId,
    translationLanguage: language,
    performanceModifier: null,
    reviseCounter: 0,
    averageTranslationKnowledge: 0,
    lastDateModifiedTranslation: NOW,
    statsByCase: [],
    ...overrides,
});

const house = (id = 'w1', performances = []) =>
    word(id, 'Noun', {
        English: { singularEN: 'house', pluralEN: 'houses' },
        Spanish: { singularES: 'casa', pluralES: 'casas', genderES: 'la' },
    }, performances);

module.exports = { DAY, NOW, daysAgo, word, stat, perf, house };
