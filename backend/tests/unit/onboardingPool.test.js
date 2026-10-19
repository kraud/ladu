/**
 * The committed onboarding pool (scripts/onboarding/pool.tsv) and its parser (lib/onboardingPool.ts).
 * The file is edited by hand during the review, so this test is the guard for every edit.
 * pool-forms.json (Slice 3a) must match it: after an edit, run scripts/lexicon/onboarding-forms.ts.
 * Plan: .context/plans/onboarding.md, Slices 2 and 3a.
 */
const {
    readPool, parsePool, readForms, hasKeyCases, pluralOnlyCases, PLURAL_ONLY_NOUNS_EN,
    POOL_COLUMNS, POOL_STATUSES, POOL_TOPICS, POOL_BANDS, POOL_PARTS_OF_SPEECH, POOL_GENDERS,
} = require('../../lib/onboardingPool');

describe('scripts/onboarding/pool.tsv', () => {
    const pool = readPool();

    it('has concepts', () => {
        expect(pool.length).toBeGreaterThan(0);
    });

    it('has unique ids', () => {
        const ids = pool.map((concept) => concept.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it.each(pool.map((concept) => [concept.id, concept]))('%s is valid', (id, concept) => {
        expect(POOL_STATUSES).toContain(concept.status);
        expect(POOL_TOPICS).toContain(concept.topic);
        expect(concept.topics.length).toBeGreaterThanOrEqual(1);
        concept.topics.forEach((topic) => expect(POOL_TOPICS).toContain(topic));
        expect(concept.topics).toContain(concept.topic);
        expect(new Set(concept.topics).size).toBe(concept.topics.length);
        expect(concept.senseKey).toMatch(/^(\d+\.\d+|manual)$/);
        expect(POOL_BANDS).toContain(concept.band);
        expect(POOL_PARTS_OF_SPEECH).toContain(concept.partOfSpeech);
        expect(Number.isInteger(concept.rank) && concept.rank > 0).toBe(true);
        expect(concept.words.English?.word).toBeTruthy();
        // English + at least one other language: a Word needs two (D9).
        expect(Object.keys(concept.words).length).toBeGreaterThanOrEqual(2);
        for (const [language, code] of [['Spanish', 'es'], ['German', 'de']]) {
            const gender = concept.words[language]?.gender;
            if (gender) expect(POOL_GENDERS[code]).toContain(gender);
        }
    });
});

describe('parsePool', () => {
    const header = POOL_COLUMNS.join('\t');
    const line = ['keep', 'noun:apple', 'food_drink', 'food_drink,core', 'beginner', 'Noun', '2628', 'apple', 'manzana', 'la', 'Apfel', 'der', 'õun', 'fruit', '0.1', ''].join('\t');

    it('reads the words, genders and flags of a line', () => {
        const [concept] = parsePool(`${header}\n${line}\n`);
        expect(concept).toMatchObject({
            status: 'keep', id: 'noun:apple', topic: 'food_drink', topics: ['food_drink', 'core'], senseKey: '0.1',
            partOfSpeech: 'Noun', rank: 2628, flags: [],
        });
        expect(concept.words).toEqual({
            English: { word: 'apple', gender: null },
            Spanish: { word: 'manzana', gender: 'la' },
            German: { word: 'Apfel', gender: 'der' },
            Estonian: { word: 'õun', gender: null },
        });
    });

    it('leaves out a language with an empty word', () => {
        const [concept] = parsePool(`${header}\n${line.replace('\tõun\t', '\t\t')}`);
        expect(concept.words.Estonian).toBeUndefined();
    });

    it('rejects an unknown topic or band, a primary topic missing from topics, and a bad sense_key', () => {
        const edit = (from, to) => `${header}\n${line.replace(from, to)}\n`;
        expect(() => parsePool(edit('food_drink,core', 'food_drink,nope'))).toThrow(/unknown topic "nope"/);
        expect(() => parsePool(edit('\tfood_drink,core\t', '\tanimals\t'))).toThrow(/must include the primary topic/);
        expect(() => parsePool(edit('beginner', 'Beginner'))).toThrow(/unknown band/);
        expect(() => parsePool(edit('\t0.1\t', '\t1\t'))).toThrow(/sense_key/);
        expect(parsePool(edit('\t0.1\t', '\tmanual\t'))[0].senseKey).toBe('manual');
    });

    it('rejects an unknown status, part of speech or gender', () => {
        expect(() => parsePool(`${header}\n${line.replace('keep', 'maybe')}\n`)).toThrow(/unknown status/);
        expect(() => parsePool(`${header}\n${line.replace('\tNoun\t', '\tPronoun\t')}\n`)).toThrow(/part of speech/);
        expect(() => parsePool(`${header}\n${line.replace('\tla\t', '\tlos\t')}\n`)).toThrow(/Spanish gender/);
    });

    it('rejects a wrong header or a line with missing columns', () => {
        expect(() => parsePool(`status\tid\n${line}`)).toThrow(/header/);
        expect(() => parsePool(`${header}\nkeep\tnoun:apple`)).toThrow(/line 2/);
    });
});

describe('scripts/onboarding/pool-forms.json', () => {
    const keep = readPool().filter((concept) => concept.status === 'keep');
    const { format, concepts } = readForms();

    it('has the expected format', () => {
        expect(format).toBe('ladu-onboarding-forms/1');
    });

    it('has exactly the keep concepts of pool.tsv (else run onboarding-forms.ts again)', () => {
        expect(Object.keys(concepts).sort()).toEqual(keep.map((concept) => concept.id).sort());
    });

    it.each(keep.map((concept) => [concept.id, concept]))('%s matches pool.tsv and has its key cases', (id, concept) => {
        for (const [language, { word, cases }] of Object.entries(concepts[id])) {
            expect(word).toBe(concept.words[language]?.word);
            expect(hasKeyCases(concept.partOfSpeech, language, cases, word)).toBe(true);
        }
    });
});

describe('hasKeyCases', () => {
    it('needs every group of the language and part of speech', () => {
        expect(hasKeyCases('Noun', 'Spanish', { genderES: 'la', singularES: 'casa' })).toBe(true);
        expect(hasKeyCases('Noun', 'Spanish', { singularES: 'casa' })).toBe(false);
        expect(hasKeyCases('Noun', 'German', { genderDE: 'das', singularNominativDE: 'Haus' })).toBe(true);
    });

    it('accepts either case of a Spanish adjective', () => {
        expect(hasKeyCases('Adjective', 'Spanish', { neutralSingularES: 'feliz' })).toBe(true);
        expect(hasKeyCases('Adjective', 'Spanish', { maleSingularES: 'rojo' })).toBe(true);
    });

    it('lets a plural-only English noun have pluralEN instead of singularEN, and no other noun', () => {
        expect(PLURAL_ONLY_NOUNS_EN).toEqual(['clothes', 'pants', 'news', 'data', 'stairs']);
        for (const word of PLURAL_ONLY_NOUNS_EN) {
            expect(hasKeyCases('Noun', 'English', { pluralEN: word }, word)).toBe(true);
            expect(hasKeyCases('Noun', 'English', pluralOnlyCases(word), word)).toBe(true);
            expect(hasKeyCases('Noun', 'English', {}, word)).toBe(false);
        }
        // An ordinary noun still needs its singular, even with a plural; the word is needed to tell.
        expect(hasKeyCases('Noun', 'English', { pluralEN: 'dogs' }, 'dog')).toBe(false);
        expect(hasKeyCases('Noun', 'English', { pluralEN: 'clothes' })).toBe(false);
        expect(hasKeyCases('Noun', 'English', { singularEN: 'dog' }, 'dog')).toBe(true);
        // Only English nouns: a plural-only word does not relax other languages or parts of speech.
        expect(hasKeyCases('Noun', 'Spanish', { pluralEN: 'clothes' }, 'clothes')).toBe(false);
        expect(hasKeyCases('Verb', 'English', { pluralEN: 'clothes' }, 'clothes')).toBe(false);
    });

    it('rejects an unknown part of speech or language, and empty values', () => {
        expect(hasKeyCases('Pronoun', 'English', { singularEN: 'it' })).toBe(false);
        expect(hasKeyCases('Noun', 'French', { singularEN: 'x' })).toBe(false);
        expect(hasKeyCases('Verb', 'Estonian', { infinitiveMaEE: '' })).toBe(false);
    });
});
