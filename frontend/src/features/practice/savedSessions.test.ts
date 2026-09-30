import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { makeExercise, makePracticeHandlers, makeSavedSession } from '@/test/msw/practiceHandlers';
import { defaultParams } from './params';
import { fromSavedSession, saveOrUpdateSession, toSnapshot } from './savedSessions';
import { createSession, type Session } from './session';

const running = (savedId: string | null = null): Session =>
    createSession({
        userId: 'u1',
        params: defaultParams(['English', 'Spanish']),
        wordIds: null,
        exercises: [makeExercise({ key: 'a' }), makeExercise({ key: 'b', translationId: 't2' })],
        savedId,
    });

describe('toSnapshot', () => {
    it('leaves the link to the saved copy out', () => {
        const snapshot = toSnapshot(running('ses-1'));
        expect(snapshot).not.toHaveProperty('savedId');
        expect(snapshot.exercises).toHaveLength(2);
    });
});

describe('saveOrUpdateSession', () => {
    it('creates a saved copy for a session that was never saved', async () => {
        const fake = makePracticeHandlers();
        server.use(...fake.handlers);

        const saved = await saveOrUpdateSession(running());

        expect(fake.state.sessionBodies.map((b) => b.method)).toEqual(['POST']);
        expect(fake.state.sessionBodies[0].snapshot).not.toHaveProperty('savedId');
        expect(fake.state.sessions.map((s) => s.id)).toEqual([saved.id]);
    });

    it('updates the saved copy of a session that was saved before', async () => {
        const fake = makePracticeHandlers({ sessions: [makeSavedSession({ id: 'ses-9' })] });
        server.use(...fake.handlers);

        await saveOrUpdateSession(running('ses-9'));

        expect(fake.state.sessionBodies).toMatchObject([{ method: 'PUT', id: 'ses-9' }]);
        expect(fake.state.sessions).toHaveLength(1);
    });

    it('saves a new copy when the server says the old one is gone', async () => {
        const fake = makePracticeHandlers();
        server.use(...fake.handlers);

        await saveOrUpdateSession(running('ses-gone'));

        expect(fake.state.sessionBodies.map((b) => b.method)).toEqual(['PUT', 'POST']);
        expect(fake.state.sessions).toHaveLength(1);
    });

    it('throws any other failure, and does not save a second copy', async () => {
        const fake = makePracticeHandlers({ sessions: [makeSavedSession({ id: 'ses-9' })] });
        fake.state.failNextSessionSaves = 1;
        server.use(...fake.handlers);

        await expect(saveOrUpdateSession(running('ses-9'))).rejects.toBeTruthy();

        expect(fake.state.sessionBodies).toEqual([]);
        expect(fake.state.sessions).toHaveLength(1);
    });
});

describe('fromSavedSession', () => {
    it('makes a running session linked to its saved copy, for the current user', () => {
        const saved = makeSavedSession({ id: 'ses-3' });
        const session = fromSavedSession(saved, 'u-now');
        expect(session).toMatchObject({ userId: 'u-now', savedId: 'ses-3', view: 'exercises', returnToResults: false });
        expect(session?.exercises).toHaveLength(2);
    });

    it('returns null for a snapshot that is not a session', () => {
        expect(fromSavedSession(makeSavedSession({ snapshot: { exercises: 'x' } }), 'u1')).toBeNull();
        expect(fromSavedSession(makeSavedSession({ snapshot: null }), 'u1')).toBeNull();
    });
});
