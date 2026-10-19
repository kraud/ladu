/**
 * The Turnstile captcha in the learner app (captcha.md, Slice 2): the widget on the demo start screen,
 * the register form and the password-reset request, the token in the request, and the new token after
 * a refusal. Cloudflare's script is replaced by a fake `turnstile` API that records each render.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeAccessHandlers } from '@/test/msw/accessHandlers';
import { makeAuthHandlers } from '@/test/msw/authHandlers';
import { OPEN_ACCESS } from '@/features/access/types';
import type { TurnstileApi, TurnstileRenderOptions } from './turnstile';

const fake = vi.hoisted(() => ({
    renders: [] as { id: string; options: TurnstileRenderOptions }[],
    reset: vi.fn(),
    remove: vi.fn(),
}));

vi.mock('./turnstile', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./turnstile')>();
    const api: TurnstileApi = {
        render: (_container, options) => {
            const id = `widget-${fake.renders.length + 1}`;
            fake.renders.push({ id, options });
            return id;
        },
        reset: fake.reset,
        remove: fake.remove,
    };
    return { ...actual, loadTurnstile: () => Promise.resolve(api) };
});

const SITE_KEY = '1x00000000000000000000AA';
const captchaOn = (extra = {}) =>
    server.use(...makeAccessHandlers({ ...OPEN_ACCESS, demo: { enabled: true }, captcha: { enabled: true, siteKey: SITE_KEY }, ...extra }));

/** The newest widget the page drew. */
const lastWidget = async () => {
    await waitFor(() => expect(fake.renders.length).toBeGreaterThan(0));
    return fake.renders[fake.renders.length - 1].options;
};
/** Plays Cloudflare: the visitor passed the check and the widget hands over a token. */
const solve = async (token: string) => {
    const options = await lastWidget();
    act(() => options.callback(token));
};

beforeEach(() => {
    server.use(...makeAuthHandlers().handlers);
    fake.renders.length = 0;
    fake.reset.mockClear();
    fake.remove.mockClear();
});

describe('the captcha is off', () => {
    it('draws no widget on the demo start screen, and Start needs only the languages', async () => {
        server.use(...makeAccessHandlers({ ...OPEN_ACCESS, demo: { enabled: true } }));
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/demo' });
        await user.click(await screen.findByRole('button', { name: 'Get started' }));
        await user.click(await screen.findByRole('button', { name: 'English' }));
        await user.click(screen.getByRole('button', { name: 'Español' }));

        expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
        expect(screen.queryByTestId('captcha-widget')).not.toBeInTheDocument();
        expect(fake.renders).toHaveLength(0);
    });
});

describe('/demo with the captcha on', () => {
    const toStep2 = async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(await screen.findByRole('button', { name: 'Get started' }));
        await user.click(await screen.findByRole('button', { name: 'English' }));
        await user.click(screen.getByRole('button', { name: 'Español' }));
    };

    it('draws the widget for the "demo" action, and Start waits for a token', async () => {
        captchaOn();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/demo' });
        await toStep2(user);

        const options = await lastWidget();
        expect(options.sitekey).toBe(SITE_KEY);
        expect(options.action).toBe('demo');
        expect(options.language).toBe('en');
        expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();

        await solve('token-1');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled());

        // The token ends (it expired): Start waits again.
        act(() => options['expired-callback']());
        await waitFor(() => expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled());
    });

    it('sends the token, and after a refusal shows the message, asks for a new token and waits for it', async () => {
        captchaOn();
        const bodies: unknown[] = [];
        server.use(
            http.post('*/api/demo', async ({ request }) => {
                bodies.push(await request.json());
                return HttpResponse.json({ message: 'The captcha check failed', code: 'captcha_failed' }, { status: 400 });
            }),
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/demo' });
        await toStep2(user);
        await solve('token-1');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled());

        await user.click(screen.getByRole('button', { name: 'Start' }));

        expect(await screen.findByText('The human check failed. Try again.')).toBeInTheDocument();
        expect(bodies).toHaveLength(1);
        expect(bodies[0]).toMatchObject({ languages: ['English', 'Spanish'], captchaToken: 'token-1' });
        await waitFor(() => expect(fake.reset).toHaveBeenCalledWith(fake.renders[0].id));
        expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
    });

    it('says so when Cloudflare is down (503 captcha_unavailable)', async () => {
        captchaOn();
        server.use(
            http.post('*/api/demo', () =>
                HttpResponse.json({ message: 'The captcha check is not available right now', code: 'captcha_unavailable' }, { status: 503 }),
            ),
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/demo' });
        await toStep2(user);
        await solve('token-1');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled());
        await user.click(screen.getByRole('button', { name: 'Start' }));

        expect(await screen.findByText('The human check is not available now. Try again later.')).toBeInTheDocument();
    });

    it('shows a hint when the script cannot load (an ad blocker), and Start stays off', async () => {
        captchaOn();
        const turnstile = await import('./turnstile');
        vi.spyOn(turnstile, 'loadTurnstile').mockRejectedValueOnce(new Error('blocked'));
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/demo' });
        await toStep2(user);

        expect(await screen.findByText(/could not load/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
    });
});

describe('/register with the captcha on', () => {
    it('draws the widget on step 2 for the "register" action; Create account waits for a token and sends it', async () => {
        captchaOn();
        const bodies: unknown[] = [];
        server.use(
            http.post('*/api/users', async ({ request }) => {
                bodies.push(await request.json());
                return HttpResponse.json({ message: 'The captcha check failed', code: 'captcha_failed' }, { status: 400 });
            }),
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/register' });

        await screen.findByRole('button', { name: 'Continue' });
        expect(fake.renders).toHaveLength(0); // step 1 has no widget
        await user.type(screen.getByLabelText(/^Name/), 'Kai Rebane');
        await user.type(screen.getByLabelText(/^Username/), 'kai');
        await user.type(screen.getByLabelText(/^Email/), 'kai@example.com');
        await user.type(screen.getByLabelText(/^Password/), 'password123');
        await user.type(screen.getByLabelText(/^Confirm password/), 'password123');
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        await user.click(await screen.findByRole('button', { name: 'English', pressed: false }));
        await user.click(screen.getByRole('button', { name: 'Español', pressed: false }));

        expect((await lastWidget()).action).toBe('register');
        expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();

        await solve('token-r');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled());
        await user.click(screen.getByRole('button', { name: 'Create account' }));

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toMatchObject({ email: 'kai@example.com', captchaToken: 'token-r' });
        await waitFor(() => expect(fake.reset).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled());
    });
});

describe('the password-reset request with the captcha on', () => {
    it('draws the widget for the "password_reset" action; the button waits for a token and sends it', async () => {
        captchaOn();
        const bodies: unknown[] = [];
        server.use(
            http.post('*/api/users/requestPasswordReset', async ({ request }) => {
                bodies.push(await request.json());
                return new HttpResponse(null, { status: 200 });
            }),
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/resetPassword' });

        expect((await lastWidget()).action).toBe('password_reset');
        await user.type(await screen.findByLabelText('Email'), 'kai@example.com');
        expect(screen.getByRole('button', { name: 'Send reset link' })).toBeDisabled();

        await solve('token-p');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled());
        await user.click(screen.getByRole('button', { name: 'Send reset link' }));

        await waitFor(() => expect(bodies).toEqual([{ email: 'kai@example.com', captchaToken: 'token-p' }]));
    });
});
