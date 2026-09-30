/**
 * Thin transport layer over `apiClient` — no React, no store, no toasts (those
 * live in `hooks.ts`). One function per exercise endpoint (phase-5-practice.md §B.3).
 */
import { apiClient } from '@/api/client';
import type { WordSimpleBE } from '@/features/words/types';
import type {
    GenerateBody,
    GenerateResponse,
    PerformanceSummary,
    SaveAnswerBody,
    SaveConfigBody,
    SavedConfig,
    SetModifierBody,
} from './types';

/** `POST /api/exercises/generate` — POST because the result is random. 400 `{ code }` for bad settings. */
export async function generateExercises(body: GenerateBody, signal?: AbortSignal): Promise<GenerateResponse> {
    const { data } = await apiClient.post<GenerateResponse>('/exercises/generate', body, { signal });
    return data;
}

/** `POST /api/exercises/answers` — 404 when the translation or case is unknown or not visible. */
export async function saveAnswer(body: SaveAnswerBody): Promise<PerformanceSummary> {
    const { data } = await apiClient.post<PerformanceSummary>('/exercises/answers', body);
    return data;
}

/** `PUT /api/exercises/performances/:translationId/modifier` — 404 until the first answer created the row. */
export async function setModifier(translationId: string, body: SetModifierBody): Promise<PerformanceSummary> {
    const { data } = await apiClient.put<PerformanceSummary>(
        `/exercises/performances/${encodeURIComponent(translationId)}/modifier`,
        body,
    );
    return data;
}

/** `GET /api/practice/configs` — the caller's saved configurations, newest first. */
export async function listConfigs(signal?: AbortSignal): Promise<SavedConfig[]> {
    const { data } = await apiClient.get<SavedConfig[]>('/practice/configs', { signal });
    return data;
}

/** `POST /api/practice/configs` — 400 `{ code }` for bad input, 409 `name_taken`. */
export async function createConfig(body: SaveConfigBody): Promise<SavedConfig> {
    const { data } = await apiClient.post<SavedConfig>('/practice/configs', body);
    return data;
}

/** `PUT /api/practice/configs/:id` — replaces everything. 409 `name_taken`, 404 when gone. */
export async function updateConfig(id: string, body: SaveConfigBody): Promise<SavedConfig> {
    const { data } = await apiClient.put<SavedConfig>(`/practice/configs/${encodeURIComponent(id)}`, body);
    return data;
}

/** `DELETE /api/practice/configs/:id` — 204; 404 when gone. */
export async function deleteConfig(id: string): Promise<void> {
    await apiClient.delete(`/practice/configs/${encodeURIComponent(id)}`);
}

/** `GET /api/practice/configs/:id/words` — the saved words the user can still see (Review row shape, saved order). */
export async function getConfigWords(id: string): Promise<WordSimpleBE[]> {
    const { data } = await apiClient.get<WordSimpleBE[]>(`/practice/configs/${encodeURIComponent(id)}/words`);
    return data;
}
