/**
 * An in-memory fake of the five single-word `wordController` endpoints, for the
 * words data-layer tests (Slice 2) and the word pages (Slices 4–5). Each call
 * to `makeWordHandlers()` gets its own isolated store.
 *
 * Faithful to the live controller after Phase 2 Slice 1:
 *   - responses are `id`-only (word + translations);
 *   - `GET /:id` for a non-author → 403 "User not authorized";
 *   - `PUT` / `DELETE` for a non-author → 401 "User not authorized";
 *   - `POST` → 400 without `partOfSpeech` or with < 2 translations.
 *
 * The bearer token is not verified — tests set `callerId` directly and the
 * fake treats every request as coming from that user.
 */
import { http, HttpResponse } from 'msw';
import type { Lang, PartOfSpeech } from '@/ts/enums';
import type {
    CreateWordBody,
    TranslationBE,
    UpdateWordBody,
    WordBE,
    WordCaseBE,
    WordTagRef,
} from '@/features/words/types';

export interface SeedWord {
    id?: string;
    user: string;
    partOfSpeech: PartOfSpeech;
    clue?: string | null;
    translations: Array<{ id?: string; language: Lang; cases: WordCaseBE[] }>;
    tags?: WordTagRef[];
}

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

function assembleTranslations(
    input: Array<{ id?: string; language: Lang; cases: WordCaseBE[] }>,
): TranslationBE[] {
    return input.map((t) => ({
        id: t.id ?? nextId('trans'),
        language: t.language,
        // The controller drops blank case values; mirror that.
        cases: t.cases.filter((c) => c.word !== ''),
    }));
}

export function makeWordHandlers(opts: { callerId: string; seed?: SeedWord[] }) {
    const { callerId, seed = [] } = opts;
    const store = new Map<string, WordBE>();
    /** Bodies received by `POST` / `PUT`, in call order — for payload-shape assertions. */
    const requests: { method: 'POST' | 'PUT'; body: unknown }[] = [];

    function hydrate(s: SeedWord): WordBE {
        const now = new Date().toISOString();
        const word: WordBE = {
            id: s.id ?? nextId('word'),
            user: s.user,
            partOfSpeech: s.partOfSpeech,
            translations: assembleTranslations(s.translations),
            clue: s.clue ?? null,
            isCloned: false,
            originalCreator: null,
            tags: s.tags ?? [],
            createdAt: now,
            updatedAt: now,
        };
        store.set(word.id, word);
        return word;
    }

    for (const s of seed) hydrate(s);

    const handlers = [
        // GET /api/words — caller's own words only
        http.get('*/api/words', () =>
            HttpResponse.json([...store.values()].filter((w) => w.user === callerId)),
        ),

        // GET /api/words/:id
        http.get('*/api/words/:id', ({ params }) => {
            const word = store.get(params.id as string);
            if (!word) {
                return HttpResponse.json({ message: 'Word not found' }, { status: 400 });
            }
            if (word.user !== callerId) {
                return HttpResponse.json({ message: 'User not authorized' }, { status: 403 });
            }
            return HttpResponse.json(word);
        }),

        // POST /api/words
        http.post('*/api/words', async ({ request }) => {
            const body = (await request.json()) as CreateWordBody;
            requests.push({ method: 'POST', body });
            if (!body.partOfSpeech) {
                return HttpResponse.json({ message: 'Please add part of speech' }, { status: 400 });
            }
            if (!body.translations || body.translations.length < 2) {
                return HttpResponse.json(
                    { message: 'Please add 2 or more translations' },
                    { status: 400 },
                );
            }
            const word = hydrate({
                user: callerId,
                partOfSpeech: body.partOfSpeech,
                clue: body.clue ?? null,
                translations: body.translations,
            });
            return HttpResponse.json(word);
        }),

        // PUT /api/words/:id
        http.put('*/api/words/:id', async ({ params, request }) => {
            const existing = store.get(params.id as string);
            const body = (await request.json()) as UpdateWordBody;
            requests.push({ method: 'PUT', body });
            if (!existing) {
                return HttpResponse.json({ message: 'Word not found' }, { status: 400 });
            }
            if (existing.user !== callerId) {
                return HttpResponse.json({ message: 'User not authorized' }, { status: 401 });
            }
            const updated: WordBE = {
                ...existing,
                partOfSpeech: body.partOfSpeech ?? existing.partOfSpeech,
                clue: body.clue ?? null,
                translations: assembleTranslations(body.translations),
                updatedAt: new Date().toISOString(),
            };
            store.set(updated.id, updated);
            return HttpResponse.json(updated);
        }),

        // DELETE /api/words/:id
        http.delete('*/api/words/:id', ({ params }) => {
            const existing = store.get(params.id as string);
            if (!existing) {
                return HttpResponse.json({ message: 'Word not found' }, { status: 400 });
            }
            if (existing.user !== callerId) {
                return HttpResponse.json({ message: 'User not authorized' }, { status: 401 });
            }
            store.delete(existing.id);
            return HttpResponse.json({ id: existing.id });
        }),
    ];

    return { handlers, store, requests };
}
