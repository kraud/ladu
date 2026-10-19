/**
 * Request access in the learner app (access-requests.md, Slice 2): the button under the banner on
 * `/login` and `/register`, the `/request` page (checkbox, email, button), the body that it sends,
 * the one "received" message, and the captcha token. Cloudflare's script is replaced by a fake
 * `turnstile` API, like in `captcha.test.tsx`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeAccessHandlers } from '@/test/msw/accessHandlers';
import { makeAuthHandlers } from '@/test/msw/authHandlers';
import { OPEN_ACCESS, type AccessMode, type AccessStatus } from './types';
import type { TurnstileApi, TurnstileRenderOptions } from '@/features/captcha/turnstile';

const fake = vi.hoisted(() => ({
    renders: [] as { id: string; options: TurnstileRenderOptions }[],
    reset: vi.fn(),
    remove: vi.fn(),
}));

vi.mock('@/features/captcha/turnstile', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/features/captcha/turnstile')>();
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

const gates = (registration: AccessMode, login: AccessMode, extra: Partial<AccessStatus> = {}): AccessStatus => ({
    ...OPEN_ACCESS,
    registration: { mode: registration, note: '' },
    login: { mode: login, note: '' },
    ...extra,
});

interface Sent {
    body: Record<string, unknown>;
}

/** Answers `POST /api/access/request` like the server (202), and records each body. */
const requestHandler = (answer: () => Response = () => HttpResponse.json({ received: true }, { status: 202 })) => {
    const sent: Sent[] = [];
    server.use(
        http.post('*/api/access/request', async ({ request }) => {
            sent.push({ body: (await request.json()) as Record<string, unknown> });
            return answer();
        }),
    );
    return sent;
};

const button = () => screen.getByRole('button', { name: 'Request access' });
const type = async (email: string) => userEvent.type(screen.getByLabelText('Email'), email);

beforeEach(() => {
    server.use(...makeAuthHandlers().handlers);
    fake.renders.length = 0;
    fake.reset.mockClear();
});

describe('the button on /login and /register', () => {
    it.each<[string, AccessMode]>([
        ['limited', 'limited'],
        ['closed', 'closed'],
    ])('shows under the register banner when registration is %s', async (_name, mode) => {
        server.use(...makeAccessHandlers(gates(mode, 'open')));
        await renderApp({ initialEntry: '/register' });
        expect(await screen.findByRole('link', { name: 'Request access' })).toHaveAttribute('href', '/request');
    });

    it('is still usable when registration is closed (the form is off, the button is not)', async () => {
        server.use(...makeAccessHandlers(gates('closed', 'open')));
        await renderApp({ initialEntry: '/register' });
        const link = await screen.findByRole('link', { name: 'Request access' });
        expect(screen.getByLabelText(/^Name/)).toBeDisabled();
        expect(link.closest('fieldset')).toBeNull();
    });

    it('shows on /login when login is limited, and opens /request with the box ticked', async () => {
        server.use(...makeAccessHandlers(gates('open', 'limited')));
        await renderApp({ initialEntry: '/login' });
        const link = await screen.findByRole('link', { name: 'Request access' });
        expect(link).toHaveAttribute('href', '/request?account=true');

        await userEvent.click(link);
        expect(await screen.findByRole('checkbox', { name: 'I already have an account' })).toBeChecked();
    });

    it('opens /request with the box empty from /register', async () => {
        server.use(...makeAccessHandlers(gates('limited', 'open')));
        await renderApp({ initialEntry: '/register' });
        await userEvent.click(await screen.findByRole('link', { name: 'Request access' }));
        expect(await screen.findByRole('checkbox', { name: 'I already have an account' })).not.toBeChecked();
    });

    it('shows nothing when the gate is open', async () => {
        server.use(...makeAccessHandlers(gates('open', 'open')));
        await renderApp({ initialEntry: '/login' });
        await screen.findByRole('button', { name: 'Sign in' });
        expect(screen.queryByRole('link', { name: 'Request access' })).not.toBeInTheDocument();

        await renderApp({ initialEntry: '/register' });
        await screen.findByRole('button', { name: 'Continue' });
        expect(screen.queryByRole('link', { name: 'Request access' })).not.toBeInTheDocument();
    });
});

describe('the /request page', () => {
    beforeEach(() => {
        server.use(...makeAccessHandlers(gates('limited', 'limited')));
    });

    it('keeps the button off until the email has a valid format', async () => {
        await renderApp({ initialEntry: '/request' });
        await screen.findByLabelText('Email');
        expect(button()).toBeDisabled();

        await type('not-an-email');
        expect(button()).toBeDisabled();
        expect(await screen.findByText('Valid e-mail is required')).toBeInTheDocument();

        await userEvent.clear(screen.getByLabelText('Email'));
        await type('kai@example.com');
        await waitFor(() => expect(button()).toBeEnabled());
    });

    it('sends a registration request when the box is empty, then shows one message', async () => {
        const sent = requestHandler();
        await renderApp({ initialEntry: '/request' });
        await screen.findByLabelText('Email');
        await type('kai@example.com');
        await waitFor(() => expect(button()).toBeEnabled());
        await userEvent.click(button());

        expect(await screen.findByText('Request received')).toBeInTheDocument();
        expect(sent).toHaveLength(1);
        expect(sent[0].body).toEqual({ email: 'kai@example.com', hasAccount: false });
        expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    });

    it('sends a login request when the box is ticked', async () => {
        const sent = requestHandler();
        await renderApp({ initialEntry: '/request' });
        await userEvent.click(await screen.findByRole('checkbox', { name: 'I already have an account' }));
        await type('kai@example.com');
        await waitFor(() => expect(button()).toBeEnabled());
        await userEvent.click(button());

        await screen.findByText('Request received');
        expect(sent[0].body).toEqual({ email: 'kai@example.com', hasAccount: true });
    });

    it('says that a request is not needed when the gate of the ticked kind is open, and keeps the button off', async () => {
        server.use(...makeAccessHandlers(gates('open', 'limited')));
        await renderApp({ initialEntry: '/request' });
        await screen.findByLabelText('Email');
        await type('kai@example.com');

        expect(await screen.findByText(/This is open now/)).toBeInTheDocument();
        expect(within(screen.getByRole('status')).getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
        expect(button()).toBeDisabled();

        // Tick the box: login is limited, so the request is useful again.
        await userEvent.click(screen.getByRole('checkbox', { name: 'I already have an account' }));
        await waitFor(() => expect(button()).toBeEnabled());
        expect(screen.queryByText(/This is open now/)).not.toBeInTheDocument();
    });

    it('shows an error and keeps the form when the server says the gate is open (409)', async () => {
        requestHandler(() => HttpResponse.json({ message: 'open', code: 'access_not_needed' }, { status: 409 }));
        await renderApp({ initialEntry: '/request' });
        await screen.findByLabelText('Email');
        await type('kai@example.com');
        await waitFor(() => expect(button()).toBeEnabled());
        await userEvent.click(button());

        expect(await screen.findByText('This is open now, so you do not need to ask.')).toBeInTheDocument();
        expect(screen.queryByText('Request received')).not.toBeInTheDocument();
    });

    it('shows a generic error and keeps the form when the call fails', async () => {
        requestHandler(() => HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 }));
        await renderApp({ initialEntry: '/request' });
        await screen.findByLabelText('Email');
        await type('kai@example.com');
        await waitFor(() => expect(button()).toBeEnabled());
        await userEvent.click(button());

        await waitFor(() => expect(screen.getByLabelText('Email')).toHaveValue('kai@example.com'));
        expect(screen.queryByText('Request received')).not.toBeInTheDocument();
    });
});

describe('the captcha on /request', () => {
    const SITE_KEY = '1x00000000000000000000AA';
    const lastWidget = async () => {
        await waitFor(() => expect(fake.renders.length).toBeGreaterThan(0));
        return fake.renders[fake.renders.length - 1].options;
    };

    beforeEach(() => {
        server.use(...makeAccessHandlers(gates('limited', 'limited', { captcha: { enabled: true, siteKey: SITE_KEY } })));
    });

    it('draws the widget for the action access_request, and waits for a token', async () => {
        await renderApp({ initialEntry: '/request' });
        await screen.findByLabelText('Email');
        await type('kai@example.com');

        const options = await lastWidget();
        expect(options.action).toBe('access_request');
        expect(options.sitekey).toBe(SITE_KEY);
        expect(button()).toBeDisabled();

        act(() => options.callback('token-1'));
        await waitFor(() => expect(button()).toBeEnabled());
    });

    it('sends the token, and asks for a new one after a refusal', async () => {
        const sent = requestHandler(() => HttpResponse.json({ message: 'no', code: 'captcha_failed' }, { status: 400 }));
        await renderApp({ initialEntry: '/request' });
        await screen.findByLabelText('Email');
        await type('kai@example.com');
        act(() => void (async () => (await lastWidget()).callback('token-1'))());
        await waitFor(() => expect(button()).toBeEnabled());
        await userEvent.click(button());

        await waitFor(() => expect(sent).toHaveLength(1));
        expect(sent[0].body).toEqual({ email: 'kai@example.com', hasAccount: false, captchaToken: 'token-1' });
        // The token is spent: the button waits for a new one.
        await waitFor(() => expect(button()).toBeDisabled());
        expect(await screen.findByText(/human check|captcha|try again/i)).toBeInTheDocument();
    });
});
