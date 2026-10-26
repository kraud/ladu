// Demo access, Slice 2 step 2: the template data file, the template seed, and the copy into each
// new demo (id maps, array remap, date shift). See .context/plans/demo-access.md.
const { randomUUID } = require('crypto');
const request = require('./request');
const { and, eq, inArray } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const {
    users, words, translations, translationCases, tags, tagWords, practiceConfigs, exercisePerformances, exercisePerformanceCases,
} = require('../src/db/schema');
const { resetDemoStartLimiter } = require('../lib/demo');
const { loadTemplateData, seedDemoTemplate, TEMPLATE_USERNAME } = require('../lib/demoTemplate');
const { validateConfigRequest } = require('../services/exercises');
const { MULTI_LANGUAGE } = require('../services/exercises/catalogue');
const { RECORD_LENGTH, applyAnswer } = require('../services/exercises/knowledge');
// The app's own case-name lists (the word forms are checked in the browser only: Review log S2-3).
const { LANGUAGE_SUFFIX } = require('../lib/languages');
const { Lang, NounCases, VerbCases, AdjectiveCases, AdverbCases } = require('../../frontend/src/ts/enums');

const DAY = 24 * 60 * 60 * 1000;
const data = loadTemplateData();

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    resetDemoStartLimiter();
});
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

// ---------------------------------------------------------------------------------------------------

describe('the template data file (scripts/demo-template/data.json)', () => {
    const CASES_BY_POS = { Noun: NounCases, Verb: VerbCases, Adjective: AdjectiveCases, Adverb: AdverbCases };
    const SUFFIX = LANGUAGE_SUFFIX;
    const LANGUAGES = Object.values(Lang);
    const wordByKey = new Map(data.words.map((w) => [w.key, w]));
    const tagKeys = new Set(data.tags.map((t) => t.key));

    it('has unique word keys, unique tag keys and unique tag labels (case-insensitive)', () => {
        expect(wordByKey.size).toBe(data.words.length);
        expect(tagKeys.size).toBe(data.tags.length);
        expect(new Set(data.tags.map((t) => t.label.toLowerCase())).size).toBe(data.tags.length);
    });

    it.each(data.words.map((w) => [w.key, w]))('word "%s": a known part of speech, ≥ 2 languages, every case name valid for it', (_key, word) => {
        const cases = CASES_BY_POS[word.partOfSpeech];
        expect(cases).toBeDefined();
        const languages = Object.keys(word.translations);
        expect(languages.length).toBeGreaterThanOrEqual(2);
        for (const language of languages) {
            expect(LANGUAGES).toContain(language);
            const forms = Object.entries(word.translations[language]);
            expect(forms.length).toBeGreaterThan(0);
            for (const [caseName, value] of forms) {
                expect({ caseName, valid: Object.values(cases).includes(caseName) }).toEqual({ caseName, valid: true });
                expect({ caseName, language, suffixMatches: caseName.endsWith(SUFFIX[language]) }).toEqual({ caseName, language, suffixMatches: true });
                expect(typeof value === 'string' && value.trim().length > 0).toBe(true);
            }
        }
        for (const tag of word.tags) expect(tagKeys).toContain(tag);
    });

    it('gives every adverb its Gradable / Non-gradable radio, and the full text next to a periphrastic box (gradable-radio plan, Q1, Q9)', () => {
        const adverbs = data.words.filter((w) => w.partOfSpeech === 'Adverb');
        expect(adverbs.length).toBeGreaterThan(0);
        for (const word of adverbs) {
            for (const [language, forms] of Object.entries(word.translations)) {
                const suffix = SUFFIX[language];
                expect(['Gradable', 'Non-gradable']).toContain(forms[`gradable${suffix}`]);
                const degrees = !!forms[`comparative${suffix}`] || !!forms[`superlative${suffix}`];
                expect(forms[`gradable${suffix}`] === 'Gradable').toBe(degrees);
                if (forms.periphrasticEN) expect(forms.comparativeEN).toBe(`more ${forms.adverbEN}`);
                if (forms.periphrasticComparativeES) expect(forms.comparativeES).toBe(`más ${forms.adverbES}`);
                if (forms.periphrasticSuperlativeEE) expect(forms.superlativeEE).toBe(`kõige ${forms.comparativeEE}`);
            }
        }
    });

    it('has practice configs that the app accepts, and that name existing words and tags', () => {
        expect(data.practiceConfigs.length).toBeGreaterThan(0);
        for (const config of data.practiceConfigs) {
            for (const key of config.words ?? []) expect(wordByKey.has(key)).toBe(true);
            for (const key of config.tags ?? []) expect(tagKeys).toContain(key);
            const result = validateConfigRequest({
                name: config.name,
                description: config.description ?? null,
                params: config.params,
                wordIds: config.words ? config.words.map(() => randomUUID()) : null,
                tagIds: config.tags ? config.tags.map(() => randomUUID()) : null,
            });
            expect({ name: config.name, ok: result.ok }).toEqual({ name: config.name, ok: true });
        }
    });

    it('has a practice history only on forms that the exercises practise, once per translation', () => {
        const practised = new Set(
            Object.values(MULTI_LANGUAGE).flatMap((groups) => Object.values(groups).flatMap((slots) => Object.values(slots).flatMap((byLang) => Object.values(byLang)))),
        );
        const seen = new Set();
        for (const entry of data.history) {
            const word = wordByKey.get(entry.word);
            expect(word).toBeDefined();
            expect(word.translations[entry.language]).toBeDefined();
            expect(seen.has(`${entry.word}|${entry.language}`)).toBe(false);
            seen.add(`${entry.word}|${entry.language}`);
            expect(Number.isInteger(entry.daysAgo) && entry.daysAgo >= 0).toBe(true);
            if (entry.modifier !== undefined) expect(['Mastered', 'Revise']).toContain(entry.modifier);
            for (const [caseName, answers] of Object.entries(entry.cases)) {
                expect(word.translations[entry.language][caseName]).toBeDefined();
                expect({ caseName, practised: practised.has(caseName) }).toEqual({ caseName, practised: true });
                expect(answers.length >= 1 && answers.length <= RECORD_LENGTH && answers.every((a) => typeof a === 'boolean')).toBe(true);
            }
        }
    });
});

// ---------------------------------------------------------------------------------------------------

const templateRow = async () => (await db.select().from(users).where(eq(users.username, TEMPLATE_USERNAME)))[0];

describe('seedDemoTemplate', () => {
    it('builds the template: a demo row with no expiry, the words, Private tags, configs and history', async () => {
        const result = await seedDemoTemplate();
        expect(result).toMatchObject({ created: true, words: data.words.length, tags: data.tags.length });

        const template = await templateRow();
        expect(template).toMatchObject({ isDemo: true, demoExpiresAt: null, password: null });
        expect(await db.select().from(words).where(eq(words.userId, template.id))).toHaveLength(data.words.length);
        const templateTags = await db.select().from(tags).where(eq(tags.authorId, template.id));
        expect(templateTags.every((t) => t.visibility === 'Private')).toBe(true);
        expect(await db.select().from(practiceConfigs).where(eq(practiceConfigs.userId, template.id))).toHaveLength(data.practiceConfigs.length);
        expect(await db.select().from(exercisePerformances).where(eq(exercisePerformances.userId, template.id))).toHaveLength(data.history.length);
    });

    it('stores, for every case, the knowledge the engine computes from its answers', async () => {
        const { userId } = await seedDemoTemplate();
        const rows = await db
            .select({ caseName: exercisePerformanceCases.caseName, record: exercisePerformanceCases.record, knowledge: exercisePerformanceCases.knowledge })
            .from(exercisePerformanceCases)
            .innerJoin(exercisePerformances, eq(exercisePerformances.id, exercisePerformanceCases.exercisePerformanceId))
            .where(eq(exercisePerformances.userId, userId));
        expect(rows).toHaveLength(data.history.reduce((n, h) => n + Object.keys(h.cases).length, 0));
        for (const row of rows) {
            const replayed = row.record.reduce((stat, correct) => applyAnswer(stat, row.caseName, correct), undefined);
            expect(row.knowledge).toBeCloseTo(replayed.knowledge, 3);
        }
    });

    it('keeps an existing template when run again, and --reset builds a new one', async () => {
        const first = await seedDemoTemplate();
        const again = await seedDemoTemplate();
        expect(again).toMatchObject({ created: false, userId: first.userId, words: data.words.length });
        expect(await db.select().from(users).where(eq(users.username, TEMPLATE_USERNAME))).toHaveLength(1);

        const rebuilt = await seedDemoTemplate({ reset: true });
        expect(rebuilt.created).toBe(true);
        expect(rebuilt.userId).not.toBe(first.userId);
        expect(await db.select().from(words).where(eq(words.userId, first.userId))).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------------------------------

describe('the copy into a new demo (POST /api/demo)', () => {
    beforeEach(() => pool.query(`UPDATE access_settings SET demo_enabled = true, demo_max_words = 30, demo_max_tags = 5 WHERE id = 1`));

    const start = () => request(app).post('/api/demo').send({});

    it('refuses with 503 demo_unavailable when there is no template, and keeps no account', async () => {
        const res = await start();
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('demo_unavailable');
        expect(await db.select().from(users)).toHaveLength(0);
    });

    it('copies every row with new ids, as the demo\'s own words and Private tags, and leaves the template as it was', async () => {
        const { userId: templateId } = await seedDemoTemplate();
        const res = await start();
        expect(res.status).toBe(201);
        const demoId = res.body.id;
        expect(res.body).toMatchObject({ demoWordLimit: data.words.length + 30, demoTagLimit: data.tags.length + 5 });

        const templateWords = await db.select().from(words).where(eq(words.userId, templateId));
        const demoWords = await db.select().from(words).where(eq(words.userId, demoId));
        expect(demoWords).toHaveLength(templateWords.length);
        const templateWordIds = new Set(templateWords.map((w) => w.id));
        expect(demoWords.some((w) => templateWordIds.has(w.id))).toBe(false);
        expect(demoWords.every((w) => w.isCloned === false && w.sourceWordId === null && w.originalCreatorId === null)).toBe(true);

        const countTranslations = async (ids) => (await db.select().from(translations).where(inArray(translations.wordId, ids))).length;
        expect(await countTranslations(demoWords.map((w) => w.id))).toBe(await countTranslations([...templateWordIds]));
        const demoTranslationIds = (await db.select().from(translations).where(inArray(translations.wordId, demoWords.map((w) => w.id)))).map((t) => t.id);
        expect((await db.select().from(translationCases).where(inArray(translationCases.translationId, demoTranslationIds))).length).toBeGreaterThan(0);

        const demoTags = await db.select().from(tags).where(eq(tags.authorId, demoId));
        expect(demoTags.map((t) => t.label).sort()).toEqual(data.tags.map((t) => t.label).sort());
        expect(demoTags.every((t) => t.visibility === 'Private' && t.sourceTagId === null)).toBe(true);
        const demoLinks = await db.select().from(tagWords).where(inArray(tagWords.tagId, demoTags.map((t) => t.id)));
        expect(demoLinks).toHaveLength(data.words.reduce((n, w) => n + w.tags.length, 0));
        expect(demoLinks.every((l) => demoWords.some((w) => w.id === l.wordId))).toBe(true);

        // The template is untouched.
        expect(await db.select().from(words).where(eq(words.userId, templateId))).toHaveLength(data.words.length);
    });

    it('remaps the word and tag ids inside the saved practice configs', async () => {
        await seedDemoTemplate();
        const demoId = (await start()).body.id;
        const configs = await db.select().from(practiceConfigs).where(eq(practiceConfigs.userId, demoId));
        expect(configs).toHaveLength(data.practiceConfigs.length);

        const demoWordIds = new Set((await db.select().from(words).where(eq(words.userId, demoId))).map((w) => w.id));
        const [verbsTag] = await db.select().from(tags).where(and(eq(tags.authorId, demoId), eq(tags.label, 'Verbs')));
        const verbs = configs.find((c) => c.name === 'Verbs');
        expect(verbs.wordIds).toHaveLength(4);
        expect(verbs.wordIds.every((id) => demoWordIds.has(id))).toBe(true);
        expect(verbs.tagIds).toEqual([verbsTag.id]);
        const mixed = configs.find((c) => c.wordIds === null);
        expect(mixed.tagIds).toBeNull();
    });

    it('copies the practice history onto the demo\'s own words and moves the dates forward, keeping the gaps', async () => {
        // A template seeded 60 days ago would look "forgotten" without the shift.
        await seedDemoTemplate({ now: new Date(Date.now() - 60 * DAY) });
        const before = Date.now();
        const demoId = (await start()).body.id;

        const performances = await db.select().from(exercisePerformances).where(eq(exercisePerformances.userId, demoId));
        expect(performances).toHaveLength(data.history.length);
        const demoWordIds = new Set((await db.select().from(words).where(eq(words.userId, demoId))).map((w) => w.id));
        expect(performances.every((p) => demoWordIds.has(p.wordId))).toBe(true);
        const demoTranslations = await db.select().from(translations).where(inArray(translations.wordId, [...demoWordIds]));
        expect(performances.every((p) => demoTranslations.some((t) => t.id === p.translationId && t.language === p.translationLanguage))).toBe(true);

        // The newest date is one day ago; the oldest keeps its distance from it.
        const dates = performances.map((p) => p.lastDateModifiedTranslation.getTime());
        const newest = Math.max(...dates);
        const oldest = Math.min(...dates);
        expect(Math.abs(newest - (before - DAY))).toBeLessThan(60 * 1000);
        const daysAgo = data.history.map((h) => h.daysAgo);
        expect(Math.round((newest - oldest) / DAY)).toBe(Math.max(...daysAgo) - Math.min(...daysAgo));

        const cases = await db.select().from(exercisePerformanceCases).where(inArray(exercisePerformanceCases.exercisePerformanceId, performances.map((p) => p.id)));
        expect(cases.length).toBe(data.history.reduce((n, h) => n + Object.keys(h.cases).length, 0));
        expect(cases.every((c) => c.lastDate.getTime() <= newest + 1000)).toBe(true);
    });

    it('gives two demos separate copies', async () => {
        await seedDemoTemplate();
        const a = (await start()).body.id;
        const b = (await start()).body.id;
        const wordsOf = async (id) => new Set((await db.select().from(words).where(eq(words.userId, id))).map((w) => w.id));
        const [wa, wb] = [await wordsOf(a), await wordsOf(b)];
        expect(wa.size).toBe(data.words.length);
        expect([...wa].some((id) => wb.has(id))).toBe(false);
    });
});
