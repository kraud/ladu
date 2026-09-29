/**
 * Benchmark for POST /api/exercises/generate (phase-5-practice.md, Slice 3).
 * Not a test. It seeds ~5,000 words for one throw-away user, times the service
 * for several parameter sets, then deletes the user (the FK cascade removes the rest).
 *
 * It always runs against the TEST database (NODE_ENV=test is forced below), so it can
 * never touch development data.
 *
 *   cd backend && npx tsx scripts/bench-exercises.ts [wordCount]
 */

process.env.NODE_ENV = 'test';

const { eq } = require('drizzle-orm');
const { db, pool }: typeof import('../src/db') = require('../src/db');
const {
    exercisePerformanceCases,
    exercisePerformances,
    translationCases,
    translations,
    users,
    words,
}: typeof import('../src/db/schema') = require('../src/db/schema');
const { generateExercises }: typeof import('../services/exerciseService') = require('../services/exerciseService');

const WORD_COUNT = Number(process.argv[2]) || 5000;
const PRACTISED_SHARE = 0.6;
const CHUNK = 1000;
const LANGUAGES = ['English', 'Spanish', 'German', 'Estonian'];

const chunks = <T>(rows: T[]): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK));
    return out;
};

async function seed(userId: string) {
    const wordRows = await db
        .insert(words)
        .values(Array.from({ length: WORD_COUNT }, () => ({ userId, partOfSpeech: 'Noun' })))
        .returning({ id: words.id });

    const translationValues = wordRows.flatMap((w) => LANGUAGES.map((language) => ({ wordId: w.id, language })));
    const translationRows: { id: string; wordId: string; language: string }[] = [];
    for (const part of chunks(translationValues)) {
        translationRows.push(...(await db.insert(translations).values(part).returning({
            id: translations.id, wordId: translations.wordId, language: translations.language,
        })));
    }

    const caseNames: Record<string, string[]> = {
        English: ['singularEN', 'pluralEN'],
        Spanish: ['singularES', 'pluralES', 'genderES'],
        German: ['singularNominativDE', 'pluralNominativDE', 'singularGenitivDE', 'genderDE'],
        Estonian: ['singularNimetavEE', 'pluralNimetavEE', 'shortFormEE'],
    };
    const caseValues = translationRows.flatMap((t) =>
        caseNames[t.language].map((caseName, i) => ({
            translationId: t.id,
            caseName,
            word: caseName.startsWith('gender') ? 'la' : `${t.id.slice(0, 6)}-${i}`,
        })),
    );
    for (const part of chunks(caseValues)) await db.insert(translationCases).values(part);

    // Practice history for a share of the words: every translation, every case with a random score.
    const practised = new Set(wordRows.slice(0, Math.floor(WORD_COUNT * PRACTISED_SHARE)).map((w) => w.id));
    const perfValues = translationRows
        .filter((t) => practised.has(t.wordId))
        .map((t) => ({
            userId,
            wordId: t.wordId,
            translationId: t.id,
            translationLanguage: t.language,
            reviseCounter: 0,
            averageTranslationKnowledge: Math.random() * 100,
            lastDateModifiedTranslation: new Date(Date.now() - Math.random() * 90 * 86_400_000),
        }));
    const perfRows: { id: string; translationId: string }[] = [];
    for (const part of chunks(perfValues)) {
        perfRows.push(...(await db.insert(exercisePerformances).values(part).returning({
            id: exercisePerformances.id, translationId: exercisePerformances.translationId,
        })));
    }
    const languageByTranslation = new Map(translationRows.map((t) => [t.id, t.language]));
    const perfCases = perfRows.flatMap((p) =>
        caseNames[languageByTranslation.get(p.translationId) as string].map((caseName) => ({
            exercisePerformanceId: p.id,
            caseName,
            record: [true, false, true],
            knowledge: Math.random() * 100,
            lastDate: new Date(Date.now() - Math.random() * 90 * 86_400_000),
        })),
    );
    for (const part of chunks(perfCases)) await db.insert(exercisePerformanceCases).values(part);
}

async function time(label: string, run: () => Promise<unknown[]>, repeats = 5) {
    const samples: number[] = [];
    let count = 0;
    for (let i = 0; i < repeats; i++) {
        const start = process.hrtime.bigint();
        count = (await run()).length;
        samples.push(Number(process.hrtime.bigint() - start) / 1e6);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];
    console.log(`${label.padEnd(58)} median ${median.toFixed(0).padStart(5)} ms  max ${samples[samples.length - 1].toFixed(0).padStart(5)} ms  (${count} exercises)`);
}

async function main() {
    const [user] = await db
        .insert(users)
        .values({
            name: 'Bench', email: `bench-${Date.now()}@example.test`, username: `bench${Date.now()}`,
            languages: LANGUAGES, nativeLanguage: 'Spanish',
        })
        .returning();
    try {
        console.log(`Seeding ${WORD_COUNT} words (${Math.round(PRACTISED_SHARE * 100)} % practised)…`);
        await seed(user.id);

        const viewer = { id: user.id, languages: LANGUAGES, nativeLanguage: 'Spanish' };
        const base = {
            languages: LANGUAGES, partsOfSpeech: ['Noun'], amount: 10, type: 'Text-Input' as const,
            multiLang: 'Multi-Language' as const, difficultyMC: 1, wordSelection: 'Exercise-Performance' as const,
            excludeNative: false,
        };
        await time('warm-up', () => generateExercises(viewer, base), 1);
        await time('Text-Input, multi-language, weakest first, 10', () => generateExercises(viewer, base));
        await time('Text-Input, multi-language, weakest first, 100', () => generateExercises(viewer, { ...base, amount: 100 }));
        await time('Multiple-Choice L1, multi-language, 10', () =>
            generateExercises(viewer, { ...base, type: 'Multiple-Choice' }));
        await time('Random card type, random mode (Random words), 10', () =>
            generateExercises(viewer, { ...base, type: 'Random', multiLang: 'Random', wordSelection: 'Random' }));
        await time('Single-language, multiple-choice, exclude native, 10', () =>
            generateExercises(viewer, { ...base, type: 'Multiple-Choice', multiLang: 'Single-Language', excludeNative: true }));
    } finally {
        await db.delete(users).where(eq(users.id, user.id));
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
