/**
 * Thin transport layer over `apiClient` — no React, no store, no toasts (those
 * live in `hooks.ts`). One function per exercise endpoint (phase-5-practice.md §B.3).
 */
import { apiClient } from '@/api/client';
import type {
    GenerateBody,
    GenerateResponse,
    PerformanceSummary,
    SaveAnswerBody,
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
