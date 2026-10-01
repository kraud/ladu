/**
 * The login gate in the learner app (access-gates.md, PR 2): the banner and the three states of the login
 * page, "act as open" when the status call fails, the refresh after the server refuses a sign-in, and the
 * two answers that carry no token (a verified email, a new Google account) plus the Google error codes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderApp, renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeAuthHandlers } from '@/test/msw/authHandlers';
import { makeAccessHandlers } from '@/test/msw/accessHandlers';
import { makeToken } from '@/test/tokens';
import { useAuthStore } from '@/stores/authStore';
import { AccessBanner } from './components/AccessBanner';
import type { AccessMode, AccessStatus } from './types';

const status = (mode: AccessMode, note = ''): AccessStatus => ({
    registration: { mode: 'open', note: '' },
    login: { mode, note },
});

const CLOSED_TEXT = 'Sign-in is closed for now. Please check back later.';
const LIMITED_TEXT = 'Sign-in is limited right now. Only some accounts can sign in.';
const NOT_ALLOWED_TEXT = 'Sign-in is limited right now. This account cannot sign in yet.';
const VERIFIED_TEXT =
    'Your email is verified. Sign-in is not open to this account right now. Please check back later.';
const CREATED_TEXT =
    'Your account is created. Sign-in is not open to this account right now. Please check back later.';

afterEach(() => {
    useAuthStore.getState().clearSession();
    window.location.hash = '';
});

describe('AccessBanner for login', () => {
    it('shows nothing when open', () => {
        const { container } = renderWithProviders(<AccessBanner gate="login" status={{ mode: 'open', note: 'ignored' }} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the login message for closed and limited, and the owner line as plain text', () => {
        const { unmount } = renderWithProviders(
            <AccessBanner gate="login" status={{ mode: 'closed', note: '<b>soon</b> https://x.test' }} />,
        );
        expect(screen.getByRole('status')).toHaveTextContent(CLOSED_TEXT);
        expect(screen.getByText('<b>soon</b> https://x.test')).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        unmount();

        renderWithProviders(<AccessBanner gate="login" status={{ mode: 'limited', note: '' }} />);
        expect(screen.getByRole('status')).toHaveTextContent(LIMITED_TEXT);
    });
});

describe('login page', () => {
    it('open: no banner, the form and the Google link work', async () => {
        server.use(...makeAuthHandlers().handlers, ...makeAccessHandlers(status('open')));
        await renderApp({ initialEntry: '/login' });

        expect(await screen.findByRole('link', { name: 'Continue with Google' })).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    });

    it('closed: shows the banner and the owner line, and turns off the form and the Google button', async () => {
        server.use(...makeAuthHandlers().handlers, ...makeAccessHandlers(status('closed', 'Back at 14:00 UTC')));
        await renderApp({ initialEntry: '/login' });

        expect(await screen.findByText(CLOSED_TEXT)).toBeInTheDocument();
        expect(screen.getByText('Back at 14:00 UTC')).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeDisabled();
        expect(screen.getByLabelText('Password')).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
        expect(screen.queryByRole('link', { name: 'Continue with Google' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
    });

    it('limited: shows a note and keeps the form on (the server decides by account)', async () => {
        server.use(...makeAuthHandlers().handlers, ...makeAccessHandlers(status('limited')));
        await renderApp({ initialEntry: '/login' });

        expect(await screen.findByText(LIMITED_TEXT)).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
        expect(screen.getByRole('link', { name: 'Continue with Google' })).toBeInTheDocument();
    });

    it('acts as open when the status call fails (the server still enforces the gate)', async () => {
        let asked = false;
        server.use(
            http.get('*/api/access', () => {
                asked = true;
                return HttpResponse.json({ message: 'boom' }, { status: 500 });
            }),
            // The first matching handler wins, so the overrides go before the defaults.
            ...makeAuthHandlers().handlers,
        );
        await renderApp({ initialEntry: '/login' });

        await waitFor(() => expect(asked).toBe(true));
        expect(await screen.findByRole('link', { name: 'Continue with Google' })).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeEnabled();
    });

    it('the register page keeps working while login is closed (the gates are separate)', async () => {
        server.use(...makeAuthHandlers().handlers, ...makeAccessHandlers(status('closed')));
        await renderApp({ initialEntry: '/register' });

        await screen.findByRole('button', { name: 'Continue' });
        expect(screen.queryByText(CLOSED_TEXT)).not.toBeInTheDocument();
        expect(screen.getByLabelText(/^Name/)).toBeEnabled();
    });

    it('when the server refuses a sign-in, shows the translated message and reads the state again', async () => {
        const user = userEvent.setup();
        let current = status('open');
        let reads = 0;
        server.use(
            http.get('*/api/access', () => {
                reads += 1;
                return HttpResponse.json(current);
            }),
            // The owner limited sign-in after the page loaded, and this account is not on the list.
            http.post('*/api/users/login', () => {
                current = status('limited');
                return HttpResponse.json(
                    { message: 'Sign-in is limited right now', code: 'login_not_allowed' },
                    { status: 403 },
                );
            }),
            // The first matching handler wins, so the overrides go before the defaults.
            ...makeAuthHandlers().handlers,
        );
        await renderApp({ initialEntry: '/login' });

        await screen.findByRole('button', { name: 'Sign in' });
        await user.type(screen.getByLabelText('Email'), 'who@example.com');
        await user.type(screen.getByLabelText('Password'), 'password123');
        expect(reads).toBe(1);
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        expect(await screen.findByText(NOT_ALLOWED_TEXT)).toBeInTheDocument();
        await waitFor(() => expect(reads).toBe(2));
        expect(await screen.findByText(LIMITED_TEXT)).toBeInTheDocument();
        expect(useAuthStore.getState().user).toBeNull();
    });

    it('shows the closed message for login_closed', async () => {
        const user = userEvent.setup();
        server.use(
            http.post('*/api/users/login', () =>
                HttpResponse.json({ message: 'Sign-in is closed for now', code: 'login_closed' }, { status: 403 }),
            ),
            // The first matching handler wins, so the overrides go before the defaults.
            ...makeAuthHandlers().handlers,
        );
        await renderApp({ initialEntry: '/login' });

        await screen.findByRole('button', { name: 'Sign in' });
        await user.type(screen.getByLabelText('Email'), 'who@example.com');
        await user.type(screen.getByLabelText('Password'), 'password123');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        expect(await screen.findByText(CLOSED_TEXT)).toBeInTheDocument();
    });
});

describe('the email link while the login gate refuses the account', () => {
    it('says the email is verified, writes no session, and has no countdown', async () => {
        server.use(
            http.get('*/api/users/:userId/verify/:tokenId', () =>
                HttpResponse.json({ message: 'Email verified successfully', verified: true, loginBlocked: 'login_closed' }),
            ),
            // The first matching handler wins, so the overrides go before the defaults.
            ...makeAuthHandlers().handlers,
        );
        const { router } = await renderApp({ initialEntry: '/user/user-1/verify/token-1' });

        expect(await screen.findByText('Validated successfully!')).toBeInTheDocument();
        expect(screen.getByText(VERIFIED_TEXT)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
        expect(screen.queryByRole('button', { name: 'Enter now' })).not.toBeInTheDocument();
        expect(screen.queryByText(/Entering Ladu/)).not.toBeInTheDocument();
        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().token).toBeNull();
        expect(router.state.location.pathname).toBe('/user/user-1/verify/token-1');
    });

    it('does not move on its own after the time the countdown would take', async () => {
        server.use(
            http.get('*/api/users/:userId/verify/:tokenId', () =>
                HttpResponse.json({ message: 'Email verified successfully', verified: true, loginBlocked: 'login_not_allowed' }),
            ),
            // The first matching handler wins, so the overrides go before the defaults.
            ...makeAuthHandlers().handlers,
        );
        const { router } = await renderApp({ initialEntry: '/user/user-1/verify/token-1' });
        await screen.findByText(VERIFIED_TEXT);

        await new Promise((resolve) => setTimeout(resolve, 3500));
        expect(router.state.location.pathname).toBe('/user/user-1/verify/token-1');
        expect(useAuthStore.getState().user).toBeNull();
    }, 10_000);
});

describe('Google', () => {
    it('a #error=login_closed fragment toasts the closed message, writes no session, and returns to /login', async () => {
        server.use(...makeAuthHandlers().handlers);
        window.location.hash = '#error=login_closed';
        const { router } = await renderApp({ initialEntry: '/auth/callback' });

        await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
        expect(await screen.findAllByText(CLOSED_TEXT)).not.toHaveLength(0);
        expect(useAuthStore.getState().user).toBeNull();
    });

    it('a #error=login_not_allowed fragment toasts the "cannot sign in yet" message', async () => {
        server.use(...makeAuthHandlers().handlers);
        window.location.hash = '#error=login_not_allowed';
        await renderApp({ initialEntry: '/auth/callback' });

        expect(await screen.findByText(NOT_ALLOWED_TEXT)).toBeInTheDocument();
    });

    it('completes a Google sign-up while login is limited: the account exists, there is no session, and the person is told', async () => {
        const user = userEvent.setup();
        server.use(
            http.post('*/api/auth/signup/complete', () =>
                HttpResponse.json(
                    { loginBlocked: 'login_not_allowed', message: 'Account created. Sign-in is limited right now' },
                    { status: 201 },
                ),
            ),
            // The first matching handler wins, so the overrides go before the defaults.
            ...makeAuthHandlers().handlers,
        );
        const ticket = makeToken({
            typ: 'oauth_signup',
            provider: 'google',
            sub: 'sub-1',
            email: 'brandnew@example.com',
            name: 'Brand New',
        });
        window.location.hash = `#ticket=${ticket}&mode=signup`;
        const { router } = await renderApp({ initialEntry: '/auth/callback' });

        await screen.findByLabelText(/^Username/);
        await user.click(screen.getByRole('button', { name: 'English', pressed: false }));
        await user.click(screen.getByRole('button', { name: 'Español', pressed: false }));
        const submit = screen.getByRole('button', { name: 'Create account' });
        await waitFor(() => expect(submit).toBeEnabled());
        await user.click(submit);

        expect(await screen.findByText(CREATED_TEXT)).toBeInTheDocument();
        await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().token).toBeNull();
    });
});
