/**
 * Demo access in the learner app (demo-access.md, Slice 1): the `/demo` start screen (D12, D14),
 * the language choice (D16, Slice 3), the start itself, the error messages, and `/demo/ended` (D13).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeAccessHandlers } from '@/test/msw/accessHandlers';
import { makeMetricsHandlers } from '@/test/msw/metricsHandlers';
import { futureToken } from '@/test/tokens';
import demo from '../../../public/locales/en/demo.json';
import { OPEN_ACCESS } from '@/features/access/types';
import { useAuthStore } from '@/stores/authStore';
import { demoMsLeft, isLiveDemo } from './session';
import { DEMO_TRANSITION_LINES, demoTransitionTiming, pickDemoTransitionLines } from './transition';

// The transition screen (D18) is short in tests; one block below sets its own timing.
const realTiming = { ...demoTransitionTiming };
beforeEach(() => Object.assign(demoTransitionTiming, { lineMs: 10, fadeMs: 10 }));
afterEach(() => Object.assign(demoTransitionTiming, realTiming));

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

/** Step 1 of the start screen → step 2 (the languages). */
const getStarted = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'Get started' }));
};

/** Picks languages on step 2 of the start screen by their tile names ("English", "Deutsch"…), in this order. */
const pickLanguages = async (user: ReturnType<typeof userEvent.setup>, ...names: string[]) => {
    for (const name of names) await user.click(await screen.findByRole('button', { name }));
};

const normalSession = { id: 'u1', name: 'Ada', email: 'ada@example.com', username: 'ada', languages: ['English', 'Spanish'], token: futureToken() };

describe('/demo — the demo is off', () => {
    it('says so and points to sign-up, with no start button', async () => {
        await renderApp({ initialEntry: '/demo' }); // the base handlers answer: demo off
        expect(await screen.findByRole('heading', { name: 'The demo is off' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
        expect(screen.queryByRole('button', { name: 'Get started' })).not.toBeInTheDocument();
    });

    it('acts as off when the status call fails', async () => {
        server.use(http.get('*/api/access', () => HttpResponse.json({ message: 'Boom' }, { status: 500 })));
        await renderApp({ initialEntry: '/demo' });
        expect(await screen.findByRole('heading', { name: 'The demo is off' })).toBeInTheDocument();
    });
});

describe('/demo — the start screen', () => {
    it('step 1 describes the demo; "Get started" opens step 2 with the languages, Start and the Terms note', async () => {
        demoOn();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/demo' });
        expect(await screen.findByRole('heading', { name: 'Try the demo' })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Get started' })).toBeEnabled());
        expect(screen.queryByRole('button', { name: 'English' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
        expect(screen.queryByText(/logs you out/)).not.toBeInTheDocument();

        await getStarted(user);
        expect(screen.getByRole('heading', { name: 'Which languages do you use?' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Try the demo' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
        expect(screen.getByText(/By starting the demo/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Terms' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument();
    });

    it('the arrow before the step-2 title goes back to step 1 and keeps the picks', async () => {
        demoOn();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/demo' });
        await getStarted(user);
        await pickLanguages(user, 'English', 'Español');

        await user.click(screen.getByRole('button', { name: 'Back' }));
        expect(screen.getByRole('heading', { name: 'Try the demo' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();

        await getStarted(user);
        expect(screen.getByText('2 languages selected')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
    });

    it('enables Start only with 2 or more languages picked (D16)', async () => {
        demoOn();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/demo' });

        await getStarted(user);
        const startButton = await screen.findByRole('button', { name: 'Start' });
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

        await getStarted(user);
        await pickLanguages(user, 'Eesti', 'English');
        expect(bodies).toEqual([]);
        await user.click(screen.getByRole('button', { name: 'Start' }));

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
        await getStarted(user);
        await pickLanguages(user, 'English', 'Español');
        await user.click(await screen.findByRole('button', { name: 'Log out and start' }));

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
        expect(await screen.findByRole('button', { name: 'Get started' })).toBeInTheDocument();
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

        await getStarted(user);
        await pickLanguages(user, 'English', 'Español');
        await user.click(await screen.findByRole('button', { name: 'Start' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(message);
        expect(router.state.location.pathname).toBe('/demo');
        expect(useAuthStore.getState().user).toBeNull();
    });
});

describe('/demo — the transition screen (D18)', () => {
    const ENGLISH_LINES = Object.values(demo.transition.lines);
    const shownLine = () => screen.getByRole('status', { name: 'Starting the demo' }).querySelector('p')?.textContent ?? '';

    it('covers the start with the logo, the loading bar and the lines, opens the dashboard after the last line, then fades out', async () => {
        Object.assign(demoTransitionTiming, { lineMs: 150, fadeMs: 50 });
        demoOn();
        startHandler(); // answers at once: the screen still shows every line
        server.use(...makeMetricsHandlers().handlers);
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/demo' });

        await getStarted(user);
        await pickLanguages(user, 'English', 'Español');
        await user.click(screen.getByRole('button', { name: 'Start' }));

        const layer = await screen.findByRole('status', { name: 'Starting the demo' });
        expect(layer.querySelector('img')).toHaveAttribute('src', '/brand/Ladu_inside_bubble_outline.svg');
        // The loading bar is above the line.
        const bar = within(layer).getByRole('progressbar', { name: 'Demo start progress' });
        expect(bar.compareDocumentPosition(layer.querySelector('p')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        const seen = new Set([shownLine()]);
        expect(ENGLISH_LINES).toContain(shownLine());
        expect(router.state.location.pathname).toBe('/demo');

        await waitFor(() => expect(router.state.location.pathname).toBe('/'), { timeout: 2000 });
        seen.add(shownLine());
        expect(seen.size).toBeGreaterThan(1); // the line changed before the dashboard opened
        expect(layer).toHaveAttribute('data-phase', 'leaving');
        await waitFor(() => expect(screen.queryByRole('status', { name: 'Starting the demo' })).not.toBeInTheDocument());
    });

    it('waits for a slow server after the last line', async () => {
        demoOn();
        let answer: () => void = () => {};
        const answered = new Promise<void>((resolve) => (answer = resolve));
        server.use(
            http.post('*/api/demo', async () => {
                await answered;
                return HttpResponse.json(demoAnswer(), { status: 201 });
            }),
        );
        server.use(...makeMetricsHandlers().handlers);
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/demo' });

        await getStarted(user);
        await pickLanguages(user, 'English', 'Español');
        await user.click(screen.getByRole('button', { name: 'Start' }));
        await screen.findByRole('status', { name: 'Starting the demo' });
        await new Promise((resolve) => setTimeout(resolve, 100)); // every line is shown by now
        expect(router.state.location.pathname).toBe('/demo');
        expect(screen.getByRole('status', { name: 'Starting the demo' })).toHaveAttribute('data-phase', 'showing');

        answer();
        await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    });

    it('closes at once on a refusal, and /demo shows the message', async () => {
        Object.assign(demoTransitionTiming, { lineMs: 5000 });
        demoOn();
        startHandler(() => HttpResponse.json({ message: 'refused', code: 'demo_busy' }, { status: 503 }));
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/demo' });

        await getStarted(user);
        await pickLanguages(user, 'English', 'Español');
        await user.click(screen.getByRole('button', { name: 'Start' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Too many demos are running.');
        expect(screen.queryByRole('status', { name: 'Starting the demo' })).not.toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/demo');
    });

    it('pickDemoTransitionLines: different keys from the pool, in a random order', () => {
        for (let run = 0; run < 20; run++) {
            const picked = pickDemoTransitionLines(3);
            expect(picked).toHaveLength(3);
            expect(new Set(picked).size).toBe(3);
            for (const key of picked) expect(DEMO_TRANSITION_LINES).toContain(key);
        }
        expect(pickDemoTransitionLines(3, () => 0)).not.toEqual(pickDemoTransitionLines(3, () => 0.99));
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
