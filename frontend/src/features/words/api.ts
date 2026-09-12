/**
 * Thin transport layer over `apiClient` (baseURL `/api`). No React, no toasts,
 * no store or query-cache access — those live in `hooks.ts`. Each function maps
 * 1:1 to a `wordController` endpoint.
 *
 * Phase 2 scope: the five single-word CRUD endpoints. `GET /api/words/simple`,
 * `searchWord`, and `deleteMany` land with the Review table in Phase 3.
 */
import { apiClient } from '@/api/client';
import type {
    CreateWordBody,
    DeleteWordResponse,
    UpdateWordBody,
    WordBE,
} from './types';

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
