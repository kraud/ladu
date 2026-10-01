/**
 * The access page keeps its tab in the URL, so a link to the login gate can be
 * shared and the back button moves between the two. `tab` is always one of the
 * two values; the bare `/access` reads as registration and the router writes
 * the default back as `?tab=registration`.
 */
export interface AccessSearch {
    tab: 'registration' | 'login';
}

/** Anything malformed in the URL is dropped, never an error page. */
export function validateAccessSearch(search: Record<string, unknown>): AccessSearch {
    return { tab: search.tab === 'login' ? 'login' : 'registration' };
}
