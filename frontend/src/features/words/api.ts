/**
 * Thin transport layer over `apiClient` (baseURL `/api`). No React, no toasts,
 * no store or query-cache access — those live in `hooks.ts`. Each function maps
 * 1:1 to a `wordController` endpoint.
 *
 * Phase 2 scope: the five single-word CRUD endpoints. `GET /api/words/simple`
 * and `deleteMany` landed with the Review table in Phase 3 Slice 6.
 * `searchWord` is unused — the Review toolbar's search goes through `/simple`'s
 * own `q` param instead (Slice 7).
 */
import { apiClient } from '@/api/client';
import type {
    CreateWordBody,
    DeleteManyResponse,
    DeleteWordResponse,
    UpdateWordBody,
    WordBE,
    WordListFilters,
    WordSimpleBE,
} from './types';
import type { CursorPage } from '@/api/types';

/** `GET /api/words` — every word authored by the caller (no pagination in Phase 2). */
export async function getWords(): Promise<WordBE[]> {
    const { data } = await apiClient.get<WordBE[]>('/words');
    return data;
}

/** `GET /api/words/:id` — 400 "Word not found", 403 "User not authorized" if not the author. */
export async function getWordById(id: string): Promise<WordBE> {
    const { data } = await apiClient.get<WordBE>(`/words/${encodeURIComponent(id)}`);
    return data;
}

/** `POST /api/words` — 400 unless `partOfSpeech` and >= 2 translations are present. */
export async function createWord(body: CreateWordBody): Promise<WordBE> {
    const { data } = await apiClient.post<WordBE>('/words', body);
    return data;
}

/** `PUT /api/words/:id` — 401 if not the author; diff-syncs translations + cases. */
export async function updateWord(body: UpdateWordBody): Promise<WordBE> {
    const { data } = await apiClient.put<WordBE>(
        `/words/${encodeURIComponent(body.id)}`,
        body,
    );
    return data;
}

/** `DELETE /api/words/:id` — 401 if not the author; cascades translations/cases/tag links. */
export async function deleteWord(id: string): Promise<DeleteWordResponse> {
    const { data } = await apiClient.delete<DeleteWordResponse>(
        `/words/${encodeURIComponent(id)}`,
    );
    return data;
}

/** Params for `getWordsSimplified` — the filters plus the two pagination knobs. */
export interface GetWordsSimplifiedParams extends WordListFilters {
    cursor?: string;
    limit?: number;
}

/**
 * `pos` / `gender` / `tag` are REPEATABLE query keys (`?pos=Noun&pos=Verb`) —
 * `wordController.ts`'s `parseArrayParam` only recognises that form. Axios's
 * default array serializer instead emits `pos[]=Noun&pos[]=Verb`; passing a
 * `URLSearchParams` bypasses the serializer entirely (axios special-cases it
 * in `buildURL`), so this is built by hand rather than via `params: {...}`.
 */
function buildListQuery(params: GetWordsSimplifiedParams): URLSearchParams {
    const search = new URLSearchParams();
    for (const value of params.pos ?? []) search.append('pos', value);
    for (const value of params.gender ?? []) search.append('gender', value);
    for (const value of params.tag ?? []) search.append('tag', value);
    if (params.q) search.set('q', params.q);
    if (params.cursor) search.set('cursor', params.cursor);
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    return search;
}

/**
 * `GET /api/words/simple` — own words plus words from followed tags,
 * keyset-paginated. 400 "Invalid cursor" on a malformed `cursor`. `signal` is
 * threaded through so `useWordsInfinite` can abort an in-flight page when the
 * filters change mid-request.
 */
export async function getWordsSimplified(
    params: GetWordsSimplifiedParams,
    signal?: AbortSignal,
): Promise<CursorPage<WordSimpleBE>> {
    const { data } = await apiClient.get<CursorPage<WordSimpleBE>>('/words/simple', {
        params: buildListQuery(params),
        signal,
    });
    return data;
}

/**
 * `DELETE /api/words/deleteMany` — 400 "No word IDs provided", 400 "Some
 * words are missing", 401 "User not authorized to delete at least one of the
 * words". Axios has no dedicated DELETE-body argument; the payload rides
 * under `config.data`.
 */
export async function deleteManyWords(wordsId: string[]): Promise<DeleteManyResponse> {
    const { data } = await apiClient.delete<DeleteManyResponse>('/words/deleteMany', {
        data: { wordsId },
    });
    return data;
}
