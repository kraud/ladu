/**
 * An in-memory fake of the three `exerciseController` endpoints (phase-5-practice.md
 * §B.3) and, since Phase 5.5, of the saved-configuration endpoints
 * (`practiceConfigController`) and of the saved-session endpoints (`practiceSessionController`);
 * both lists are empty unless a test seeds them, for the practice data-layer tests (Slice 4) and the practice screens
 * (Slices 5–8). Each `makePracticeHandlers()` call gets its own isolated state.
 *
 * Deliberately simple where the backend's own integration tests
 * (`backend/tests/exercises.test.js`) already cover the full behaviour:
 *   - `generate` does not rank or build exercises — it hands back the
 *     `exercises` the test seeded (cut to `amount`) and records the body.
 *   - `answers` keeps the real last-4 record and the real knowledge formula
 *     (A.8), so a test can watch a card's indicator move.
 *   - `modifier` answers 404 until an answer created the performance (C7).
 * The bearer token is not verified.
 */
import { http, HttpResponse } from 'msw';
import { createSession } from '@/features/practice/session';
import type { WordSimpleBE } from '@/features/words/types';
import type {
    Exercise,
    GenerateBody,
    Modifier,
    PerformanceSummary,
    SaveAnswerBody,
    SaveConfigBody,
    SavedConfig,
    SavedSessionFull,
    SavedSessionItem,
    SavedSessionSummary,
    SessionSnapshot,
} from '@/features/practice/types';

export interface PracticeFakeOptions {
    exercises?: Exercise[];
    /** Existing performances (by translation id), e.g. to start with a Mastered word. */
    performances?: PerformanceSummary[];
    /** Saved configurations to start with. */
    configs?: SavedConfig[];
    /** The words the user can still see; a saved configuration's words are looked up here. */
    configWords?: WordSimpleBE[];
    /** Saved sessions to start with (newest first). */
    sessions?: SavedSessionFull[];
}

export interface PracticeFakeState {
    generateBodies: GenerateBody[];
    answers: SaveAnswerBody[];
    modifiers: { translationId: string; modifier: Modifier | null }[];
    /** Make the next N `answers` calls fail with a 500 (save-failure tests). */
    failNextAnswers: number;
    /** Make `generate` answer this status once (e.g. 400 with a code). */
    generateFailure: { status: number; body: Record<string, unknown> } | null;
    performances: Map<string, PerformanceSummary>;
    /** Saved configurations, newest first. */
    configs: SavedConfig[];
    /** Bodies of every create / edit call, in order. */
    configBodies: { method: 'POST' | 'PUT'; id?: string; body: SaveConfigBody }[];
    deletedConfigIds: string[];
    /** Make the next `getConfigWords` call fail with a 500. */
    failNextConfigWords: boolean;
    /** Saved sessions, newest first. */
    sessions: SavedSessionFull[];
    /** Every create / update call, in order. */
    sessionBodies: { method: 'POST' | 'PUT'; id?: string; snapshot: SessionSnapshot }[];
    deletedSessionIds: string[];
    /** Make the next N create / update calls fail with a 500. */
    failNextSessionSaves: number;
    /** Make the next `getSession` call fail with a 500. */
    failNextSessionRead: boolean;
}

/** Same rule as the backend (`calculateNewPercentageOfKnowledge`): the window always counts /4. */
function nextKnowledge(previous: number, record: boolean[]): number {
    const window = (record.filter(Boolean).length / 4) * 100;
    return previous > 0 ? (0.5 * previous + 3.5 * window) / 4 : window;
}

export function makePracticeHandlers(options: PracticeFakeOptions = {}) {
    const state: PracticeFakeState = {
        generateBodies: [],
        answers: [],
        modifiers: [],
        failNextAnswers: 0,
        generateFailure: null,
        performances: new Map((options.performances ?? []).map((p) => [p.translationId, p])),
        configs: [...(options.configs ?? [])],
        configBodies: [],
        deletedConfigIds: [],
        failNextConfigWords: false,
        sessions: [...(options.sessions ?? [])],
        sessionBodies: [],
        deletedSessionIds: [],
        failNextSessionSaves: 0,
        failNextSessionRead: false,
    };
    let sessionCounter = 0;
    const notFound = () => HttpResponse.json({ message: 'Not found', code: 'not_found' }, { status: 404 });
    const toItem = ({ snapshot: _snapshot, ...item }: SavedSessionFull): SavedSessionItem => item;
    const visibleWords = options.configWords ?? [];
    let configCounter = 0;
    const nameTaken = (name: string, exceptId?: string) =>
        state.configs.some((c) => c.id !== exceptId && c.name.toLowerCase() === name.trim().toLowerCase());
    const taken = () =>
        HttpResponse.json({ message: 'A configuration with this name already exists.', code: 'name_taken' }, { status: 409 });
    const missingOf = (wordIds: string[] | null) =>
        (wordIds ?? []).filter((id) => !visibleWords.some((w) => w.id === id)).length;

    const handlers = [
        http.post('*/api/exercises/generate', async ({ request }) => {
            const body = (await request.json()) as GenerateBody;
            state.generateBodies.push(body);
            if (state.generateFailure) {
                const { status, body: failure } = state.generateFailure;
                state.generateFailure = null;
                return HttpResponse.json(failure, { status });
            }
            const exercises = (options.exercises ?? []).slice(0, body.amount).map((exercise) => ({
                ...exercise,
                performance: state.performances.get(exercise.translationId) ?? exercise.performance,
            }));
            return HttpResponse.json({ exercises });
        }),

        http.post('*/api/exercises/answers', async ({ request }) => {
            const body = (await request.json()) as SaveAnswerBody;
            if (state.failNextAnswers > 0) {
                state.failNextAnswers -= 1;
                return HttpResponse.json({ message: 'Server error' }, { status: 500 });
            }
            state.answers.push(body);

            const correct = body.result !== 'wrong';
            const performance = state.performances.get(body.translationId) ?? {
                translationId: body.translationId,
                modifier: null,
                reviseCounter: 0,
                cases: [],
            };
            const existing = performance.cases.find((c) => c.caseName === body.caseName);
            const record = [...(existing?.record ?? []), correct].slice(-4);
            const updated = {
                caseName: body.caseName,
                record,
                knowledge: nextKnowledge(existing?.knowledge ?? 0, record),
                lastDate: new Date().toISOString(),
            };

            let { modifier, reviseCounter } = performance;
            if (correct && modifier === 'Revise') {
                reviseCounter += 1;
                if (reviseCounter >= 5) {
                    modifier = null;
                    reviseCounter = 0;
                }
            }
            const next: PerformanceSummary = {
                translationId: body.translationId,
                modifier,
                reviseCounter,
                cases: [...performance.cases.filter((c) => c.caseName !== body.caseName), updated],
            };
            state.performances.set(body.translationId, next);
            return HttpResponse.json(next);
        }),

        http.put('*/api/exercises/performances/:translationId/modifier', async ({ params, request }) => {
            const translationId = String(params.translationId);
            const { modifier } = (await request.json()) as { modifier: Modifier | null };
            state.modifiers.push({ translationId, modifier });

            const performance = state.performances.get(translationId);
            if (!performance) return HttpResponse.json({ message: 'Not found', code: 'not_found' }, { status: 404 });
            const next = { ...performance, modifier, reviseCounter: 0 };
            state.performances.set(translationId, next);
            return HttpResponse.json(next);
        }),

        http.get('*/api/practice/configs', () => HttpResponse.json(state.configs)),

        http.post('*/api/practice/configs', async ({ request }) => {
            const body = (await request.json()) as SaveConfigBody;
            state.configBodies.push({ method: 'POST', body });
            if (nameTaken(body.name)) return taken();
            const now = new Date().toISOString();
            const config: SavedConfig = {
                id: `cfg-${++configCounter}`,
                name: body.name,
                description: body.description,
                params: body.params,
                wordIds: body.wordIds,
                missingCount: missingOf(body.wordIds),
                createdAt: now,
                updatedAt: now,
            };
            state.configs = [config, ...state.configs];
            return HttpResponse.json(config, { status: 201 });
        }),

        http.get('*/api/practice/configs/:id/words', ({ params }) => {
            if (state.failNextConfigWords) {
                state.failNextConfigWords = false;
                return HttpResponse.json({ message: 'Server error' }, { status: 500 });
            }
            const config = state.configs.find((c) => c.id === params.id);
            if (!config) return HttpResponse.json({ message: 'Not found', code: 'not_found' }, { status: 404 });
            const rows = (config.wordIds ?? []).flatMap((id) => visibleWords.find((w) => w.id === id) ?? []);
            return HttpResponse.json(rows);
        }),

        http.put('*/api/practice/configs/:id', async ({ params, request }) => {
            const body = (await request.json()) as SaveConfigBody;
            const id = String(params.id);
            state.configBodies.push({ method: 'PUT', id, body });
            const index = state.configs.findIndex((c) => c.id === id);
            if (index < 0) return HttpResponse.json({ message: 'Not found', code: 'not_found' }, { status: 404 });
            if (nameTaken(body.name, id)) return taken();
            const next: SavedConfig = {
                ...state.configs[index],
                ...body,
                missingCount: missingOf(body.wordIds),
                updatedAt: new Date().toISOString(),
            };
            state.configs = state.configs.map((c, i) => (i === index ? next : c));
            return HttpResponse.json(next);
        }),

        http.delete('*/api/practice/configs/:id', ({ params }) => {
            const id = String(params.id);
            if (!state.configs.some((c) => c.id === id)) {
                return HttpResponse.json({ message: 'Not found', code: 'not_found' }, { status: 404 });
            }
            state.deletedConfigIds.push(id);
            state.configs = state.configs.filter((c) => c.id !== id);
            return new HttpResponse(null, { status: 204 });
        }),

        http.get('*/api/practice/sessions', () => HttpResponse.json(state.sessions.map(toItem))),

        http.post('*/api/practice/sessions', async ({ request }) => {
            const { snapshot } = (await request.json()) as { snapshot: SessionSnapshot };
            if (state.failNextSessionSaves > 0) {
                state.failNextSessionSaves -= 1;
                return HttpResponse.json({ message: 'Server error' }, { status: 500 });
            }
            state.sessionBodies.push({ method: 'POST', snapshot });
            const now = new Date().toISOString();
            const saved: SavedSessionFull = {
                id: `ses-${++sessionCounter}`,
                summary: summarize(snapshot),
                createdAt: now,
                updatedAt: now,
                expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
                snapshot,
            };
            // The server keeps at most 10: the oldest goes.
            state.sessions = [saved, ...state.sessions].slice(0, 10);
            return HttpResponse.json(saved, { status: 201 });
        }),

        http.get('*/api/practice/sessions/:id', ({ params }) => {
            if (state.failNextSessionRead) {
                state.failNextSessionRead = false;
                return HttpResponse.json({ message: 'Server error' }, { status: 500 });
            }
            const found = state.sessions.find((s) => s.id === params.id);
            return found ? HttpResponse.json(found) : notFound();
        }),

        http.put('*/api/practice/sessions/:id', async ({ params, request }) => {
            const { snapshot } = (await request.json()) as { snapshot: SessionSnapshot };
            if (state.failNextSessionSaves > 0) {
                state.failNextSessionSaves -= 1;
                return HttpResponse.json({ message: 'Server error' }, { status: 500 });
            }
            const id = String(params.id);
            state.sessionBodies.push({ method: 'PUT', id, snapshot });
            const index = state.sessions.findIndex((s) => s.id === id);
            if (index < 0) return notFound();
            const next: SavedSessionFull = {
                ...state.sessions[index],
                snapshot,
                summary: summarize(snapshot),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
            };
            state.sessions = [next, ...state.sessions.filter((_, i) => i !== index)];
            return HttpResponse.json(next);
        }),

        http.delete('*/api/practice/sessions/:id', ({ params }) => {
            const id = String(params.id);
            if (!state.sessions.some((s) => s.id === id)) return notFound();
            state.deletedSessionIds.push(id);
            state.sessions = state.sessions.filter((s) => s.id !== id);
            return new HttpResponse(null, { status: 204 });
        }),
    ];

    return { handlers, state };
}

/** A minimal valid exercise for tests. Override any field. */
export function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
    return {
        key: 'w1:English.singularEN>Spanish.singularES:0',
        type: 'Text-Input',
        multiLang: true,
        partOfSpeech: 'Noun' as Exercise['partOfSpeech'],
        wordId: 'word-1',
        translationId: 'tr-es-1',
        prompt: { language: 'English' as Exercise['prompt']['language'], caseName: 'singularEN', value: 'house' },
        answer: { language: 'Spanish' as Exercise['answer']['language'], caseName: 'singularES', value: 'casa' },
        performance: null,
        ...overrides,
    };
}

/** A saved configuration for tests. Override any field. */
export function makeConfig(overrides: Partial<SavedConfig> = {}): SavedConfig {
    return {
        id: 'cfg-seed',
        name: 'Morning drill',
        description: null,
        params: {
            languages: ['English', 'Spanish'] as SavedConfig['params']['languages'],
            partsOfSpeech: ['Noun', 'Verb'] as SavedConfig['params']['partsOfSpeech'],
            amount: 12,
            type: 'Multiple-Choice',
            multiLang: 'Multi-Language',
            difficultyMC: 2,
            strictnessTI: 3,
            wordSelection: 'Random',
            excludeNative: false,
        },
        wordIds: null,
        missingCount: 0,
        createdAt: '2026-09-30T08:00:00.000Z',
        updatedAt: '2026-09-30T08:00:00.000Z',
        ...overrides,
    };
}

/** A Review-shaped word row (what `GET /practice/configs/:id/words` returns) for tests. */
export function makeConfigWord(id: string, label: string, overrides: Partial<WordSimpleBE> = {}): WordSimpleBE {
    return {
        id,
        user: 'u1',
        partOfSpeech: 'Noun' as WordSimpleBE['partOfSpeech'],
        tags: [],
        createdAt: '2026-09-30T08:00:00.000Z',
        updatedAt: '2026-09-30T08:00:00.000Z',
        storedLanguages: ['English', 'Spanish'],
        dataEN: label,
        ...overrides,
    };
}

/** The summary the server builds from a snapshot (same rules as `summarizeSnapshot` in the backend). */
function summarize(snapshot: SessionSnapshot): SavedSessionSummary {
    const given = snapshot.answers.filter((a) => a !== null);
    const used = new Set(snapshot.exercises.flatMap((e) => [e.prompt.language, e.answer.language]));
    return {
        answered: given.length,
        correct: given.filter((a) => a.result !== 'wrong').length,
        total: snapshot.exercises.length,
        languages: [...used],
        partsOfSpeech: [...new Set(snapshot.exercises.map((e) => e.partOfSpeech))],
        cardTypes: [...new Set(snapshot.exercises.map((e) => e.type))],
    };
}

/**
 * A saved session for tests: two typed exercises, none answered unless `answers` says so.
 * Override any field of the row, or pass a `snapshot` to change what resuming opens.
 */
export function makeSavedSession(overrides: Partial<SavedSessionFull> = {}): SavedSessionFull {
    const { savedId: _savedId, ...snapshot } = createSession({
        userId: 'u1',
        params: makeConfig().params,
        wordIds: null,
        exercises: [makeExercise({ key: 'a' }), makeExercise({ key: 'b', translationId: 'tr-2' })],
    });
    return {
        id: 'ses-seed',
        summary: summarize(snapshot),
        createdAt: '2026-09-30T08:00:00.000Z',
        updatedAt: '2026-09-30T08:00:00.000Z',
        expiresAt: '2026-10-07T08:00:00.000Z',
        snapshot,
        ...overrides,
    };
}
