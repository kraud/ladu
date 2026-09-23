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
import { expiredToken, makeToken } from '@/test/tokens';
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
    it('walks the two-step form, gates step 2 on >= 2 languages, then creates the account and lands on /login', async () => {
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/register' });

        // Step 1 — profile data.
        await screen.findByRole('button', { name: 'Continue' });
        await user.type(screen.getByLabelText(/^Name/), 'Kai Rebane');
        await user.type(screen.getByLabelText(/^Username/), 'kai');
        await user.type(screen.getByLabelText(/^Email/), 'kai@example.com');
        await user.type(screen.getByLabelText(/^Password/), 'password123');
        await user.type(screen.getByLabelText(/^Confirm password/), 'password123');
        await user.click(screen.getByRole('button', { name: 'Continue' }));

        // Step 2 — languages.
        await screen.findByRole('button', { name: 'Create account' });
        expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'English', pressed: false }));
        // One language is not enough.
        expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'Español', pressed: false }));

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled(),
        );
        await user.click(screen.getByRole('button', { name: 'Create account' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
        expect(await screen.findByText(/kai@example\.com/)).toBeInTheDocument();
        expect(useAuthStore.getState().user).toBeNull();

        const created = auth.userFor('kai@example.com');
        expect(created?.verified).toBe(false);
        expect(created?.languages).toEqual(['English', 'Spanish']);
    });

    it('"Back" on step 2 returns to step 1 with the entered values kept', async () => {
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/register' });

        await screen.findByRole('button', { name: 'Continue' });
        await user.type(screen.getByLabelText(/^Name/), 'Kai Rebane');
        await user.type(screen.getByLabelText(/^Username/), 'kai');
        await user.type(screen.getByLabelText(/^Email/), 'kai@example.com');
        await user.type(screen.getByLabelText(/^Password/), 'password123');
        await user.type(screen.getByLabelText(/^Confirm password/), 'password123');
        await user.click(screen.getByRole('button', { name: 'Continue' }));

        await screen.findByRole('button', { name: 'Back' });
        await user.click(screen.getByRole('button', { name: 'Back' }));

        expect(await screen.findByLabelText(/^Name/)).toHaveValue('Kai Rebane');
        expect(screen.getByLabelText(/^Email/)).toHaveValue('kai@example.com');
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
            languages: ['English', 'Spanish'],
            uiLanguage: 'English',
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

    it('carries the UI language chosen on the login screen into the session', async () => {
        server.use(...makeAuthHandlers([
            { email: 'v@example.com', password: 'password123', verified: true, id: 'u-v' },
        ]).handlers);

        const user = userEvent.setup();
        const { router, i18n } = await renderApp({ initialEntry: '/login' });

        // Pick Español in the public language selector before signing in.
        await user.click(screen.getByRole('button', { name: /interface language/i }));
        await user.click(await screen.findByRole('menuitem', { name: 'Español' }));
        expect(i18n.language).toBe('es');

        await user.type(screen.getByLabelText('Email'), 'v@example.com');
        await user.type(screen.getByLabelText('Password'), 'password123');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/'));
        expect(useAuthStore.getState().user?.uiLanguage).toBe('Spanish');
        // Still Spanish inside the app — the protected selector's effect is a no-op.
        expect(i18n.language).toBe('es');
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

describe('OAuth callback (Phase 2)', () => {
    // `/auth/callback` reads a raw `window.location.hash` (never a query
    // string) — `createMemoryHistory`'s `initialEntry` doesn't drive jsdom's
    // real Location object, so the hash has to be set on it directly, the
    // same way a real browser's would be after the backend's redirect.
    afterEach(() => {
        window.location.hash = '';
    });

    it('a #token= fragment signs the user in and lands on Home', async () => {
        // Log in through the real form once, purely to get a real session
        // token out of the fake backend — the OAuth callback's `token` is the
        // same `generateToken` output a password login's is.
        server.use(...makeAuthHandlers([
            { email: 'oauth-a@example.com', password: 'password123', verified: true, name: 'OAuth User' },
        ]).handlers);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/login' });
        await screen.findByRole('button', { name: 'Sign in' });
        await user.type(screen.getByLabelText('Email'), 'oauth-a@example.com');
        await user.type(screen.getByLabelText('Password'), 'password123');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));
        await waitFor(() => expect(useAuthStore.getState().token).toBeTruthy());
        const token = useAuthStore.getState().token;
        useAuthStore.getState().clearSession();

        window.location.hash = `#token=${token}`;
        const { router } = await renderApp({ initialEntry: '/auth/callback' });

        await waitFor(() => expect(router.state.location.pathname).toBe('/'));
        expect(useAuthStore.getState().user?.email).toBe('oauth-a@example.com');
        expect(useAuthStore.getState().token).toBe(token);
    });

    it('a #error= fragment toasts the mapped message and returns to /login', async () => {
        window.location.hash = '#error=oauth_not_linked';
        const { router } = await renderApp({ initialEntry: '/auth/callback' });

        await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
        expect(
            await screen.findByText(
                'This Google account matches an existing password account. Linking sign-in methods is coming soon — sign in with your password for now.',
            ),
        ).toBeInTheDocument();
        expect(useAuthStore.getState().user).toBeNull();
    });

    it('an unrecognised error code falls back to the generic message', async () => {
        window.location.hash = '#error=something_unexpected';
        await renderApp({ initialEntry: '/auth/callback' });

        expect(await screen.findByText('Something went wrong, try again.')).toBeInTheDocument();
    });
});

describe('OAuth signup completion (Phase 3)', () => {
    afterEach(() => {
        window.location.hash = '';
    });

    const makeSignupTicket = (overrides: Record<string, unknown> = {}) =>
        makeToken({
            typ: 'oauth_signup',
            provider: 'google',
            sub: 'sub-1',
            email: 'brandnew@example.com',
            name: 'Brand New',
            ...overrides,
        });

    it('a #ticket=&mode=signup fragment shows the signup screen, username prefilled from the ticket email', async () => {
        window.location.hash = `#ticket=${makeSignupTicket()}&mode=signup`;
        await renderApp({ initialEntry: '/auth/callback' });

        expect(await screen.findByLabelText(/^Username/)).toHaveValue('brandnew');
    });

    it('completes signup, signs in verified with no password, and lands on Home', async () => {
        const user = userEvent.setup();
        window.location.hash = `#ticket=${makeSignupTicket({ email: 'newperson@example.com', name: 'New Person' })}&mode=signup`;
        const { router } = await renderApp({ initialEntry: '/auth/callback' });

        await screen.findByLabelText(/^Username/);
        await user.clear(screen.getByLabelText(/^Username/));
        await user.type(screen.getByLabelText(/^Username/), 'newperson123');
        await user.click(screen.getByRole('button', { name: 'English', pressed: false }));
        await user.click(screen.getByRole('button', { name: 'Español', pressed: false }));

        const submit = screen.getByRole('button', { name: 'Create account' });
        await waitFor(() => expect(submit).toBeEnabled());
        await user.click(submit);

        await waitFor(() => expect(router.state.location.pathname).toBe('/'));
        expect(useAuthStore.getState().user?.username).toBe('newperson123');
        expect(useAuthStore.getState().user?.verified).toBe(true);
        expect(useAuthStore.getState().token).toBeTruthy();

        const created = auth.userFor('newperson@example.com');
        expect(created?.verified).toBe(true);
    });

    it('surfaces a duplicate-username error and stays on the form for a retry', async () => {
        server.use(
            ...makeAuthHandlers([
                { email: 'someoneelse@example.com', password: 'x', username: 'taken', verified: true },
            ]).handlers,
        );
        const user = userEvent.setup();
        window.location.hash = `#ticket=${makeSignupTicket({ email: 'brandnew2@example.com' })}&mode=signup`;
        await renderApp({ initialEntry: '/auth/callback' });

        await screen.findByLabelText(/^Username/);
        await user.clear(screen.getByLabelText(/^Username/));
        await user.type(screen.getByLabelText(/^Username/), 'taken');
        await user.click(screen.getByRole('button', { name: 'English', pressed: false }));
        await user.click(screen.getByRole('button', { name: 'Español', pressed: false }));
        const submit = screen.getByRole('button', { name: 'Create account' });
        await waitFor(() => expect(submit).toBeEnabled());
        await user.click(submit);

        expect(await screen.findByText('That username is already taken.')).toBeInTheDocument();
        // Still on the signup form, not bounced anywhere — the ticket is reusable within its 10-minute window.
        expect(screen.getByLabelText(/^Username/)).toBeInTheDocument();
    });
});
