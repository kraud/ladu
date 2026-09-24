import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { useAuthStore } from '@/stores/authStore';
import { futureToken } from '@/test/tokens';
import { AccountPage } from './AccountPage';

// Every AccountPage render now fires `useOAuthIdentities` too (oauth-login-strategy.md
// Phase 5, "Sign-in methods" row + Connect/Disconnect controls). A plain
// password account with nothing connected is the right default for tests
// that aren't about sign-in methods specifically — see SignInMethodsField.test.tsx
// for the Connect/Disconnect flows themselves.
beforeEach(() => {
    server.use(
        http.get('*/api/auth/identities', () => HttpResponse.json({ hasPassword: true, identities: [] })),
    );
});

const SESSION = {
    id: 'u1',
    name: 'Kai Rebane',
    email: 'kai@example.com',
    username: 'kai',
    languages: ['English', 'German'],
    uiLanguage: 'English',
    nativeLanguage: null,
    verified: true,
    token: futureToken(),
};

describe('AccountPage', () => {
    it('renders the profile read-only with a language chip per selection', () => {
        renderWithProviders(<AccountPage />, { session: SESSION });

        expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
        expect(screen.getByText('kai@example.com')).toBeInTheDocument();

        const langs = screen.getByRole('list');
        expect(within(langs).getByText('English')).toBeInTheDocument();
        expect(within(langs).getByText('Deutsch')).toBeInTheDocument();
        expect(screen.getByText('2 of 4 selected')).toBeInTheDocument();
    });

    it('shows the no-languages banner and a shortcut straight into edit mode', async () => {
        const user = userEvent.setup();
        renderWithProviders(<AccountPage />, { session: { ...SESSION, languages: [] } });

        expect(screen.getByText('No languages configured')).toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /select languages/i }));

        // Now in edit mode — the picker is present, Save is blocked at 0 languages.
        expect(screen.getByRole('button', { name: 'English', pressed: false })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('gates Save on name, username and >= 2 languages', async () => {
        const user = userEvent.setup();
        renderWithProviders(<AccountPage />, { session: SESSION });

        await user.click(screen.getByRole('button', { name: /edit profile/i }));

        const save = screen.getByRole('button', { name: 'Save' });
        await waitFor(() => expect(save).toBeEnabled());

        await user.clear(screen.getByLabelText(/^Name/));
        await waitFor(() => expect(save).toBeDisabled());

        await user.type(screen.getByLabelText(/^Name/), 'Kai R');
        await waitFor(() => expect(save).toBeEnabled());

        // Drop to a single language.
        await user.click(screen.getByRole('button', { name: 'Deutsch', pressed: true }));
        await waitFor(() => expect(save).toBeDisabled());
    });

    it('saves a full payload, folds it into the session, and returns to the view', async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            http.put('*/api/users/updateUser', async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({
                    ...SESSION,
                    token: undefined,
                    name: body.name,
                    languages: body.languages,
                });
            }),
        );

        const user = userEvent.setup();
        renderWithProviders(<AccountPage />, { session: SESSION });

        await user.click(screen.getByRole('button', { name: /edit profile/i }));
        await user.clear(screen.getByLabelText(/^Name/));
        await user.type(screen.getByLabelText(/^Name/), 'Kai Uus');
        await user.click(screen.getByRole('button', { name: 'Español', pressed: false }));

        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(body).toBeDefined());
        expect(body).toEqual({
            email: 'kai@example.com',
            name: 'Kai Uus',
            username: 'kai',
            languages: ['English', 'German', 'Spanish'],
            uiLanguage: 'English',
            nativeLanguage: null,
        });

        await waitFor(() => expect(useAuthStore.getState().user?.name).toBe('Kai Uus'));
        // Back in read-only mode with the fresh data.
        expect(await screen.findByRole('button', { name: /edit profile/i })).toBeInTheDocument();
        expect(useAuthStore.getState().token).toBe(SESSION.token);
    });
});
