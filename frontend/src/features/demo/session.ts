import { isTokenExpired } from '@/lib/jwt';
import type { SessionUser } from '@/stores/authStore';

/** Milliseconds until the demo ends (≤ 0 once it has ended); null when the session is not a demo. */
export function demoMsLeft(user: SessionUser | null, now: number = Date.now()): number | null {
    if (!user?.isDemo || !user.demoExpiresAt) return null;
    const end = Date.parse(user.demoExpiresAt);
    return Number.isNaN(end) ? null : end - now;
}

/** A demo session that can still be used: a valid token and time left. */
export function isLiveDemo(user: SessionUser | null, token: string | null, now: number = Date.now()): boolean {
    const left = demoMsLeft(user, now);
    return left !== null && left > 0 && !isTokenExpired(token, now);
}
