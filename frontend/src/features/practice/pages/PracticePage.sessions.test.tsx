import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeWordHandlers } from '@/test/msw/wordHandlers';
import { makeConfig, makeExercise, makePracticeHandlers, makeSavedSession } from '@/test/msw/practiceHandlers';
import { futureToken } from '@/test/tokens';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { PartOfSpeech, Lang } from '@/ts/enums';
import type { SeedWord } from '@/test/msw/wordHandlers';
import { usePracticeSessionStore } from '../sessionStore';
import type { Exercise } from '../types';

const SESSION = {
    id: 'u1',
    name: 'Kai Rebane',
    email: 'kai@example.com',
    username: 'kai',
    languages: ['English', 'Spanish'],
    uiLanguage: 'English',
    nativeLanguage: null,
    verified: true,
    token: futureToken(),
};

const noun: SeedWord = {
    id: 'w1',
    user: 'u1',
    partOfSpeech: PartOfSpeech.noun,
    translations: [{ language: Lang.EN, cases: [{ caseName: 'singularEN', word: 'house' }] }],
};

function setUp(options: Parameters<typeof makePracticeHandlers>[0] = {}) {
    server.use(...makeWordHandlers({ callerId: 'u1', seed: [noun] }).handlers);
    const fake = makePracticeHandlers(options);
    server.use(...fake.handlers);
    return fake;
}

const twoExercises = (): Exercise[] => [makeExercise({ key: 'a' }), makeExercise({ key: 'b', translationId: 'tr-2' })];

/** A session that runs in this tab, as if the user had started it. */
function startLocal(savedId: string | null = null, exercises = twoExercises()) {
    usePracticeSessionStore.getState().start({
        userId: 'u1',
        params: makeConfig().params,
        wordIds: null,
        exercises,
        savedId,
    });
}

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
});

afterEach(() => {
    useAuthStore.getState().clearSession();
    usePracticeSessionStore.getState().clear();
    useUiStore.getState().setPracticePreselection(null);
});

const renderPractice = () => renderApp({ initialEntry: '/practice', session: SESSION });

async function openLeaveDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Leave session' }));
    return screen.findByRole('dialog');
}

describe('Leave dialog', () => {
    it('has three ways out: save and leave, leave and delete, keep practicing', async () => {
        setUp();
        startLocal();
        const user = userEvent.setup();
        await renderPractice();

        const dialog = await openLeaveDialog(user);

        expect(within(dialog).getByRole('button', { name: 'Save session and leave' })).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Leave session and delete' })).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Keep practicing' })).toBeInTheDocument();
        expect(within(dialog).getByText(/up to 10 saved sessions for 7 days/)).toBeInTheDocument();
    });

    it('saves a new session and leaves', async () => {
        const fake = setUp();
        startLocal();
        const user = userEvent.setup();
        await renderPractice();

        await user.type(await screen.findByLabelText('Your answer'), 'casa{Enter}');
        await user.click(await screen.findByRole('button', { name: 'Next' }));
        const dialog = await openLeaveDialog(user);
        await user.click(within(dialog).getByRole('button', { name: 'Save session and leave' }));

        await waitFor(() => expect(usePracticeSessionStore.getState().session).toBeNull());
        expect(fake.state.sessionBodies).toHaveLength(1);
        const { method, snapshot } = fake.state.sessionBodies[0];
        expect(method).toBe('POST');
        expect(snapshot).not.toHaveProperty('savedId');
        expect(snapshot.current).toBe(1);
        expect(snapshot.answers[0]).toMatchObject({ result: 'correct', given: 'casa' });
        expect(await screen.findByText('Session saved. You can resume it from the set-up screen.')).toBeInTheDocument();
        // The set-up shows the new row (in the sessions tab).
        expect(await screen.findByRole('button', { name: 'Resume session with 1 of 2 answered' })).toBeInTheDocument();
    });

    it('updates the saved copy of a resumed session instead of adding one', async () => {
        const fake = setUp({ sessions: [makeSavedSession({ id: 'ses-1' })] });
        startLocal('ses-1');
        const user = userEvent.setup();
        await renderPractice();

        const dialog = await openLeaveDialog(user);
        await user.click(within(dialog).getByRole('button', { name: 'Save session and leave' }));

        await waitFor(() => expect(usePracticeSessionStore.getState().session).toBeNull());
        expect(fake.state.sessionBodies).toMatchObject([{ method: 'PUT', id: 'ses-1' }]);
        expect(fake.state.sessions).toHaveLength(1);
    });

    it('saves a new copy when the old one is gone', async () => {
        const fake = setUp();
        startLocal('ses-gone');
        const user = userEvent.setup();
        await renderPractice();

        const dialog = await openLeaveDialog(user);
        await user.click(within(dialog).getByRole('button', { name: 'Save session and leave' }));

        await waitFor(() => expect(usePracticeSessionStore.getState().session).toBeNull());
        expect(fake.state.sessionBodies.map((b) => b.method)).toEqual(['PUT', 'POST']);
        expect(fake.state.sessions).toHaveLength(1);
    });

    it('keeps the user in the session when the save fails, and lets them try again', async () => {
        const fake = setUp();
        fake.state.failNextSessionSaves = 1;
        startLocal();
        const user = userEvent.setup();
        await renderPractice();

        const dialog = await openLeaveDialog(user);
        await user.click(within(dialog).getByRole('button', { name: 'Save session and leave' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Something went wrong');
        expect(usePracticeSessionStore.getState().session).not.toBeNull();
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save session and leave' }));
        await waitFor(() => expect(usePracticeSessionStore.getState().session).toBeNull());
        expect(fake.state.sessions).toHaveLength(1);
    });

    it('leaves and deletes: nothing is saved, and the session is gone', async () => {
        const fake = setUp();
        startLocal();
        const user = userEvent.setup();
        await renderPractice();

        const dialog = await openLeaveDialog(user);
        await user.click(within(dialog).getByRole('button', { name: 'Leave session and delete' }));

        await waitFor(() => expect(usePracticeSessionStore.getState().session).toBeNull());
        expect(fake.state.sessionBodies).toEqual([]);
        expect(fake.state.deletedSessionIds).toEqual([]);
    });

    it('leaves and deletes the saved copy of a resumed session too', async () => {
        const fake = setUp({ sessions: [makeSavedSession({ id: 'ses-1' })] });
        startLocal('ses-1');
        const user = userEvent.setup();
        await renderPractice();

        const dialog = await openLeaveDialog(user);
        await user.click(within(dialog).getByRole('button', { name: 'Leave session and delete' }));

        await waitFor(() => expect(fake.state.deletedSessionIds).toEqual(['ses-1']));
        expect(usePracticeSessionStore.getState().session).toBeNull();
        await waitFor(() => expect(fake.state.sessions).toEqual([]));
    });

    it('still leaves when deleting the saved copy fails', async () => {
        setUp({ sessions: [] });
        startLocal('ses-gone');
        const user = userEvent.setup();
        await renderPractice();

        const dialog = await openLeaveDialog(user);
        await user.click(within(dialog).getByRole('button', { name: 'Leave session and delete' }));

        await waitFor(() => expect(usePracticeSessionStore.getState().session).toBeNull());
    });

    it('keeps everything when the user chooses to keep practicing', async () => {
        const fake = setUp();
        startLocal();
        const user = userEvent.setup();
        await renderPractice();

        const dialog = await openLeaveDialog(user);
        await user.click(within(dialog).getByRole('button', { name: 'Keep practicing' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(usePracticeSessionStore.getState().session).not.toBeNull();
        expect(fake.state.sessionBodies).toEqual([]);
    });
});

describe('finishing a resumed session', () => {
    it('deletes the saved copy and unlinks the session', async () => {
        const fake = setUp({ sessions: [makeSavedSession({ id: 'ses-1' })] });
        startLocal('ses-1', [makeExercise({ key: 'only' })]);
        const user = userEvent.setup();
        await renderPractice();

        await user.type(await screen.findByLabelText('Your answer'), 'casa{Enter}');
        await user.click(await screen.findByRole('button', { name: 'See results' }));

        await waitFor(() => expect(fake.state.deletedSessionIds).toEqual(['ses-1']));
        expect(usePracticeSessionStore.getState().session).toMatchObject({ view: 'results', savedId: null });
    });

    it('does not call the server for a session that was never saved', async () => {
        const fake = setUp();
        startLocal(null, [makeExercise({ key: 'only' })]);
        const user = userEvent.setup();
        await renderPractice();

        await user.type(await screen.findByLabelText('Your answer'), 'casa{Enter}');
        await user.click(await screen.findByRole('button', { name: 'See results' }));

        await waitFor(() => expect(usePracticeSessionStore.getState().session?.view).toBe('results'));
        expect(fake.state.deletedSessionIds).toEqual([]);
    });
});

describe('Saved sessions list', () => {
    it('says so when there are none, and states the limit and the expiry', async () => {
        setUp();
        await renderPractice();

        expect(await screen.findByText(/You have no saved sessions/)).toBeInTheDocument();
        expect(screen.getByText('You can keep up to 10 sessions for 7 days. A new session replaces the oldest one.')).toBeInTheDocument();
    });

    it('shows each session with the same three facts as the resume banner, and the expiry date', async () => {
        const answered = makeSavedSession({ id: 'a' });
        answered.summary = { ...answered.summary, answered: 1, correct: 1 };
        setUp({ sessions: [answered, makeSavedSession({ id: 'b' })] });
        await renderPractice();

        const first = await screen.findByRole('button', { name: 'Resume session with 1 of 2 answered' });
        expect(within(first).getByText('1 of 2')).toBeInTheDocument();
        expect(within(first).getByText('exercises')).toBeInTheDocument();
        expect(within(first).getByText('1 correct so far')).toBeInTheDocument();
        expect(within(first).getByTestId('card-type-grid')).toBeInTheDocument();
        expect(within(first).getByTestId('flag-grid')).toBeInTheDocument();
        expect(within(first).getByText('languages')).toBeInTheDocument();
        expect(within(first).getByText('type of words')).toBeInTheDocument();
        expect(within(first).getByText(/^Expires on .*2026/)).toBeInTheDocument();

        const second = screen.getByRole('button', { name: 'Resume session with 0 of 2 answered' });
        expect(within(second).getByText('0 of 2')).toBeInTheDocument();
        expect(within(second).queryByText(/correct so far/)).not.toBeInTheDocument();
    });

    it('marks a session row as clickable: pointer cursor and a highlight on hover', async () => {
        setUp({ sessions: [makeSavedSession()] });
        await renderPractice();

        const row = await screen.findByRole('button', { name: 'Resume session with 0 of 2 answered' });
        expect(row).toHaveClass('cursor-pointer');
        expect(row.className).toMatch(/hover:bg-\(--accent-soft\)/);
    });

    it('resumes a saved session where it was left, linked to its saved copy', async () => {
        const saved = makeSavedSession({ id: 'ses-1' });
        saved.snapshot = { ...(saved.snapshot as object), current: 1 };
        const fake = setUp({ sessions: [saved] });
        const user = userEvent.setup();
        await renderPractice();

        await user.click(await screen.findByRole('button', { name: 'Resume session with 0 of 2 answered' }));

        expect(await screen.findByText('Exercise 2 of 2')).toBeInTheDocument();
        expect(usePracticeSessionStore.getState().session).toMatchObject({ userId: 'u1', savedId: 'ses-1', current: 1 });
        // The saved copy stays until the user finishes or deletes the session.
        expect(fake.state.sessions).toHaveLength(1);
        expect(fake.state.deletedSessionIds).toEqual([]);
    });

    it('says so when the session is gone, and refreshes the list', async () => {
        const fake = setUp({ sessions: [makeSavedSession({ id: 'ses-1' })] });
        const user = userEvent.setup();
        await renderPractice();
        const row = await screen.findByRole('button', { name: 'Resume session with 0 of 2 answered' });
        // Expired on the server after the list was loaded.
        fake.state.sessions = [];

        await user.click(row);

        expect(await screen.findByText('This session is not available now. It may have expired.')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText(/You have no saved sessions/)).toBeInTheDocument());
        expect(usePracticeSessionStore.getState().session).toBeNull();
    });

    it('says so when the session cannot be downloaded, and changes nothing', async () => {
        const fake = setUp({ sessions: [makeSavedSession({ id: 'ses-1' })] });
        fake.state.failNextSessionRead = true;
        const user = userEvent.setup();
        await renderPractice();

        await user.click(await screen.findByRole('button', { name: 'Resume session with 0 of 2 answered' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
        expect(usePracticeSessionStore.getState().session).toBeNull();
    });

    it('does not open a snapshot that is not a session', async () => {
        setUp({ sessions: [makeSavedSession({ id: 'ses-1', snapshot: { exercises: 'x' } })] });
        const user = userEvent.setup();
        await renderPractice();

        await user.click(await screen.findByRole('button', { name: 'Resume session with 0 of 2 answered' }));

        expect(await screen.findByText('This session is not available now. It may have expired.')).toBeInTheDocument();
        expect(usePracticeSessionStore.getState().session).toBeNull();
    });

    it('asks before replacing an unfinished session in this tab', async () => {
        setUp({ sessions: [makeSavedSession({ id: 'ses-1' })] });
        startLocal();
        usePracticeSessionStore.getState().park();
        const user = userEvent.setup();
        await renderPractice();

        await user.click(await screen.findByRole('button', { name: 'Resume session with 0 of 2 answered' }));
        expect(await screen.findByText('Replace your unfinished session?')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Keep' }));
        expect(usePracticeSessionStore.getState().session?.savedId).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Resume session with 0 of 2 answered' }));
        await user.click(await screen.findByRole('button', { name: 'Resume saved session' }));

        await waitFor(() => expect(usePracticeSessionStore.getState().session?.savedId).toBe('ses-1'));
        expect(usePracticeSessionStore.getState().parked).toBe(false);
    });

    it('drops words from Review when a saved session is resumed', async () => {
        setUp({ sessions: [makeSavedSession({ id: 'ses-1' })] });
        useUiStore
            .getState()
            .setPracticePreselection([{ id: 'w1', partOfSpeech: PartOfSpeech.noun, label: 'house', languages: ['EN'] }]);
        const user = userEvent.setup();
        await renderPractice();

        // With words from Review the page opens on New configuration; the sessions are one tab away.
        await user.click(await screen.findByRole('button', { name: 'Back to Practice' }));
        await user.click(await screen.findByRole('button', { name: 'Resume session with 0 of 2 answered' }));

        expect(await screen.findByText('Exercise 1 of 2')).toBeInTheDocument();
    });

    it('asks first, then deletes a saved session', async () => {
        const fake = setUp({ sessions: [makeSavedSession({ id: 'a' }), makeSavedSession({ id: 'b' })] });
        const user = userEvent.setup();
        await renderPractice();

        const buttons = await screen.findAllByRole('button', { name: 'Delete session with 0 of 2 answered' });
        await user.click(buttons[0]);
        expect(await screen.findByText('Delete this saved session?')).toBeInTheDocument();
        expect(fake.state.deletedSessionIds).toEqual([]);
        await user.click(screen.getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(fake.state.deletedSessionIds).toEqual(['a']));
        await waitFor(() =>
            expect(screen.getAllByRole('button', { name: 'Resume session with 0 of 2 answered' })).toHaveLength(1),
        );
    });

    it('keeps the session when the user cancels the delete', async () => {
        const fake = setUp({ sessions: [makeSavedSession()] });
        const user = userEvent.setup();
        await renderPractice();

        await user.click(await screen.findByRole('button', { name: 'Delete session with 0 of 2 answered' }));
        await user.click(await screen.findByRole('button', { name: 'Cancel' }));

        expect(fake.state.deletedSessionIds).toEqual([]);
    });
});

describe('the resume banner', () => {
    it('"Dismiss" on a saved session drops the local copy and leaves the saved copy in the list', async () => {
        const fake = setUp({ sessions: [makeSavedSession({ id: 'ses-1' })] });
        startLocal('ses-1');
        usePracticeSessionStore.getState().park();
        const user = userEvent.setup();
        await renderPractice();

        await user.click(await screen.findByRole('button', { name: 'Dismiss' }));

        expect(usePracticeSessionStore.getState().session).toBeNull();
        expect(fake.state.deletedSessionIds).toEqual([]);
        expect(await screen.findByRole('button', { name: 'Resume session with 0 of 2 answered' })).toBeInTheDocument();
    });
});
