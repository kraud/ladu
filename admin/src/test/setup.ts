import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw/server';
import { useAuthStore } from '@/stores/authStore';

// jsdom's scrollTo throws "Not implemented"; TanStack Router calls it on navigation.
Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true, configurable: true });

// jsdom has no PointerEvent; Base UI's Button re-dispatches one on click.
if (typeof window.PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {
        pointerId: number;
        pointerType: string;
        constructor(type: string, params: PointerEventInit = {}) {
            super(type, params);
            this.pointerId = params.pointerId ?? 0;
            this.pointerType = params.pointerType ?? '';
        }
    }
    // @ts-expect-error — a test-only polyfill, not a spec-complete PointerEvent.
    window.PointerEvent = PointerEventPolyfill;
}

// The app must never reach the real network in a test.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
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
