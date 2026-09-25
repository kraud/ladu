/**
 * The landing → app handoff (Phase 3.9, Slice 4, D3).
 *
 * The landing page (`ladu.com.ar`) and the app (`app.ladu.com.ar`) are
 * different origins, so neither can read the other's `localStorage`. The
 * landing links carry the visitor's choices in the address instead:
 * `https://app.ladu.com.ar/login?lng=es&theme=dark`. This module reads those two
 * values ONCE, at boot, before i18n starts and before the router is created:
 *
 *   - `theme` (`light` | `dark`) is applied and saved as the browser's choice
 *     (`setTheme`) — an address value beats a saved choice (D6);
 *   - `lng` (`en` | `es` | `de` | `ee`) is returned, and `i18n.ts` starts in
 *     that language (i18next then caches it, like the language selector does);
 *   - both are removed from the address bar. Every other parameter (for
 *     example `?redirect=`) and the `#…` fragment (the Google sign-in result)
 *     stay exactly as they were.
 *
 * Anything invalid is ignored but still removed, so the address always ends up
 * clean. Signed-in users are not special-cased here: once a session exists,
 * the theme and language on the account win (`useSessionTheme`,
 * `LanguageSelector`), as in Slice 3.
 *
 * `index.html`'s inline script also reads `?theme=` (apply only, no save) so
 * the first paint already has the right theme.
 */
import { UI_LANGUAGES, type UiLanguage } from '@/lib/language';
import { isTheme, setTheme, type Theme } from '@/lib/theme';

export interface Handoff {
    lng?: UiLanguage['i18n'];
    theme?: Theme;
}

const HANDOFF_KEYS = ['lng', 'theme'];

/** Pure: pick the recognised values out of a query string and return the rest untouched. */
export function parseHandoff(search: string): { handoff: Handoff; cleanedSearch: string; found: boolean } {
    const pairs = search.replace(/^\?/, '').split('&').filter(Boolean);
    const kept: string[] = [];
    const handoff: Handoff = {};
    let found = false;

    for (const pair of pairs) {
        const eq = pair.indexOf('=');
        const key = eq === -1 ? pair : pair.slice(0, eq);
        if (!HANDOFF_KEYS.includes(key)) {
            kept.push(pair);
            continue;
        }
        found = true;
        let value = '';
        try {
            value = decodeURIComponent(eq === -1 ? '' : pair.slice(eq + 1)).toLowerCase();
        } catch {
            /* malformed escape — treated as an invalid value */
        }
        if (key === 'theme' && isTheme(value)) handoff.theme = value;
        if (key === 'lng') {
            const language = UI_LANGUAGES.find((l) => l.i18n === value);
            if (language) handoff.lng = language.i18n;
        }
    }

    return { handoff, cleanedSearch: kept.length ? `?${kept.join('&')}` : '', found };
}

/** Read the handoff from the current address, apply the theme, clean the address. Call once, at boot. */
export function takeHandoffParams(): Handoff {
    try {
        const { pathname, search, hash } = window.location;
        const { handoff, cleanedSearch, found } = parseHandoff(search);
        if (!found) return {};

        if (handoff.theme) setTheme(handoff.theme);
        window.history.replaceState(window.history.state, '', `${pathname}${cleanedSearch}${hash}`);
        return handoff;
    } catch {
        return {};
    }
}
