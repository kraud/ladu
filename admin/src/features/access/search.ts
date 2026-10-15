/**
 * The access page keeps its tab in the URL, so a link to one gate can be
 * shared and the back button moves between the tabs. `tab` is always one of
 * the three values; the bare `/access` reads as registration and the router
 * writes the default back as `?tab=registration`.
 */
export interface AccessSearch {
    tab: 'registration' | 'login' | 'demo';
}

/** Anything malformed in the URL is dropped, never an error page. */
export function validateAccessSearch(search: Record<string, unknown>): AccessSearch {
    return { tab: search.tab === 'login' || search.tab === 'demo' ? search.tab : 'registration' };
}
