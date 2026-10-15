import { isTokenExpired } from '@/lib/jwt';
import type { SessionUser } from '@/stores/authStore';

/** Milliseconds until the demo ends (≤ 0 once it has ended); null when the session is not a demo. */
export function demoMsLeft(user: SessionUser | null, now: number = Date.now()): number | null {
    if (!user?.isDemo || !user.demoExpiresAt) return null;
    const end = Date.parse(user.demoExpiresAt);
    return Number.isNaN(end) ? null : end - now;
}

/** Time left as `m:ss`, or `h:mm:ss` from one hour. Rounded up to the second, never below 0:00. */
export function formatTimeLeft(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** A demo session that can still be used: a valid token and time left. */
export function isLiveDemo(user: SessionUser | null, token: string | null, now: number = Date.now()): boolean {
    const left = demoMsLeft(user, now);
    return left !== null && left > 0 && !isTokenExpired(token, now);
}
