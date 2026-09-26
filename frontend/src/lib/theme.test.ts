import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
    THEME_STORAGE_KEY,
    applyTheme,
    currentTheme,
    initTheme,
    readStoredTheme,
    setTheme,
    systemTheme,
    useTheme,
} from './theme';

/** jsdom has no `matchMedia`; this stub lets a test pick the OS preference and flip it live. */
function stubOsTheme(initial: 'light' | 'dark') {
    let dark = initial === 'dark';
    const changeListeners = new Set<() => void>();
    vi.stubGlobal(
        'matchMedia',
        vi.fn().mockImplementation(() => ({
            get matches() {
                return dark;
            },
            addEventListener: (_: string, fn: () => void) => changeListeners.add(fn),
            removeEventListener: (_: string, fn: () => void) => changeListeners.delete(fn),
        })),
    );
    return {
        flip(next: 'light' | 'dark') {
            dark = next === 'dark';
            changeListeners.forEach((fn) => fn());
        },
    };
}

describe('theme', () => {
    beforeEach(() => {
        document.documentElement.removeAttribute('data-theme');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('falls back to light where matchMedia is missing (jsdom)', () => {
        expect(systemTheme()).toBe('light');
    });

    it('follows the OS preference when nothing is saved', () => {
        stubOsTheme('dark');
        expect(readStoredTheme()).toBeNull();
        expect(currentTheme()).toBe('dark');
    });

    it('lets a saved choice win over the OS preference', () => {
        stubOsTheme('dark');
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
        expect(currentTheme()).toBe('light');
    });

    it('ignores a malformed saved value', () => {
        stubOsTheme('light');
        localStorage.setItem(THEME_STORAGE_KEY, 'purple');
        expect(readStoredTheme()).toBeNull();
        expect(currentTheme()).toBe('light');
    });

    it('does not throw when storage is blocked', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(readStoredTheme()).toBeNull();
        expect(() => setTheme('dark')).not.toThrow();
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        vi.restoreAllMocks();
    });

    it('setTheme saves the choice and sets the attribute', () => {
        setTheme('dark');
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('initTheme applies the start theme without saving it', () => {
        stubOsTheme('dark');
        const stop = initTheme();
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
        stop();
    });

    it('initTheme follows a live OS change only while no choice is saved', () => {
        const os = stubOsTheme('light');
        const stop = initTheme();
        os.flip('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        os.flip('light');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        stop();
    });

    it('useTheme re-renders when the theme is set', () => {
        stubOsTheme('light');
        applyTheme('light');
        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe('light');

        act(() => result.current.setTheme('dark'));
        expect(result.current.theme).toBe('dark');
    });
});
