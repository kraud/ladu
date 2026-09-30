/**
 * Exercises API — Integration Tests
 *
 * Phase 5 Slice 3 (phase-5-practice.md §B.3): the three old routes were replaced by
 *   POST /api/exercises/generate
 *   POST /api/exercises/answers
 *   PUT  /api/exercises/performances/:translationId/modifier
 * The pure math is pinned in tests/unit/exercises*.test.js; this file tests the
 * HTTP contract, security (IDOR, visibility), full-pool ranking and batching.
 */

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const { and, eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const {
    exercisePerformanceCases,
    exercisePerformances,
    translationCases,
    translations,
    users,
    words,
} = require('../src/db/schema');
const { wordScore } = require('../services/exercises');
const { BATCH_SIZE, rankCandidateWords } = require('../services/exerciseService');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const LANGUAGES = ['English', 'Spanish'];

const register = async (name, email, username, languages = LANGUAGES) => {
    await request(app).post('/api/users').send({ name, email, username, password: 'pass123', languages });
    const r = await request(app).post('/api/users/login').send({ email, password: 'pass123' });
    return r.body;
};

const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

/** A Noun with English + Spanish singular (and optional plural / gender). Returns the API word. */
const postNoun = async (user, en, es, extra = {}) => {
    const res = await request(app)
        .post('/api/words')
        .set(auth(user))
        .send({
            partOfSpeech: 'Noun',
            translations: [
                {
                    language: 'English',
                    cases: [{ word: en, caseName: 'singularEN' }, ...(extra.pluralEN ? [{ word: extra.pluralEN, caseName: 'pluralEN' }] : [])],
                },
                {
                    language: 'Spanish',
                    cases: [
                        { word: es, caseName: 'singularES' },
                        ...(extra.genderES ? [{ word: extra.genderES, caseName: 'genderES' }] : []),
                    ],
                },
            ],
            tags: [],
        });
    expect(res.statusCode).toBe(200);
    return res.body;
};

const translationOf = (word, language) => word.translations.find((t) => t.language === language);

const generate = (user, overrides = {}) =>
    request(app)
        .post('/api/exercises/generate')
        .set(auth(user))
        .send({
            languages: LANGUAGES,
            partsOfSpeech: ['Noun'],
            amount: 5,
            type: 'Text-Input',
            multiLang: 'Multi-Language',
            wordSelection: 'Exercise-Performance',
            ...overrides,
        });

const answer = (user, body) => request(app).post('/api/exercises/answers').set(auth(user)).send(body);
const setModifier = (user, translationId, modifier) =>
    request(app).put(`/api/exercises/performances/${translationId}/modifier`).set(auth(user)).send({ modifier });

const perfRows = (userId) => db.select().from(exercisePerformances).where(eq(exercisePerformances.userId, userId));

/** Insert many words straight into the DB (the API is too slow for 100+ words). */
const bulkWords = async (userId, count, { valid = true, prefix = 'w' } = {}) => {
    const ids = [];
    for (let i = 0; i < count; i++) {
        const [w] = await db.insert(words).values({ userId, partOfSpeech: 'Noun' }).returning();
        const [en] = await db.insert(translations).values({ wordId: w.id, language: 'English' }).returning();
        const [es] = await db.insert(translations).values({ wordId: w.id, language: 'Spanish' }).returning();
        await db.insert(translationCases).values([
            // "unknownX" is not in the catalogue → the word yields no exercise.
            { translationId: en.id, caseName: valid ? 'singularEN' : 'unknownEN', word: `${prefix}${i}-en` },
            { translationId: es.id, caseName: valid ? 'singularES' : 'unknownES', word: `${prefix}${i}-es` },
        ]);
        ids.push({ wordId: w.id, en: en.id, es: es.id });
    }
    return ids;
};

const addPerformance = (userId, ids, fields) =>
    db.insert(exercisePerformances).values({
        userId,
        wordId: ids.wordId,
        translationId: fields.language === 'Spanish' ? ids.es : ids.en,
        translationLanguage: fields.language ?? 'Spanish',
        reviseCounter: 0,
        averageTranslationKnowledge: fields.knowledge ?? 0,
        lastDateModifiedTranslation: fields.date ?? new Date(),
        performanceModifier: fields.modifier ?? null,
    });

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);

// ===========================================================================
// Auth + validation
// ===========================================================================

describe('exercise API — auth and validation', () => {
    let user;
    beforeEach(async () => {
        user = await register('Ex User', 'ex@test.com', 'exuser');
    });

    it('rejects unauthenticated calls', async () => {
        expect((await request(app).post('/api/exercises/generate').send({})).statusCode).toBe(401);
        expect((await request(app).post('/api/exercises/answers').send({})).statusCode).toBe(401);
    });

    it('removes the old routes', async () => {
        expect((await request(app).get('/api/exercises/getUserExercises').set(auth(user))).statusCode).toBe(404);
        expect((await request(app).post('/api/exercises/saveTranslationPerformance').set(auth(user)).send({})).statusCode).toBe(404);
        expect((await request(app).post('/api/exercises/savePerformanceAction').set(auth(user)).send({})).statusCode).toBe(404);
    });

    it.each([
        ['missing body fields', { languages: undefined }, 'invalid_languages'],
        ['unknown language', { languages: ['English', 'Klingon'] }, 'invalid_languages'],
        ['no language', { languages: [] }, 'invalid_languages'],
        ['one language in Multi-Language mode', { languages: ['English'] }, 'invalid_languages'],
        ['no part of speech', { partsOfSpeech: [] }, 'invalid_parts_of_speech'],
        ['unknown part of speech', { partsOfSpeech: ['Pronoun'] }, 'invalid_parts_of_speech'],
        ['amount 0', { amount: 0 }, 'invalid_amount'],
        ['amount 101', { amount: 101 }, 'invalid_amount'],
        ['amount 1.5', { amount: 1.5 }, 'invalid_amount'],
        ['amount as string', { amount: '5' }, 'invalid_amount'],
        ['unknown card type', { type: 'Drag' }, 'invalid_type'],
        ['unknown language mode', { multiLang: 'Both' }, 'invalid_language_mode'],
        ['difficulty 4', { difficultyMC: 4 }, 'invalid_difficulty'],
        ['unknown word selection', { wordSelection: 'Newest' }, 'invalid_word_selection'],
        ['excludeNative as string', { excludeNative: 'yes' }, 'invalid_exclude_native'],
        ['wordIds not uuids', { wordIds: ['abc'] }, 'invalid_word_ids'],
        ['too many wordIds', { wordIds: Array(501).fill('11111111-1111-4111-8111-111111111111') }, 'invalid_word_ids'],
    ])('generate: 400 for %s', async (_label, overrides, code) => {
        const res = await generate(user, overrides);
        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe(code);
    });

    it('generate: accepts amount 1 and 100', async () => {
        expect((await generate(user, { amount: 1 })).statusCode).toBe(200);
        expect((await generate(user, { amount: 100 })).statusCode).toBe(200);
    });

    it('answers: 400 for bad input', async () => {
        const good = '11111111-1111-4111-8111-111111111111';
        expect((await answer(user, { translationId: 'nope', caseName: 'x', result: 'correct' })).body.code).toBe('invalid_translation_id');
        expect((await answer(user, { translationId: good, caseName: '', result: 'correct' })).body.code).toBe('invalid_case_name');
        expect((await answer(user, { translationId: good, caseName: 'x', result: 'maybe' })).body.code).toBe('invalid_result');
        expect((await answer(user, { translationId: good, caseName: 'x', record: true })).statusCode).toBe(400);
    });

    it('modifier: 400 for bad input', async () => {
        const good = '11111111-1111-4111-8111-111111111111';
        expect((await setModifier(user, 'nope', 'Mastered')).body.code).toBe('invalid_translation_id');
        expect((await setModifier(user, good, 'Forgotten')).body.code).toBe('invalid_modifier');
        const missing = await request(app).put(`/api/exercises/performances/${good}/modifier`).set(auth(user)).send({});
        expect(missing.body.code).toBe('invalid_modifier');
    });
});

// ===========================================================================
// Generate
// ===========================================================================

describe('POST /api/exercises/generate', () => {
    let user;
    beforeEach(async () => {
        user = await register('Ex User', 'ex@test.com', 'exuser');
    });

    it('returns an empty list when the user has no words', async () => {
        const res = await generate(user);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ exercises: [] });
    });

    it('returns the documented Exercise shape (no _id)', async () => {
        const word = await postNoun(user, 'house', 'casa');
        const res = await generate(user, { amount: 1 });

        expect(res.statusCode).toBe(200);
        expect(res.body.exercises).toHaveLength(1);
        const ex = res.body.exercises[0];
        expect(Object.keys(ex).sort()).toEqual(
            ['answer', 'key', 'multiLang', 'partOfSpeech', 'performance', 'prompt', 'translationId', 'type', 'wordId'].sort(),
        );
        expect(ex).toMatchObject({ type: 'Text-Input', multiLang: true, partOfSpeech: 'Noun', wordId: word.id, performance: null });
        expect(ex.prompt.language).not.toBe(ex.answer.language);
        expect([ex.prompt.value, ex.answer.value].sort()).toEqual(['casa', 'house']);
        expect([translationOf(word, 'English').id, translationOf(word, 'Spanish').id]).toContain(ex.translationId);
        expect(JSON.stringify(res.body)).not.toContain('"_id"');
        expect(ex.options).toBeUndefined();
    });

    it('builds multiple-choice options: answer included, shuffled list without duplicates', async () => {
        await postNoun(user, 'house', 'casa');
        await postNoun(user, 'dog', 'perro');
        await postNoun(user, 'cat', 'gato');
        await postNoun(user, 'bird', 'casa'); // duplicate Spanish value on purpose

        const res = await generate(user, { amount: 4, type: 'Multiple-Choice', difficultyMC: 1 });
        expect(res.statusCode).toBe(200);
        expect(res.body.exercises.length).toBeGreaterThan(0);
        for (const ex of res.body.exercises) {
            expect(ex.type).toBe('Multiple-Choice');
            expect(ex.options).toContain(ex.answer.value);
            const lowered = ex.options.map((o) => o.toLowerCase());
            expect(new Set(lowered).size).toBe(lowered.length);
            expect(ex.options.length).toBeGreaterThanOrEqual(2);
            expect(ex.options.length).toBeLessThanOrEqual(3);
        }
    });

    it('keeps the catalogue order for single-language choices', async () => {
        await postNoun(user, 'house', 'casa', { genderES: 'la' });
        const res = await generate(user, {
            languages: ['Spanish'], type: 'Multiple-Choice', multiLang: 'Single-Language', amount: 1,
        });
        expect(res.statusCode).toBe(200);
        expect(res.body.exercises).toHaveLength(1);
        expect(res.body.exercises[0]).toMatchObject({ multiLang: false, answer: { caseName: 'genderES', value: 'la' } });
        expect(res.body.exercises[0].options).toEqual(['el', 'la', 'el/la']);
    });

    it('excludes the native language from single-language drills only when asked', async () => {
        await postNoun(user, 'house', 'casa', { genderES: 'la' });
        await db.update(users).set({ nativeLanguage: 'Spanish' }).where(eq(users.id, user.id));
        const base = { languages: ['Spanish'], type: 'Multiple-Choice', multiLang: 'Single-Language', amount: 1 };

        expect((await generate(user, { ...base, excludeNative: false })).body.exercises).toHaveLength(1);
        expect((await generate(user, { ...base, excludeNative: true })).body.exercises).toHaveLength(0);
    });

    it('takes the native language from the account, never from the request', async () => {
        await postNoun(user, 'house', 'casa', { genderES: 'la' });
        // No nativeLanguage on the account; a client-sent one must be ignored.
        const res = await generate(user, {
            languages: ['Spanish'], type: 'Multiple-Choice', multiLang: 'Single-Language', amount: 1,
            excludeNative: true, nativeLanguage: 'Spanish',
        });
        expect(res.body.exercises).toHaveLength(1);
    });

    it('filters by part of speech (adjectives have no exercises)', async () => {
        await postNoun(user, 'house', 'casa');
        const res = await generate(user, { partsOfSpeech: ['Adjective'] });
        expect(res.body.exercises).toHaveLength(0);
    });

    it('repeats rounds over the same words when amount exceeds the pool', async () => {
        await postNoun(user, 'house', 'casa', { pluralEN: 'houses' });
        const res = await generate(user, { amount: 3 });
        // Only one word, one common slot (singular) → one exercise, not three.
        expect(res.body.exercises.length).toBeLessThanOrEqual(3);
        expect(res.body.exercises.length).toBeGreaterThanOrEqual(1);
    });

    describe('pre-selected words and visibility', () => {
        let other, mine, theirs;
        beforeEach(async () => {
            other = await register('Other', 'other@test.com', 'otheruser');
            mine = await postNoun(user, 'house', 'casa');
            await postNoun(user, 'dog', 'perro');
            theirs = await postNoun(other, 'secret', 'secreto');
        });

        it('uses only the pre-selected words', async () => {
            const res = await generate(user, { wordIds: [mine.id], amount: 10 });
            expect(res.body.exercises.length).toBeGreaterThan(0);
            expect(new Set(res.body.exercises.map((e) => e.wordId))).toEqual(new Set([mine.id]));
        });

        it("ignores another user's private word ids (no error, no leak)", async () => {
            const res = await generate(user, { wordIds: [theirs.id], amount: 10 });
            expect(res.statusCode).toBe(200);
            expect(res.body.exercises).toHaveLength(0);

            const mixed = await generate(user, { wordIds: [theirs.id, mine.id], amount: 10 });
            expect(new Set(mixed.body.exercises.map((e) => e.wordId))).toEqual(new Set([mine.id]));
            expect(JSON.stringify(mixed.body)).not.toContain('secret');
        });

        it('includes words of a followed Public tag, and drops them when the tag turns Private', async () => {
            const tag = await request(app)
                .post('/api/tags').set(auth(other))
                .send({ label: 'Shared', visibility: 'Public', description: '', wordIds: [theirs.id] });
            await request(app).post(`/api/tags/${tag.body.id}/follow`).set(auth(user));

            let res = await generate(user, { wordIds: [theirs.id], amount: 10 });
            expect(res.body.exercises.map((e) => e.wordId)).toContain(theirs.id);
            res = await generate(user, { amount: 10 });
            expect(res.body.exercises.map((e) => e.wordId)).toContain(theirs.id);

            await request(app).patch(`/api/tags/${tag.body.id}`).set(auth(other)).send({ visibility: 'Private' });
            res = await generate(user, { wordIds: [theirs.id], amount: 10 });
            expect(res.body.exercises).toHaveLength(0);
        });
    });
});

// ===========================================================================
// Ranking, full pool, batching
// ===========================================================================

describe('word ranking (D2b)', () => {
    let user;
    beforeEach(async () => {
        user = await register('Ex User', 'ex@test.com', 'exuser');
    });

    it('SQL word score equals the JS wordScore on the same data', async () => {
        const ids = await bulkWords(user.id, 7);
        const now = new Date();

        await addPerformance(user.id, ids[0], { modifier: 'Mastered', knowledge: 10 });
        await addPerformance(user.id, ids[1], { modifier: 'Revise', knowledge: 90 });
        await addPerformance(user.id, ids[2], { knowledge: 80, date: daysAgo(30) });
        await addPerformance(user.id, ids[3], { knowledge: 60, date: new Date() });
        // Two languages on one word → mean of both.
        await addPerformance(user.id, ids[4], { language: 'English', knowledge: 40, date: daysAgo(3) });
        await addPerformance(user.id, ids[4], { language: 'Spanish', knowledge: 90, date: daysAgo(10) });
        // A language outside the user's profile does not count.
        await db.insert(exercisePerformances).values({
            userId: user.id, wordId: ids[5].wordId, translationId: ids[5].en, translationLanguage: 'German',
            reviseCounter: 0, averageTranslationKnowledge: 100, lastDateModifiedTranslation: new Date(),
        });
        // ids[5] (only a German row) and ids[6] (no row) → score 0.

        const ranked = await rankCandidateWords(
            { id: user.id, languages: LANGUAGES },
            { languages: LANGUAGES, partsOfSpeech: ['Noun'], multiLang: 'Multi-Language', wordSelection: 'Exercise-Performance' },
            now,
        );
        expect(ranked).toHaveLength(7);

        const rows = await perfRows(user.id);
        for (const { wordId } of ids) {
            const perfs = rows
                .filter((r) => r.wordId === wordId)
                .map((r) => ({
                    translationId: r.translationId,
                    translationLanguage: r.translationLanguage,
                    performanceModifier: r.performanceModifier,
                    averageTranslationKnowledge: r.averageTranslationKnowledge,
                    lastDateModifiedTranslation: r.lastDateModifiedTranslation,
                    statsByCase: [],
                }));
            const expected = wordScore(perfs, LANGUAGES, now);
            const actual = ranked.find((r) => r.id === wordId).score;
            expect(actual).toBeCloseTo(expected, 4);
        }
        // Ascending by score.
        const scores = ranked.map((r) => r.score);
        expect(scores).toEqual([...scores].sort((a, b) => a - b));
    });

    it('puts the weakest words first', async () => {
        const ids = await bulkWords(user.id, 3);
        await addPerformance(user.id, ids[0], { knowledge: 90 });
        await addPerformance(user.id, ids[1], { knowledge: 20 });
        // ids[2]: never practised → score 0 → first.

        const res = await generate(user, { amount: 3 });
        expect(res.body.exercises.map((e) => e.wordId)).toEqual([ids[2].wordId, ids[1].wordId, ids[0].wordId]);
    });

    it('ranks the WHOLE pool, not a random sample of 50', async () => {
        const ids = await bulkWords(user.id, 120);
        // 110 words are well known; 10 are new. A 50-word sample would miss most of the new ones.
        for (const id of ids.slice(0, 110)) await addPerformance(user.id, id, { knowledge: 95 });
        const newWordIds = new Set(ids.slice(110).map((i) => i.wordId));

        for (let run = 0; run < 3; run++) {
            const res = await generate(user, { amount: 10 });
            expect(res.body.exercises).toHaveLength(10);
            expect(new Set(res.body.exercises.map((e) => e.wordId))).toEqual(newWordIds);
        }
    });

    it('keeps loading batches when the weakest words give no exercise', async () => {
        // BATCH_SIZE + 10 words that never give an exercise, ranked first (score 0),
        // and 3 good words with some knowledge, ranked after them.
        await bulkWords(user.id, BATCH_SIZE + 10, { valid: false, prefix: 'bad' });
        const good = await bulkWords(user.id, 3, { prefix: 'good' });
        for (const g of good) await addPerformance(user.id, g, { knowledge: 50 });

        const res = await generate(user, { amount: 3 });
        expect(res.body.exercises).toHaveLength(3);
        expect(new Set(res.body.exercises.map((e) => e.wordId))).toEqual(new Set(good.map((g) => g.wordId)));
    });

    it('Random selection still returns valid exercises from the full pool', async () => {
        await bulkWords(user.id, 20);
        const res = await generate(user, { amount: 5, wordSelection: 'Random' });
        expect(res.body.exercises).toHaveLength(5);
        expect(new Set(res.body.exercises.map((e) => e.wordId)).size).toBe(5);
    });
});

// ===========================================================================
// Answers
// ===========================================================================

describe('POST /api/exercises/answers', () => {
    let user, other, word, esId;
    beforeEach(async () => {
        user = await register('Ex User', 'ex@test.com', 'exuser');
        other = await register('Other', 'other@test.com', 'otheruser');
        word = await postNoun(user, 'house', 'casa');
        esId = translationOf(word, 'Spanish').id;
    });

    const body = (result, extra = {}) => ({ translationId: esId, caseName: 'singularES', result, ...extra });

    it('creates the performance on the first answer (25 %)', async () => {
        const res = await answer(user, body('correct'));
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            translationId: esId,
            modifier: null,
            reviseCounter: 0,
            cases: [{ caseName: 'singularES', record: [true], knowledge: 25, lastDate: expect.any(String) }],
        });
        expect(JSON.stringify(res.body)).not.toContain('_id');
        expect(await perfRows(user.id)).toHaveLength(1);
    });

    it('updates the last-4 record and knowledge (A.8: 25 → 46.875)', async () => {
        await answer(user, body('correct'));
        const res = await answer(user, body('correct'));
        expect(res.body.cases[0].record).toEqual([true, true]);
        expect(res.body.cases[0].knowledge).toBeCloseTo(46.875, 3);
    });

    it('stores partial as correct and wrong as false', async () => {
        await answer(user, body('partial'));
        const res = await answer(user, body('wrong'));
        expect(res.body.cases[0].record).toEqual([true, false]);
    });

    it('keeps only the last 4 answers', async () => {
        for (const r of ['wrong', 'correct', 'correct', 'wrong', 'correct']) await answer(user, body(r));
        const res = await answer(user, body('correct'));
        expect(res.body.cases[0].record).toEqual([true, false, true, true]);
    });

    it('two simultaneous answers create ONE performance row and keep both answers', async () => {
        const [a, b] = await Promise.all([answer(user, body('correct')), answer(user, body('wrong'))]);
        expect(a.statusCode).toBe(200);
        expect(b.statusCode).toBe(200);
        expect(await perfRows(user.id)).toHaveLength(1);
        const cases = await db.select().from(exercisePerformanceCases);
        expect(cases).toHaveLength(1);
        expect(cases[0].record).toHaveLength(2);
    });

    it('404 for an unknown case name on a real translation', async () => {
        const res = await answer(user, body('correct', { caseName: 'notACase' }));
        expect(res.statusCode).toBe(404);
        expect(await perfRows(user.id)).toHaveLength(0);
    });

    it('404 for an unknown translation', async () => {
        const res = await answer(user, body('correct', { translationId: '11111111-1111-4111-8111-111111111111' }));
        expect(res.statusCode).toBe(404);
    });

    it("IDOR: another user cannot save performance on a private word's translation", async () => {
        const res = await answer(other, body('correct'));
        expect(res.statusCode).toBe(404);
        expect(await perfRows(other.id)).toHaveLength(0);
        expect(await perfRows(user.id)).toHaveLength(0);
    });

    it("IDOR: a client-sent performanceId is ignored and never touches another user's row", async () => {
        const first = await answer(user, body('correct'));
        expect(first.statusCode).toBe(200);
        const [ownersRow] = await perfRows(user.id);

        // `other` follows a Public tag with the word, so they may answer — on their OWN row.
        const tag = await request(app).post('/api/tags').set(auth(user))
            .send({ label: 'Pub', visibility: 'Public', description: '', wordIds: [word.id] });
        await request(app).post(`/api/tags/${tag.body.id}/follow`).set(auth(other));
        const res = await answer(other, body('wrong', { performanceId: ownersRow.id }));
        expect(res.statusCode).toBe(200);

        const [unchanged] = await db.select().from(exercisePerformances).where(eq(exercisePerformances.id, ownersRow.id));
        expect(unchanged.averageTranslationKnowledge).toBe(ownersRow.averageTranslationKnowledge);
        const ownersCases = await db.select().from(exercisePerformanceCases).where(eq(exercisePerformanceCases.exercisePerformanceId, ownersRow.id));
        expect(ownersCases[0].record).toEqual([true]);
        expect(await perfRows(other.id)).toHaveLength(1);
    });

    it('a follower of a visible tag can answer; once the tag is Private the answer is 404', async () => {
        const tag = await request(app).post('/api/tags').set(auth(user))
            .send({ label: 'Pub', visibility: 'Public', description: '', wordIds: [word.id] });
        await request(app).post(`/api/tags/${tag.body.id}/follow`).set(auth(other));
        expect((await answer(other, body('correct'))).statusCode).toBe(200);

        await request(app).patch(`/api/tags/${tag.body.id}`).set(auth(user)).send({ visibility: 'Private' });
        expect((await answer(other, body('correct'))).statusCode).toBe(404);
    });

    it('generate returns the saved performance on the answer side', async () => {
        await answer(user, body('correct'));
        const res = await generate(user, { amount: 5 });
        const withPerf = res.body.exercises.filter((e) => e.translationId === esId);
        for (const ex of withPerf) {
            expect(ex.performance).toMatchObject({ translationId: esId, modifier: null });
            expect(ex.performance.cases[0]).toMatchObject({ caseName: 'singularES', record: [true], knowledge: 25 });
        }
    });
});

// ===========================================================================
// Modifiers + revise counter
// ===========================================================================

describe('PUT /api/exercises/performances/:translationId/modifier', () => {
    let user, other, word, esId;
    beforeEach(async () => {
        user = await register('Ex User', 'ex@test.com', 'exuser');
        other = await register('Other', 'other@test.com', 'otheruser');
        word = await postNoun(user, 'house', 'casa');
        esId = translationOf(word, 'Spanish').id;
    });

    const correctAnswer = (u = user) => answer(u, { translationId: esId, caseName: 'singularES', result: 'correct' });

    it('404 when the user has no performance for the translation yet (C7)', async () => {
        const res = await setModifier(user, esId, 'Mastered');
        expect(res.statusCode).toBe(404);
        expect(await perfRows(user.id)).toHaveLength(0);
    });

    it('sets Mastered, then Revise, then clears with null — returning the full summary', async () => {
        await correctAnswer();

        let res = await setModifier(user, esId, 'Mastered');
        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({ translationId: esId, modifier: 'Mastered', reviseCounter: 0 });
        expect(res.body.cases).toHaveLength(1);

        res = await setModifier(user, esId, 'Revise');
        expect(res.body.modifier).toBe('Revise');

        res = await setModifier(user, esId, null);
        expect(res.body.modifier).toBeNull();
    });

    it('keeps updating knowledge while a modifier is set', async () => {
        await correctAnswer();
        await setModifier(user, esId, 'Mastered');
        const res = await correctAnswer();
        expect(res.body.modifier).toBe('Mastered');
        expect(res.body.cases[0].record).toEqual([true, true]);
    });

    it('Revise clears itself after 5 correct answers (counter 1..4, then reset)', async () => {
        await correctAnswer();
        await setModifier(user, esId, 'Revise');

        for (let n = 1; n <= 4; n++) {
            const res = await correctAnswer();
            expect(res.body).toMatchObject({ modifier: 'Revise', reviseCounter: n });
        }
        const last = await correctAnswer();
        expect(last.body).toMatchObject({ modifier: null, reviseCounter: 0 });
    });

    it('a wrong answer does not advance the revise counter', async () => {
        await correctAnswer();
        await setModifier(user, esId, 'Revise');
        await correctAnswer();
        const res = await answer(user, { translationId: esId, caseName: 'singularES', result: 'wrong' });
        expect(res.body).toMatchObject({ modifier: 'Revise', reviseCounter: 1 });
    });

    it('re-setting a modifier resets the counter', async () => {
        await correctAnswer();
        await setModifier(user, esId, 'Revise');
        await correctAnswer();
        const res = await setModifier(user, esId, 'Revise');
        expect(res.body.reviseCounter).toBe(0);
    });

    it("IDOR: another user cannot change the owner's modifier", async () => {
        await correctAnswer();
        const res = await setModifier(other, esId, 'Mastered');
        expect(res.statusCode).toBe(404);
        const [row] = await perfRows(user.id);
        expect(row.performanceModifier).toBeNull();
    });

    it('a modifier changes ranking: Mastered ranks last, Revise ranks first', async () => {
        const w2 = await postNoun(user, 'dog', 'perro');
        const w3 = await postNoun(user, 'cat', 'gato');
        const es = (w) => translationOf(w, 'Spanish').id;
        for (const [w, r] of [[word, 'correct'], [w2, 'correct'], [w3, 'correct']]) {
            await answer(user, { translationId: es(w), caseName: 'singularES', result: r });
        }
        await setModifier(user, es(word), 'Mastered');
        await setModifier(user, es(w3), 'Revise');

        const res = await generate(user, { amount: 3 });
        expect(res.body.exercises.map((e) => e.wordId)).toEqual([w3.id, w2.id, word.id]);
    });
});
