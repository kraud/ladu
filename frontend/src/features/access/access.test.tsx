/**
 * The registration gate in the learner app (access-gates.md, PR 1): the banner, the three
 * states of the register page, "act as open" when the status call fails, and the refresh
 * after the server refuses a sign-up.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderApp, renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeAuthHandlers } from '@/test/msw/authHandlers';
import { makeAccessHandlers } from '@/test/msw/accessHandlers';
import { useAuthStore } from '@/stores/authStore';
import { AccessBanner } from './components/AccessBanner';
import type { AccessStatus } from './types';

const status = (mode: 'open' | 'closed' | 'limited', note = ''): AccessStatus => ({
    registration: { mode, note },
    login: { mode: 'open', note: '' },
});

const CLOSED_TEXT = 'Sign-ups are closed for now. Please check back later.';
const LIMITED_TEXT = 'Sign-ups are open by invitation only right now.';
const NOT_INVITED_TEXT = 'Sign-ups are by invitation only right now. This email is not on the list.';

beforeEach(() => {
    server.use(...makeAuthHandlers().handlers);
});

afterEach(() => {
    useAuthStore.getState().clearSession();
});

describe('AccessBanner', () => {
    it('shows nothing when open', () => {
        const { container } = renderWithProviders(
            <AccessBanner gate="registration" status={{ mode: 'open', note: 'ignored' }} />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the translated message for closed, and the owner line under it', () => {
        renderWithProviders(
            <AccessBanner gate="registration" status={{ mode: 'closed', note: 'Back at 14:00 UTC' }} />,
        );
        expect(screen.getByRole('status')).toHaveTextContent(CLOSED_TEXT);
        expect(screen.getByText('Back at 14:00 UTC')).toBeInTheDocument();
    });

    it('shows the translated message for limited', () => {
        renderWithProviders(<AccessBanner gate="registration" status={{ mode: 'limited', note: '' }} />);
        expect(screen.getByRole('status')).toHaveTextContent(LIMITED_TEXT);
    });

    it('shows the owner line as plain text, never as markup or a link', () => {
        renderWithProviders(
            <AccessBanner
                gate="registration"
                status={{ mode: 'closed', note: '<b>soon</b> <a href="https://x.test">x</a>' }}
            />,
        );
        expect(screen.getByText('<b>soon</b> <a href="https://x.test">x</a>')).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(document.querySelector('b')).toBeNull();
    });
});

describe('register page', () => {
    it('open: no banner, the form and the Google link work', async () => {
        server.use(...makeAccessHandlers(status('open')));
        await renderApp({ initialEntry: '/register' });

        expect(await screen.findByRole('link', { name: 'Continue with Google' })).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByLabelText(/^Name/)).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    });

    it('closed: shows the banner and the owner line, and turns off the form and the Google button', async () => {
        server.use(...makeAccessHandlers(status('closed', 'Back at 14:00 UTC')));
        await renderApp({ initialEntry: '/register' });

        expect(await screen.findByText(CLOSED_TEXT)).toBeInTheDocument();
        expect(screen.getByText('Back at 14:00 UTC')).toBeInTheDocument();
        expect(screen.getByLabelText(/^Name/)).toBeDisabled();
        expect(screen.getByLabelText(/^Email/)).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
        // The Google button is a disabled button, not a link that goes nowhere.
        expect(screen.queryByRole('link', { name: 'Continue with Google' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
    });

    it('limited: shows a gentler note and keeps the form on (the server decides by email)', async () => {
        server.use(...makeAccessHandlers(status('limited')));
        await renderApp({ initialEntry: '/register' });

        expect(await screen.findByText(LIMITED_TEXT)).toBeInTheDocument();
        expect(screen.getByLabelText(/^Name/)).toBeEnabled();
        expect(screen.getByRole('link', { name: 'Continue with Google' })).toBeInTheDocument();
    });

    it('acts as open when the status call fails (the server still enforces the gate)', async () => {
        let asked = false;
        server.use(
            http.get('*/api/access', () => {
                asked = true;
                return HttpResponse.json({ message: 'boom' }, { status: 500 });
            }),
        );
        await renderApp({ initialEntry: '/register' });

        await waitFor(() => expect(asked).toBe(true));
        expect(await screen.findByRole('link', { name: 'Continue with Google' })).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByLabelText(/^Name/)).toBeEnabled();
    });

    it('when the server refuses a sign-up, shows the translated message and reads the state again', async () => {
        const user = userEvent.setup();
        let current = status('open');
        let reads = 0;
        server.use(
            http.get('*/api/access', () => {
                reads += 1;
                return HttpResponse.json(current);
            }),
            // The owner switched to limited after the page loaded, and this email is not listed.
            http.post('*/api/users', () => {
                current = status('limited');
                return HttpResponse.json(
                    { message: 'Sign-ups are by invitation only right now', code: 'registration_not_invited' },
                    { status: 403 },
                );
            }),
        );
        await renderApp({ initialEntry: '/register' });

        await screen.findByRole('button', { name: 'Continue' });
        await user.type(screen.getByLabelText(/^Name/), 'Kai Rebane');
        await user.type(screen.getByLabelText(/^Username/), 'kai');
        await user.type(screen.getByLabelText(/^Email/), 'kai@example.com');
        await user.type(screen.getByLabelText(/^Password/), 'password123');
        await user.type(screen.getByLabelText(/^Confirm password/), 'password123');
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        await user.click(await screen.findByRole('button', { name: 'English', pressed: false }));
        await user.click(screen.getByRole('button', { name: 'Español', pressed: false }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled());
        expect(reads).toBe(1);
        await user.click(screen.getByRole('button', { name: 'Create account' }));

        expect(await screen.findByText(NOT_INVITED_TEXT)).toBeInTheDocument();
        // The refusal made the app read the gate again, and the banner now matches it.
        await waitFor(() => expect(reads).toBe(2));
        expect(await screen.findByText(LIMITED_TEXT)).toBeInTheDocument();
    });
});
