import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderApp, renderWithProviders } from '@/test/render';
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

// The language picker and the native-language badges both list languages: scope each lookup to its group.
const inPicker = (name: string, pressed: boolean) =>
    within(screen.getByRole('group', { name: 'Languages' })).getByRole('button', { name, pressed });
const inNative = (name: string) =>
    within(screen.getByRole('group', { name: 'Native language' })).getByRole('button', { name });

describe('AccountPage', () => {
    it('renders the profile read-only with a language chip per selection', () => {
        renderWithProviders(<AccountPage />, { session: SESSION });

        expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
        expect(screen.getByText('kai@example.com')).toBeInTheDocument();

        const langs = screen.getByRole('list');
        expect(within(langs).getByText('English')).toBeInTheDocument();
        expect(within(langs).getByText('Deutsch')).toBeInTheDocument();
        expect(screen.getByText('2 of 5 selected')).toBeInTheDocument();
    });

    it('shows the no-languages banner and a shortcut straight into edit mode', async () => {
        const user = userEvent.setup();
        renderWithProviders(<AccountPage />, { session: { ...SESSION, languages: [] } });

        expect(screen.getByText('No languages configured')).toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /select languages/i }));

        // Now in edit mode — the picker is present, Save is blocked at 0 languages.
        expect(inPicker('English', false)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('gates Save of the account card on name and username', async () => {
        const user = userEvent.setup();
        renderWithProviders(<AccountPage />, { session: SESSION });

        await user.click(screen.getByRole('button', { name: 'Edit profile' }));

        const save = screen.getByRole('button', { name: 'Save' });
        await waitFor(() => expect(save).toBeEnabled());

        await user.clear(screen.getByLabelText(/^Name/));
        await waitFor(() => expect(save).toBeDisabled());

        await user.type(screen.getByLabelText(/^Name/), 'Kai R');
        await waitFor(() => expect(save).toBeEnabled());
    });

    it('gates Save of the languages card on >= 2 languages', async () => {
        const user = userEvent.setup();
        renderWithProviders(<AccountPage />, { session: SESSION });

        await user.click(screen.getByRole('button', { name: 'Edit languages' }));

        const save = screen.getByRole('button', { name: 'Save' });
        await waitFor(() => expect(save).toBeEnabled());

        // Drop to a single language.
        await user.click(inPicker('Deutsch', true));
        await waitFor(() => expect(save).toBeDisabled());
    });

    // `updateUser` keeps every field that is absent, so each card sends only its own fields
    // (plus the email the endpoint checks). Nothing of the other card can be overwritten.
    it('saves the account card with name and username only, folds it into the session, and returns to the view', async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            http.put('*/api/users/updateUser', async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ ...SESSION, token: undefined, name: body.name });
            }),
        );

        const user = userEvent.setup();
        renderWithProviders(<AccountPage />, { session: SESSION });

        await user.click(screen.getByRole('button', { name: 'Edit profile' }));
        await user.clear(screen.getByLabelText(/^Name/));
        await user.type(screen.getByLabelText(/^Name/), 'Kai Uus');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(body).toBeDefined());
        expect(body).toEqual({ email: 'kai@example.com', name: 'Kai Uus', username: 'kai' });

        await waitFor(() => expect(useAuthStore.getState().user?.name).toBe('Kai Uus'));
        // Back in read-only mode: both edit buttons are there again.
        expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Edit languages' })).toBeInTheDocument();
        expect(useAuthStore.getState().token).toBe(SESSION.token);
    });

    it('saves the languages card with the language fields only', async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            http.put('*/api/users/updateUser', async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ ...SESSION, token: undefined, languages: body.languages });
            }),
        );

        const user = userEvent.setup();
        renderWithProviders(<AccountPage />, { session: SESSION });

        await user.click(screen.getByRole('button', { name: 'Edit languages' }));
        await user.click(inPicker('Español', false));
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(body).toBeDefined());
        expect(body).toEqual({
            email: 'kai@example.com',
            languages: ['English', 'German', 'Spanish'],
            nativeLanguage: null,
            masteredLanguagePairs: [],
        });
        await waitFor(() => expect(useAuthStore.getState().user?.languages).toEqual(['English', 'German', 'Spanish']));
        expect(await screen.findByRole('button', { name: 'Edit languages' })).toBeInTheDocument();
    });

    it('shows a reserved-name refusal from the server, stays in edit mode and keeps the session unchanged', async () => {
        server.use(
            http.put('*/api/users/updateUser', () =>
                HttpResponse.json({ message: 'This username is not available', code: 'username_reserved' }, { status: 400 }),
            ),
        );
        const user = userEvent.setup();
        // `renderApp`, not `renderWithProviders`: only it mounts the toast container.
        await renderApp({ initialEntry: '/user', session: SESSION });

        await user.click(await screen.findByRole('button', { name: /edit profile/i }));
        await user.clear(screen.getByLabelText(/^Username/));
        await user.type(screen.getByLabelText(/^Username/), 'Ladu_Official');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByText('That username is not available. Please choose another.')).toBeInTheDocument();
        // Still editing, so the person can pick another name; the stored profile did not change.
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
        expect(useAuthStore.getState().user?.username).toBe('kai');
    });

    it('shows the native language, or "None"', () => {
        const { unmount } = renderWithProviders(<AccountPage />, { session: SESSION });
        expect(screen.getByText('Native language')).toBeInTheDocument();
        expect(screen.getByText('None')).toBeInTheDocument();
        unmount();

        renderWithProviders(<AccountPage />, { session: { ...SESSION, nativeLanguage: 'German' } });
        expect(screen.queryByText('None')).not.toBeInTheDocument();
        // A badge, like the ones of the language list, in the row of the native language.
        const row = screen.getByText('Native language').parentElement as HTMLElement;
        expect(within(row).getByText('Deutsch')).toHaveClass('chip');
    });

    it('saves a native language chosen from the selected languages', async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            http.put('*/api/users/updateUser', async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ ...SESSION, token: undefined, nativeLanguage: body.nativeLanguage });
            }),
        );
        const user = userEvent.setup();
        renderWithProviders(<AccountPage />, { session: SESSION });

        await user.click(screen.getByRole('button', { name: /edit languages/i }));
        await user.click(inNative('Deutsch'));
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(body).toBeDefined());
        expect(body).toMatchObject({ nativeLanguage: 'German', languages: ['English', 'German'] });
        await waitFor(() => expect(useAuthStore.getState().user?.nativeLanguage).toBe('German'));
    });

    it('sends null when the native language is no longer a selected language', async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            http.put('*/api/users/updateUser', async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ ...SESSION, token: undefined, nativeLanguage: body.nativeLanguage });
            }),
        );
        const user = userEvent.setup();
        renderWithProviders(<AccountPage />, { session: { ...SESSION, nativeLanguage: 'German' } });

        await user.click(screen.getByRole('button', { name: /edit languages/i }));
        await user.click(inPicker('Deutsch', true));
        await user.click(inPicker('Español', false));
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(body).toBeDefined());
        expect(body).toMatchObject({ nativeLanguage: null, languages: ['English', 'Spanish'] });
    });

    // Mastered language pairs (plans/mastered-language-pairs): pairs of selected languages that
    // Practice never combines. Added as a chip from two selects, removed with the chip's x.
    describe('mastered language pairs', () => {
        const THREE = ['English', 'Spanish', 'German'];
        const WITH_PAIR = { ...SESSION, languages: THREE, masteredLanguagePairs: [['English', 'Spanish']] };
        const REMOVE_EN_ES = 'Remove the pair English & Español';

        function captureUpdate() {
            const captured: { body?: Record<string, unknown> } = {};
            server.use(
                http.put('*/api/users/updateUser', async ({ request }) => {
                    captured.body = (await request.json()) as Record<string, unknown>;
                    return HttpResponse.json({ ...SESSION, token: undefined, ...captured.body });
                }),
            );
            return captured;
        }

        async function pick(user: ReturnType<typeof userEvent.setup>, select: string, option: string) {
            await user.click(screen.getByRole('combobox', { name: select }));
            await user.click(await screen.findByRole('option', { name: option }));
        }

        it('shows the pairs read-only, or "No pairs"', () => {
            const { unmount } = renderWithProviders(<AccountPage />, { session: SESSION });
            expect(screen.getByText('Mastered language pairs')).toBeInTheDocument();
            expect(screen.getByText('No pairs')).toBeInTheDocument();
            unmount();

            renderWithProviders(<AccountPage />, { session: WITH_PAIR });
            expect(screen.queryByText('No pairs')).not.toBeInTheDocument();
            expect(screen.getByText('English & Español')).toBeInTheDocument();
        });

        it('adds a pair from two selects and saves it', async () => {
            const captured = captureUpdate();
            const user = userEvent.setup();
            renderWithProviders(<AccountPage />, { session: { ...SESSION, languages: THREE } });

            await user.click(screen.getByRole('button', { name: /edit languages/i }));
            const add = screen.getByRole('button', { name: 'Add pair' });
            expect(add).toBeDisabled();
            await pick(user, 'First language', 'Español');
            await pick(user, 'Second language', 'English');
            await user.click(add);

            // The pair is stored with its languages sorted, whatever the order of the picks.
            expect(screen.getByRole('button', { name: REMOVE_EN_ES })).toBeInTheDocument();
            await user.click(screen.getByRole('button', { name: 'Save' }));

            await waitFor(() => expect(captured.body).toBeDefined());
            expect(captured.body).toMatchObject({ masteredLanguagePairs: [['English', 'Spanish']] });
            await waitFor(() =>
                expect(useAuthStore.getState().user?.masteredLanguagePairs).toEqual([['English', 'Spanish']]),
            );
        });

        it('removes a pair and saves the shorter list', async () => {
            const captured = captureUpdate();
            const user = userEvent.setup();
            renderWithProviders(<AccountPage />, { session: WITH_PAIR });

            await user.click(screen.getByRole('button', { name: /edit languages/i }));
            await user.click(screen.getByRole('button', { name: REMOVE_EN_ES }));
            expect(screen.queryByRole('button', { name: REMOVE_EN_ES })).not.toBeInTheDocument();
            await user.click(screen.getByRole('button', { name: 'Save' }));

            await waitFor(() => expect(captured.body).toBeDefined());
            expect(captured.body).toMatchObject({ masteredLanguagePairs: [] });
        });

        it('drops a pair when one of its languages is unselected', async () => {
            const captured = captureUpdate();
            const user = userEvent.setup();
            renderWithProviders(<AccountPage />, { session: WITH_PAIR });

            await user.click(screen.getByRole('button', { name: /edit languages/i }));
            await user.click(inPicker('Español', true));
            expect(screen.queryByRole('button', { name: REMOVE_EN_ES })).not.toBeInTheDocument();
            await user.click(screen.getByRole('button', { name: 'Save' }));

            await waitFor(() => expect(captured.body).toBeDefined());
            expect(captured.body).toMatchObject({ languages: ['English', 'German'], masteredLanguagePairs: [] });
        });

        it('asks for a third language when only 2 languages are selected', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AccountPage />, { session: SESSION });

            await user.click(screen.getByRole('button', { name: /edit languages/i }));

            expect(screen.getByText('Select a third language to master a pair.')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Add pair' })).not.toBeInTheDocument();
        });

        it('blocks Save while the pairs cover every pair of the selected languages', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AccountPage />, { session: WITH_PAIR });

            await user.click(screen.getByRole('button', { name: /edit languages/i }));
            const save = screen.getByRole('button', { name: 'Save' });
            await waitFor(() => expect(save).toBeEnabled());

            // Only English and Spanish stay: their one pair is mastered, so nothing is left to practise.
            await user.click(inPicker('Deutsch', true));
            await waitFor(() => expect(save).toBeDisabled());
            expect(screen.getByText(/Leave at least one pair open/)).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: REMOVE_EN_ES }));
            await waitFor(() => expect(save).toBeEnabled());
        });
    });

    // Two cards (account information, languages). Only one of them is in edit mode at a time.
    describe('two cards', () => {
        it('shows a languages card with a title and no subtitle, and an edit button on each card', () => {
            renderWithProviders(<AccountPage />, { session: SESSION });

            expect(screen.getByRole('heading', { name: 'Languages' })).toBeInTheDocument();
            expect(screen.queryByText(/Set the languages you use/)).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Edit languages' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
        });

        it('keeps the language data in the languages card and the rest in the account card', () => {
            renderWithProviders(<AccountPage />, { session: { ...SESSION, nativeLanguage: 'German' } });

            const languagesCard = screen.getByRole('heading', { name: 'Languages' }).closest('section') as HTMLElement;
            expect(within(languagesCard).getByText('Native language')).toBeInTheDocument();
            expect(within(languagesCard).getByText('Mastered language pairs')).toBeInTheDocument();
            expect(within(languagesCard).getByText('2 of 5 selected')).toBeInTheDocument();
            expect(within(languagesCard).queryByText('kai@example.com')).not.toBeInTheDocument();
            expect(within(languagesCard).queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();

            const accountCard = screen.getByRole('button', { name: 'Edit profile' }).closest('section') as HTMLElement;
            expect(accountCard).not.toBe(languagesCard);
            expect(within(accountCard).getByText('kai@example.com')).toBeInTheDocument();
            expect(within(accountCard).getByRole('button', { name: 'Logout' })).toBeInTheDocument();
            expect(within(accountCard).queryByText('Native language')).not.toBeInTheDocument();
        });

        it('edits the account card alone: no edit button on either card, no language fields', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AccountPage />, { session: SESSION });

            await user.click(screen.getByRole('button', { name: 'Edit profile' }));

            expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Edit languages' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'English' })).not.toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Edit languages' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
        });

        // While the account card is edited, Save and Cancel take the place of Edit profile and Logout
        // in the top right of the card: they come before the fields, and Logout is gone.
        it('puts Save and Cancel where the edit and logout buttons were, and hides Logout, while the account card is edited', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AccountPage />, { session: SESSION });

            await user.click(screen.getByRole('button', { name: 'Edit profile' }));

            expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
            const before = (a: HTMLElement, b: HTMLElement) =>
                Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
            const nameField = screen.getByLabelText(/^Name/);
            expect(before(screen.getByRole('button', { name: 'Save' }), nameField)).toBe(true);
            expect(before(screen.getByRole('button', { name: 'Cancel' }), nameField)).toBe(true);
        });

        it('edits the languages card alone: no edit button on either card, no name field', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AccountPage />, { session: SESSION });

            await user.click(screen.getByRole('button', { name: 'Edit languages' }));

            expect(inPicker('English', true)).toBeInTheDocument();
            expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Edit languages' })).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Edit languages' })).toBeInTheDocument();
        });

        // Like the account card: Save and Cancel take the place of the edit button in the header,
        // so they come before the fields. Logout belongs to the account card and stays.
        it('puts Save and Cancel in the header of the languages card while it is edited', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AccountPage />, { session: SESSION });

            await user.click(screen.getByRole('button', { name: 'Edit languages' }));

            const before = (a: HTMLElement, b: HTMLElement) =>
                Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
            const firstToggle = inPicker('English', true);
            expect(before(screen.getByRole('button', { name: 'Save' }), firstToggle)).toBe(true);
            expect(before(screen.getByRole('button', { name: 'Cancel' }), firstToggle)).toBe(true);
        });
    });

    // The native language is one badge out of the selected languages, like the language list.
    describe('native language badges and field order in the languages card', () => {
        const before = (a: HTMLElement, b: HTMLElement) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

        it('offers the selected languages as badges; a second click on the chosen badge clears the native language', async () => {
            let body: Record<string, unknown> | undefined;
            server.use(
                http.put('*/api/users/updateUser', async ({ request }) => {
                    body = (await request.json()) as Record<string, unknown>;
                    return HttpResponse.json({ ...SESSION, token: undefined, nativeLanguage: body.nativeLanguage });
                }),
            );
            const user = userEvent.setup();
            renderWithProviders(<AccountPage />, { session: { ...SESSION, nativeLanguage: 'German' } });

            await user.click(screen.getByRole('button', { name: 'Edit languages' }));
            const group = screen.getByRole('group', { name: 'Native language' });
            expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['English', 'Deutsch']);
            expect(within(group).getByRole('button', { name: 'Deutsch', pressed: true })).toBeInTheDocument();

            await user.click(within(group).getByRole('button', { name: 'Deutsch', pressed: true }));
            expect(within(group).getByRole('button', { name: 'Deutsch', pressed: false })).toBeInTheDocument();
            await user.click(screen.getByRole('button', { name: 'Save' }));

            await waitFor(() => expect(body).toBeDefined());
            expect(body).toMatchObject({ nativeLanguage: null });
        });

        it('drops the badge of a language that is unselected', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AccountPage />, { session: SESSION });

            await user.click(screen.getByRole('button', { name: 'Edit languages' }));
            await user.click(inPicker('Deutsch', true));

            const group = screen.getByRole('group', { name: 'Native language' });
            expect(within(group).queryByRole('button', { name: 'Deutsch' })).not.toBeInTheDocument();
        });

        it('shows the hint of a field under its title, except the long pairs hint, which stays at the bottom', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AccountPage />, { session: { ...SESSION, languages: ['English', 'Spanish', 'German'] } });

            await user.click(screen.getByRole('button', { name: 'Edit languages' }));

            const languagesTitle = screen.getByText('Languages', { selector: 'label' });
            const languagesHint = screen.getByText(/Minimum 2 languages/);
            expect(before(languagesTitle, languagesHint)).toBe(true);
            expect(before(languagesHint, screen.getByRole('group', { name: 'Languages' }))).toBe(true);

            const nativeTitle = screen.getByText('Native language', { selector: 'label' });
            const nativeHint = screen.getByText(/Practice can skip same-language exercises/);
            expect(before(nativeTitle, nativeHint)).toBe(true);
            expect(before(nativeHint, screen.getByRole('group', { name: 'Native language' }))).toBe(true);

            expect(before(screen.getByRole('button', { name: 'Add pair' }), screen.getByText(/Practice does not combine/))).toBe(true);
        });

        it('lists the mastered pairs under their title and the controls to add a pair below the list', async () => {
            const user = userEvent.setup();
            renderWithProviders(<AccountPage />, {
                session: { ...SESSION, languages: ['English', 'Spanish', 'German'], masteredLanguagePairs: [['English', 'Spanish']] },
            });

            await user.click(screen.getByRole('button', { name: 'Edit languages' }));

            const title = screen.getByText('Mastered language pairs');
            const pair = screen.getByRole('button', { name: 'Remove the pair English & Español' });
            const firstSelect = screen.getByRole('combobox', { name: 'First language' });
            expect(before(title, pair)).toBe(true);
            expect(before(pair, firstSelect)).toBe(true);
        });
    });
});
