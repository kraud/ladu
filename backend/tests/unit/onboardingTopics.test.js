/**
 * The onboarding topic map (scripts/lexicon/onboarding-topics.ts): topicFor() and the map's own rules.
 * Plan: .context/plans/onboarding.md, Slice 1 (decisions D2, D3).
 */
const { TOPICS, PAGE_TOPICS, topicFor } = require('../../scripts/lexicon/onboarding-topics');

const CLOTHING = 'oewn-03055525-n';
const PROFESSIONAL = 'oewn-10499838-n';
const HEALTH_PROFESSIONAL = 'oewn-10184702-n';

const sense = (lexfile, ancestors = [], synset = 'oewn-00000000-n') => ({ synset, lexfile, ancestors: new Set(ancestors) });
const noun = (...senses) => topicFor({ partOfSpeech: 'Noun', senses, pageTopics: new Set() });
const verb = (...senses) => topicFor({ partOfSpeech: 'Verb', senses, pageTopics: new Set() });
const adjective = (...pageTopics) => topicFor({ partOfSpeech: 'Adjective', senses: [sense('adj.all')], pageTopics: new Set(pageTopics) });

describe('topicFor — nouns and verbs', () => {
    it('maps a direct supersense', () => {
        expect(noun(sense('noun.food'))).toBe('food_drink');
        expect(noun(sense('noun.animal'))).toBe('animals');
    });

    it('matches an anchor in the hypernym chain, or the anchor synset itself', () => {
        expect(noun(sense('noun.artifact', ['oewn-1-n', CLOTHING]))).toBe('clothing');
        expect(noun(sense('noun.artifact', [], CLOTHING))).toBe('clothing');
    });

    it('gives a broad supersense no topic without an anchor', () => {
        expect(noun(sense('noun.artifact', ['oewn-1-n']))).toBeNull();
        expect(noun(sense('noun.act'))).toBeNull();
    });

    it('checks anchors before direct supersenses (a professional is Work, not People)', () => {
        expect(noun(sense('noun.person', [PROFESSIONAL]))).toBe('work_money');
        expect(noun(sense('noun.person'))).toBe('people_family');
    });

    it('takes the first topic in TOPICS order when several anchors match (doctor: Health before Work)', () => {
        expect(noun(sense('noun.person', [PROFESSIONAL, HEALTH_PROFESSIONAL]))).toBe('body_health');
    });

    it('lets only the first sense decide', () => {
        expect(noun(sense('noun.Tops'), sense('noun.body'))).toBeNull();
        expect(noun(sense('noun.object', ['oewn-09310874-n']), sense('noun.group'))).toBe('plants_nature');
    });

    it('gives verbs a topic only through an anchor', () => {
        expect(verb(sense('verb.possession'))).toBeNull();
        expect(verb(sense('verb.consumption', [], 'oewn-01170802-v'))).toBe('food_drink');
    });

    it('returns null without WordNet senses', () => {
        expect(noun()).toBeNull();
    });
});

describe('topicFor — adjectives and adverbs', () => {
    it('maps a Wiktionary page topic from the allowlist', () => {
        expect(adjective('Taste')).toBe('food_drink');
        expect(topicFor({ partOfSpeech: 'Adverb', senses: [], pageTopics: new Set(['Time']) })).toBe('time_calendar');
    });

    it('takes the allowlist order, not the page order ("cold": Temperature before Personality)', () => {
        expect(adjective('Personality', 'Temperature')).toBe('weather');
    });

    it('ignores page topics that are not in the allowlist, and WordNet supersenses', () => {
        expect(adjective('Reds', 'Size')).toBeNull();
    });
});

describe('the map', () => {
    const ids = TOPICS.map((topic) => topic.id);

    it('has 15 unique topics (D2)', () => {
        expect(ids).toHaveLength(15);
        expect(new Set(ids).size).toBe(15);
    });

    it('gives each direct supersense to one topic only, and only noun supersenses', () => {
        const supersenses = TOPICS.flatMap((topic) => topic.supersenses);
        expect(new Set(supersenses).size).toBe(supersenses.length);
        supersenses.forEach((supersense) => expect(supersense).toMatch(/^noun\./));
    });

    it('uses well-formed anchor ids', () => {
        TOPICS.flatMap((topic) => topic.anchors).forEach((anchor) => expect(anchor.id).toMatch(/^oewn-\d{8}-[nv]$/));
    });

    it('maps page topics to known topic ids', () => {
        PAGE_TOPICS.forEach(([, id]) => expect(ids).toContain(id));
    });
});
