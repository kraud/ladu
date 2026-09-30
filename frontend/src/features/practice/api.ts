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
    SavedSessionFull,
    SavedSessionItem,
    SessionSnapshot,
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

/** `GET /api/practice/sessions` — summaries of the caller's saved sessions, newest first. */
export async function listSessions(signal?: AbortSignal): Promise<SavedSessionItem[]> {
    const { data } = await apiClient.get<SavedSessionItem[]>('/practice/sessions', { signal });
    return data;
}

/** `GET /api/practice/sessions/:id` — 404 when it is gone, expired or not the caller's. */
export async function getSession(id: string): Promise<SavedSessionFull> {
    const { data } = await apiClient.get<SavedSessionFull>(`/practice/sessions/${encodeURIComponent(id)}`);
    return data;
}

/** `POST /api/practice/sessions` — 400 `{ code }`; the server deletes the oldest session over the limit. */
export async function createSession(snapshot: SessionSnapshot): Promise<SavedSessionItem> {
    const { data } = await apiClient.post<SavedSessionItem>('/practice/sessions', { snapshot });
    return data;
}

/** `PUT /api/practice/sessions/:id` — replaces the session and starts a new expiry period. 404 when gone. */
export async function updateSession(id: string, snapshot: SessionSnapshot): Promise<SavedSessionItem> {
    const { data } = await apiClient.put<SavedSessionItem>(`/practice/sessions/${encodeURIComponent(id)}`, { snapshot });
    return data;
}

/** `DELETE /api/practice/sessions/:id` — 204; 404 when gone. */
export async function deleteSession(id: string): Promise<void> {
    await apiClient.delete(`/practice/sessions/${encodeURIComponent(id)}`);
}
