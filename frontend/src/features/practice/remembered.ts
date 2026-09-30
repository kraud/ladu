/**
 * "The next default": the last settings the user started a session with, kept
 * per browser (C5). Stored in the URL's own short-code shape, so reading it back
 * goes through the same `validatePracticeSearch` — a hand-edited or stale blob
 * can never produce invalid settings. Storage is a per-viewer convenience, so
 * every access is wrapped and the app works with it unavailable.
 */
import { defaultParams } from './params';
import { paramsToSearch, searchToParams, validatePracticeSearch } from './search';
import type { PracticeParams } from './types';

export const REMEMBERED_KEY = 'ladu.practice.params';

export function rememberParams(params: PracticeParams): void {
    try {
        localStorage.setItem(REMEMBERED_KEY, JSON.stringify(paramsToSearch(params)));
    } catch {
        /* storage unavailable or full — the next visit simply starts from the defaults */
    }
}

/** The remembered settings for this account, or the defaults when there are none. */
export function loadRememberedParams(userLanguages: readonly string[]): PracticeParams {
    const base = defaultParams(userLanguages);
    try {
        const raw = localStorage.getItem(REMEMBERED_KEY);
        if (!raw) return base;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) return base;
        return searchToParams(validatePracticeSearch(parsed as Record<string, unknown>), base, userLanguages);
    } catch {
        return base;
    }
}
