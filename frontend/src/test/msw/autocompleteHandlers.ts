/**
 * An in-memory fake of the 8 `autocompleteTranslationController` endpoints,
 * following `wordHandlers.ts`'s factory pattern: each call to
 * `makeAutocompleteHandlers()` gets its own configurable response map, and
 * every request received is logged for payload-shape assertions.
 */
import { http, HttpResponse } from 'msw';
import type { EstonianLookupResponse, GenericLookupResponse } from '@/features/autocomplete/types';

export type AutocompleteResponseMap = {
    englishVerb?: GenericLookupResponse;
    spanishVerb?: GenericLookupResponse;
    spanishNoun?: GenericLookupResponse;
    germanVerb?: GenericLookupResponse;
    germanNoun?: GenericLookupResponse;
    estonianVerb?: EstonianLookupResponse | { status: number };
    estonianNoun?: EstonianLookupResponse | { status: number };
    estonianAdjective?: EstonianLookupResponse | { status: number };
};

function isFailure(value: unknown): value is { status: number } {
    return typeof value === 'object' && value !== null && 'status' in value && Object.keys(value).length === 1;
}

export function makeAutocompleteHandlers(responses: AutocompleteResponseMap = {}) {
    const requests: { path: string; query: string }[] = [];

    const respond = (path: string, query: string, body: unknown) => {
        requests.push({ path, query });
        if (isFailure(body)) return HttpResponse.json({ message: 'lookup failed' }, { status: body.status });
        return HttpResponse.json(body ?? { foundVerb: false, foundNoun: false });
    };

    const handlers = [
        http.get('*/autocompleteTranslations/english/verb/:query', ({ params }) =>
            respond('english/verb', String(params.query), responses.englishVerb ?? { foundVerb: false })
        ),
        http.get('*/autocompleteTranslations/spanish/verb/:query', ({ params }) =>
            respond('spanish/verb', String(params.query), responses.spanishVerb ?? { foundVerb: false })
        ),
        http.get('*/autocompleteTranslations/spanish/noun/:query', ({ params }) =>
            respond('spanish/noun', String(params.query), responses.spanishNoun ?? { foundNoun: false })
        ),
        http.get('*/autocompleteTranslations/german/verb/:query', ({ params }) =>
            respond('german/verb', String(params.query), responses.germanVerb ?? { foundVerb: false })
        ),
        http.get('*/autocompleteTranslations/german/noun/:query', ({ params }) =>
            respond('german/noun', String(params.query), responses.germanNoun ?? { foundNoun: false })
        ),
        http.get('*/autocompleteTranslations/estonian/verb/:query', ({ params }) =>
            respond('estonian/verb', String(params.query), responses.estonianVerb ?? { searchResult: [] })
        ),
        http.get('*/autocompleteTranslations/estonian/noun/:query', ({ params }) =>
            respond('estonian/noun', String(params.query), responses.estonianNoun ?? { searchResult: [] })
        ),
        http.get('*/autocompleteTranslations/estonian/adjective/:query', ({ params }) =>
            respond('estonian/adjective', String(params.query), responses.estonianAdjective ?? { searchResult: [] })
        ),
    ];

    return { handlers, requests };
}
