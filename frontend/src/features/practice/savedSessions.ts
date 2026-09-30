/**
 * Saved sessions, client side (Phase 5.5): what goes to the server, and what
 * comes back into the running session. No React, no storage.
 * Spec: phase-5-5-saved-practice.md §6.
 */
import * as practiceApi from './api';
import { getApiErrorCode } from './errors';
import { isSession, type Session } from './session';
import type { SavedSessionFull, SavedSessionItem, SessionSnapshot } from './types';

/** Same numbers as the server (`services/exercises/validateSession.ts`); used only for the hint text. */
export const MAX_SAVED_SESSIONS = 10;
export const SESSION_TTL_DAYS = 7;

/** The session as stored: the local link to the saved copy stays out of it. */
export function toSnapshot(session: Session): SessionSnapshot {
    const { savedId: _savedId, ...snapshot } = session;
    return snapshot;
}

/**
 * Save the session. With a saved copy it updates that copy; if the server says it is gone
 * (expired, replaced by newer sessions, or deleted on another device) it saves a new one.
 * Any other failure is thrown, so the caller can keep the user in the session.
 */
export async function saveOrUpdateSession(session: Session): Promise<SavedSessionItem> {
    const snapshot = toSnapshot(session);
    if (session.savedId) {
        try {
            return await practiceApi.updateSession(session.savedId, snapshot);
        } catch (error) {
            if (getApiErrorCode(error) !== 'not_found') throw error;
        }
    }
    return practiceApi.createSession(snapshot);
}

/**
 * A downloaded row as a running session, or `null` when the snapshot is not usable.
 * The row is the caller's own (the server filters by owner), so the session takes the
 * current user's id. It stays linked to the row (`savedId`): saving again updates it.
 */
export function fromSavedSession(saved: SavedSessionFull, userId: string): Session | null {
    if (!isSession(saved.snapshot)) return null;
    return { ...saved.snapshot, userId, savedId: saved.id, returnToResults: false };
}
