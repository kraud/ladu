import { getApiErrorCode } from '@/api/types';

const KNOWN = new Set(['demo_disabled', 'demo_busy', 'demo_rate_limited', 'demo_unavailable']);

/** The translation key for a failed demo start: one per server code, else a generic line. */
export function demoErrorKey(error: unknown): string {
    const code = getApiErrorCode(error);
    return code && KNOWN.has(code) ? `demo:errors.${code}` : 'demo:errors.generic';
}

const IN_APP_CODES = new Set(['demo_restricted', 'demo_word_limit', 'demo_tag_limit']);

/**
 * The translation key for a demo refusal inside the app (D3, D10): an action a demo may not take,
 * or a word/tag cap. `null` for any other error, so each feature's own mapping goes on.
 */
export function demoCodeErrorKey(error: unknown): string | null {
    const code = getApiErrorCode(error);
    return code && IN_APP_CODES.has(code) ? `demo:errors.${code}` : null;
}
