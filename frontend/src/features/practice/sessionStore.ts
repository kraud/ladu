/**
 * The running practice session, kept across a reload (D3, C6): a Zustand store
 * around the pure reducer in `session.ts`, persisted to **sessionStorage**
 * (this tab only — a second tab starts its own practice).
 *
 * This is the third and last store the rewrite allows (`authStore`, `uiStore`,
 * and this one). It is a client-owned snapshot, like a form draft, so it does
 * not belong in TanStack Query. A session belongs to the account that started
 * it: logging out clears it, and `useSessionFor` never hands one to another user.
 *
 * A session is **parked** when the user navigates away from `/practice`. The page
 * then shows the settings with a "resume" banner. A reload does not park it, so a
 * reload on an exercise card opens the same card again.
 */
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { useAuthStore } from '@/stores/authStore';
import { createSession, isSession, sessionReducer, type Session, type SessionAction } from './session';

const STORAGE_KEY = 'ladu.practice.session';

interface SessionStoreState {
    session: Session | null;
    /** The user left `/practice` with this session unfinished: show the settings, offer to resume. */
    parked: boolean;
    /** Replace any running session with a new one. */
    start: (input: Parameters<typeof createSession>[0]) => void;
    dispatch: (action: SessionAction) => void;
    /** Drop the session (leave, or "Change settings"). */
    clear: () => void;
    /** Route left: park an unfinished session, drop a finished one (its answers are saved). */
    park: () => void;
    /** Open the parked session again. */
    resume: () => void;
    /** Replace any running session with one downloaded from the saved list (Phase 5.5). */
    load: (session: Session) => void;
    /** Link the running session to its saved copy, or (`null`) unlink it after the copy was deleted. */
    setSavedId: (savedId: string | null) => void;
}

type PersistedSession = Pick<SessionStoreState, 'session' | 'parked'>;

/** sessionStorage adapter that never throws (private windows, blocked storage, planted blobs). */
const safeStorage: PersistStorage<PersistedSession> = {
    getItem: (name) => {
        try {
            const raw = sessionStorage.getItem(name);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as StorageValue<PersistedSession>;
            if (!isSession(parsed?.state?.session)) return null;
            // A session stored before Phase 5.5 has no `savedId`.
            const session = { ...parsed.state.session, savedId: parsed.state.session.savedId ?? null };
            return { ...parsed, state: { ...parsed.state, session } };
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
            parked: false,
            start: (input) => set({ session: createSession(input), parked: false }),
            dispatch: (action) =>
                set((state) => {
                    if (!state.session) return state;
                    const next = sessionReducer(state.session, action);
                    return next === state.session ? state : { session: next };
                }),
            clear: () => set({ session: null, parked: false }),
            park: () =>
                set((state) => {
                    if (!state.session) return state;
                    return state.session.view === 'results'
                        ? { session: null, parked: false }
                        : { parked: true };
                }),
            resume: () => set({ parked: false }),
            load: (session) => set({ session, parked: false }),
            setSavedId: (savedId) =>
                set((state) => (state.session ? { session: { ...state.session, savedId } } : state)),
        }),
        {
            name: STORAGE_KEY,
            version: 1,
            storage: safeStorage,
            partialize: (state) => ({ session: state.session, parked: state.parked }),
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
