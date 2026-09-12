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
