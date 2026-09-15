import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '@/app/query-client';
import { server } from '@/test/msw/server';
import { makeMetricsHandlers } from '@/test/msw/metricsHandlers';
import { useUserMetrics } from './hooks';
import { metricsKeys } from './keys';
import type { BasicUserMetricsBE } from './types';
import { PartOfSpeech } from '@/ts/enums';

function setup() {
    const queryClient = createQueryClient();

    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    return { queryClient, wrapper };
}

const populated: BasicUserMetricsBE = {
    totalWords: 4,
    incompleteWordsCount: 1,
    translationsPerLanguage: [{ language: 'English', count: 4, type: 'language' }],
    translationsPerLanguageAndPOS: [
        { label: 'English', type: 'language', partOfSpeech: PartOfSpeech.noun, count: 4 },
    ],
    wordsPerPOS: [{ partOfSpeech: PartOfSpeech.noun, type: 'partOfSpeech', count: 4 }],
    wordsPerMonth: [{ label: '2026-09', partOfSpeech: PartOfSpeech.noun, count: 4 }],
};

describe('useUserMetrics', () => {
    it('fetches and returns the metrics response under the metricsKeys.all key', async () => {
        const fake = makeMetricsHandlers(populated);
        server.use(...fake.handlers);
        const { queryClient, wrapper } = setup();

        const { result } = renderHook(() => useUserMetrics(), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual(populated);
        expect(queryClient.getQueryData(metricsKeys.all)).toEqual(populated);
        expect(fake.state.calls).toBe(1);
    });

    it('returns the all-zero shape for a fresh account', async () => {
        const fake = makeMetricsHandlers();
        server.use(...fake.handlers);
        const { wrapper } = setup();

        const { result } = renderHook(() => useUserMetrics(), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.totalWords).toBe(0);
        expect(result.current.data?.wordsPerPOS).toEqual([]);
    });

    it('does not refetch on remount within the 5-minute staleTime', async () => {
        const fake = makeMetricsHandlers(populated);
        server.use(...fake.handlers);
        const { queryClient, wrapper } = setup();

        const first = renderHook(() => useUserMetrics(), { wrapper });
        await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
        first.unmount();

        function wrapper2({ children }: { children: ReactNode }) {
            return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
        }
        const second = renderHook(() => useUserMetrics(), { wrapper: wrapper2 });
        await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

        expect(fake.state.calls).toBe(1);
    });
});
