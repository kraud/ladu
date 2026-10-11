/**
 * An in-memory fake of the three routes behind "Start from a word" (Slice G):
 * - `GET /api/dictionary/translate/:fromLanguage?prefix=&partOfSpeech=` — the sense type-ahead (G1)
 * - `GET /api/dictionary/translate/sense/:partOfSpeech?english=&entry=&sense=&languages=` — one sense (G2)
 * - `POST /api/dictionary/draft` — the forms of the chosen words (G3)
 *
 * Register these BEFORE `makeAutocompleteHandlers()` in `server.use(...)`: its wildcard routes
 * (`/dictionary/:language/:partOfSpeech`) would otherwise catch `translate/English`.
 * Like `autocompleteHandlers.ts`, each call gets its own data and logs the requests it receives.
 */
import { http, HttpResponse } from 'msw';
import type { DraftPick, DraftTranslation, SenseResponse, SenseSuggestion } from '@/features/autocomplete/types';

export interface StartFromWordFakeOptions {
    /** Suggestions per start language; the fake keeps the words that start with the prefix (any letter case). */
    suggestions?: Record<string, SenseSuggestion[]>;
    /** One sense per `english|entry|sense` (the `key` of a suggestion); the fake keeps the asked languages. */
    senses?: Record<string, SenseResponse>;
    /** Draft answer per `language|word`; a pick not listed answers `found` with no cases. A number fails the call. */
    drafts?: Record<string, Pick<DraftTranslation, 'status' | 'cases'>>;
    draftFailure?: number;
}

export function makeStartFromWordHandlers(options: StartFromWordFakeOptions = {}) {
    const suggestionRequests: { language: string; prefix: string; partOfSpeech: string }[] = [];
    const senseRequests: { partOfSpeech: string; key: string; languages: string[] }[] = [];
    const draftRequests: { partOfSpeech: string; picks: DraftPick[] }[] = [];

    const handlers = [
        http.get('*/dictionary/translate/sense/:partOfSpeech', ({ params, request }) => {
            const search = new URL(request.url).searchParams;
            const key = `${search.get('english')}|${search.get('entry')}|${search.get('sense')}`;
            const languages = (search.get('languages') ?? '').split(',');
            senseRequests.push({ partOfSpeech: String(params.partOfSpeech), key, languages });
            const found = options.senses?.[key];
            if (!found) return HttpResponse.json({ message: 'No such sense' }, { status: 404 });
            const words = Object.fromEntries(Object.entries(found.sense.words).filter(([language]) => languages.includes(language)));
            const { ekilex } = found;
            // Like the backend: Ekilex only when Estonian was asked.
            return HttpResponse.json({ sense: { ...found.sense, words }, ...(ekilex && languages.includes('Estonian') ? { ekilex } : {}) });
        }),
        http.get('*/dictionary/translate/:fromLanguage', ({ params, request }) => {
            const search = new URL(request.url).searchParams;
            const language = String(params.fromLanguage);
            const prefix = search.get('prefix') ?? '';
            const partOfSpeech = search.get('partOfSpeech') ?? 'Any';
            suggestionRequests.push({ language, prefix, partOfSpeech });
            const suggestions = (options.suggestions?.[language] ?? []).filter(
                (item) =>
                    item.word.toLowerCase().startsWith(prefix.trim().toLowerCase()) &&
                    (partOfSpeech === 'Any' || item.partOfSpeech === partOfSpeech),
            );
            return HttpResponse.json({ suggestions });
        }),
        http.post('*/dictionary/draft', async ({ request }) => {
            const body = (await request.json()) as { partOfSpeech: string; picks: DraftPick[] };
            draftRequests.push(body);
            if (options.draftFailure) return HttpResponse.json({ message: 'draft failed' }, { status: options.draftFailure });
            const translations: DraftTranslation[] = body.picks.map((pick) => ({
                ...pick,
                ...(options.drafts?.[`${pick.language}|${pick.word}`] ?? { status: 'found' as const, cases: [] }),
            }));
            return HttpResponse.json({ translations });
        }),
    ];

    return { handlers, suggestionRequests, senseRequests, draftRequests };
}
