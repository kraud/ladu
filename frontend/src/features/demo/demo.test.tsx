/**
 * Demo access in the learner app (demo-access.md, Slice 1): the `/demo` start screen (D12, D14),
 * the language choice (D16, Slice 3), the start itself, the error messages, and `/demo/ended` (D13).
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeAccessHandlers } from '@/test/msw/accessHandlers';
import { makeMetricsHandlers } from '@/test/msw/metricsHandlers';
import { futureToken } from '@/test/tokens';
import { OPEN_ACCESS } from '@/features/access/types';
import { useAuthStore } from '@/stores/authStore';
import { demoMsLeft, isLiveDemo } from './session';

const demoOn = () => server.use(...makeAccessHandlers({ ...OPEN_ACCESS, demo: { enabled: true } }));
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const demoAnswer = () => ({
    id: 'demo-1',
    name: 'Demo',
    email: 'demo+1@ladu.invalid',
    username: 'demo-1',
    languages: ['English', 'Spanish', 'German', 'Estonian'],
    uiLanguage: 'English',
    nativeLanguage: 'English',
    theme: null,
    verified: true,
    isDemo: true,
    demoExpiresAt: inMinutes(15),
    demoWordLimit: 35,
    demoTagLimit: 7,
    token: futureToken(),
});

/** Records each `POST /api/demo` body and answers with `answer`. */
const startHandler = (answer: () => Response = () => HttpResponse.json(demoAnswer(), { status: 201 })) => {
    const bodies: unknown[] = [];
    server.use(
        http.post('*/api/demo', async ({ request }) => {
            bodies.push(await request.json());
            return answer();
        }),
    );
    return bodies;
};

/** Picks languages on the start screen by their tile names ("English", "Deutsch"…), in this order. */
const pickLanguages = async (user: ReturnType<typeof userEvent.setup>, ...names: string[]) => {
    for (const name of names) await user.click(await screen.findByRole('button', { name }));
};

const normalSession = { id: 'u1', name: 'Ada', email: 'ada@example.com', username: 'ada', languages: ['English', 'Spanish'], token: futureToken() };

describe('/demo — the demo is off', () => {
    it('says so and points to sign-up, with no start button', async () => {
        await renderApp({ initialEntry: '/demo' }); // the base handlers answer: demo off
        expect(await screen.findByRole('heading', { name: 'The demo is off' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
        expect(screen.queryByRole('button', { name: /start the demo/i })).not.toBeInTheDocument();
    });

    it('acts as off when the status call fails', async () => {
        server.use(http.get('*/api/access', () => HttpResponse.json({ message: 'Boom' }, { status: 500 })));
        await renderApp({ initialEntry: '/demo' });
        expect(await screen.findByRole('heading', { name: 'The demo is off' })).toBeInTheDocument();
    });
});

describe('/demo — the start screen', () => {
    it('shows the start button and the Terms note with both links', async () => {
        demoOn();
        await renderApp({ initialEntry: '/demo' });
        expect(await screen.findByRole('button', { name: 'Start the demo' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Try the demo' })).toBeInTheDocument();
        expect(screen.getByText(/By starting the demo/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Terms' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument();
        expect(screen.queryByText(/logs you out/)).not.toBeInTheDocument();
    });

    it('enables Start only with 2 or more languages picked (D16)', async () => {
        demoOn();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/demo' });

        const startButton = await screen.findByRole('button', { name: 'Start the demo' });
        await waitFor(() => expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument());
        expect(startButton).toBeDisabled();
        expect(screen.getByText('Select at least two languages')).toBeInTheDocument();

        await pickLanguages(user, 'Deutsch');
        expect(startButton).toBeDisabled();
        expect(screen.getByText('1 language selected')).toBeInTheDocument();

        await pickLanguages(user, 'English');
        expect(startButton).toBeEnabled();
        expect(screen.getByText('2 languages selected')).toBeInTheDocument();

        await pickLanguages(user, 'English'); // a second click removes it
        expect(startButton).toBeDisabled();
    });

    it('starts the demo on the click only: sends the UI language as a label and the picks in order, opens the session and the dashboard', async () => {
        demoOn();
        const bodies = startHandler();
        server.use(...makeMetricsHandlers().handlers);
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/demo' });

        await pickLanguages(user, 'Eesti', 'English');
        expect(bodies).toEqual([]);
        await user.click(screen.getByRole('button', { name: 'Start the demo' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/'));
        expect(bodies).toEqual([{ uiLanguage: 'English', languages: ['Estonian', 'English'] }]);
        expect(useAuthStore.getState().user).toMatchObject({ id: 'demo-1', isDemo: true, demoWordLimit: 35, demoTagLimit: 7 });
        expect(useAuthStore.getState().token).toEqual(expect.any(String));
    });

    it('warns a signed-in user that the demo logs them out, and replaces the session', async () => {
        demoOn();
        startHandler();
        server.use(...makeMetricsHandlers().handlers);
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/demo', session: normalSession });

        expect(await screen.findByText('You are logged in. Starting the demo logs you out of your account.')).toBeInTheDocument();
        await pickLanguages(user, 'English', 'Español');
        await user.click(await screen.findByRole('button', { name: 'Log out and start the demo' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/'));
        expect(useAuthStore.getState().user).toMatchObject({ id: 'demo-1', isDemo: true });
    });

    it('opens the app at once for a demo that is still running', async () => {
        demoOn();
        server.use(...makeMetricsHandlers().handlers);
        const { router } = await renderApp({ initialEntry: '/demo', session: { ...demoAnswer(), demoExpiresAt: inMinutes(5) } });
        await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    });

    it('shows the start screen, with no log-out warning, for a demo that has ended', async () => {
        demoOn();
        await renderApp({ initialEntry: '/demo', session: { ...demoAnswer(), demoExpiresAt: inMinutes(-1) } });
        expect(await screen.findByRole('button', { name: 'Start the demo' })).toBeInTheDocument();
        expect(screen.queryByText(/logs you out/)).not.toBeInTheDocument();
    });

    it.each([
        ['demo_busy', 503, 'Too many demos are running. Try again in a few minutes.'],
        ['demo_rate_limited', 429, 'Too many demos were started from your network. Try again later.'],
        ['demo_disabled', 403, 'The demo is off now.'],
        ['demo_invalid_languages', 400, 'Select at least two languages.'],
        ['something_else', 500, 'The demo could not start. Try again.'],
    ])('shows the message for %s and stays on the page', async (code, status, message) => {
        demoOn();
        startHandler(() => HttpResponse.json({ message: 'refused', code }, { status }));
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/demo' });

        await pickLanguages(user, 'English', 'Español');
        await user.click(await screen.findByRole('button', { name: 'Start the demo' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(message);
        expect(router.state.location.pathname).toBe('/demo');
        expect(useAuthStore.getState().user).toBeNull();
    });
});

describe('/demo/ended', () => {
    it('says the demo has ended and offers sign-up and a new demo, not the login page', async () => {
        await renderApp({ initialEntry: '/demo/ended' });
        expect(await screen.findByRole('heading', { name: 'The demo has ended' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
        expect(screen.getByRole('link', { name: 'Start a new demo' })).toHaveAttribute('href', '/demo');
    });
});

describe('demo session helpers', () => {
    const base = { id: 'd', name: 'Demo', email: 'd@x', username: 'd', languages: [], uiLanguage: 'English', nativeLanguage: null, verified: true };

    it('demoMsLeft: the time left for a demo, null for anything else', () => {
        const now = Date.parse('2026-10-15T12:00:00.000Z');
        expect(demoMsLeft({ ...base, isDemo: true, demoExpiresAt: '2026-10-15T12:10:00.000Z' }, now)).toBe(10 * 60_000);
        expect(demoMsLeft({ ...base, isDemo: true, demoExpiresAt: '2026-10-15T11:59:00.000Z' }, now)).toBe(-60_000);
        expect(demoMsLeft({ ...base, isDemo: true, demoExpiresAt: 'not a date' }, now)).toBeNull();
        expect(demoMsLeft(base, now)).toBeNull();
        expect(demoMsLeft(null, now)).toBeNull();
    });

    it('isLiveDemo: time left and a valid token', () => {
        const live = { ...base, isDemo: true, demoExpiresAt: inMinutes(5) };
        expect(isLiveDemo(live, futureToken())).toBe(true);
        expect(isLiveDemo({ ...live, demoExpiresAt: inMinutes(-1) }, futureToken())).toBe(false);
        expect(isLiveDemo(live, null)).toBe(false);
        expect(isLiveDemo(base, futureToken())).toBe(false);
    });
});
