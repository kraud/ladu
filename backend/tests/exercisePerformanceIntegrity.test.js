/**
 * Exercise performance integrity — Integration Tests
 *
 * Phase 5 Slice 2 (phase-5-practice.md): migration 0007, D5 (removing a
 * translation or a case deletes the stats of ALL users), and D7 (cloning a
 * tag copies the cloner's own practice history).
 *
 * `nativeLanguage` validation (D6) is tested with the other profile tests in
 * auth.test.js.
 */

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { and, eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const {
    exercisePerformanceCases,
    exercisePerformances,
    translations,
    words,
} = require('../src/db/schema');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const registerAndLogin = async (name, email, username) => {
    await request(app).post('/api/users').send({
        name, email, username, password: 'pass123', languages: ['English', 'Spanish', 'Estonian'],
    });
    const r = await request(app).post('/api/users/login').send({ email, password: 'pass123' });
    return r.body;
};

const createNoun = async (token) => {
    const res = await request(app)
        .post('/api/words')
        .set('Authorization', `Bearer ${token}`)
        .send({
            partOfSpeech: 'Noun',
            translations: [
                {
                    language: 'English',
                    cases: [{ word: 'house', caseName: 'singularEN' }, { word: 'houses', caseName: 'pluralEN' }],
                },
                { language: 'Estonian', cases: [{ word: 'maja', caseName: 'singularNimetavEE' }] },
            ],
        });
    return res.body;
};

const translationOf = (word, language) => word.translations.find((t) => t.language === language);

// Inserts a performance row (+ case stats) for `userId` on one translation.
const seedPerformance = async (userId, wordId, translationId, language, caseNames, extra = {}) => {
    const [perf] = await db
        .insert(exercisePerformances)
        .values({
            userId,
            wordId,
            translationId,
            translationLanguage: language,
            averageTranslationKnowledge: 50,
            lastDateModifiedTranslation: new Date('2026-01-01T00:00:00Z'),
            ...extra,
        })
        .returning();
    if (caseNames.length > 0) {
        await db.insert(exercisePerformanceCases).values(
            caseNames.map((caseName) => ({
                exercisePerformanceId: perf.id,
                caseName,
                record: [true, false],
                knowledge: 40,
                lastDate: new Date('2026-01-01T00:00:00Z'),
            })),
        );
    }
    return perf;
};

const countPerformances = async (translationId) =>
    (await db.select().from(exercisePerformances).where(eq(exercisePerformances.translationId, translationId))).length;

const caseStatsOf = async (performanceId) =>
    db.select().from(exercisePerformanceCases).where(eq(exercisePerformanceCases.exercisePerformanceId, performanceId));

// ===========================================================================
// Migration 0007
// ===========================================================================
describe('Migration 0007 — performance integrity', () => {
    // The whole test runs in one transaction that is rolled back (Postgres
    // DDL is transactional): the new constraints are dropped, bad rows are
    // seeded, then the real migration file runs against them.
    const migrationSql = fs.readFileSync(
        path.resolve(__dirname, '../src/db/migrations/0007_exercise_performance_integrity.sql'),
        'utf8',
    );
    const statements = migrationSql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);

    const revertDdl = [
        'DROP INDEX ep_user_translation_unique',
        'DROP INDEX epc_performance_case_unique',
        'ALTER TABLE exercise_performances DROP CONSTRAINT ep_modifier_check',
        'ALTER TABLE exercise_performances DROP CONSTRAINT exercise_performances_translation_id_translations_id_fk',
        'ALTER TABLE exercise_performances ALTER COLUMN translation_id DROP NOT NULL',
        `ALTER TABLE exercise_performances ADD CONSTRAINT exercise_performances_translation_id_translations_id_fk
            FOREIGN KEY (translation_id) REFERENCES translations(id) ON DELETE SET NULL`,
    ];

    it('removes orphans and duplicates, keeps the latest row, then enforces the constraints', async () => {
        const user = await registerAndLogin('Mig User', 'mig@test.com', 'miguser');
        const word = await createNoun(user.token);
        const en = translationOf(word, 'English');
        const ee = translationOf(word, 'Estonian');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const ddl of revertDdl) await client.query(ddl);

            const insertPerf = async (translationId, lastDate, modifier = null) =>
                (await client.query(
                    `INSERT INTO exercise_performances
                        (user_id, word_id, translation_id, translation_language, performance_modifier, last_date_modified_translation)
                     VALUES ($1, $2, $3, 'English', $4, $5) RETURNING id`,
                    [user.id, word.id, translationId, modifier, lastDate],
                )).rows[0].id;
            const insertCase = (perfId, caseName, lastDate) =>
                client.query(
                    `INSERT INTO exercise_performance_cases (exercise_performance_id, case_name, record, knowledge, last_date)
                     VALUES ($1, $2, '{true}', 25, $3)`,
                    [perfId, caseName, lastDate],
                );

            const orphan = await insertPerf(null, '2026-01-01');
            await insertCase(orphan, 'singularEN', '2026-01-01');
            const older = await insertPerf(en.id, '2026-01-01');
            await insertCase(older, 'singularEN', '2026-01-01');
            const newer = await insertPerf(en.id, '2026-02-01');
            // Duplicate case stats inside the surviving performance.
            await insertCase(newer, 'singularEN', '2026-01-10');
            await insertCase(newer, 'singularEN', '2026-02-01');
            const invalidModifier = await insertPerf(ee.id, '2026-01-01', 'Bogus');

            await client.query('SAVEPOINT before_migration');
            for (const statement of statements) await client.query(statement);

            const perfs = (await client.query('SELECT id, translation_id, performance_modifier FROM exercise_performances')).rows;
            expect(perfs.map((r) => r.id).sort()).toEqual([newer, invalidModifier].sort());
            expect(perfs.find((r) => r.id === invalidModifier).performance_modifier).toBeNull();

            const cases = (await client.query('SELECT exercise_performance_id, last_date FROM exercise_performance_cases')).rows;
            expect(cases).toHaveLength(1);
            expect(cases[0].exercise_performance_id).toBe(newer);
            // `timestamp` has no zone: node-pg parses it as local time.
            const kept = new Date(cases[0].last_date);
            expect([kept.getMonth(), kept.getDate()]).toEqual([1, 1]);

            // The constraints now hold.
            await client.query('SAVEPOINT constraints');
            await expect(insertPerf(en.id, '2026-03-01')).rejects.toThrow(/ep_user_translation_unique/);
            await client.query('ROLLBACK TO SAVEPOINT constraints');
            await expect(insertPerf(null, '2026-03-01')).rejects.toThrow(/null value/);
            await client.query('ROLLBACK TO SAVEPOINT constraints');
            await expect(insertPerf(ee.id, '2026-03-01', 'Bogus')).rejects.toThrow();
            await client.query('ROLLBACK TO SAVEPOINT constraints');
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });
});

// ===========================================================================
// D5 — PUT /api/words/:id removes stats for every user
// ===========================================================================
describe('PUT /api/words/:id - stale performance data (D5)', () => {
    let owner, follower, word, en, ee;

    beforeEach(async () => {
        owner = await registerAndLogin('Owner', 'owner@test.com', 'owner');
        follower = await registerAndLogin('Follower', 'follower@test.com', 'follower');
        word = await createNoun(owner.token);
        en = translationOf(word, 'English');
        ee = translationOf(word, 'Estonian');
    });

    const put = (translationsBody) =>
        request(app)
            .put(`/api/words/${word.id}`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ translations: translationsBody });

    it('removing a language deletes the owner\'s and a follower\'s performance for it, and keeps other languages', async () => {
        await seedPerformance(owner.id, word.id, en.id, 'English', ['singularEN']);
        await seedPerformance(follower.id, word.id, en.id, 'English', ['singularEN']);
        await seedPerformance(follower.id, word.id, ee.id, 'Estonian', ['singularNimetavEE']);

        const res = await put([
            { language: 'Estonian', cases: [{ word: 'maja', caseName: 'singularNimetavEE' }] },
        ]);

        expect(res.statusCode).toBe(200);
        expect(await db.select().from(translations).where(eq(translations.id, en.id))).toHaveLength(0);
        expect(await countPerformances(en.id)).toBe(0);
        expect(await countPerformances(ee.id)).toBe(1);
        // The follower has no rows with a NULL translation left over.
        const all = await db.select().from(exercisePerformances);
        expect(all.every((row) => row.translationId !== null)).toBe(true);
    });

    it('removing a case deletes that case\'s stats for every user and keeps the others', async () => {
        const ownerPerf = await seedPerformance(owner.id, word.id, en.id, 'English', ['singularEN', 'pluralEN']);
        const followerPerf = await seedPerformance(follower.id, word.id, en.id, 'English', ['singularEN', 'pluralEN']);

        const res = await put([
            { language: 'English', cases: [{ word: 'house', caseName: 'singularEN' }] },
            { language: 'Estonian', cases: [{ word: 'maja', caseName: 'singularNimetavEE' }] },
        ]);

        expect(res.statusCode).toBe(200);
        for (const perf of [ownerPerf, followerPerf]) {
            const stats = await caseStatsOf(perf.id);
            expect(stats.map((s) => s.caseName)).toEqual(['singularEN']);
        }
        // The performance rows themselves stay.
        expect(await countPerformances(en.id)).toBe(2);
        // The stored average is recomputed from the remaining case: aged mean at
        // "now" of one stat (knowledge 40, dated 2026-01-01) — well below the
        // seeded 50 and above 0 — and the modified date moves to "now".
        const rows = await db.select().from(exercisePerformances).where(eq(exercisePerformances.translationId, en.id));
        for (const row of rows) {
            expect(row.averageTranslationKnowledge).toBeGreaterThan(0);
            expect(row.averageTranslationKnowledge).toBeLessThan(40);
            expect(row.lastDateModifiedTranslation.getTime()).toBeGreaterThan(new Date('2026-06-01').getTime());
        }
    });

    it('does not change any data when the update fails midway (transaction)', async () => {
        const perf = await seedPerformance(owner.id, word.id, en.id, 'English', ['singularEN', 'pluralEN']);

        // A case without `word` violates NOT NULL on translation_cases.word (insert of a new case).
        const res = await put([
            {
                language: 'English',
                cases: [{ word: 'house', caseName: 'singularEN' }, { caseName: 'genitiveEN' }],
            },
            { language: 'Estonian', cases: [{ word: 'maja', caseName: 'singularNimetavEE' }] },
        ]);

        expect(res.statusCode).toBeGreaterThanOrEqual(400);
        expect((await caseStatsOf(perf.id)).map((s) => s.caseName).sort()).toEqual(['pluralEN', 'singularEN']);
    });
});

// ===========================================================================
// D7 — POST /api/tags/:id/clone copies the cloner's own history
// ===========================================================================
describe('POST /api/tags/:id/clone - performance history (D7)', () => {
    it('copies only the cloner\'s rows, with remapped ids, and leaves the source untouched', async () => {
        const author = await registerAndLogin('Author', 'author@test.com', 'author');
        const cloner = await registerAndLogin('Cloner', 'cloner@test.com', 'cloner');
        const other = await registerAndLogin('Other', 'other@test.com', 'other');

        const word = await createNoun(author.token);
        const en = translationOf(word, 'English');
        const ee = translationOf(word, 'Estonian');
        const tag = await request(app)
            .post('/api/tags')
            .set('Authorization', `Bearer ${author.token}`)
            .send({ label: 'Houses', visibility: 'Public', wordIds: [word.id] });

        const clonerEn = await seedPerformance(cloner.id, word.id, en.id, 'English', ['singularEN', 'pluralEN'], {
            performanceModifier: 'Revise',
            reviseCounter: 2,
            averageTranslationKnowledge: 61.5,
        });
        await seedPerformance(author.id, word.id, en.id, 'English', ['singularEN']);
        await seedPerformance(other.id, word.id, ee.id, 'Estonian', ['singularNimetavEE']);

        const res = await request(app)
            .post(`/api/tags/${tag.body.id}/clone`)
            .set('Authorization', `Bearer ${cloner.token}`)
            .send({ visibility: 'Private' });
        expect(res.statusCode).toBe(200);

        const [clonedWord] = await db.select().from(words).where(and(eq(words.userId, cloner.id), eq(words.isCloned, true)));
        const clonedTranslations = await db.select().from(translations).where(eq(translations.wordId, clonedWord.id));
        const clonedEn = clonedTranslations.find((t) => t.language === 'English');
        const clonedEe = clonedTranslations.find((t) => t.language === 'Estonian');

        const copied = await db.select().from(exercisePerformances).where(eq(exercisePerformances.translationId, clonedEn.id));
        expect(copied).toHaveLength(1);
        expect(copied[0]).toMatchObject({
            userId: cloner.id,
            wordId: clonedWord.id,
            translationLanguage: 'English',
            performanceModifier: 'Revise',
            reviseCounter: 2,
            averageTranslationKnowledge: 61.5,
        });
        expect(copied[0].id).not.toBe(clonerEn.id);
        const copiedStats = await caseStatsOf(copied[0].id);
        expect(copiedStats.map((s) => s.caseName).sort()).toEqual(['pluralEN', 'singularEN']);
        expect(copiedStats[0]).toMatchObject({ record: [true, false], knowledge: 40 });

        // No history for a translation the cloner never practiced, and none from other users.
        expect(await countPerformances(clonedEe.id)).toBe(0);
        const clonerRows = await db.select().from(exercisePerformances).where(eq(exercisePerformances.userId, cloner.id));
        expect(clonerRows).toHaveLength(2); // the original + the copy
        const otherRows = await db.select().from(exercisePerformances).where(eq(exercisePerformances.userId, other.id));
        expect(otherRows).toHaveLength(1);

        // Source rows and their stats are unchanged.
        expect(await countPerformances(en.id)).toBe(2); // cloner + author
        expect(await caseStatsOf(clonerEn.id)).toHaveLength(2);
    });
});
