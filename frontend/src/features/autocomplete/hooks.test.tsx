import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '@/app/query-client';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { server } from '@/test/msw/server';
import { makeAutocompleteHandlers } from '@/test/msw/autocompleteHandlers';
import { useAutocompleteTranslation } from './hooks';

function setup(responses: Parameters<typeof makeAutocompleteHandlers>[0] = {}) {
    const fake = makeAutocompleteHandlers(responses);
    server.use(...fake.handlers);

    const queryClient = createQueryClient();
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    return { fake, wrapper };
}

describe('useAutocompleteTranslation', () => {
    it('is disabled — never fetches — for a (language, PoS) pair with no registry entry', async () => {
        const { fake, wrapper } = setup();
        const { result } = renderHook(
            () => useAutocompleteTranslation({ language: Lang.EN, pos: PartOfSpeech.adjective, query: 'big' }),
            { wrapper }
        );

        expect(result.current.fetchStatus).toBe('idle');
        expect(fake.requests).toHaveLength(0);
    });

    it('is disabled for a blank query even with a valid registry entry', () => {
        const { fake, wrapper } = setup();
        const { result } = renderHook(
            () => useAutocompleteTranslation({ language: Lang.EN, pos: PartOfSpeech.verb, query: '   ' }),
            { wrapper }
        );

        expect(result.current.fetchStatus).toBe('idle');
        expect(fake.requests).toHaveLength(0);
    });

    it('fetches and normalizes a found English verb', async () => {
        const { wrapper } = setup({
            englishVerb: {
                status: 'found',
                cases: [{ caseName: 'simplePresent1sEN', word: 'run' }],
            },
        });
        const { result } = renderHook(
            () => useAutocompleteTranslation({ language: Lang.EN, pos: PartOfSpeech.verb, query: 'run' }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.status).toBe('found');
        expect(result.current.data?.cases.get('simplePresent1sEN' as never)).toBe('run');
    });

    it('calls the one dictionary route with the app values and passes searchInEnglish on', async () => {
        const { fake, wrapper } = setup({
            estonianVerb: { status: 'found', cases: [{ caseName: 'infinitiveMaEE', word: 'jooksma' }] },
        });
        const { result } = renderHook(
            () => useAutocompleteTranslation({ language: Lang.EE, pos: PartOfSpeech.verb, query: 'run', extra: true }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(fake.requests).toEqual([{ path: 'Estonian/Verb', query: 'run', searchInEnglish: true }]);
        expect(result.current.data?.status).toBe('found');
        expect(result.current.data?.cases.get('infinitiveMaEE' as never)).toBe('jooksma');
    });

    it('keeps a partial status (the "not fully sure" notice) and encodes the query', async () => {
        const { fake, wrapper } = setup({
            spanishNoun: { status: 'partial', cases: [{ caseName: 'genderES', word: 'la' }] },
        });
        const { result } = renderHook(
            () => useAutocompleteTranslation({ language: Lang.ES, pos: PartOfSpeech.noun, query: 'canción' }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(fake.requests[0]).toMatchObject({ path: 'Spanish/Noun', query: 'canción' });
        expect(result.current.data?.status).toBe('partial');
        expect(result.current.data?.cases.get('genderES' as never)).toBe('la');
    });

    it('reports a not-found German noun', async () => {
        const { wrapper } = setup({ germanNoun: { status: 'not-found', cases: [] } });
        const { result } = renderHook(
            () => useAutocompleteTranslation({ language: Lang.DE, pos: PartOfSpeech.noun, query: 'zzzznotaword' }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.status).toBe('not-found');
    });
});
