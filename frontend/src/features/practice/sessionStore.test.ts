import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeExercise } from '@/test/msw/practiceHandlers';
import { useAuthStore } from '@/stores/authStore';
import { defaultParams } from './params';
import { usePracticeSessionStore, useSessionFor } from './sessionStore';
import { renderHook } from '@testing-library/react';

const STORAGE_KEY = 'ladu.practice.session';
const input = () => ({
    userId: 'u1',
    params: defaultParams(['English', 'Spanish']),
    wordIds: null,
    exercises: [makeExercise({ key: 'a' }), makeExercise({ key: 'b', translationId: 't2' })],
});

beforeEach(() => {
    usePracticeSessionStore.getState().clear();
    sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('practice session store', () => {
    it('starts a session and applies reducer actions', () => {
        const { start, dispatch } = usePracticeSessionStore.getState();
        start(input());
        dispatch({ type: 'answer', index: 0, result: 'correct', given: 'casa' });
        dispatch({ type: 'goTo', index: 1 });

        const session = usePracticeSessionStore.getState().session;
        expect(session?.answers[0]).toMatchObject({ result: 'correct', given: 'casa' });
        expect(session?.current).toBe(1);
    });

    it('ignores actions when there is no session', () => {
        usePracticeSessionStore.getState().dispatch({ type: 'goTo', index: 1 });
        expect(usePracticeSessionStore.getState().session).toBeNull();
    });

    it('does not change the state for a no-op action', () => {
        usePracticeSessionStore.getState().start(input());
        const before = usePracticeSessionStore.getState().session;
        usePracticeSessionStore.getState().dispatch({ type: 'goTo', index: 99 });
        expect(usePracticeSessionStore.getState().session).toBe(before);
    });

    it('a new start replaces the running session; clear drops it', () => {
        const { start, clear } = usePracticeSessionStore.getState();
        start(input());
        start({ ...input(), exercises: [makeExercise({ key: 'only' })] });
        expect(usePracticeSessionStore.getState().session?.exercises).toHaveLength(1);
        clear();
        expect(usePracticeSessionStore.getState().session).toBeNull();
    });

    it('writes the session to sessionStorage — this tab only, never localStorage', () => {
        usePracticeSessionStore.getState().start(input());
        const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
        expect(stored.state.session.exercises).toHaveLength(2);
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('restores the same card after a reload', async () => {
        const { start, dispatch } = usePracticeSessionStore.getState();
        start(input());
        dispatch({ type: 'answer', index: 0, result: 'wrong', given: 'x' });
        dispatch({ type: 'goTo', index: 1 });

        // Setting the state writes to storage too, so keep the blob a reload would find.
        const blob = sessionStorage.getItem(STORAGE_KEY) as string;
        usePracticeSessionStore.setState({ session: null });
        sessionStorage.setItem(STORAGE_KEY, blob);
        await usePracticeSessionStore.persist.rehydrate();

        const session = usePracticeSessionStore.getState().session;
        expect(session?.current).toBe(1);
        expect(session?.answers[0]).toMatchObject({ result: 'wrong' });
    });

    it('discards a broken or planted blob instead of crashing', async () => {
        for (const blob of [
            '{not json',
            JSON.stringify({ state: { session: { userId: 'u1' } }, version: 1 }),
            JSON.stringify({ state: { session: { ...input(), answers: [], current: 0, view: 'exercises' } }, version: 1 }),
            JSON.stringify({ state: { session: null }, version: 1 }),
        ]) {
            sessionStorage.setItem(STORAGE_KEY, blob);
            usePracticeSessionStore.setState({ session: null });
            await usePracticeSessionStore.persist.rehydrate();
            expect(usePracticeSessionStore.getState().session).toBeNull();
        }
    });

    it('survives storage that throws', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(() => usePracticeSessionStore.getState().start(input())).not.toThrow();
        expect(usePracticeSessionStore.getState().session).not.toBeNull();
    });
});

describe('useSessionFor', () => {
    it('hands a session only to the account that started it', () => {
        usePracticeSessionStore.getState().start(input());
        expect(renderHook(() => useSessionFor('u1')).result.current).not.toBeNull();
        expect(renderHook(() => useSessionFor('u2')).result.current).toBeNull();
        expect(renderHook(() => useSessionFor(null)).result.current).toBeNull();
        expect(renderHook(() => useSessionFor(undefined)).result.current).toBeNull();
    });
});

describe('logout', () => {
    it('clears the session when the login ends', () => {
        useAuthStore.getState().setSession({ id: 'u1', email: 'a@b.c', name: 'A', username: 'a', languages: ['English', 'Spanish'] }, 'token');
        usePracticeSessionStore.getState().start(input());

        useAuthStore.getState().clearSession();
        expect(usePracticeSessionStore.getState().session).toBeNull();
    });
});
