/**
 * Phase-1 gate integration suite — the auth vertical slice walked end to end
 * over MSW against the *real* route tree (`renderApp`): register → verify →
 * login → logout → expired-token → protected-redirect, plus the decision-1
 * unverified-login branch and a mapped backend error.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeAuthHandlers } from '@/test/msw/authHandlers';
import { useAuthStore } from '@/stores/authStore';
import { expiredToken } from '@/test/tokens';
import * as authApi from './api';

let auth: ReturnType<typeof makeAuthHandlers>;

beforeEach(() => {
    auth = makeAuthHandlers();
    server.use(...auth.handlers);
});

afterEach(() => {
    useAuthStore.getState().clearSession();
});

describe('register', () => {
    it('creates the account, shows the email toast, and lands on /login (no session)', async () => {
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/register' });

        await screen.findByRole('button', { name: 'Create account' });
        await user.type(screen.getByLabelText(/^Name/), 'Kai Rebane');
        await user.type(screen.getByLabelText(/^Username/), 'kai');
        await user.type(screen.getByLabelText(/^Email/), 'kai@example.com');
        await user.type(screen.getByLabelText(/^Password/), 'password123');
        await user.type(screen.getByLabelText(/^Confirm password/), 'password123');
        await user.click(screen.getByRole('button', { name: 'Create account' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
        expect(await screen.findByText(/kai@example\.com/)).toBeInTheDocument();
        expect(useAuthStore.getState().user).toBeNull();
        expect(auth.userFor('kai@example.com')?.verified).toBe(false);
    });
});

describe('verify email', () => {
    it('verifies via the emailed link, writes the session, and enters the app', async () => {
        // Set-up account via the API so the test owns the verify token.
        await authApi.register({
            name: 'Ada',
            username: 'ada',
            email: 'ada@example.com',
            password: 'password123',
        });
        const userId = auth.userFor('ada@example.com')!.id;
        const token = auth.verifyTokenFor('ada@example.com')!;

        await renderApp({ initialEntry: `/user/${userId}/verify/${token}` });

        expect(await screen.findByText('Validated successfully!')).toBeInTheDocument();
        await waitFor(() => expect(useAuthStore.getState().user?.email).toBe('ada@example.com'));
        expect(useAuthStore.getState().token).toBeTruthy();

        await userEvent.setup().click(screen.getByRole('button', { name: 'Enter now' }));
        // Home now renders the real WelcomeBanner ("Welcome, {name}").
        expect(
            await screen.findByRole('heading', { name: /Welcome, Ada/ }),
        ).toBeInTheDocument();
    });

    it('shows the failure state for a bad token', async () => {
        await renderApp({ initialEntry: '/user/nope/verify/bad-token' });
        expect(await screen.findByText('Oops. Something went wrong.')).toBeInTheDocument();
        expect(useAuthStore.getState().user).toBeNull();
    });
});

describe('login', () => {
    it('signs a verified user in and redirects to the stashed path', async () => {
        server.use(...makeAuthHandlers([
            { email: 'v@example.com', password: 'password123', verified: true, id: 'u-v' },
        ]).handlers);

        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/login?redirect=%2Freview' });

        await screen.findByRole('button', { name: 'Sign in' });
        await user.type(screen.getByLabelText('Email'), 'v@example.com');
        await user.type(screen.getByLabelText('Password'), 'password123');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/review'));
        expect(useAuthStore.getState().user?.email).toBe('v@example.com');
    });

    it('decision 1: an unverified account is warned and NOT signed in', async () => {
        server.use(...makeAuthHandlers([
            { email: 'u@example.com', password: 'password123', verified: false, id: 'u-u' },
        ]).handlers);

        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/login' });

        await screen.findByRole('button', { name: 'Sign in' });
        await user.type(screen.getByLabelText('Email'), 'u@example.com');
        await user.type(screen.getByLabelText('Password'), 'password123');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        expect(
            await screen.findByText('You need to verify your account before signing in.'),
        ).toBeInTheDocument();
        expect(useAuthStore.getState().user).toBeNull();
        expect(router.state.location.pathname).toBe('/login');
    });

    it('surfaces a mapped backend error on bad credentials', async () => {
        server.use(...makeAuthHandlers([
            { email: 'v@example.com', password: 'right', verified: true },
        ]).handlers);

        const user = userEvent.setup();
        await renderApp({ initialEntry: '/login' });

        await screen.findByRole('button', { name: 'Sign in' });
        await user.type(screen.getByLabelText('Email'), 'v@example.com');
        await user.type(screen.getByLabelText('Password'), 'wrong');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
        expect(useAuthStore.getState().user).toBeNull();
    });
});

describe('session guards', () => {
    it('logout: clearing the session sends protected routes back to /login', async () => {
        // Land authenticated on the dashboard…
        server.use(...makeAuthHandlers([
            { email: 'v@example.com', password: 'password123', verified: true, id: 'u-v' },
        ]).handlers);
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/login' });
        await screen.findByRole('button', { name: 'Sign in' });
        await user.type(screen.getByLabelText('Email'), 'v@example.com');
        await user.type(screen.getByLabelText('Password'), 'password123');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));
        await waitFor(() => expect(router.state.location.pathname).toBe('/'));

        // …then log out the way `useLogout` (wired into the Slice-4 UserMenu)
        // does: clear the session, then a protected route is no longer reachable.
        useAuthStore.getState().clearSession();
        void router.navigate({ to: '/review' });
        await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    });

    it('an expired token on a protected route redirects to /login', async () => {
        const { router } = await renderApp({
            initialEntry: '/',
            session: { id: 'u1', email: 'a@x.com', token: expiredToken() },
        });
        await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    });

    it('no session on a protected route redirects to /login with the attempted path', async () => {
        const { router } = await renderApp({ initialEntry: '/review' });
        await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
        expect(router.state.location.search).toMatchObject({
            redirect: expect.stringContaining('/review'),
        });
    });
});
