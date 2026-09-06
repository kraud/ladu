/**
 * Snapshot Tests — Migration Baseline (Drizzle ORM)
 *
 * These tests verify that the migrated controllers return response shapes
 * consistent with the pre-migration baseline.  Each test creates domain
 * objects and snapshots the *structure* (excluding dynamic fields) of the
 * API response.
 *
 * Migration changes:
 *   - `User.create()` / `Word.create()` / `Tag.create()` replaced with
 *     Drizzle inserts + controller API calls.
 *   - The word response now includes a `tags` array (resolved tag documents)
 *     instead of the old `tagWords` junction array.
 *   - The tag response now includes `wordCount` and resolved `author` info.
 */

const request = require('supertest');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users } = require('../src/db/schema');

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const stripDynamic = (obj) => {
    if (Array.isArray(obj)) return obj.map(stripDynamic);
    if (obj && typeof obj === 'object') {
        const cleaned = {};
        for (const [k, v] of Object.entries(obj)) {
            if (
                [
                    '_id', 'id', '__v', 'createdAt', 'updatedAt',
                    'lastDateModifiedTranslation', 'lastDate',
                    'user', 'author', 'authorId',
                    'translationId', 'word', 'wordId',
                    'originalCreator', 'originalCreatorId',
                    '$__', '$isNew', '_doc', '$isValid',
                    'tagWords', 'userId', 'exercisePerformanceId',
                ].includes(k)
            ) continue;
            cleaned[k] = stripDynamic(v);
        }
        return cleaned;
    }
    return obj;
};

describe('Data Snapshots - Migration Baseline', () => {
    let token, userId;

    beforeEach(async () => {
        // Insert a user directly via Drizzle (avoids bcrypt hashing),
        // then generate a JWT for authentication using the global helper.
        const [user] = await db
            .insert(users)
            .values({
                name: 'Snapshot Tester',
                email: 'snap@test.com',
                username: 'snapuser',
                password: 'dummyhash',
            })
            .returning();
        userId = user.id;
        token = global.signin(userId);
    });

    it('records the shape of a full Word with 3 languages', async () => {
        // Create a tag via the API first (needed as a word association).
        const tagRes = await request(app)
            .post('/api/tags')
            .set('Authorization', `Bearer ${token}`)
            .send({
                author: userId,
                label: 'Core Verbs',
                public: 'Private',
            });
        const tagId = tagRes.body._id;

        const res = await request(app)
            .post('/api/words')
            .set('Authorization', `Bearer ${token}`)
            .send({
                partOfSpeech: 'Verb',
                translations: [
                    {
                        language: 'English',
                        cases: [
                            { word: 'to run', caseName: 'infinitiveNonFiniteSimpleEN' },
                            { word: 'run', caseName: 'simplePresent1sEN' },
                            { word: 'ran', caseName: 'simplePastEN' },
                        ],
                    },
                    {
                        language: 'Estonian',
                        cases: [
                            { word: 'jooksma', caseName: 'infinitiveMaEE' },
                            { word: 'jookseb', caseName: 'indicativePresent3sEE' },
                            { word: 'jooksis', caseName: 'indicativePast1sEE' },
                        ],
                    },
                    {
                        language: 'German',
                        cases: [
                            { word: 'laufen', caseName: 'infinitiveDE' },
                            { word: 'laeuft', caseName: 'present3sDE' },
                            { word: 'lief', caseName: 'preterite1s3sDE' },
                        ],
                    },
                ],
                clue: 'move quickly on foot',
                tags: [{ _id: tagId }],
            });

        expect(res.statusCode).toBe(200);
        expect(stripDynamic(res.body)).toMatchSnapshot();
    });

    it('records the shape of an ExercisePerformance document', async () => {
        // Create a word with an Estonian translation so we can reference a
        // real translation ID (FK constraint in the exercise_performances table).
        const wordRes = await request(app)
            .post('/api/words')
            .set('Authorization', `Bearer ${token}`)
            .send({
                partOfSpeech: 'Noun',
                translations: [
                    { language: 'EN', cases: [{ word: 'book', caseName: 'singularNominative' }] },
                    { language: 'Estonian', cases: [{ word: 'raamat', caseName: 'singularNimetavEE' }] },
                ],
                tags: [],
            });
        const wordId = wordRes.body._id;
        const estonianTrans = wordRes.body.translations.find(
            (t) => t.language === 'Estonian',
        );

        const res = await request(app)
            .post('/api/exercises/saveTranslationPerformance')
            .set('Authorization', `Bearer ${token}`)
            .send({
                translationId: estonianTrans._id,
                translationLanguage: 'Estonian',
                word: wordId,
                caseName: 'singularNimetavEE',
                record: true,
            });

        expect(res.statusCode).toBe(200);
        expect(stripDynamic(res.body)).toMatchSnapshot();
    });

    it('records the shape of a Tag with word associations', async () => {
        // Create a word via the API first.
        const wordRes = await request(app)
            .post('/api/words')
            .set('Authorization', `Bearer ${token}`)
            .send({
                partOfSpeech: 'Adjective',
                translations: [
                    { language: 'EN', cases: [{ word: 'big', caseName: 'positive' }] },
                    { language: 'DE', cases: [{ word: 'groß', caseName: 'positive' }] },
                ],
                tags: [],
            });
        const wordId = wordRes.body._id;

        const res = await request(app)
            .post('/api/tags')
            .set('Authorization', `Bearer ${token}`)
            .send({
                author: userId,
                label: 'Adjectives Pack',
                public: 'Private',
                description: 'Common adjectives',
                words: [{ _id: wordId }],
            });

        expect(res.statusCode).toBe(200);
        expect(stripDynamic(res.body)).toMatchSnapshot();
    });
});
