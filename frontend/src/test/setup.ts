import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw/server';
import { useAuthStore } from '@/stores/authStore';

// jsdom's scrollTo throws "Not implemented"; TanStack Router's scroll
// restoration calls it on every navigation. Replace it with a no-op.
Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true, configurable: true });

// One MSW server for the whole suite. Unhandled requests are an error — the
// app must never reach the real network in tests.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
    server.resetHandlers();
    cleanup();
    useAuthStore.getState().clearSession();
    try {
        localStorage.clear();
    } catch {
        /* jsdom always provides localStorage; ignore if a test stubbed it out */
    }
});

afterAll(() => server.close());
