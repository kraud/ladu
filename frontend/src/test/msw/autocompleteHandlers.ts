/**
 * An in-memory fake of `GET /api/dictionary/:language/:partOfSpeech/:query` and of the type-ahead
 * list `GET /api/dictionary/:language/:partOfSpeech?prefix=` (Slice E), following
 * `wordHandlers.ts`'s factory pattern: each call to `makeAutocompleteHandlers()` gets its
 * own configurable response map, and every request received is logged for assertions.
 *
 * Responses are keyed by a short name per (language, part of speech); a key that is not
 * given answers `not-found`. `{ status: <number> }` alone makes the request fail with it.
 * `options.entries` answers a lookup with `?entry=<id>` (a type-ahead pick) by entry id, before
 * the per-pair response. `options.suggestions` lists the words per pair; the fake returns the ones
 * whose lemma starts with the prefix (any letter case), like the backend.
 */
import { http, HttpResponse } from 'msw';
import type { DictionaryResponse, Suggestion } from '@/features/autocomplete/types';

const KEYS = {
    'English/Verb': 'englishVerb',
    'English/Adjective': 'englishAdjective',
    'English/Adverb': 'englishAdverb',
    'Spanish/Verb': 'spanishVerb',
    'Spanish/Noun': 'spanishNoun',
    'Spanish/Adjective': 'spanishAdjective',
    'Spanish/Adverb': 'spanishAdverb',
    'German/Verb': 'germanVerb',
    'German/Noun': 'germanNoun',
    'German/Adjective': 'germanAdjective',
    'German/Adverb': 'germanAdverb',
    'Estonian/Verb': 'estonianVerb',
    'Estonian/Noun': 'estonianNoun',
    'Estonian/Adjective': 'estonianAdjective',
    'Estonian/Adverb': 'estonianAdverb',
} as const;

type Key = (typeof KEYS)[keyof typeof KEYS];
export type AutocompleteResponseMap = Partial<Record<Key, DictionaryResponse | { status: number }>>;

const NOT_FOUND: DictionaryResponse = { status: 'not-found', cases: [] };

function isFailure(value: unknown): value is { status: number } {
    return typeof value === 'object' && value !== null && typeof (value as { status: unknown }).status === 'number';
}

export interface AutocompleteFakeOptions {
    entries?: Record<string, DictionaryResponse>;
    suggestions?: Partial<Record<Key, Suggestion[]>>;
}

export function makeAutocompleteHandlers(responses: AutocompleteResponseMap = {}, options: AutocompleteFakeOptions = {}) {
    /** `path` is "<language>/<partOfSpeech>", e.g. "German/Noun". */
    const requests: { path: string; query: string; searchInEnglish: boolean; entry: string | null }[] = [];
    const suggestionRequests: { path: string; prefix: string }[] = [];

    const handlers = [
        http.get('*/dictionary/:language/:partOfSpeech', ({ params, request }) => {
            const path = `${String(params.language)}/${String(params.partOfSpeech)}`;
            const prefix = new URL(request.url).searchParams.get('prefix') ?? '';
            suggestionRequests.push({ path, prefix });

            const key = KEYS[path as keyof typeof KEYS];
            if (!key) return HttpResponse.json({ message: `No dictionary for ${path}` }, { status: 400 });
            const words = options.suggestions?.[key] ?? [];
            return HttpResponse.json({
                suggestions: words.filter(({ lemma }) => lemma.toLowerCase().startsWith(prefix.trim().toLowerCase())),
            });
        }),
        http.get('*/dictionary/:language/:partOfSpeech/:query', ({ params, request }) => {
            const path = `${String(params.language)}/${String(params.partOfSpeech)}`;
            const search = new URL(request.url).searchParams;
            const searchInEnglish = search.get('searchInEnglish') === 'true';
            const entry = search.get('entry');
            requests.push({ path, query: String(params.query), searchInEnglish, entry });

            const key = KEYS[path as keyof typeof KEYS];
            if (!key) return HttpResponse.json({ message: `No dictionary for ${path}` }, { status: 400 });
            const body = (entry ? options.entries?.[entry] : undefined) ?? responses[key] ?? NOT_FOUND;
            if (isFailure(body)) return HttpResponse.json({ message: 'lookup failed' }, { status: body.status });
            return HttpResponse.json(body);
        }),
    ];

    return { handlers, requests, suggestionRequests };
}
