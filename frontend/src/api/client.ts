/**
 * The single axios instance every feature's `api.ts` builds on.
 *
 * `baseURL: '/api'` is relative on purpose — the Vite dev proxy forwards `/api`
 * to `:5001`, and in production the frontend is served same-origin with the
 * backend, so no absolute URL is ever needed.
 *
 * Circular-import note: this module must not import the router or `Providers`
 * (client → router → routes → feature hooks → client would be a cycle). The
 * 401 → redirect wiring instead goes through the `onUnauthorized` registry
 * below, which `app/Providers.tsx` subscribes to with a `router.navigate`.
 */
import axios, { AxiosError, type AxiosInstance } from 'axios';
import { authStore } from '@/stores/authStore';
import type { ApiError } from '@/api/types';

type UnauthorizedHandler = () => void;

const unauthorizedHandlers = new Set<UnauthorizedHandler>();

/**
 * Register a callback to run after a 401 has cleared the session (e.g. navigate
 * to `/login`). Returns an unsubscribe function.
 */
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
    unauthorizedHandlers.add(handler);
    return () => {
        unauthorizedHandlers.delete(handler);
    };
}

export const apiClient: AxiosInstance = axios.create({
    baseURL: '/api',
});

// Attach the bearer token from the session store on every request.
apiClient.interceptors.request.use((config) => {
    const { token } = authStore.getState();
    if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
});

// 401 → drop the session and notify subscribers. A retry-once refresh leg
// belongs here but is intentionally omitted: the backend exposes no refresh
// endpoint, so the only correct response to an expired/invalid token is logout.
apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiError>) => {
        if (error.response?.status === 401) {
            authStore.getState().clearSession();
            for (const handler of unauthorizedHandlers) {
                handler();
            }
        }
        return Promise.reject(error);
    },
);
