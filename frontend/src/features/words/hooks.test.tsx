import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/app/query-client';
import { getApiErrorMessage } from '@/api/types';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { server } from '@/test/msw/server';
import { makeWordHandlers, type SeedWord } from '@/test/msw/wordHandlers';
import { useCreateWord, useDeleteWord, useUpdateWord, useWord } from './hooks';
import { wordKeys } from './keys';
import type { CreateWordBody } from './types';

const ME = 'user-me';
const OTHER = 'user-other';

function setup(seed: SeedWord[] = []) {
    const fake = makeWordHandlers({ callerId: ME, seed });
    server.use(...fake.handlers);

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    return { fake, queryClient, invalidateSpy, wrapper };
}

const nounBody: CreateWordBody = {
    partOfSpeech: PartOfSpeech.noun,
    clue: 'a place to live',
    translations: [
        { language: Lang.EN, cases: [{ caseName: 'singularEN', word: 'house' }] },
        { language: Lang.ES, cases: [{ caseName: 'singularES', word: 'casa' }] },
    ],
};

const seededNoun: SeedWord = {
    id: 'word-seed',
    user: ME,
    partOfSpeech: PartOfSpeech.noun,
    translations: [
        { id: 'trans-en', language: Lang.EN, cases: [{ caseName: 'singularEN', word: 'house' }] },
        { id: 'trans-es', language: Lang.ES, cases: [{ caseName: 'singularES', word: 'casa' }] },
    ],
};

describe('useWord', () => {
    it('returns a word the caller owns', async () => {
        const { wrapper } = setup([seededNoun]);
        const { result } = renderHook(() => useWord('word-seed'), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.id).toBe('word-seed');
        expect(result.current.data?.translations).toHaveLength(2);
        expect(result.current.data).not.toHaveProperty('_id');
    });

    it("surfaces a 403 for another user's word", async () => {
        const { wrapper } = setup([{ ...seededNoun, id: 'word-other', user: OTHER }]);
        const { result } = renderHook(() => useWord('word-other'), { wrapper });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(getApiErrorMessage(result.current.error)).toBe('User not authorized');
    });

    it('stays idle for an empty id', () => {
        const { wrapper } = setup();
        const { result } = renderHook(() => useWord(''), { wrapper });

        expect(result.current.fetchStatus).toBe('idle');
        expect(result.current.data).toBeUndefined();
    });
});

describe('useCreateWord', () => {
    it('sends the nested translation payload and invalidates words + metrics', async () => {
        const { fake, wrapper, invalidateSpy } = setup();
        const { result } = renderHook(() => useCreateWord(), { wrapper });

        result.current.mutate(nounBody);
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.user).toBe(ME);
        expect(fake.requests).toHaveLength(1);
        expect(fake.requests[0]).toEqual({
            method: 'POST',
            body: {
                partOfSpeech: 'Noun',
                clue: 'a place to live',
                translations: [
                    { language: 'English', cases: [{ caseName: 'singularEN', word: 'house' }] },
                    { language: 'Spanish', cases: [{ caseName: 'singularES', word: 'casa' }] },
                ],
            },
        });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wordKeys.all });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['metrics'] });
    });

    it('surfaces the < 2 translations error from the backend', async () => {
        const { wrapper } = setup();
        const { result } = renderHook(() => useCreateWord(), { wrapper });

        result.current.mutate({
            partOfSpeech: PartOfSpeech.noun,
            translations: [{ language: Lang.EN, cases: [{ caseName: 'singularEN', word: 'house' }] }],
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(getApiErrorMessage(result.current.error)).toBe('Please add 2 or more translations');
    });
});

describe('useUpdateWord', () => {
    it('writes the fresh word into the detail cache and invalidates', async () => {
        const { queryClient, wrapper, invalidateSpy } = setup([seededNoun]);
        const { result } = renderHook(() => useUpdateWord(), { wrapper });

        result.current.mutate({
            id: 'word-seed',
            partOfSpeech: PartOfSpeech.noun,
            translations: [
                { language: Lang.EN, cases: [{ caseName: 'singularEN', word: 'home' }] },
                { language: Lang.ES, cases: [{ caseName: 'singularES', word: 'casa' }] },
            ],
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        const cached = queryClient.getQueryData(wordKeys.detail('word-seed'));
        expect(cached).toEqual(result.current.data);
        expect(result.current.data?.translations[0].cases[0].word).toBe('home');
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wordKeys.all });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['metrics'] });
    });
});

describe('useDeleteWord', () => {
    it('drops the detail cache entry and invalidates', async () => {
        const { queryClient, wrapper, invalidateSpy } = setup([seededNoun]);
        queryClient.setQueryData(wordKeys.detail('word-seed'), { id: 'word-seed' });

        const { result } = renderHook(() => useDeleteWord(), { wrapper });
        result.current.mutate('word-seed');

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual({ id: 'word-seed' });
        expect(queryClient.getQueryData(wordKeys.detail('word-seed'))).toBeUndefined();
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wordKeys.all });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['metrics'] });
    });
});
