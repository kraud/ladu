/**
 * The running practice session, kept across a reload (D3, C6): a Zustand store
 * around the pure reducer in `session.ts`, persisted to **sessionStorage**
 * (this tab only — a second tab starts its own practice).
 *
 * This is the third and last store the rewrite allows (`authStore`, `uiStore`,
 * and this one). It is a client-owned snapshot, like a form draft, so it does
 * not belong in TanStack Query. A session belongs to the account that started
 * it: logging out clears it, and `useSessionFor` never hands one to another user.
 */
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { useAuthStore } from '@/stores/authStore';
import { createSession, sessionReducer, type Session, type SessionAction } from './session';

const STORAGE_KEY = 'ladu.practice.session';

interface SessionStoreState {
    session: Session | null;
    /** Replace any running session with a new one. */
    start: (input: Parameters<typeof createSession>[0]) => void;
    dispatch: (action: SessionAction) => void;
    /** Drop the session (leave, or "Change settings"). */
    clear: () => void;
}

type PersistedSession = Pick<SessionStoreState, 'session'>;

/** Enough of the shape to trust a persisted blob; anything else is discarded. */
function isSession(value: unknown): value is Session {
    if (typeof value !== 'object' || value === null) return false;
    const s = value as Record<string, unknown>;
    return (
        typeof s.userId === 'string' &&
        Array.isArray(s.exercises) &&
        Array.isArray(s.answers) &&
        s.answers.length === s.exercises.length &&
        typeof s.params === 'object' &&
        s.params !== null &&
        typeof s.current === 'number' &&
        s.current >= 0 &&
        s.current < Math.max(1, s.exercises.length) &&
        (s.view === 'exercises' || s.view === 'results')
    );
}

/** sessionStorage adapter that never throws (private windows, blocked storage, planted blobs). */
const safeStorage: PersistStorage<PersistedSession> = {
    getItem: (name) => {
        try {
            const raw = sessionStorage.getItem(name);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as StorageValue<PersistedSession>;
            return isSession(parsed?.state?.session) ? parsed : null;
        } catch {
            return null;
        }
    },
    setItem: (name, value) => {
        try {
            sessionStorage.setItem(name, JSON.stringify(value));
        } catch {
            /* unavailable — the session simply will not survive a reload */
        }
    },
    removeItem: (name) => {
        try {
            sessionStorage.removeItem(name);
        } catch {
            /* nothing to do */
        }
    },
};

export const usePracticeSessionStore = create<SessionStoreState>()(
    persist(
        (set) => ({
            session: null,
            start: (input) => set({ session: createSession(input) }),
            dispatch: (action) =>
                set((state) => {
                    if (!state.session) return state;
                    const next = sessionReducer(state.session, action);
                    return next === state.session ? state : { session: next };
                }),
            clear: () => set({ session: null }),
        }),
        {
            name: STORAGE_KEY,
            version: 1,
            storage: safeStorage,
            partialize: (state) => ({ session: state.session }),
        },
    ),
);

/** The running session of `userId`, or `null` (also for a session that belongs to someone else). */
export function useSessionFor(userId: string | null | undefined): Session | null {
    return usePracticeSessionStore((state) =>
        userId && state.session?.userId === userId ? state.session : null,
    );
}

// A session must not outlive the login that started it.
useAuthStore.subscribe((state, previous) => {
    if (previous.user && !state.user) usePracticeSessionStore.getState().clear();
});
