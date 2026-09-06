/**
 * Exercises API — Integration Tests
 *
 * Migration notes (Mongoose → Drizzle):
 *   - Word / ExercisePerformance models replaced with Drizzle queries.
 *   - `Word.findOne({})` → `db.select().from(words).limit(1)`
 *   - `Word.create({})` → use the POST /api/words endpoint
 *   - `ExercisePerformance.create({})` → direct Drizzle insert
 *   - `new mongoose.Types.ObjectId()` → plain UUID strings
 */

const request = require('supertest');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { exercisePerformances, translations, words } = require('../src/db/schema');

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const registerAndLogin = async () => {
    await request(app).post('/api/users').send({
        name: 'Ex User', email: 'ex@test.com', username: 'exuser', password: 'pass123',
    });
    const r = await request(app).post('/api/users/login').send({ email: 'ex@test.com', password: 'pass123' });
    return r.body;
};

const seedWords = async (token) => {
    await request(app).post('/api/words').set('Authorization', `Bearer ${token}`)
        .send({
            partOfSpeech: 'Verb',
            translations: [
                { language: 'English', cases: [{ word: 'to run', caseName: 'infinitiveNonFiniteSimpleEN' }] },
                { language: 'Estonian', cases: [{ word: 'jooksma', caseName: 'infinitiveMaEE' }] },
            ],
            tags: [],
        });
    await request(app).post('/api/words').set('Authorization', `Bearer ${token}`)
        .send({
            partOfSpeech: 'Verb',
            translations: [
                { language: 'English', cases: [{ word: 'to eat', caseName: 'infinitiveNonFiniteSimpleEN' }] },
                { language: 'Estonian', cases: [{ word: 's88ma', caseName: 'infinitiveMaEE' }] },
            ],
            tags: [],
        });
};

describe('GET /api/exercises/getUserExercises - Exercise Generation', () => {
    let token;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        await seedWords(token);
    });

    it('returns exercises for valid parameters (Multi-Language)', async () => {
        const params = encodeURIComponent(JSON.stringify({
            languages: ['English', 'Estonian'],
            partsOfSpeech: ['Verb'],
            amountOfExercises: 1,
            multiLang: 'Multi-Language',
            type: 'Text-Input',
            mode: 'Single-Try',
            wordSelection: 'Random',
        }));

        const res = await request(app)
            .get(`/api/exercises/getUserExercises?parameters=${params}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
    });

    it('returns 200 for Single-Language exercises', async () => {
        const params = encodeURIComponent(JSON.stringify({
            languages: ['English', 'Estonian'],
            partsOfSpeech: ['Verb'],
            amountOfExercises: 1,
            multiLang: 'Single-Language',
            type: 'Text-Input',
            mode: 'Single-Try',
            wordSelection: 'Random',
        }));

        const res = await request(app)
            .get(`/api/exercises/getUserExercises?parameters=${params}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
    });
});

describe('POST /api/exercises/saveTranslationPerformance - Performance Tracking', () => {
    let token;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        await seedWords(token);
    });

    it('creates a new performance entry on first save', async () => {
        const [word] = await db.select().from(words).limit(1);
        const [trans] = await db.select().from(translations).limit(1);

        const res = await request(app)
            .post('/api/exercises/saveTranslationPerformance')
            .set('Authorization', `Bearer ${token}`)
            .send({
                translationId: trans.id,
                translationLanguage: 'Estonian',
                word: word.id,
                caseName: 'infinitiveMaEE',
                record: true,
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('averageTranslationKnowledge');
        expect(res.body.statsByCase).toHaveLength(1);
    });

    it('updates knowledge on subsequent saves', async () => {
        const [word] = await db.select().from(words).limit(1);
        const [trans] = await db.select().from(translations).limit(1);

        await request(app)
            .post('/api/exercises/saveTranslationPerformance')
            .set('Authorization', `Bearer ${token}`)
            .send({ translationId: trans.id, translationLanguage: 'Estonian', word: word.id, caseName: 'infinitiveMaEE', record: true });

        const res = await request(app)
            .post('/api/exercises/saveTranslationPerformance')
            .set('Authorization', `Bearer ${token}`)
            .send({ translationId: trans.id, translationLanguage: 'Estonian', word: word.id, caseName: 'infinitiveMaEE', record: true });

        expect(res.statusCode).toBe(200);
        expect(res.body.statsByCase[0].knowledge).toBeGreaterThan(0);
        expect(res.body.statsByCase[0].record).toHaveLength(2);
    });

    it('tracks wrong answers (record: false)', async () => {
        const [word] = await db.select().from(words).limit(1);
        const [trans] = await db.select().from(translations).limit(1);

        const res = await request(app)
            .post('/api/exercises/saveTranslationPerformance')
            .set('Authorization', `Bearer ${token}`)
            .send({ translationId: trans.id, translationLanguage: 'Estonian', word: word.id, caseName: 'infinitiveMaEE', record: false });

        expect(res.statusCode).toBe(200);
        expect(res.body.statsByCase[0].record).toEqual([false]);
    });
});

describe('POST /api/exercises/savePerformanceAction - Performance Modifiers', () => {
    let token, userId, performanceId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        userId = data._id;

        // Create a word via the API (needs 2+ translations per controller validation)
        const wordRes = await request(app)
            .post('/api/words').set('Authorization', `Bearer ${token}`)
            .send({
                partOfSpeech: 'Verb',
                translations: [
                    { language: 'EN', cases: [{ word: 'test', caseName: 'infinitiveNonFiniteSimpleEN' }] },
                    { language: 'ES', cases: [{ word: 'probar', caseName: 'infinitiveNonFiniteSimpleES' }] },
                ],
                tags: [],
            });
        const wordId = wordRes.body._id;

        // Fetch the translation that was created
        const [trans] = await db.select().from(translations).where(eq(translations.wordId, wordId)).limit(1);

        // Create a performance entry directly via Drizzle
        const [perf] = await db
            .insert(exercisePerformances)
            .values({
                userId,
                wordId,
                translationId: trans.id,
                averageTranslationKnowledge: 50,
                lastDateModifiedTranslation: new Date(),
            })
            .returning();
        performanceId = perf.id;
    });

    it('marks a translation as Mastered', async () => {
        const res = await request(app)
            .post('/api/exercises/savePerformanceAction')
            .set('Authorization', `Bearer ${token}`)
            .send({ performanceId, action: 'master' });

        expect(res.statusCode).toBe(200);
        expect(res.body.performanceModifier).toBe('Mastered');
    });

    it('marks a translation for Revise', async () => {
        const res = await request(app)
            .post('/api/exercises/savePerformanceAction')
            .set('Authorization', `Bearer ${token}`)
            .send({ performanceId, action: 'forget' });

        expect(res.statusCode).toBe(200);
        expect(res.body.performanceModifier).toBe('Revise');
    });
});
