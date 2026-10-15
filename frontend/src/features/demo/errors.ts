import { getApiErrorCode } from '@/api/types';

const KNOWN = new Set(['demo_disabled', 'demo_busy', 'demo_rate_limited', 'demo_unavailable']);

/** The translation key for a failed demo start: one per server code, else a generic line. */
export function demoErrorKey(error: unknown): string {
    const code = getApiErrorCode(error);
    return code && KNOWN.has(code) ? `demo:errors.${code}` : 'demo:errors.generic';
}
