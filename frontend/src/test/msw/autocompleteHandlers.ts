/**
 * An in-memory fake of `GET /api/dictionary/:language/:partOfSpeech/:query`, following
 * `wordHandlers.ts`'s factory pattern: each call to `makeAutocompleteHandlers()` gets its
 * own configurable response map, and every request received is logged for assertions.
 *
 * Responses are keyed by a short name per (language, part of speech); a key that is not
 * given answers `not-found`. `{ status: <number> }` alone makes the request fail with it.
 */
import { http, HttpResponse } from 'msw';
import type { DictionaryResponse } from '@/features/autocomplete/types';

const KEYS = {
    'English/Verb': 'englishVerb',
    'Spanish/Verb': 'spanishVerb',
    'Spanish/Noun': 'spanishNoun',
    'German/Verb': 'germanVerb',
    'German/Noun': 'germanNoun',
    'Estonian/Verb': 'estonianVerb',
    'Estonian/Noun': 'estonianNoun',
    'Estonian/Adjective': 'estonianAdjective',
} as const;

type Key = (typeof KEYS)[keyof typeof KEYS];
export type AutocompleteResponseMap = Partial<Record<Key, DictionaryResponse | { status: number }>>;

const NOT_FOUND: DictionaryResponse = { status: 'not-found', cases: [] };

function isFailure(value: unknown): value is { status: number } {
    return typeof value === 'object' && value !== null && typeof (value as { status: unknown }).status === 'number';
}

export function makeAutocompleteHandlers(responses: AutocompleteResponseMap = {}) {
    /** `path` is "<language>/<partOfSpeech>", e.g. "German/Noun". */
    const requests: { path: string; query: string; searchInEnglish: boolean }[] = [];

    const handlers = [
        http.get('*/dictionary/:language/:partOfSpeech/:query', ({ params, request }) => {
            const path = `${String(params.language)}/${String(params.partOfSpeech)}`;
            const searchInEnglish = new URL(request.url).searchParams.get('searchInEnglish') === 'true';
            requests.push({ path, query: String(params.query), searchInEnglish });

            const key = KEYS[path as keyof typeof KEYS];
            if (!key) return HttpResponse.json({ message: `No dictionary for ${path}` }, { status: 400 });
            const body = responses[key] ?? NOT_FOUND;
            if (isFailure(body)) return HttpResponse.json({ message: 'lookup failed' }, { status: body.status });
            return HttpResponse.json(body);
        }),
    ];

    return { handlers, requests };
}
