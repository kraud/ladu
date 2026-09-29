/**
 * An in-memory fake of the three `exerciseController` endpoints (phase-5-practice.md
 * §B.3), for the practice data-layer tests (Slice 4) and the practice screens
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
import type {
    Exercise,
    GenerateBody,
    Modifier,
    PerformanceSummary,
    SaveAnswerBody,
} from '@/features/practice/types';

export interface PracticeFakeOptions {
    exercises?: Exercise[];
    /** Existing performances (by translation id), e.g. to start with a Mastered word. */
    performances?: PerformanceSummary[];
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
    };

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
