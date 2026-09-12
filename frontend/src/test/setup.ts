import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw/server';
import { useAuthStore } from '@/stores/authStore';

// jsdom's scrollTo throws "Not implemented"; TanStack Router's scroll
// restoration calls it on every navigation. Replace it with a no-op.
Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true, configurable: true });

// jsdom ships no `PointerEvent` constructor. Base UI's Radio/Checkbox/Dialog
// click handlers re-dispatch a constructed `PointerEvent` to carry the
// source event's modifier keys (`dispatchClickWithModifiers`), which throws
// "is not a constructor" without this. `MouseEvent` covers every field that
// helper reads (bubbles/cancelable/composed/detail/shiftKey/ctrlKey/altKey/metaKey).
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
