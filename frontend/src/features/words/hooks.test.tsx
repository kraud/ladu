import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/app/query-client';
import { getApiErrorMessage } from '@/api/types';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { server } from '@/test/msw/server';
import { makeWordHandlers, type SeedWord } from '@/test/msw/wordHandlers';
import {
    normalizeWordFilters,
    useBulkDeleteWords,
    useCreateWord,
    useDeleteWord,
    useUpdateWord,
    useWord,
    useWordsInfinite,
} from './hooks';
import { wordKeys } from './keys';
import { metricsKeys } from '@/features/metrics/keys';
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
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: metricsKeys.all });
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
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: metricsKeys.all });
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
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: metricsKeys.all });
    });
});

function verbSeed(label: string, id = `word-${label}`): SeedWord {
    return {
        id,
        user: ME,
        partOfSpeech: PartOfSpeech.verb,
        translations: [{ language: Lang.EN, cases: [{ caseName: 'simplePresent1sEN', word: label }] }],
    };
}

function nounSeed(label: string, id = `word-${label}`): SeedWord {
    return {
        id,
        user: ME,
        partOfSpeech: PartOfSpeech.noun,
        translations: [{ language: Lang.EN, cases: [{ caseName: 'singularEN', word: label }] }],
    };
}

describe('normalizeWordFilters', () => {
    it('sorts arrays so equivalent filter sets hash to the same query key', () => {
        expect(normalizeWordFilters({ pos: [PartOfSpeech.verb, PartOfSpeech.noun] })).toEqual(
            normalizeWordFilters({ pos: [PartOfSpeech.noun, PartOfSpeech.verb] }),
        );
    });

    it('treats a blank or whitespace-only q the same as no q at all', () => {
        expect(normalizeWordFilters({ q: '   ' })).toEqual(normalizeWordFilters({}));
        expect(normalizeWordFilters({ q: '' }).q).toBeUndefined();
    });

    it('collapses an empty array to undefined so the key stays clean', () => {
        expect(normalizeWordFilters({ pos: [] })).toEqual({});
    });

    it('trims a real query and leaves arrays alone', () => {
        expect(normalizeWordFilters({ q: '  cat  ', gender: ['der'] })).toEqual({
            q: 'cat',
            gender: ['der'],
        });
    });
});

describe('useWordsInfinite', () => {
    it('fetches the first page and reports no next page when everything fits in one', async () => {
        const { wrapper } = setup([verbSeed('a'), verbSeed('b'), verbSeed('c')]);
        const { result } = renderHook(() => useWordsInfinite(), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.pages[0].items).toHaveLength(3);
        expect(result.current.data?.pages[0].total).toBe(3);
        expect(result.current.hasNextPage).toBe(false);
    });

    it('sends pos as repeatable query keys, not axios\'s default pos[] form', async () => {
        const { fake, wrapper } = setup([nounSeed('a'), verbSeed('b')]);
        const { result } = renderHook(
            () => useWordsInfinite({ pos: [PartOfSpeech.noun, PartOfSpeech.verb] }),
            { wrapper },
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(fake.simpleQueries[0]).toContain('pos=Noun');
        expect(fake.simpleQueries[0]).toContain('pos=Verb');
        expect(fake.simpleQueries[0]).not.toContain('%5B%5D'); // the encoded `[]` axios would emit
    });

    it('pages via nextCursor once more words exist than fit on one page', async () => {
        const words = Array.from({ length: 51 }, (_, i) => verbSeed(String(i)));
        const { wrapper } = setup(words);
        const { result } = renderHook(() => useWordsInfinite(), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.pages[0].items).toHaveLength(50);
        expect(result.current.hasNextPage).toBe(true);

        void result.current.fetchNextPage();
        await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

        expect(result.current.data?.pages[1].items).toHaveLength(1);
        expect(result.current.hasNextPage).toBe(false);
        const allIds = new Set(result.current.data?.pages.flatMap((p) => p.items.map((w) => w.id)));
        expect(allIds.size).toBe(51);
    });
});

describe('useBulkDeleteWords', () => {
    it('removes each detail cache entry and invalidates words + metrics', async () => {
        const { queryClient, wrapper, invalidateSpy } = setup([verbSeed('a'), verbSeed('b')]);
        queryClient.setQueryData(wordKeys.detail('word-a'), { id: 'word-a' });
        queryClient.setQueryData(wordKeys.detail('word-b'), { id: 'word-b' });

        const { result } = renderHook(() => useBulkDeleteWords(), { wrapper });
        result.current.mutate(['word-a', 'word-b']);

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual({ deletedCount: 2 });
        expect(queryClient.getQueryData(wordKeys.detail('word-a'))).toBeUndefined();
        expect(queryClient.getQueryData(wordKeys.detail('word-b'))).toBeUndefined();
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wordKeys.all });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: metricsKeys.all });
    });

    it('surfaces "No word IDs provided" for an empty selection', async () => {
        const { wrapper } = setup();
        const { result } = renderHook(() => useBulkDeleteWords(), { wrapper });

        result.current.mutate([]);
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(getApiErrorMessage(result.current.error)).toBe('No word IDs provided');
    });

    it('surfaces "Some words are missing" for an unknown id', async () => {
        const { wrapper } = setup([verbSeed('a')]);
        const { result } = renderHook(() => useBulkDeleteWords(), { wrapper });

        result.current.mutate(['word-a', 'does-not-exist']);
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(getApiErrorMessage(result.current.error)).toBe('Some words are missing');
    });

    it('surfaces the not-authorized message when a selected word is not the caller\'s', async () => {
        const { wrapper } = setup([{ ...verbSeed('a'), user: OTHER }]);
        const { result } = renderHook(() => useBulkDeleteWords(), { wrapper });

        result.current.mutate(['word-a']);
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(getApiErrorMessage(result.current.error)).toBe(
            'User not authorized to delete at least one of the words',
        );
    });
});
