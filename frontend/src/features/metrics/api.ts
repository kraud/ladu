/**
 * Thin transport layer over `apiClient` (baseURL `/api`). No React, no toasts,
 * no store or query-cache access — those live in `hooks.ts`.
 */
import { apiClient } from '@/api/client';
import type { BasicUserMetricsBE } from './types';

/**
 * `GET /api/users/getUserMetrics` — note the path: it lives under `/users`,
 * not `/metrics` (`snapshot/ui/02-dashboard.md:39` names the wrong path; the
 * real route is `backend/routes/userRoutes.js:18`).
 */
export async function getUserMetrics(): Promise<BasicUserMetricsBE> {
    const { data } = await apiClient.get<BasicUserMetricsBE>('/users/getUserMetrics');
    return data;
}
