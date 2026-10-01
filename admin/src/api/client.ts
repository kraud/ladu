/**
 * The one axios instance for the admin API. `baseURL: '/api'` is relative on
 * purpose: the Vite proxy forwards it to the backend in dev, and in production
 * Caddy does the same on the admin host (slice 7).
 *
 * This module must not import the router (cycle: client -> router -> routes ->
 * hooks -> client). A 401 is reported through `onUnauthorized` instead, which
 * `app/Providers.tsx` subscribes to.
 */
import axios, { AxiosError, type AxiosInstance } from 'axios';
import { authStore } from '@/stores/authStore';
import type { ApiError } from '@/api/types';

type UnauthorizedHandler = () => void;

const unauthorizedHandlers = new Set<UnauthorizedHandler>();

/** Run `handler` after a 401 has cleared the session. Returns an unsubscribe function. */
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
    unauthorizedHandlers.add(handler);
    return () => {
        unauthorizedHandlers.delete(handler);
    };
}

export const apiClient: AxiosInstance = axios.create({ baseURL: '/api' });

apiClient.interceptors.request.use((config) => {
    const { token } = authStore.getState();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    return config;
});

// A wrong password on the login form is a 400, not a 401, so this only fires
// for an expired, disabled or forged staff token.
apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiError>) => {
        if (error.response?.status === 401) {
            authStore.getState().clearSession();
            for (const handler of unauthorizedHandlers) handler();
        }
        return Promise.reject(error);
    },
);

/** The server's message for an error, or a fallback. */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
    if (axios.isAxiosError<ApiError>(error)) {
        if (!error.response) return 'Cannot reach the server';
        return error.response.data?.message ?? fallback;
    }
    return fallback;
}
