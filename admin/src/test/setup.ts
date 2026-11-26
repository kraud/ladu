import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw/server';
import { useAuthStore } from '@/stores/authStore';
import { cleanupRenderedApps } from './renderApp';

// jsdom's scrollTo throws "Not implemented"; TanStack Router calls it on navigation.
Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true, configurable: true });

// The app must never reach the real network in a test.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));

afterEach(() => {
    cleanupRenderedApps();
    server.resetHandlers();
    cleanup();
    useAuthStore.getState().clearSession();
    try {
        localStorage.clear();
    } catch {
        /* jsdom always has localStorage */
    }
});

afterAll(() => server.close());
