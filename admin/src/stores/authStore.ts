/**
 * The staff session: who is signed in, and their token. The storage key is not
 * the learner app's `ladu.session`, so one kind of session can never be read
 * as the other (the two apps are on different origins anyway; this is belt and
 * braces for `localhost` dev, where origins differ only by port).
 */
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { isTokenExpired } from '@/lib/jwt';

export type StaffRole = 'owner' | 'admin' | 'support' | 'viewer';

export interface StaffUser {
    id: string;
    email: string;
    name: string;
    role: StaffRole;
    /** From the server (`/auth/me`): the UI shows only the buttons these allow. The server still checks every request. */
    permissions: string[];
    /** True while the person still has the temporary password an owner gave them. */
    mustChangePassword: boolean;
    /** The backend's `ENVIRONMENT` ("staging"/"prod", or "local" in dev) — the header marks which environment this is. Not a column of `staff_accounts`. */
    environment: string;
}

interface AuthState {
    staff: StaffUser | null;
    token: string | null;
    /** `token` is omitted when refreshing the profile from `/auth/me`. */
    setSession: (staff: StaffUser, token?: string) => void;
    clearSession: () => void;
}

type PersistedAuth = Pick<AuthState, 'staff' | 'token'>;

const STORAGE_KEY = 'ladu-admin.session';

function isValidStaff(value: unknown): value is StaffUser {
    if (typeof value !== 'object' || value === null) return false;
    const s = value as Record<string, unknown>;
    return (
        typeof s.id === 'string' &&
        s.id.length > 0 &&
        typeof s.email === 'string' &&
        typeof s.role === 'string' &&
        // A session saved before permissions existed is dropped: one new login.
        Array.isArray(s.permissions)
    );
}

/** localStorage adapter that never throws: a bad or unavailable store means "no session". */
const safeStorage: PersistStorage<PersistedAuth> = {
    getItem: (name) => {
        try {
            const raw = localStorage.getItem(name);
            return raw ? (JSON.parse(raw) as StorageValue<PersistedAuth>) : null;
        } catch {
            return null;
        }
    },
    setItem: (name, value) => {
        try {
            localStorage.setItem(name, JSON.stringify(value));
        } catch {
            /* the session simply will not persist */
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
            staff: null,
            token: null,
            setSession: (staff, token) => set({ staff, token: token ?? get().token }),
            clearSession: () => set({ staff: null, token: null }),
        }),
        {
            name: STORAGE_KEY,
            storage: safeStorage,
            partialize: (state) => ({ staff: state.staff, token: state.token }),
            onRehydrateStorage: () => (state, error) => {
                if (error || !state) return;
                if (isTokenExpired(state.token) || !isValidStaff(state.staff)) {
                    state.clearSession();
                }
            },
        },
    ),
);

/** A session saved before this field existed reads as `false`. */
export function useMustChangePassword(): boolean {
    return useAuthStore((s) => s.staff?.mustChangePassword === true);
}

/** True if the signed-in staff member has `permission`. */
export function useCan(permission: string): boolean {
    return useAuthStore((s) => s.staff?.permissions.includes(permission) ?? false);
}

/** Non-hook access for the axios interceptors, route guards and tests. */
export const authStore = {
    getState: useAuthStore.getState,
    setState: useAuthStore.setState,
};
