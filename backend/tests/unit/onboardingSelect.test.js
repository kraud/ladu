/**
 * Onboarding selection, validation and tag names (services/onboarding). Pure: synthetic pools,
 * plus a few checks against the committed pool. Plan: .context/plans/onboarding.md, Slice 3c
 * (D5, D9, D14–D16, D18, D22–D25).
 */
const {
    selectConcepts, capacity, learningLanguages, validateChoice, validateCreate, checkCount,
    TOPIC_LABELS, topicLabel, CORE_SHARE, MAX_WORDS,
} = require('../../services/onboarding');
const { readPool, readForms } = require('../../lib/onboardingPool');
const { LANGUAGE_NAMES } = require('../../lib/languages');
const { TOPICS } = require('../../scripts/lexicon/onboarding-topics');

// --- Synthetic pool -----------------------------------------------------------------------------

const ALL = ['English', 'Spanish', 'German', 'Estonian'];

/** A pool concept + its forms. `langs` = the languages with a word (and forms unless `noForms`). */
const make = (id, { topic = 'food_drink', topics = [topic], band = 'beginner', rank = 100, pos = 'Noun', langs = ALL, status = 'keep', noForms = [], word } = {}) => ({
    concept: {
        status, id, topic, topics, band, partOfSpeech: pos, rank, sense: '', senseKey: '0.0', flags: [],
        words: Object.fromEntries(langs.map((l) => [l, { word: word ? word(l) : `${id}-${l}`, gender: null }])),
    },
    forms: Object.fromEntries(langs.filter((l) => !noForms.includes(l)).map((l) => [l, { word: word ? word(l) : `${id}-${l}`, cases: { [`case${l}`]: `${id}-${l}` } }])),
});
const build = (...entries) => ({
    pool: entries.map((e) => e.concept),
    forms: Object.fromEntries(entries.map((e) => [e.concept.id, e.forms])),
});
/** Many concepts in one topic and band, ranked 1..n. */
const many = (prefix, n, options = {}) => Array.from({ length: n }, (_, i) => make(`${prefix}${i + 1}`, { rank: (options.rankFrom ?? 0) + i + 1, ...options }));

const choice = (overrides = {}) => ({
    languages: ['English', 'Spanish'],
    nativeLanguage: 'English',
    levels: { Spanish: 'beginner' },
    topics: ['food_drink', 'animals', 'feelings'],
    ...overrides,
});
const ids = (selected) => selected.map((s) => s.id);

describe('learningLanguages', () => {
    it('drops the native language, or keeps all when there is none', () => {
        expect(learningLanguages(['English', 'Spanish', 'German'], 'Spanish')).toEqual(['English', 'German']);
        expect(learningLanguages(['English', 'Spanish'], null)).toEqual(['English', 'Spanish']);
    });
});

describe('selectConcepts — which concepts count', () => {
    it('uses only keep lines of the picked topics and core', () => {
        const { pool, forms } = build(
            make('a', { rank: 1 }), make('b', { rank: 2, status: 'check' }), make('c', { rank: 3, status: 'drop' }),
            make('d', { rank: 4, topic: 'clothing' }), make('e', { rank: 5, topic: 'core' }),
        );
        expect(ids(selectConcepts(pool, forms, choice(), 10)).sort()).toEqual(['a', 'e']);
    });

    it('needs 2 of the user\'s languages with forms (D9), and the learning language itself', () => {
        const { pool, forms } = build(
            make('noSpanish', { rank: 1, langs: ['English', 'German'] }),
            make('noFormsEs', { rank: 2, noForms: ['Spanish'] }),
            make('onlyEs', { rank: 3, langs: ['Spanish', 'German'] }),
            make('ok', { rank: 4, langs: ['English', 'Spanish'] }),
        );
        expect(ids(selectConcepts(pool, forms, choice(), 10))).toEqual(['ok']);
    });

    it('gives each Word the user\'s languages that have forms, in account order, with the cases', () => {
        const { pool, forms } = build(make('a', { noForms: ['German'] }));
        const [selected] = selectConcepts(pool, forms, choice({ languages: ['Spanish', 'German', 'English'], levels: { Spanish: 'beginner', German: 'beginner' } }), 1);
        expect(selected).toEqual({
            id: 'a', topic: 'food_drink', topics: ['food_drink'], partOfSpeech: 'Noun',
            translations: [
                { language: 'Spanish', cases: [{ caseName: 'caseSpanish', word: 'a-Spanish' }] },
                { language: 'English', cases: [{ caseName: 'caseEnglish', word: 'a-English' }] },
            ],
        });
    });
});

describe('selectConcepts — a concept with two topics', () => {
    it('is eligible when any of its topics is picked, and keeps all its topics', () => {
        const { pool, forms } = build(
            make('fish', { rank: 1, topic: 'animals', topics: ['animals', 'food_drink'] }),
            make('car', { rank: 2, topic: 'travel_transport' }),
        );
        for (const topic of ['animals', 'food_drink']) {
            const selected = selectConcepts(pool, forms, choice({ topics: [topic] }), 10);
            expect(ids(selected)).toEqual(['fish']);
            expect(selected[0]).toMatchObject({ topic: 'animals', topics: ['animals', 'food_drink'] });
        }
        expect(selectConcepts(pool, forms, choice({ topics: ['feelings'] }), 10)).toEqual([]);
    });

    it('is eligible through core when core is its second topic, and counts as core', () => {
        const { pool, forms } = build(
            make('run', { rank: 1, topic: 'sports_hobbies', topics: ['sports_hobbies', 'core'] }),
            ...many('f', 8, { rankFrom: 10 }),
        );
        const selected = selectConcepts(pool, forms, choice({ topics: ['food_drink'] }), 5);
        // The core share (D22) asks for the first core pick at the third pick: run, though its primary topic is not picked.
        expect(ids(selected)).toEqual(['f1', 'f2', 'run', 'f3', 'f4']);
    });

    it('is taken once even when two of its topics are picked', () => {
        const { pool, forms } = build(make('fish', { rank: 1, topic: 'animals', topics: ['animals', 'food_drink'] }));
        expect(ids(selectConcepts(pool, forms, choice({ topics: ['animals', 'food_drink', 'feelings'] }), 10))).toEqual(['fish']);
    });
});

describe('selectConcepts — bands, topics and core (D5, D16, D22, D24)', () => {
    it('takes each learning language from its own band', () => {
        const { pool, forms } = build(
            make('esBeg', { rank: 1, langs: ['English', 'Spanish'] }),
            make('esAdv', { rank: 2, langs: ['English', 'Spanish'], band: 'advanced' }),
            make('deBeg', { rank: 3, langs: ['English', 'German'] }),
            make('deAdv', { rank: 4, langs: ['English', 'German'], band: 'advanced' }),
        );
        const c = choice({ languages: ['English', 'Spanish', 'German'], levels: { Spanish: 'beginner', German: 'advanced' } });
        expect(ids(selectConcepts(pool, forms, c, 2)).sort()).toEqual(['deAdv', 'esBeg']);
    });

    it('takes the picked topics in turn, each by rank', () => {
        const { pool, forms } = build(
            ...many('f', 3, { topic: 'food_drink' }), ...many('a', 3, { topic: 'animals', rankFrom: 10 }),
        );
        expect(ids(selectConcepts(pool, forms, choice({ topics: ['food_drink', 'animals', 'feelings'] }), 4))).toEqual(['f1', 'a1', 'f2', 'a2']);
    });

    it(`makes about ${CORE_SHARE * 100} % of the picks core vocabulary`, () => {
        const { pool, forms } = build(...many('t', 20), ...many('c', 20, { topic: 'core', rankFrom: 50 }));
        const selected = selectConcepts(pool, forms, choice(), 10);
        expect(selected.filter((s) => s.topic === 'core')).toHaveLength(2);
        expect(selectConcepts(pool, forms, choice(), 5).filter((s) => s.topic === 'core')).toHaveLength(1);
    });

    it('fills with: core of the band → topics, then core, of the next band → topics, then core, of the band below', () => {
        const { pool, forms } = build(
            make('topic', { rank: 1, band: 'intermediate' }),
            make('core', { rank: 2, band: 'intermediate', topic: 'core' }),
            make('nextTopic', { rank: 3, band: 'advanced' }),
            make('nextCore', { rank: 4, band: 'advanced', topic: 'core' }),
            make('belowTopic', { rank: 5, band: 'beginner' }),
            make('belowCore', { rank: 6, band: 'beginner', topic: 'core' }),
        );
        const selected = selectConcepts(pool, forms, choice({ levels: { Spanish: 'intermediate' } }), 10);
        expect(ids(selected)).toEqual(['topic', 'core', 'nextTopic', 'nextCore', 'belowTopic', 'belowCore']);
    });

    it('has no next band for an advanced learner, but the band below', () => {
        const { pool, forms } = build(make('adv', { rank: 1, band: 'advanced' }), make('mid', { rank: 2, band: 'intermediate' }), make('beg', { rank: 3 }));
        expect(ids(selectConcepts(pool, forms, choice({ levels: { Spanish: 'advanced' } }), 10))).toEqual(['adv', 'mid']);
    });
});

describe('selectConcepts — sharing and duplicates', () => {
    const c = choice({ languages: ['English', 'Spanish', 'German'], levels: { Spanish: 'beginner', German: 'advanced' } });

    it('lets the languages take turns', () => {
        const { pool, forms } = build(...many('beg', 5), ...many('adv', 5, { band: 'advanced', rankFrom: 10 }));
        const selected = ids(selectConcepts(pool, forms, c, 4));
        expect(selected.filter((id) => id.startsWith('beg'))).toHaveLength(2);
        expect(selected.filter((id) => id.startsWith('adv'))).toHaveLength(2);
    });

    it('gives the share of a language that runs out to the others', () => {
        const { pool, forms } = build(...many('beg', 8), make('adv1', { band: 'advanced', rank: 50 }));
        const selected = ids(selectConcepts(pool, forms, c, 6));
        expect(selected).toHaveLength(6);
        expect(selected.filter((id) => id.startsWith('adv'))).toEqual(['adv1']);
    });

    it('never takes a concept twice, even when two languages share a band', () => {
        const { pool, forms } = build(...many('x', 3));
        const twin = choice({ languages: ['English', 'Spanish', 'German'], levels: { Spanish: 'beginner', German: 'beginner' } });
        expect(ids(selectConcepts(pool, forms, twin, 10))).toEqual(['x1', 'x2', 'x3']);
    });

    it('skips a concept with the same words in the user\'s languages (couch / sofa)', () => {
        const sofa = (l) => (l === 'English' ? 'sofa' : 'sofá');
        const { pool, forms } = build(
            make('couch', { rank: 1, langs: ['English', 'Spanish'], word: (l) => (l === 'English' ? 'sofa' : 'sofá') }),
            make('sofa', { rank: 2, langs: ['English', 'Spanish'], word: sofa }),
            make('chair', { rank: 3 }),
        );
        expect(ids(selectConcepts(pool, forms, choice(), 10))).toEqual(['couch', 'chair']);
    });

    it('stops at the count', () => {
        const { pool, forms } = build(...many('x', 30));
        expect(selectConcepts(pool, forms, choice(), 7)).toHaveLength(7);
    });
});

describe('capacity (D18)', () => {
    it('rounds the reachable concepts down to a multiple of 10', () => {
        const { pool, forms } = build(...many('x', 59));
        expect(capacity(pool, forms, choice())).toBe(50);
    });

    it(`is at most ${MAX_WORDS}`, () => {
        const { pool, forms } = build(...many('x', 200));
        expect(capacity(pool, forms, choice())).toBe(MAX_WORDS);
    });
});

describe('validateChoice / validateCreate / checkCount', () => {
    const account = { languages: ['English', 'Spanish', 'German'], nativeLanguage: 'English' };
    const body = { levels: { Spanish: 'beginner', German: 'advanced' }, topics: ['food_drink', 'animals', 'feelings', 'weather'] };

    it('accepts a level for each learning language and at least 4 topics, up to all 15', () => {
        expect(validateChoice(body, account)).toEqual({ ok: true, value: body });
        expect(validateChoice({ ...body, topics: TOPICS.map((t) => t.id) }, account).ok).toBe(true);
        expect(TOPICS).toHaveLength(15);
    });

    it.each([
        ['a missing learning language', { ...body, levels: { Spanish: 'beginner' } }, 'invalid_levels'],
        ['a level for the native language', { ...body, levels: { ...body.levels, English: 'beginner' } }, 'invalid_levels'],
        ['an unknown level', { ...body, levels: { Spanish: 'expert', German: 'advanced' } }, 'invalid_levels'],
        ['3 topics', { ...body, topics: ['food_drink', 'animals', 'feelings'] }, 'invalid_topics'],
        ['a repeated topic', { ...body, topics: ['food_drink', 'food_drink', 'animals', 'feelings'] }, 'invalid_topics'],
        ['"core" as a topic', { ...body, topics: ['food_drink', 'animals', 'feelings', 'core'] }, 'invalid_topics'],
        ['no body', null, 'invalid_body'],
    ])('refuses %s', (_, request, code) => {
        expect(validateChoice(request, account)).toMatchObject({ ok: false, code });
    });

    it('needs a count from 10 to 150 in steps of 10', () => {
        expect(validateCreate({ ...body, count: 80 }, account)).toMatchObject({ ok: true, value: { count: 80 } });
        for (const count of [0, 5, 55, 160, 50.5, '50', undefined]) {
            expect(validateCreate({ ...body, count }, account)).toMatchObject({ ok: false, code: 'invalid_count' });
        }
    });

    it('checks the count against the capacity (D18, D25)', () => {
        expect(checkCount(100, 100)).toEqual({ ok: true, value: 100 });
        expect(checkCount(110, 100)).toMatchObject({ ok: false, code: 'count_over_capacity' });
        expect(checkCount(40, 100)).toMatchObject({ ok: false, code: 'invalid_count' });
        expect(checkCount(30, 40)).toEqual({ ok: true, value: 30 });
    });
});

describe('topic tag names (D23)', () => {
    it('names every topic and core in every UI language', () => {
        for (const id of [...TOPICS.map((t) => t.id), 'core']) {
            expect(Object.keys(TOPIC_LABELS[id]).sort()).toEqual([...LANGUAGE_NAMES].sort());
        }
    });

    // The topic grid in the app (onboarding.json) and the tag names made here must read the same.
    it.each([['English', 'en'], ['Spanish', 'es'], ['German', 'de'], ['Estonian', 'ee'], ['French', 'fr']])(
        'gives the topics of %s the same names as the frontend locale (%s)',
        (language, code) => {
            const { topics } = require(`../../../frontend/public/locales/${code}/onboarding.json`);
            for (const id of TOPICS.map((t) => t.id)) {
                expect({ id, name: TOPIC_LABELS[id][language] }).toEqual({ id, name: topics.names[id] });
            }
        },
    );

    it('uses the UI language, English when it is not set or unknown', () => {
        expect(topicLabel('animals', 'German')).toBe('Tiere');
        expect(topicLabel('animals', 'French')).toBe('Animaux');
        expect(topicLabel('numbers_measures', 'English')).toBe('Measures & quantities');
        expect(topicLabel('animals', null)).toBe('Animals');
        expect(topicLabel('core', 'Klingon')).toBe('Core vocabulary');
    });
});

describe('the committed pool', () => {
    const pool = readPool();
    const forms = readForms().concepts;

    const common = choice({ languages: ['English', 'Spanish', 'German'], levels: { Spanish: 'beginner', German: 'intermediate' } });
    const coreOf = (selected) => selected.filter((s) => s.topics.includes('core')).length;

    it('keeps the 20 % core share while the topics last (50 words → 10 core)', () => {
        expect(coreOf(selectConcepts(pool, forms, common, 50))).toBe(10);
    });

    it('fills 150 words for a common choice, no duplicates, 2+ languages each; core fills the gap (D16)', () => {
        expect(capacity(pool, forms, common)).toBe(150);
        const selected = selectConcepts(pool, forms, common, 150);
        expect(selected).toHaveLength(150);
        expect(new Set(ids(selected)).size).toBe(150);
        expect(coreOf(selected)).toBeGreaterThanOrEqual(30);
        for (const s of selected) expect(s.translations.length).toBeGreaterThanOrEqual(2);
    });

    it('reaches at least 50 words for the smallest topics at every level (measured minimum: 80)', () => {
        for (const level of ['beginner', 'intermediate', 'advanced']) {
            for (const learn of ['Spanish', 'German', 'Estonian']) {
                const c = choice({ languages: ['English', learn], levels: { [learn]: level }, topics: ['weather', 'technology_media', 'work_money', 'numbers_measures'] });
                expect(capacity(pool, forms, c)).toBeGreaterThanOrEqual(50);
            }
        }
    });
});
