import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { SignInMethodsField } from './SignInMethodsField';

describe('SignInMethodsField', () => {
    it('shows the Password chip and a Connect button when nothing is linked yet', async () => {
        server.use(
            http.get('*/api/auth/identities', () => HttpResponse.json({ hasPassword: true, identities: [] })),
        );
        renderWithProviders(<SignInMethodsField />);

        expect(await screen.findByText('Password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Connect Google/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();
    });

    it('clicking Connect starts the protected flow with the right provider', async () => {
        let requestedProvider: string | undefined;
        server.use(
            http.get('*/api/auth/identities', () => HttpResponse.json({ hasPassword: true, identities: [] })),
            http.post('*/api/auth/:provider/link', ({ params }) => {
                requestedProvider = (params as { provider: string }).provider;
                return HttpResponse.json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?mock=1' });
            }),
        );
        const user = userEvent.setup();
        renderWithProviders(<SignInMethodsField />);

        await user.click(await screen.findByRole('button', { name: /Connect Google/ }));
        await waitFor(() => expect(requestedProvider).toBe('google'));
    });

    it('shows the Google chip with Disconnect enabled when a password also exists; confirming removes it', async () => {
        let deleted = false;
        server.use(
            http.get('*/api/auth/identities', () =>
                HttpResponse.json({ hasPassword: true, identities: [{ id: 'identity-1', provider: 'google' }] }),
            ),
            http.delete('*/api/auth/identities/identity-1', () => {
                deleted = true;
                return HttpResponse.json({});
            }),
        );
        const user = userEvent.setup();
        renderWithProviders(<SignInMethodsField />);

        expect(await screen.findByText('Google')).toBeInTheDocument();
        const trigger = screen.getByRole('button', { name: 'Disconnect' });
        expect(trigger).toBeEnabled();
        await user.click(trigger);

        // The confirm dialog reuses the same "Disconnect" label for its own
        // action button — scope to the dialog so the query isn't ambiguous.
        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: 'Disconnect' }));

        await waitFor(() => expect(deleted).toBe(true));
    });

    it('lets a disconnect attempt on the only sign-in method through to the backend, rather than disabling the button', async () => {
        let attempted = false;
        server.use(
            http.get('*/api/auth/identities', () =>
                HttpResponse.json({ hasPassword: false, identities: [{ id: 'identity-1', provider: 'google' }] }),
            ),
            http.delete('*/api/auth/identities/identity-1', () => {
                attempted = true;
                // Mirrors the backend's real last-method guard (oauthController.ts's
                // `deleteIdentity`) — the UI must surface this, not pre-empt it, so
                // the click has to reach the network instead of being disabled away.
                return HttpResponse.json({ message: 'Cannot remove your only sign-in method' }, { status: 400 });
            }),
        );
        const user = userEvent.setup();
        renderWithProviders(<SignInMethodsField />);

        expect(await screen.findByText('Google')).toBeInTheDocument();
        const trigger = screen.getByRole('button', { name: 'Disconnect' });
        expect(trigger).toBeEnabled();
        await user.click(trigger);

        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: 'Disconnect' }));

        await waitFor(() => expect(attempted).toBe(true));
        // Rejected by the backend, not removed from the list.
        expect(screen.getByText('Google')).toBeInTheDocument();
    });
});
