import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/app/query-client';
import { server } from '@/test/msw/server';
import { makeExercise, makePracticeHandlers } from '@/test/msw/practiceHandlers';
import { getApiErrorCode, practiceErrorKey } from './errors';
import { useGenerateExercises, useSaveAnswer, useSetModifier } from './hooks';
import { defaultParams, toGenerateBody } from './params';

function setup(options: Parameters<typeof makePracticeHandlers>[0] = {}) {
    const fake = makePracticeHandlers(options);
    server.use(...fake.handlers);

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const setDataSpy = vi.spyOn(queryClient, 'setQueryData');
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    return { fake, invalidateSpy, setDataSpy, wrapper };
}

const body = toGenerateBody({ ...defaultParams(['English', 'Spanish']), amount: 2 });

describe('useGenerateExercises', () => {
    it('posts the parameters and returns the exercises', async () => {
        const { fake, wrapper } = setup({
            exercises: [makeExercise({ key: 'a' }), makeExercise({ key: 'b' }), makeExercise({ key: 'c' })],
        });
        const { result } = renderHook(() => useGenerateExercises(), { wrapper });

        await act(() => result.current.mutateAsync(body));
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(fake.state.generateBodies).toEqual([body]);
        expect(result.current.data?.exercises.map((e) => e.key)).toEqual(['a', 'b']);
        expect(JSON.stringify(result.current.data)).not.toContain('"_id"');
    });

    it('sends wordIds for a pre-selection and never the typing strictness', async () => {
        const { fake, wrapper } = setup({ exercises: [makeExercise()] });
        const { result } = renderHook(() => useGenerateExercises(), { wrapper });

        await act(() =>
            result.current.mutateAsync(toGenerateBody({ ...defaultParams(['English', 'Spanish']), strictnessTI: 3 }, ['w1', 'w2'])),
        );

        expect(fake.state.generateBodies[0].wordIds).toEqual(['w1', 'w2']);
        expect(fake.state.generateBodies[0]).not.toHaveProperty('strictnessTI');
    });

    it('surfaces a 400 with its stable code', async () => {
        const { fake, wrapper } = setup();
        fake.state.generateFailure = { status: 400, body: { message: 'Bad amount', code: 'invalid_amount' } };
        const { result } = renderHook(() => useGenerateExercises(), { wrapper });

        await act(async () => {
            await result.current.mutateAsync(body).catch(() => undefined);
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(getApiErrorCode(result.current.error)).toBe('invalid_amount');
        expect(practiceErrorKey(result.current.error)).toBe('practice:apiErrors.invalidAmount');
    });

    it('an empty result is a success, not an error', async () => {
        const { wrapper } = setup({ exercises: [] });
        const { result } = renderHook(() => useGenerateExercises(), { wrapper });
        await act(() => result.current.mutateAsync(body));
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual({ exercises: [] });
    });
});

describe('useSaveAnswer', () => {
    const answer = { translationId: 'tr-1', caseName: 'singularES', result: 'correct' as const };

    it('saves an answer and returns the fresh performance (25 %, then 46.9 %)', async () => {
        const { fake, wrapper } = setup();
        const { result } = renderHook(() => useSaveAnswer(), { wrapper });

        await act(() => result.current.mutateAsync(answer));
        await waitFor(() => expect(result.current.data?.cases[0].record).toEqual([true]));
        expect(result.current.data?.cases[0]).toMatchObject({ caseName: 'singularES', record: [true], knowledge: 25 });

        await act(() => result.current.mutateAsync(answer));
        await waitFor(() => expect(result.current.data?.cases[0].record).toEqual([true, true]));
        expect(result.current.data?.cases[0].knowledge).toBeCloseTo(46.875, 3);
        expect(fake.state.answers).toHaveLength(2);
    });

    it('sends only translationId, caseName and result', async () => {
        const { fake, wrapper } = setup();
        const { result } = renderHook(() => useSaveAnswer(), { wrapper });
        await act(() => result.current.mutateAsync({ ...answer, result: 'partial' }));
        expect(fake.state.answers[0]).toEqual({ ...answer, result: 'partial' });
    });

    it('reports a failed save so the session can mark it unsaved', async () => {
        const { fake, wrapper } = setup();
        fake.state.failNextAnswers = 1;
        const { result } = renderHook(() => useSaveAnswer(), { wrapper });

        await act(async () => {
            await result.current.mutateAsync(answer).catch(() => undefined);
        });
        await waitFor(() => expect(result.current.isError).toBe(true));

        // The retry succeeds.
        await act(() => result.current.mutateAsync(answer));
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe('useSetModifier', () => {
    it('is a 404 until an answer created the performance', async () => {
        const { wrapper } = setup();
        const { result } = renderHook(() => useSetModifier(), { wrapper });

        await act(async () => {
            await result.current.mutateAsync({ translationId: 'tr-1', modifier: 'Mastered' }).catch(() => undefined);
        });
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(getApiErrorCode(result.current.error)).toBe('not_found');
    });

    it('sets, switches and clears the modifier', async () => {
        const { fake, wrapper } = setup();
        const save = renderHook(() => useSaveAnswer(), { wrapper });
        await act(() => save.result.current.mutateAsync({ translationId: 'tr-1', caseName: 'singularES', result: 'correct' }));

        const { result } = renderHook(() => useSetModifier(), { wrapper });
        await act(() => result.current.mutateAsync({ translationId: 'tr-1', modifier: 'Mastered' }));
        await waitFor(() => expect(result.current.data).toMatchObject({ modifier: 'Mastered', reviseCounter: 0 }));
        await act(() => result.current.mutateAsync({ translationId: 'tr-1', modifier: 'Revise' }));
        await waitFor(() => expect(result.current.data?.modifier).toBe('Revise'));
        await act(() => result.current.mutateAsync({ translationId: 'tr-1', modifier: null }));
        await waitFor(() => expect(result.current.data?.modifier).toBeNull());
        expect(fake.state.modifiers.map((m) => m.modifier)).toEqual(['Mastered', 'Revise', null]);
    });
});

describe('invalidation graph (Phase 5: practice has no query edges)', () => {
    it('no practice mutation touches the query cache', async () => {
        const { invalidateSpy, setDataSpy, wrapper } = setup({ exercises: [makeExercise()] });
        const generate = renderHook(() => useGenerateExercises(), { wrapper });
        const save = renderHook(() => useSaveAnswer(), { wrapper });
        const modifier = renderHook(() => useSetModifier(), { wrapper });

        await act(() => generate.result.current.mutateAsync(body));
        await act(() => save.result.current.mutateAsync({ translationId: 'tr-1', caseName: 'singularES', result: 'correct' }));
        await act(() => modifier.result.current.mutateAsync({ translationId: 'tr-1', modifier: 'Revise' }));

        expect(invalidateSpy).not.toHaveBeenCalled();
        expect(setDataSpy).not.toHaveBeenCalled();
    });
});
