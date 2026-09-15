/**
 * Word CRUD wire contracts — re-pinned against the live backend after Phase 2
 * Slice 1's `_id` strip (`backend/services/wordService.ts`,
 * `backend/controllers/wordController.ts`). Word and translation responses are
 * `id`-only.
 *
 * The form-local model — `WordData` / `TranslationItem` / `WordItem` carrying
 * the `InternalStatus` fields (`completionState`, `isDirty`) — lives in
 * `ts/interfaces.ts` and is consumed by the form engine from Slice 3 on. This
 * file is only the shapes that cross the network.
 */
import type { UiLanguage } from '@/lib/language';
import type { Lang, PartOfSpeech } from '@/ts/enums';

/** One `caseName → word` slot. `caseName` is a verbatim enum string from `ts/enums.ts`. */
export interface WordCaseBE {
    caseName: string;
    word: string;
}

/** One language's translation, as persisted (assembled by `wordService.ts`). */
export interface TranslationBE {
    id: string;
    language: Lang;
    cases: WordCaseBE[];
}

/**
 * A tag as it rides on a word response — a raw `tags` table row (Drizzle
 * `$inferSelect`), NOT the form-model `TagData` in `ts/interfaces.ts`. Phase 2
 * never renders these; the shape is pinned only so Phase 4 widens it on purpose.
 */
export interface WordTagRef {
    id: string;
    authorId: string;
    label: string;
    description: string | null;
    visibility: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * `GET /api/words`, `GET /api/words/:id`, `POST /api/words`, `PUT /api/words/:id`
 * all return this shape (`assembleWord` in `wordService.ts`). Dates are ISO
 * strings over the wire.
 */
export interface WordBE {
    id: string;
    /** Author id (`word.userId`). The ownership check on `GET /:id` compares this to the caller. */
    user: string;
    partOfSpeech: PartOfSpeech;
    translations: TranslationBE[];
    clue: string | null;
    isCloned: boolean;
    originalCreator: string | null;
    tags: WordTagRef[];
    createdAt: string;
    updatedAt: string;
}

/** One translation inside a create/update payload — no `id`, cases only. */
export interface TranslationInput {
    language: Lang;
    cases: WordCaseBE[];
}

/**
 * `POST /api/words` body. `partOfSpeech` and >= 2 translations are required
 * (400 otherwise). Phase 2 sends no `tags` — the tags field is deferred to
 * Phase 4 (decision D2).
 */
export interface CreateWordBody {
    partOfSpeech: PartOfSpeech;
    clue?: string;
    translations: TranslationInput[];
}

/**
 * `PUT /api/words/:id` body. The old frontend put the id in the body and its
 * service lifted it into the URL; the controller only reads `req.params.id`, so
 * `api.ts` sends the id in the path and echoes it in the body for shape parity.
 * `partOfSpeech` is immutable after creation but still sent (the controller
 * updates it only when present, and it never changes).
 */
export interface UpdateWordBody extends CreateWordBody {
    id: string;
}

/** `DELETE /api/words/:id` → 200 (`{ id }` only after Slice 1). */
export interface DeleteWordResponse {
    id: string;
}

/**
 * `GET /api/words/simple` — the Review table's row (`simplifyWord` in
 * `wordController.ts`). Flat and dynamically keyed per language, unlike
 * `WordBE`'s nested `translations[]`: no per-case detail, just one headline
 * word and a case count per language, plus gender for the two languages that
 * carry one.
 *
 * `LangKey` reuses `UiLanguage['key']` rather than redeclaring the union — a
 * template-literal mapped type over it (`data${K}`, `registeredCases${K}`) is
 * fully indexable with no `Record<union, T>` collision: unlike `CaseName`
 * (four enums sharing string values, which broke `Record` indexing in the
 * autocomplete slice and forced a `Map`), these four keys are collision-free
 * literals, so plain property access typechecks.
 */
export type LangKey = UiLanguage['key'];

/**
 * The headline word per language. Optional even when the language IS present
 * in `storedLanguages`: `getRequiredFieldsData` (`wordController.ts`) looks up
 * the one required case via `.find()`; when a translation was persisted
 * without it, the lookup is `undefined` and `res.json` drops the key entirely
 * — a stored translation is not the same fact as "has a headline word".
 */
type SimpleHeadlineFields = { [K in LangKey as `data${K}`]?: string };

/** `translation.cases.length` for the language — a raw stored-case count, not a percentage. */
type SimpleCaseCountFields = { [K in LangKey as `registeredCases${K}`]?: number };

export interface WordSimpleBE extends SimpleHeadlineFields, SimpleCaseCountFields {
    id: string;
    /** Author id. `!== session.user.id` means this row arrived via a followed tag — read-only. */
    user: string;
    partOfSpeech: PartOfSpeech;
    /** Same shape as `WordBE.tags` (`assembleWord`). Typed now, unrendered until Phase 4 (D1). */
    tags: WordTagRef[];
    createdAt: string;
    updatedAt: string;
    /** Full `Lang` labels ("German"), not keys — the authoritative "has a translation" signal. */
    storedLanguages: string[];
    /** Nouns only; only DE/ES carry a gendered case at all. */
    genderES?: string;
    genderDE?: string;
}

/**
 * `GET /api/words/simple` query filters, shared by the URL search-param layer
 * (`features/words/review/search.ts`) and `useWordsInfinite`. `tag` is
 * declared but never populated in Phase 3 (D1) — Phase 4 fills it in, no
 * shape change needed.
 */
export interface WordListFilters {
    q?: string;
    pos?: PartOfSpeech[];
    gender?: string[];
    tag?: string[];
}

/** `DELETE /api/words/deleteMany` → 200. */
export interface DeleteManyResponse {
    deletedCount: number;
}
