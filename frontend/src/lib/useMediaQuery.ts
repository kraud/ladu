/**
 * Live `matchMedia` value for a CSS media query. Used where a piece of UI
 * must be rendered in exactly ONE place per breakpoint (so each control keeps
 * a single accessible name), instead of twice with one copy hidden by CSS.
 *
 * `matchMedia` is missing in jsdom and in some embedded browsers: the hook
 * then reports `false` (the desktop layout), the same guard `lib/theme.ts`
 * uses. Tests that need the phone layout stub `window.matchMedia`.
 */
import { useCallback, useSyncExternalStore } from 'react';

/** The app's one layout breakpoint (`AppHeader`, `globals.css`, `WordEditorLayout`). */
export const MOBILE_QUERY = '(max-width: 920px)';

function matcher(query: string): MediaQueryList | undefined {
    try {
        return typeof window.matchMedia === 'function' ? window.matchMedia(query) : undefined;
    } catch {
        return undefined;
    }
}

export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (onChange: () => void) => {
            const list = matcher(query);
            if (!list) return () => {};
            list.addEventListener('change', onChange);
            return () => list.removeEventListener('change', onChange);
        },
        [query],
    );
    return useSyncExternalStore(
        subscribe,
        () => matcher(query)?.matches ?? false,
        () => false,
    );
}

export function useIsMobile(): boolean {
    return useMediaQuery(MOBILE_QUERY);
}
