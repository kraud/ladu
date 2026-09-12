/**
 * The session store — the single source of truth for "who is logged in".
 *
 * Fixes three §8.4 defects the old app carried:
 *  - Three divergent localStorage write shapes (login stored the whole response,
 *    verify stored `response.data.user`, register stored nothing). Here every
 *    backend shape passes through ONE `toSessionUser` normalizer.
 *  - An unguarded parse of the raw localStorage session blob at boot. Here the
 *    storage adapter try/catches the parse and `onRehydrateStorage` drops
 *    anything malformed or expired.
 *  - Session key `user` reused from v1. New key `ladu.session` — a stale v1
 *    blob can never be mistaken for a v2 session.
 */
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { isTokenExpired } from '@/lib/jwt';

/** The normalized session user — the only shape the app reads. */
export interface SessionUser {
    id: string;
    name: string;
    email: string;
    username: string;
    /** language *labels* ("English", "Spanish", …) in the user's preferred order */
    languages: string[];
    uiLanguage: string;
    nativeLanguage: string | null;
    verified: boolean;
}

/**
 * Every raw user object the backend can hand us:
 *  - login  (`serializeLoginUser`): `nativeLanguage` key omitted when null; carries `token`
 *  - verify (`verifyUser`): full row; carries `token`
 *  - getMe / updateUser (`serializeUser`): full row; no `token`
 *  - register (`publicUserResponse`): no `token` — never persisted, but normalizes anyway
 *
 * `id` only. `_id` is a MongoDB artifact with no place in new frontend code
 * (.context/plans/new-repo-build-plan.md §4): the Postgres schema has no such column. The auth
 * serializers in `userController.ts` still emit a legacy `_id` alias; it is
 * stripped in the Phase 1 auth slice, and this normalizer never reads it.
 */
export interface RawUser {
    id?: string;
    name?: string;
    email?: string;
    username?: string;
    languages?: unknown;
    uiLanguage?: string | null;
    nativeLanguage?: string | null;
    verified?: boolean | null;
    token?: string;
}

interface AuthState {
    user: SessionUser | null;
    token: string | null;
    /**
     * Write the session from any backend user shape. `token` falls back to
     * `raw.token` (login / verify carry it) and then to the current token
     * (a `getMe` refresh keeps the token it was fetched with).
     */
    setSession: (raw: RawUser, token?: string) => void;
    clearSession: () => void;
}

type PersistedAuth = Pick<AuthState, 'user' | 'token'>;

const STORAGE_KEY = 'ladu.session';

/** Collapse any backend user shape into the one shape the app consumes. */
export function toSessionUser(raw: RawUser): SessionUser {
    return {
        id: raw.id ?? '',
        name: raw.name ?? '',
        email: raw.email ?? '',
        username: raw.username ?? '',
        languages: Array.isArray(raw.languages) ? raw.languages.filter((l): l is string => typeof l === 'string') : [],
        uiLanguage: raw.uiLanguage ?? 'English',
        nativeLanguage: raw.nativeLanguage ?? null,
        // `users.verified` is nullable. A missing flag on a getMe refresh must
        // not log the user out — login/verify already gate the unverified path
        // (Phase 1 decision 1), so treat only an explicit `false` as unverified.
        verified: raw.verified == null ? true : raw.verified === true,
    };
}

function isValidSessionUser(value: unknown): value is SessionUser {
    if (typeof value !== 'object' || value === null) return false;
    const u = value as Record<string, unknown>;
    return typeof u.id === 'string' && u.id.length > 0 && typeof u.email === 'string';
}

/**
 * localStorage adapter that never throws on read. A hand-planted or v1-era blob
 * is discarded (and cleared) instead of crashing the boot — the parse lives
 * here, wrapped, so no component reaches into localStorage directly (the
 * Phase-1 gate greps for exactly that).
 */
const safeStorage: PersistStorage<PersistedAuth> = {
    getItem: (name) => {
        try {
            const raw = localStorage.getItem(name);
            if (!raw) return null;
            return JSON.parse(raw) as StorageValue<PersistedAuth>;
        } catch {
            try {
                localStorage.removeItem(name);
            } catch {
                /* localStorage unavailable — nothing to clean */
            }
            return null;
        }
    },
    setItem: (name, value) => {
        try {
            localStorage.setItem(name, JSON.stringify(value));
        } catch {
            /* quota or unavailable — session simply won't persist this write */
        }
    },
    removeItem: (name) => {
        try {
            localStorage.removeItem(name);
        } catch {
            /* nothing to do */
        }
    },
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            setSession: (raw, token) => {
                set({
                    user: toSessionUser(raw),
                    token: token ?? raw.token ?? get().token ?? null,
                });
            },
            clearSession: () => set({ user: null, token: null }),
        }),
        {
            name: STORAGE_KEY,
            storage: safeStorage,
            partialize: (state) => ({ user: state.user, token: state.token }),
            onRehydrateStorage: () => (state, error) => {
                if (error || !state) return;
                if (isTokenExpired(state.token) || !isValidSessionUser(state.user)) {
                    state.clearSession();
                }
            },
        },
    ),
);

/** Non-hook access for interceptors, route guards, and tests. */
export const authStore = {
    getState: useAuthStore.getState,
    setState: useAuthStore.setState,
};
