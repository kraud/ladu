/**
 * Phone-width viewport for tests. jsdom has no `matchMedia`, so `useIsMobile`
 * (`lib/useMediaQuery.ts`) reports desktop by default; a test that needs the
 * phone layout calls `mockMobileViewport()`. `test/setup.ts` calls
 * `restoreViewport()` after every test.
 */
import { vi } from 'vitest';

const original = window.matchMedia;

export function mockMobileViewport() {
    const list = { matches: true, addEventListener: () => {}, removeEventListener: () => {} };
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => list), writable: true, configurable: true });
}

export function restoreViewport() {
    Object.defineProperty(window, 'matchMedia', { value: original, writable: true, configurable: true });
}
