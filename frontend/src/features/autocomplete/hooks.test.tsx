import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '@/app/query-client';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { server } from '@/test/msw/server';
import { makeAutocompleteHandlers } from '@/test/msw/autocompleteHandlers';
import { useAutocompleteTranslation, useDictionarySuggestions } from './hooks';

function setup(
    responses: Parameters<typeof makeAutocompleteHandlers>[0] = {},
    options: Parameters<typeof makeAutocompleteHandlers>[1] = {}
) {
    const fake = makeAutocompleteHandlers(responses, options);
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
            () => useAutocompleteTranslation({ language: Lang.EN, pos: PartOfSpeech.preposition, query: 'in' }),
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
        expect(fake.requests).toEqual([{ path: 'Estonian/Verb', query: 'run', searchInEnglish: true, entry: null }]);
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

describe('useDictionarySuggestions (Slice E)', () => {
    const TANZEN = { entryId: '44444444-4444-4444-4444-444444444444', lemma: 'tanzen' };

    it('asks for nothing under 2 characters, or while turned off', () => {
        const { fake, wrapper } = setup({}, { suggestions: { germanVerb: [TANZEN] } });
        const short = renderHook(
            () => useDictionarySuggestions({ language: Lang.DE, pos: PartOfSpeech.verb, prefix: ' t ', enabled: true }),
            { wrapper }
        );
        const off = renderHook(
            () => useDictionarySuggestions({ language: Lang.DE, pos: PartOfSpeech.verb, prefix: 'ta', enabled: false }),
            { wrapper }
        );

        expect(short.result.current.fetchStatus).toBe('idle');
        expect(off.result.current.fetchStatus).toBe('idle');
        expect(fake.suggestionRequests).toHaveLength(0);
    });

    it('asks the suggestion route with the app values and the trimmed prefix', async () => {
        const { fake, wrapper } = setup({}, { suggestions: { germanVerb: [TANZEN] } });
        const { result } = renderHook(
            () => useDictionarySuggestions({ language: Lang.DE, pos: PartOfSpeech.verb, prefix: 'ta ', enabled: true }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([TANZEN]);
        expect(fake.suggestionRequests).toEqual([{ path: 'German/Verb', prefix: 'ta' }]);
    });
});

describe('useAutocompleteTranslation with a type-ahead pick', () => {
    it('sends the entry id, and caches the answer apart from the main-sense lookup', async () => {
        const entryId = '55555555-5555-5555-5555-555555555555';
        const { fake, wrapper } = setup(
            { germanNoun: { status: 'found', cases: [{ caseName: 'genderDE', word: 'der' }] } },
            { entries: { [entryId]: { status: 'found', cases: [{ caseName: 'genderDE', word: 'die' }] } } }
        );
        const picked = renderHook(
            () => useAutocompleteTranslation({ language: Lang.DE, pos: PartOfSpeech.noun, query: 'See', entryId }),
            { wrapper }
        );
        const main = renderHook(() => useAutocompleteTranslation({ language: Lang.DE, pos: PartOfSpeech.noun, query: 'See' }), {
            wrapper,
        });

        await waitFor(() => expect(picked.result.current.data?.cases.get('genderDE' as never)).toBe('die'));
        await waitFor(() => expect(main.result.current.data?.cases.get('genderDE' as never)).toBe('der'));
        expect(fake.requests.map((request) => request.entry).sort()).toEqual([entryId, null].sort());
    });
});
