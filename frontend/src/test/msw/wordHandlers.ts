/**
 * An in-memory fake of the `wordController` endpoints, for the words
 * data-layer tests (Slice 2), the word pages (Slices 4–5) and the Review
 * table (Slice 6). Each call to `makeWordHandlers()` gets its own isolated
 * store.
 *
 * Faithful to the live controller after Phase 2 Slice 1 / Phase 3 Slice 5–6:
 *   - responses are `id`-only (word + translations);
 *   - `GET /:id` for a non-author → 403 "User not authorized";
 *   - `PUT` / `DELETE` for a non-author → 401 "User not authorized";
 *   - `POST` → 400 without `partOfSpeech` or with < 2 translations;
 *   - `GET /simple` and `DELETE /deleteMany` are registered AHEAD of the
 *     `:id`-parameterised routes below — MSW matches in registration order,
 *     and the `:id` route would otherwise swallow both
 *     (`:id === 'simple'` / `'deleteMany'`) before they ever run.
 *
 * The bearer token is not verified — tests set `callerId` directly and the
 * fake treats every request as coming from that user.
 */
import { http, HttpResponse } from 'msw';
import { Lang } from '@/ts/enums';
import type { PartOfSpeech } from '@/ts/enums';
import type {
    CreateWordBody,
    TranslationBE,
    UpdateWordBody,
    WordBE,
    WordCaseBE,
    WordSimpleBE,
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

/**
 * `getRequiredFieldsData` (`wordController.ts`), reproduced verbatim per
 * part-of-speech/language pair — the exact table `simplifyWord` uses to pick
 * a translation's headline case. Deliberately NOT `lib/words.ts`'s
 * `primaryCaseWord`: that picks the first `required` text field, which for
 * `ADJECTIVE_CONFIGS[ES]` is `neutralSingular`, while the backend prefers
 * `maleSingularES` and only falls back to `neutralSingularES`.
 */
function headlineFields(
    pos: PartOfSpeech,
    language: Lang,
    cases: WordCaseBE[],
): Record<string, string> {
    const find = (name: string): string | undefined =>
        cases.find((c) => c.caseName === name)?.word;
    const only = (key: string, value: string | undefined): Record<string, string> =>
        value !== undefined ? { [key]: value } : {};

    switch (pos) {
        case 'Noun':
            switch (language) {
                case 'Estonian':
                    return only('dataEE', find('singularNimetavEE'));
                case 'English':
                    return only('dataEN', find('singularEN'));
                case 'Spanish':
                    return { ...only('genderES', find('genderES')), ...only('dataES', find('singularES')) };
                case 'German':
                    return {
                        ...only('genderDE', find('genderDE')),
                        ...only('dataDE', find('singularNominativDE')),
                    };
                default:
                    return {};
            }
        case 'Adverb':
            switch (language) {
                case 'English':
                    return only('dataEN', find('adverbEN'));
                case 'Spanish':
                    return only('dataES', find('adverbES'));
                case 'German':
                    return only('dataDE', find('adverbDE'));
                default:
                    return {};
            }
        case 'Adjective':
            switch (language) {
                case 'English':
                    return only('dataEN', find('positiveEN'));
                case 'Spanish':
                    return only('dataES', find('maleSingularES') ?? find('neutralSingularES'));
                case 'German':
                    return only('dataDE', find('positiveDE'));
                case 'Estonian':
                    return only('dataEE', find('algvorreEE'));
                default:
                    return {};
            }
        case 'Verb':
            switch (language) {
                case 'English':
                    return only('dataEN', find('simplePresent1sEN'));
                case 'Spanish':
                    return only('dataES', find('infinitiveNonFiniteSimpleES'));
                case 'Estonian':
                    return only('dataEE', find('infinitiveMaEE'));
                case 'German':
                    return only('dataDE', find('infinitiveDE'));
                default:
                    return {};
            }
        default:
            return {};
    }
}

const REGISTERED_FIELD_BY_LANG: Record<Lang, string> = {
    [Lang.EN]: 'registeredCasesEN',
    [Lang.ES]: 'registeredCasesES',
    [Lang.DE]: 'registeredCasesDE',
    [Lang.EE]: 'registeredCasesEE',
};

/** Mirrors `simplifyWord` (`wordController.ts`) over a fake `WordBE`. */
function simplifyWord(word: WordBE): WordSimpleBE {
    const storedLanguages = new Set<string>();
    let simplified: Record<string, unknown> = {
        tags: word.tags,
        partOfSpeech: word.partOfSpeech,
        createdAt: word.createdAt,
        updatedAt: word.updatedAt,
        id: word.id,
        user: word.user,
    };

    for (const translation of word.translations) {
        storedLanguages.add(translation.language);
        simplified = {
            ...simplified,
            ...headlineFields(word.partOfSpeech, translation.language, translation.cases),
            [REGISTERED_FIELD_BY_LANG[translation.language]]: translation.cases.length,
        };
    }

    return { ...simplified, storedLanguages: Array.from(storedLanguages) } as WordSimpleBE;
}

/** Base64 `"<ISO createdAt>|<id>"`, matching `encodeCursor`/`decodeCursor` in `wordController.ts`. */
function encodeCursor(createdAt: string, id: string): string {
    return btoa(`${createdAt}|${id}`);
}

function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
    try {
        const [createdAt, id] = atob(cursor).split('|');
        if (!id || Number.isNaN(new Date(createdAt).getTime())) return null;
        return { createdAt, id };
    } catch {
        return null;
    }
}

/** `ORDER BY created_at DESC, id DESC` — the same tie-break the real keyset uses. */
function compareNewestFirst(a: WordBE, b: WordBE): number {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
}

function matchesListFilters(word: WordBE, callerId: string, url: URL): boolean {
    // The real access rule is "own words OR words from a followed tag"; this
    // fake models only ownership — followed-tag access is covered by the
    // backend's own integration tests (`words-simple.test.js`).
    if (word.user !== callerId) return false;

    const posValues = url.searchParams.getAll('pos');
    if (posValues.length > 0 && !posValues.includes(word.partOfSpeech)) return false;

    const genderValues = url.searchParams.getAll('gender');
    if (genderValues.length > 0) {
        const hasGender = word.translations.some((t) =>
            t.cases.some(
                (c) => c.caseName.toLowerCase().startsWith('gender') && genderValues.includes(c.word),
            ),
        );
        if (!hasGender) return false;
    }

    const q = url.searchParams.get('q');
    if (q) {
        const needle = q.toLowerCase();
        const hasMatch = word.translations.some((t) =>
            t.cases.some((c) => {
                const name = c.caseName.toLowerCase();
                if (name.startsWith('gender') || name.startsWith('gradable')) return false;
                return c.word.toLowerCase().includes(needle);
            }),
        );
        if (!hasMatch) return false;
    }

    const tagIds = url.searchParams.getAll('tag');
    if (tagIds.length > 0 && !word.tags.some((tag) => tagIds.includes(tag.id))) return false;

    return true;
}

export function makeWordHandlers(opts: { callerId: string; seed?: SeedWord[] }) {
    const { callerId, seed = [] } = opts;
    const store = new Map<string, WordBE>();
    /** Bodies received by `POST` / `PUT`, in call order — for payload-shape assertions. */
    const requests: { method: 'POST' | 'PUT'; body: unknown }[] = [];
    /** Raw query strings received by `GET /simple`, in call order — for param-encoding assertions. */
    const simpleQueries: string[] = [];

    // Monotonically increasing, distinct per word — a wall-clock `Date.now()`
    // can tie two words created in the same test's same millisecond, which
    // would make the DESC keyset order (and therefore pagination) flaky.
    let clock = Date.now();
    const nextTimestamp = () => new Date((clock += 1)).toISOString();

    function hydrate(s: SeedWord): WordBE {
        const now = nextTimestamp();
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

        // GET /api/words/simple — MUST be registered before `*/api/words/:id`
        // below, or `:id === 'simple'` would swallow it (MSW matches in
        // registration order).
        http.get('*/api/words/simple', ({ request }) => {
            const url = new URL(request.url);
            simpleQueries.push(url.search);

            const filtered = [...store.values()].filter((w) => matchesListFilters(w, callerId, url));
            const total = filtered.length;
            const sorted = [...filtered].sort(compareNewestFirst);

            let afterCursor = sorted;
            const cursorParam = url.searchParams.get('cursor');
            if (cursorParam !== null) {
                const cursor = decodeCursor(cursorParam);
                if (!cursor) {
                    return HttpResponse.json({ message: 'Invalid cursor' }, { status: 400 });
                }
                afterCursor = sorted.filter((w) =>
                    w.createdAt !== cursor.createdAt ? w.createdAt < cursor.createdAt : w.id < cursor.id,
                );
            }

            const limitParam = url.searchParams.get('limit');
            const parsedLimit = limitParam !== null ? parseInt(limitParam, 10) : 50;
            const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;

            const pageRows = afterCursor.slice(0, limit + 1);
            const hasMore = pageRows.length > limit;
            const rows = hasMore ? pageRows.slice(0, limit) : pageRows;
            const nextCursor = hasMore
                ? encodeCursor(rows[rows.length - 1].createdAt, rows[rows.length - 1].id)
                : null;

            return HttpResponse.json({ items: rows.map(simplifyWord), nextCursor, total });
        }),

        // DELETE /api/words/deleteMany — MUST be registered before
        // `*/api/words/:id` below, same reason as `/simple` above.
        http.delete('*/api/words/deleteMany', async ({ request }) => {
            const body = (await request.json()) as { wordsId?: string[] };
            const wordIds = body.wordsId ?? [];
            if (wordIds.length === 0) {
                return HttpResponse.json({ message: 'No word IDs provided' }, { status: 400 });
            }
            const found = wordIds.map((id) => store.get(id));
            if (found.some((w) => w === undefined)) {
                return HttpResponse.json({ message: 'Some words are missing' }, { status: 400 });
            }
            const notOwned = found.some((w) => w?.user !== callerId);
            if (notOwned) {
                return HttpResponse.json(
                    { message: 'User not authorized to delete at least one of the words' },
                    { status: 401 },
                );
            }
            for (const id of wordIds) store.delete(id);
            return HttpResponse.json({ deletedCount: wordIds.length });
        }),

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

    return { handlers, store, requests, simpleQueries };
}
