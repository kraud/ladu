/**
 * The demo inside the app (demo-access.md, Slice 1, D6/D10/D13): the header badge and its
 * countdown, the end of the demo, the Account page for a demo, and log-out.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeMetricsHandlers } from '@/test/msw/metricsHandlers';
import { futureToken } from '@/test/tokens';
import { useAuthStore } from '@/stores/authStore';
import { formatTimeLeft } from './session';

const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();
const MINUTE = 60_000;

const demoSession = (expiresInMs = 15 * MINUTE) => ({
    id: 'demo-1',
    name: 'Demo',
    email: 'demo+1@ladu.invalid',
    username: 'demo-1f0e4c7a-0000-4000-8000-000000000000',
    languages: ['English', 'Spanish', 'German', 'Estonian'],
    uiLanguage: 'English',
    nativeLanguage: 'English',
    verified: true,
    isDemo: true,
    demoExpiresAt: inMs(expiresInMs),
    demoWordLimit: 35,
    demoTagLimit: 7,
    token: futureToken(),
});

const normalSession = {
    id: 'u1',
    name: 'Kai Rebane',
    email: 'kai@example.com',
    username: 'kai',
    languages: ['English', 'German'],
    uiLanguage: 'English',
    verified: true,
    token: futureToken(),
};

/** Counts calls to the sign-in methods endpoint (a demo must not ask for it). */
const identitiesSpy = () => {
    const spy = vi.fn();
    server.use(
        http.get('*/api/auth/identities', () => {
            spy();
            return HttpResponse.json({ hasPassword: true, identities: [] });
        }),
    );
    return spy;
};

describe('the header badge', () => {
    it('shows "Demo" and the time left for a demo, and links to the Account page', async () => {
        server.use(...makeMetricsHandlers().handlers);
        await renderApp({ initialEntry: '/', session: demoSession(15 * MINUTE) });

        const badge = await screen.findByRole('link', { name: /^Demo: 1[45]:\d\d left\. Open your account page\.$/ });
        expect(badge).toHaveAttribute('href', '/user');
        expect(within(badge).getByText('Demo')).toBeInTheDocument();
    });

    it('is not there for a normal account', async () => {
        server.use(...makeMetricsHandlers().handlers);
        await renderApp({ initialEntry: '/', session: normalSession });
        expect((await screen.findAllByRole('banner')).length).toBeGreaterThan(0);
        expect(screen.queryByRole('link', { name: /^Demo:/ })).not.toBeInTheDocument();
    });
});

describe('the end of the demo', () => {
    it('clears the session and shows /demo/ended when the time runs out', async () => {
        server.use(...makeMetricsHandlers().handlers);
        const { router } = await renderApp({ initialEntry: '/', session: demoSession(1200) });
        await screen.findByRole('link', { name: /^Demo:/ });

        await waitFor(() => expect(router.state.location.pathname).toBe('/demo/ended'), { timeout: 3000 });
        expect(useAuthStore.getState().user).toBeNull();
        expect(await screen.findByRole('heading', { name: 'The demo has ended' })).toBeInTheDocument();
    });

    it('ends at once when the app opens after the time is over (a reload)', async () => {
        server.use(...makeMetricsHandlers().handlers);
        const { router } = await renderApp({ initialEntry: '/', session: demoSession(-MINUTE) });
        await waitFor(() => expect(router.state.location.pathname).toBe('/demo/ended'));
        expect(useAuthStore.getState().token).toBeNull();
    });
});

describe('the Account page of a demo', () => {
    it('shows the demo block with the time left, and no username, email or sign-in methods', async () => {
        const identities = identitiesSpy();
        await renderApp({ initialEntry: '/user', session: demoSession(15 * MINUTE) });

        const card = await screen.findByRole('region', { name: 'Demo account' });
        expect(within(card).getByRole('timer')).toHaveTextContent(/^Time left: 1[45]:\d\d$/);
        expect(within(card).getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');

        expect(screen.queryByText(/@demo-/)).not.toBeInTheDocument();
        expect(screen.queryByText('demo+1@ladu.invalid')).not.toBeInTheDocument();
        expect(screen.queryByText('Sign-in methods')).not.toBeInTheDocument();
        expect(identities).not.toHaveBeenCalled();
    });

    it('in the edit form, replaces name, username, email and sign-in methods with one line', async () => {
        identitiesSpy();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/user', session: demoSession() });

        await user.click(await screen.findByRole('button', { name: 'Edit profile' }));
        expect(screen.getByText('A demo account cannot change its name or username.')).toBeInTheDocument();
        expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/^Username/)).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    });

    it('keeps everything for a normal account', async () => {
        const identities = identitiesSpy();
        await renderApp({ initialEntry: '/user', session: normalSession });
        expect((await screen.findAllByText('@kai')).length).toBeGreaterThan(0);
        expect(screen.queryByRole('region', { name: 'Demo account' })).not.toBeInTheDocument();
        await waitFor(() => expect(identities).toHaveBeenCalled());
    });

    it('log-out of a demo goes to /demo/ended, not to /login', async () => {
        identitiesSpy();
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/user', session: demoSession() });

        await screen.findByRole('region', { name: 'Demo account' });
        const logoutButtons = screen.getAllByRole('button', { name: 'Logout' });
        await user.click(logoutButtons[logoutButtons.length - 1]);
        await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Logout' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/demo/ended'));
        expect(useAuthStore.getState().user).toBeNull();
    });
});

describe('formatTimeLeft', () => {
    it('shows m:ss under one hour, h:mm:ss from one hour, rounds up and never goes below zero', () => {
        expect(formatTimeLeft(15 * MINUTE)).toBe('15:00');
        expect(formatTimeLeft(59_001)).toBe('1:00');
        expect(formatTimeLeft(9_000)).toBe('0:09');
        expect(formatTimeLeft(60 * MINUTE)).toBe('1:00:00');
        expect(formatTimeLeft(24 * 60 * MINUTE)).toBe('24:00:00');
        expect(formatTimeLeft(-5_000)).toBe('0:00');
    });
});
