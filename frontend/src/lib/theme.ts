/**
 * Light/dark theme — the browser half of Phase 3.9.
 *
 * The theme is the `data-theme` attribute on `<html>`; `tokens.css` reassigns
 * the palette under `[data-theme='dark']`. Two sources decide the value, in
 * this order (`.context/plans/phase-3-9-dark-mode.md` D1, D6):
 *   1. the saved choice in `localStorage['ladu.theme']` — written ONLY when the
 *      user presses the switch,
 *   2. the OS preference (`prefers-color-scheme`).
 * So a visitor who never touches the switch keeps following the OS.
 *
 * This is a small external store read through `useSyncExternalStore`, not a
 * Zustand store: the inline script in `index.html` must read the same value
 * before React loads, so the saved choice is a bare `'light' | 'dark'` string
 * rather than a persist-middleware JSON blob. (Also keeps to the "three stores"
 * rule in `stores/uiStore.ts`.)
 *
 * Every storage / `matchMedia` access is guarded — private windows and jsdom
 * either throw or omit them.
 */
import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

/** Mirrored by the inline script in `frontend/index.html`. Change both together. */
export const THEME_STORAGE_KEY = 'ladu.theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

const listeners = new Set<() => void>();

function notify(): void {
    listeners.forEach((listener) => listener());
}

function isTheme(value: unknown): value is Theme {
    return value === 'light' || value === 'dark';
}

/** The user's saved choice, or `null` when they never pressed the switch. */
export function readStoredTheme(): Theme | null {
    try {
        const value = localStorage.getItem(THEME_STORAGE_KEY);
        return isTheme(value) ? value : null;
    } catch {
        return null;
    }
}

/** The OS preference; `light` where `matchMedia` is missing. */
export function systemTheme(): Theme {
    try {
        return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
    } catch {
        return 'light';
    }
}

/** The theme that applies right now: saved choice first, OS preference second. */
export function currentTheme(): Theme {
    return readStoredTheme() ?? systemTheme();
}

/** Write the theme onto `<html>`. */
export function applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
}

/** Save the user's choice, apply it, and tell every `useTheme` consumer. */
export function setTheme(theme: Theme): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        /* storage blocked — the choice still applies for this page view */
    }
    applyTheme(theme);
    notify();
}

/**
 * Apply the start theme and keep following the OS while the user has made no
 * choice. Call once at boot. Returns an unsubscribe for tests.
 */
export function initTheme(): () => void {
    applyTheme(currentTheme());

    let media: MediaQueryList | null = null;
    try {
        media = window.matchMedia(DARK_QUERY);
    } catch {
        media = null;
    }
    const onChange = () => {
        if (readStoredTheme() === null) {
            applyTheme(systemTheme());
            notify();
        }
    };
    media?.addEventListener('change', onChange);
    return () => media?.removeEventListener('change', onChange);
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    // Another tab pressing the switch changes the saved choice.
    const onStorage = (event: StorageEvent) => {
        if (event.key === THEME_STORAGE_KEY) {
            applyTheme(currentTheme());
            listener();
        }
    };
    window.addEventListener('storage', onStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);
    };
}

/** The active theme, plus the setter. Re-renders when the theme changes. */
export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
    const theme = useSyncExternalStore(subscribe, currentTheme, () => 'light' as Theme);
    return { theme, setTheme };
}
