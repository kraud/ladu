import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/renderApp';
import { accessHandlers, makeAccess, makeAllowed, makeInvite, type AccessWrite } from '@/test/access';
import { SIGN_OUT_PHRASE } from '@/features/access/types';
import { parseEmails } from '@/features/access/pages/AccessPage';
import type { AccessState } from '@/features/access/types';

const open = () => renderApp({ initialEntry: '/access', role: 'owner' });
const openLogin = () => renderApp({ initialEntry: '/access?tab=login', role: 'owner' });
const setup = (initial: AccessState = makeAccess()) => {
    const state = { current: initial };
    const writes: AccessWrite[] = [];
    server.use(...accessHandlers(state, writes));
    return { state, writes };
};
// The page has a Registration tab and a Login tab that share labels and button names, so each query is scoped.
const registration = () => within(screen.getByRole('region', { name: 'Registration' }));
const login = () => within(screen.getByRole('region', { name: 'Login' }));
const registrationLoaded = () => screen.findByRole('region', { name: 'Registration' });
const loginLoaded = () => screen.findByRole('region', { name: 'Login' });
const modeButton = (name: string) => registration().getByRole('button', { name });
const saveButton = () => registration().getByRole('button', { name: 'Save' });

describe('who may open the page', () => {
    it('sends everyone without access.manage to the overview, and hides the header link', async () => {
        setup();
        for (const role of ['viewer', 'support', 'admin'] as const) {
            const { router, unmount } = await renderApp({ initialEntry: '/access', role });
            expect([role, router.state.location.pathname]).toEqual([role, '/']);
            expect(screen.queryByRole('link', { name: 'Access' })).not.toBeInTheDocument();
            unmount();
        }
    });

    it('shows an owner the page, and the header link', async () => {
        setup();
        await open();
        expect(await screen.findByRole('heading', { name: 'Access' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Access' })).toBeInTheDocument();
    });
});

describe('loading', () => {
    it('shows the server error and tries again', async () => {
        let fail = true;
        server.use(
            http.get('/api/admin/access', () => (fail ? HttpResponse.json({ message: 'Boom' }, { status: 500 }) : HttpResponse.json(makeAccess()))),
        );
        const user = userEvent.setup();
        await open();

        expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
        fail = false;
        await user.click(screen.getByRole('button', { name: 'Try again' }));

        await registrationLoaded();
        expect(screen.queryByText('Boom')).not.toBeInTheDocument();
    });
});

describe('registration', () => {
    it('shows the saved state, who changed it, and an explanation of each state', async () => {
        setup(makeAccess({ registration: { mode: 'closed', note: 'Back at 14:00 UTC' }, updatedAt: '2026-10-01T10:00:00.000Z', updatedBy: 'Sam Staff' }));
        await open();

        await registrationLoaded();
        expect(modeButton('Closed')).toHaveAttribute('aria-pressed', 'true');
        expect(modeButton('Open')).toHaveAttribute('aria-pressed', 'false');
        expect(registration().getByLabelText(/Extra line/)).toHaveValue('Back at 14:00 UTC');
        expect(screen.getByText(/Last changed .* by Sam Staff/)).toBeInTheDocument();
        expect(screen.getByText('Anybody can register.')).toBeInTheDocument();
        expect(screen.getByText(/Nobody can register\. A banner/)).toBeInTheDocument();
        expect(screen.getByText(/Only emails on the invite list can register\. An email leaves/)).toBeInTheDocument();
    });

    it('keeps Save off until something changes', async () => {
        setup();
        const user = userEvent.setup();
        await open();

        await registrationLoaded();
        expect(saveButton()).toBeDisabled();
        await user.click(modeButton('Closed'));
        expect(saveButton()).toBeEnabled();
        await user.click(modeButton('Open'));
        expect(saveButton()).toBeDisabled();
    });

    it('asks to confirm, says what will happen, then sends the mode, the line and the reason', async () => {
        const { writes } = setup();
        const user = userEvent.setup();
        await open();

        await registrationLoaded();
        await user.click(modeButton('Closed'));
        await user.type(registration().getByLabelText(/Extra line/), '  Back at 14:00 UTC ');
        await user.click(saveButton());

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('Set registration to closed?')).toBeInTheDocument();
        expect(within(dialog).getByText('Nobody will be able to register until you change this.')).toBeInTheDocument();
        // Nothing is sent before the confirm.
        expect(writes).toEqual([]);

        await user.type(within(dialog).getByLabelText(/Reason/), 'incident');
        await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(writes).toEqual([
            { method: 'PUT', path: '/api/admin/access/registration', body: { mode: 'closed', note: 'Back at 14:00 UTC', reason: 'incident' } },
        ]);
        expect(await screen.findByRole('status')).toHaveTextContent('Registration is now closed.');
        expect(modeButton('Closed')).toHaveAttribute('aria-pressed', 'true');
        expect(saveButton()).toBeDisabled();
    });

    it('leaves the state alone when the owner cancels', async () => {
        const { writes } = setup();
        const user = userEvent.setup();
        await open();

        await registrationLoaded();
        await user.click(modeButton('Closed'));
        await user.click(saveButton());
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(writes).toEqual([]);
    });

    it('can save only the extra line, with its own wording', async () => {
        const { writes } = setup(makeAccess({ registration: { mode: 'closed', note: '' } }));
        const user = userEvent.setup();
        await open();

        await registrationLoaded();
        await user.type(registration().getByLabelText(/Extra line/), 'Soon');
        await user.click(saveButton());
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('Save the extra line?')).toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        expect(await screen.findByRole('status')).toHaveTextContent('The extra line was saved.');
        expect(writes[0].body).toEqual({ mode: 'closed', note: 'Soon' });
    });

    it('limits the extra line to 300 characters and shows the count', async () => {
        setup();
        const user = userEvent.setup();
        await open();

        await registrationLoaded();
        const note = registration().getByLabelText(/Extra line/);
        await user.click(note);
        await user.paste('x'.repeat(320));
        expect((note as HTMLTextAreaElement).value).toHaveLength(300);
        expect(screen.getByText(/300\/300/)).toBeInTheDocument();
    });

    it('warns when the state is limited and the list is empty, in the page and in the confirm', async () => {
        setup();
        const user = userEvent.setup();
        await open();

        await registrationLoaded();
        expect(screen.queryByText(/invite list is empty, so nobody can register/)).not.toBeInTheDocument();
        await user.click(modeButton('Limited'));
        expect(screen.getByRole('alert')).toHaveTextContent('Registration is limited and the invite list is empty, so nobody can register.');
        await user.click(saveButton());
        expect(await screen.findByRole('dialog')).toHaveTextContent('The list is empty, so nobody can register now.');
    });

    it('does not warn when the list has emails', async () => {
        setup(makeAccess({ invites: [makeInvite()] }));
        const user = userEvent.setup();
        await open();

        await registrationLoaded();
        await user.click(modeButton('Limited'));
        expect(screen.queryByText(/so nobody can register\./)).not.toBeInTheDocument();
    });

    it('shows the server error inside the dialog and keeps it open', async () => {
        setup();
        server.use(http.put('/api/admin/access/registration', () => HttpResponse.json({ message: 'Boom' }, { status: 500 })));
        const user = userEvent.setup();
        await open();

        await registrationLoaded();
        await user.click(modeButton('Closed'));
        await user.click(saveButton());
        const dialog = await screen.findByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Boom');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});

describe('the invite list', () => {
    it('shows each email with who added it and when, and the count', async () => {
        setup(makeAccess({ invites: [makeInvite(), makeInvite({ id: 'invite-2', email: 'other@example.test', addedBy: null })] }));
        await open();

        await screen.findByText('friend@example.test');
        expect(screen.getByRole('heading', { name: /Invite list/ })).toHaveTextContent('(2)');
        const row = screen.getByText('friend@example.test').closest('tr') as HTMLElement;
        expect(within(row).getByText('Sam Staff')).toBeInTheDocument();
        expect(within(row).getByText(/Oct 2026/)).toBeInTheDocument();
        // A removed staff account shows a dash, never "null".
        const other = screen.getByText('other@example.test').closest('tr') as HTMLElement;
        expect(within(other).getByText('—')).toBeInTheDocument();
        expect(document.body).not.toHaveTextContent(/Invalid Date|undefined|null/);
    });

    it('says the list is empty, and keeps the list when the state is open', async () => {
        setup();
        await open();
        const invites = within(await screen.findByRole('region', { name: /Invite list/ }));
        expect(invites.getByText('The invite list is empty.')).toBeInTheDocument();
        expect(invites.getByText(/The list stays when you switch to another state/)).toBeInTheDocument();
    });

    it('splits pasted text on lines, commas, semicolons and spaces', () => {
        expect(parseEmails('a@x.test, b@x.test\nc@x.test;d@x.test  e@x.test\n\n')).toEqual([
            'a@x.test',
            'b@x.test',
            'c@x.test',
            'd@x.test',
            'e@x.test',
        ]);
        expect(parseEmails('  \n ')).toEqual([]);
    });

    it('sends the emails, then shows what was added and what was skipped, with the reasons', async () => {
        const writes: AccessWrite[] = [];
        const state = { current: makeAccess() };
        server.use(
            http.post('/api/admin/access/invites', async ({ request }) => {
                writes.push({ method: 'POST', path: '/api/admin/access/invites', body: (await request.json()) as Record<string, unknown> });
                state.current = makeAccess({ invites: [makeInvite({ email: 'new@example.test' })] });
                return HttpResponse.json({
                    ...state.current,
                    added: ['new@example.test'],
                    skipped: [
                        { email: 'bad', reason: 'invalid' },
                        { email: 'listed@example.test', reason: 'already_listed' },
                        { email: 'member@example.test', reason: 'has_account' },
                        { email: 'new@example.test', reason: 'duplicate_in_request' },
                    ],
                });
            }),
            // The first matching handler wins, so the override goes before the defaults.
            ...accessHandlers(state, writes),
        );
        const user = userEvent.setup();
        await open();

        await screen.findByRole('heading', { name: /Invite list/ });
        expect(screen.getByRole('button', { name: 'Add to the list' })).toBeDisabled();
        await user.type(screen.getByLabelText('Add emails'), 'new@example.test, bad\nlisted@example.test');
        await user.click(screen.getByRole('button', { name: 'Add to the list' }));

        const summary = await screen.findByRole('status', { name: 'Result of the last add' });
        expect(summary).toHaveTextContent('Added 1. Skipped 4.');
        expect(summary).toHaveTextContent('bad: not a valid email');
        expect(summary).toHaveTextContent('listed@example.test: already on the invite list');
        expect(summary).toHaveTextContent('member@example.test: already has an account');
        expect(summary).toHaveTextContent('new@example.test: repeated in this list');
        expect(writes).toEqual([
            { method: 'POST', path: '/api/admin/access/invites', body: { emails: ['new@example.test', 'bad', 'listed@example.test'] } },
        ]);
        // The box is empty again, and the table has the new row.
        expect(screen.getByLabelText('Add emails')).toHaveValue('');
        expect(await screen.findByText(/Added 1 to the invite list\./)).toBeInTheDocument();
        expect(screen.getAllByText('new@example.test').length).toBeGreaterThanOrEqual(1);
    });

    it('refuses more than 500 emails before it sends', async () => {
        const { writes } = setup();
        const user = userEvent.setup();
        await open();

        await screen.findByRole('heading', { name: /Invite list/ });
        await user.click(screen.getByLabelText('Add emails'));
        await user.paste(Array.from({ length: 501 }, (_, i) => `u${i}@example.test`).join('\n'));
        expect(screen.getByText(/At most 500 emails at once\. You have 501\./)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add to the list' })).toBeDisabled();
        expect(writes).toEqual([]);
    });

    it('shows the server error and keeps what was typed', async () => {
        setup();
        server.use(http.post('/api/admin/access/invites', () => HttpResponse.json({ message: 'Boom' }, { status: 500 })));
        const user = userEvent.setup();
        await open();

        await screen.findByRole('heading', { name: /Invite list/ });
        await user.type(screen.getByLabelText('Add emails'), 'a@example.test');
        await user.click(screen.getByRole('button', { name: 'Add to the list' }));

        expect(await screen.findByText('Boom')).toBeInTheDocument();
        expect(screen.getByLabelText('Add emails')).toHaveValue('a@example.test');
    });

    it('removes one email', async () => {
        const { writes } = setup(makeAccess({ invites: [makeInvite(), makeInvite({ id: 'invite-2', email: 'other@example.test' })] }));
        const user = userEvent.setup();
        await open();

        await screen.findByText('friend@example.test');
        await user.click(screen.getByRole('button', { name: 'Remove friend@example.test' }));

        await waitFor(() => expect(screen.queryByText('friend@example.test')).not.toBeInTheDocument());
        expect(screen.getByText('other@example.test')).toBeInTheDocument();
        expect(writes).toEqual([{ method: 'DELETE', path: '/api/admin/access/invites/invite-1', body: {} }]);
        expect(await screen.findByText('Removed friend@example.test from the invite list.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Invite list/ })).toHaveTextContent('(1)');
    });

    it('sends the invite email, keeps the invite on the list, and offers to send again', async () => {
        const { writes } = setup(makeAccess({ invites: [makeInvite(), makeInvite({ id: 'invite-2', email: 'other@example.test' })] }));
        const user = userEvent.setup();
        await open();

        await screen.findByText('friend@example.test');
        await user.click(screen.getByRole('button', { name: 'Send invite to friend@example.test' }));

        expect(await screen.findByText('Invite email sent to friend@example.test.')).toBeInTheDocument();
        expect(writes).toEqual([{ method: 'POST', path: '/api/admin/access/invites/invite-1/send', body: {} }]);
        // Still listed, and only that row says "Send again".
        expect(screen.getByText('friend@example.test')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Send invite to friend@example.test' })).toHaveTextContent('Send again');
        expect(screen.getByRole('button', { name: 'Send invite to other@example.test' })).toHaveTextContent('Send invite');
    });

    it('shows the server error when the send fails, and does not mark the invite as sent', async () => {
        setup(makeAccess({ invites: [makeInvite()] }));
        server.use(
            http.post('/api/admin/access/invites/:id/send', () =>
                HttpResponse.json({ message: 'This email already has an account, so an invite email is not needed' }, { status: 409 }),
            ),
        );
        const user = userEvent.setup();
        await open();

        await screen.findByText('friend@example.test');
        await user.click(screen.getByRole('button', { name: 'Send invite to friend@example.test' }));

        expect(await screen.findByText(/already has an account/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Send invite to friend@example.test' })).toHaveTextContent('Send invite');
    });

    it('shows the server error when a removal fails', async () => {
        setup(makeAccess({ invites: [makeInvite()] }));
        server.use(http.delete('/api/admin/access/invites/:id', () => HttpResponse.json({ message: 'Invite not found' }, { status: 404 })));
        const user = userEvent.setup();
        await open();

        await screen.findByText('friend@example.test');
        await user.click(screen.getByRole('button', { name: 'Remove friend@example.test' }));

        expect(await screen.findByText('Invite not found')).toBeInTheDocument();
        expect(screen.getByText('friend@example.test')).toBeInTheDocument();
    });
});

describe('login', () => {
    it('shows the saved login state and its own explanations, apart from registration', async () => {
        setup(makeAccess({ login: { mode: 'limited', note: 'Beta week' }, registration: { mode: 'closed', note: '' } }));
        const user = userEvent.setup();
        await openLogin();

        await loginLoaded();
        expect(login().getByRole('button', { name: 'Limited' })).toHaveAttribute('aria-pressed', 'true');
        expect(login().getByLabelText(/Extra line/)).toHaveValue('Beta week');
        expect(login().getByText('Anybody with an account can sign in.')).toBeInTheDocument();
        expect(login().getByText('Only accounts on the allowed list can sign in.')).toBeInTheDocument();
        // The registration tab is separate and keeps its own saved state.
        await user.click(screen.getByRole('link', { name: 'Registration' }));
        expect(registration().getByRole('button', { name: 'Closed' })).toHaveAttribute('aria-pressed', 'true');
        // The login texts do not appear on the registration tab.
        expect(screen.queryByText(/can sign in/)).not.toBeInTheDocument();
    });

    it('says that new sign-ins only are stopped, and that staff are never blocked', async () => {
        setup();
        await openLogin();
        await loginLoaded();
        const card = within(screen.getByRole('region', { name: 'Login' }));
        expect(card.getByText(/people who are already signed in stay signed in/)).toBeInTheDocument();
        expect(card.getByText(/Staff are never blocked/)).toBeInTheDocument();
    });

    it('asks to confirm, says what will happen, then sends the login mode, the line and the reason', async () => {
        const { writes } = setup();
        const user = userEvent.setup();
        await openLogin();

        await loginLoaded();
        await user.click(login().getByRole('button', { name: 'Closed' }));
        await user.type(login().getByLabelText(/Extra line/), 'Back at 14:00 UTC');
        await user.click(login().getByRole('button', { name: 'Save' }));

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('Set login to closed?')).toBeInTheDocument();
        expect(within(dialog).getByText('Nobody will be able to sign in until you change this. Open sessions keep working.')).toBeInTheDocument();
        expect(writes).toEqual([]);

        await user.type(within(dialog).getByLabelText(/Reason/), 'incident');
        await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(writes).toEqual([
            { method: 'PUT', path: '/api/admin/access/login', body: { mode: 'closed', note: 'Back at 14:00 UTC', reason: 'incident' } },
        ]);
        expect(await screen.findByRole('status')).toHaveTextContent('Login is now closed.');
        // Registration was not touched: its tab still shows the saved state.
        await user.click(screen.getByRole('link', { name: 'Registration' }));
        expect(registration().getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('keeps its Save off until something changes', async () => {
        setup();
        const user = userEvent.setup();
        await openLogin();

        await loginLoaded();
        expect(login().getByRole('button', { name: 'Save' })).toBeDisabled();
        await user.click(login().getByRole('button', { name: 'Limited' }));
        expect(login().getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('warns when login is limited and the allowed list is empty, in the card and in the confirm', async () => {
        setup();
        const user = userEvent.setup();
        await openLogin();

        await loginLoaded();
        await user.click(login().getByRole('button', { name: 'Limited' }));
        expect(login().getByRole('alert')).toHaveTextContent('Login is limited and the allowed list is empty, so nobody can sign in.');
        await user.click(login().getByRole('button', { name: 'Save' }));
        expect(await screen.findByRole('dialog')).toHaveTextContent('The list is empty, so nobody can sign in now.');
    });

    it('does not warn when the allowed list has accounts', async () => {
        setup(makeAccess({ loginAllowed: [makeAllowed()] }));
        const user = userEvent.setup();
        await openLogin();

        await loginLoaded();
        await user.click(login().getByRole('button', { name: 'Limited' }));
        expect(login().queryByRole('alert')).not.toBeInTheDocument();
    });

    it('explains that a new account cannot sign in when registration is open and login is limited', async () => {
        setup();
        const user = userEvent.setup();
        await openLogin();

        await loginLoaded();
        await user.click(login().getByRole('button', { name: 'Limited' }));
        expect(login().getByText(/new accounts are made, but they are not on the allowed list/)).toBeInTheDocument();
    });

    it('does not say that when registration is not open', async () => {
        setup(makeAccess({ registration: { mode: 'closed', note: '' } }));
        const user = userEvent.setup();
        await openLogin();

        await loginLoaded();
        await user.click(login().getByRole('button', { name: 'Limited' }));
        expect(login().queryByText(/new accounts are made/)).not.toBeInTheDocument();
    });

    it('shows the server error inside the dialog and keeps it open', async () => {
        setup();
        server.use(http.put('/api/admin/access/login', () => HttpResponse.json({ message: 'Boom' }, { status: 500 })));
        const user = userEvent.setup();
        await openLogin();

        await loginLoaded();
        await user.click(login().getByRole('button', { name: 'Closed' }));
        await user.click(login().getByRole('button', { name: 'Save' }));
        const dialog = await screen.findByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Boom');
    });
});

describe('the allowed accounts', () => {
    const allowedCard = () => within(screen.getByRole('region', { name: /Allowed accounts/ }));

    it('shows name, email, status, who added each and when, and the count', async () => {
        setup(
            makeAccess({
                loginAllowed: [makeAllowed(), makeAllowed({ userId: 'u2', name: 'Mart Kask', email: 'mart@example.com', status: 'banned', addedBy: null })],
            }),
        );
        await openLogin();

        await screen.findByText('Kaja Tamm');
        expect(screen.getByRole('heading', { name: /Allowed accounts/ })).toHaveTextContent('(2)');
        const row = screen.getByText('Kaja Tamm').closest('tr') as HTMLElement;
        expect(within(row).getByText('kaja@example.com')).toBeInTheDocument();
        expect(within(row).getByText('Active')).toBeInTheDocument();
        expect(within(row).getByText('Sam Staff')).toBeInTheDocument();
        const other = screen.getByText('Mart Kask').closest('tr') as HTMLElement;
        expect(within(other).getByText('Banned')).toBeInTheDocument();
        expect(within(other).getByText('—')).toBeInTheDocument();
        expect(document.body).not.toHaveTextContent(/Invalid Date|undefined|null/);
    });

    it('says the list is empty, and that it stays when the state is open', async () => {
        setup();
        await openLogin();
        const card = within(await screen.findByRole('region', { name: /Allowed accounts/ }));
        expect(card.getByText('The allowed list is empty.')).toBeInTheDocument();
        expect(card.getByText(/The list stays when you switch to another state/)).toBeInTheDocument();
    });

    it('sends the emails, then shows what was added and skipped, with the reasons', async () => {
        const writes: AccessWrite[] = [];
        const state = { current: makeAccess() };
        server.use(
            http.post('/api/admin/access/login-allowed', async ({ request }) => {
                writes.push({ method: 'POST', path: '/api/admin/access/login-allowed', body: (await request.json()) as Record<string, unknown> });
                state.current = makeAccess({ loginAllowed: [makeAllowed({ email: 'new@example.test', name: 'New Person' })] });
                return HttpResponse.json({
                    ...state.current,
                    added: [{ userId: 'u1', email: 'new@example.test' }],
                    skipped: [
                        { value: 'bad', reason: 'invalid' },
                        { value: 'nobody@example.test', reason: 'unknown' },
                        { value: 'gone@example.test', reason: 'deleted' },
                        { value: 'listed@example.test', reason: 'already_allowed' },
                        { value: 'new@example.test', reason: 'duplicate_in_request' },
                    ],
                });
            }),
            ...accessHandlers(state, writes),
        );
        const user = userEvent.setup();
        await openLogin();

        await screen.findByRole('heading', { name: /Allowed accounts/ });
        expect(allowedCard().getByRole('button', { name: 'Add to the allowed list' })).toBeDisabled();
        await user.type(allowedCard().getByLabelText('Add accounts by email'), 'new@example.test, bad\nlisted@example.test');
        await user.click(allowedCard().getByRole('button', { name: 'Add to the allowed list' }));

        const summary = await screen.findByRole('status', { name: 'Result of the last allow' });
        expect(summary).toHaveTextContent('Added 1. Skipped 5.');
        expect(summary).toHaveTextContent('bad: not a valid email or id');
        expect(summary).toHaveTextContent('nobody@example.test: no account with this email or id');
        expect(summary).toHaveTextContent('gone@example.test: the account is deleted');
        expect(summary).toHaveTextContent('listed@example.test: already on the allowed list');
        expect(summary).toHaveTextContent('new@example.test: repeated in this list');
        expect(writes).toEqual([
            { method: 'POST', path: '/api/admin/access/login-allowed', body: { emails: ['new@example.test', 'bad', 'listed@example.test'] } },
        ]);
        expect(allowedCard().getByLabelText('Add accounts by email')).toHaveValue('');
        expect(await screen.findByText('New Person')).toBeInTheDocument();
    });

    it('refuses more than 500 emails before it sends', async () => {
        const { writes } = setup();
        const user = userEvent.setup();
        await openLogin();

        await screen.findByRole('heading', { name: /Allowed accounts/ });
        await user.click(allowedCard().getByLabelText('Add accounts by email'));
        await user.paste(Array.from({ length: 501 }, (_, i) => `u${i}@example.test`).join('\n'));
        expect(allowedCard().getByText(/At most 500 emails at once\. You have 501\./)).toBeInTheDocument();
        expect(allowedCard().getByRole('button', { name: 'Add to the allowed list' })).toBeDisabled();
        expect(writes).toEqual([]);
    });

    it('shows the server error and keeps what was typed', async () => {
        setup();
        server.use(http.post('/api/admin/access/login-allowed', () => HttpResponse.json({ message: 'Boom' }, { status: 500 })));
        const user = userEvent.setup();
        await openLogin();

        await screen.findByRole('heading', { name: /Allowed accounts/ });
        await user.type(allowedCard().getByLabelText('Add accounts by email'), 'a@example.test');
        await user.click(allowedCard().getByRole('button', { name: 'Add to the allowed list' }));

        expect(await screen.findByText('Boom')).toBeInTheDocument();
        expect(allowedCard().getByLabelText('Add accounts by email')).toHaveValue('a@example.test');
    });

    it('removes one account', async () => {
        const { writes } = setup(makeAccess({ loginAllowed: [makeAllowed(), makeAllowed({ userId: 'u2', name: 'Mart Kask', email: 'mart@example.com' })] }));
        const user = userEvent.setup();
        await openLogin();

        await screen.findByText('Kaja Tamm');
        await user.click(screen.getByRole('button', { name: 'Remove kaja@example.com from the allowed list' }));

        await waitFor(() => expect(screen.queryByText('Kaja Tamm')).not.toBeInTheDocument());
        expect(screen.getByText('Mart Kask')).toBeInTheDocument();
        expect(writes).toEqual([{ method: 'DELETE', path: '/api/admin/access/login-allowed/u1', body: {} }]);
        expect(await screen.findByText('Removed kaja@example.com from the allowed list.')).toBeInTheDocument();
    });

    it('shows the server error when a removal fails', async () => {
        setup(makeAccess({ loginAllowed: [makeAllowed()] }));
        server.use(http.delete('/api/admin/access/login-allowed/:userId', () => HttpResponse.json({ message: 'This account is not on the allowed list' }, { status: 404 })));
        const user = userEvent.setup();
        await openLogin();

        await screen.findByText('Kaja Tamm');
        await user.click(screen.getByRole('button', { name: 'Remove kaja@example.com from the allowed list' }));

        expect(await screen.findByText('This account is not on the allowed list')).toBeInTheDocument();
        expect(screen.getByText('Kaja Tamm')).toBeInTheDocument();
    });
});

describe('sign everyone out', () => {
    const section = () => within(screen.getByRole('region', { name: 'Sign everyone out' }));

    it('is a separate red section at the bottom, and sends nothing until the dialog is confirmed', async () => {
        const { writes } = setup();
        await openLogin();

        const region = await screen.findByRole('region', { name: 'Sign everyone out' });
        // It is the last section on the page.
        const regions = screen.getAllByRole('region');
        expect(regions[regions.length - 1]).toBe(region);
        expect(region.className).toMatch(/destructive/);
        expect(section().getByText(/This cannot be undone/)).toBeInTheDocument();
        expect(writes).toEqual([]);
    });

    it('needs a reason and the exact phrase before the button works', async () => {
        const { writes } = setup();
        const user = userEvent.setup();
        await openLogin();

        await screen.findByRole('region', { name: 'Sign everyone out' });
        await user.click(section().getByRole('button', { name: 'Sign everyone out…' }));
        const dialog = await screen.findByRole('dialog');
        const submit = within(dialog).getByRole('button', { name: 'Sign everyone out' });
        expect(submit).toBeDisabled();

        // The phrase alone is not enough.
        await user.type(within(dialog).getByLabelText(/Type/), SIGN_OUT_PHRASE);
        expect(submit).toBeDisabled();
        // A reason of spaces is not a reason.
        await user.type(within(dialog).getByLabelText(/Reason/), '   ');
        expect(submit).toBeDisabled();
        await user.type(within(dialog).getByLabelText(/Reason/), 'security incident');
        expect(submit).toBeEnabled();

        // A wrong phrase turns it off again (the server checks it too).
        await user.type(within(dialog).getByLabelText(/Type/), 'X');
        expect(submit).toBeDisabled();
        expect(writes).toEqual([]);
    });

    it('sends the phrase and the reason, closes the dialog, and shows how many were signed out', async () => {
        const { writes } = setup();
        const user = userEvent.setup();
        await openLogin();

        await screen.findByRole('region', { name: 'Sign everyone out' });
        await user.click(section().getByRole('button', { name: 'Sign everyone out…' }));
        const dialog = await screen.findByRole('dialog');
        await user.type(within(dialog).getByLabelText(/Reason/), 'security incident');
        await user.type(within(dialog).getByLabelText(/Type/), SIGN_OUT_PHRASE);
        await user.click(within(dialog).getByRole('button', { name: 'Sign everyone out' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(writes).toEqual([
            { method: 'POST', path: '/api/admin/access/sign-out-everyone', body: { confirm: SIGN_OUT_PHRASE, reason: 'security incident' } },
        ]);
        expect(await screen.findByText('7 users were signed out.')).toBeInTheDocument();
    });

    it('says "1 user was signed out" for one', async () => {
        setup();
        server.use(http.post('/api/admin/access/sign-out-everyone', () => HttpResponse.json({ signedOut: 1 })));
        const user = userEvent.setup();
        await openLogin();

        await screen.findByRole('region', { name: 'Sign everyone out' });
        await user.click(section().getByRole('button', { name: 'Sign everyone out…' }));
        const dialog = await screen.findByRole('dialog');
        await user.type(within(dialog).getByLabelText(/Reason/), 'test');
        await user.type(within(dialog).getByLabelText(/Type/), SIGN_OUT_PHRASE);
        await user.click(within(dialog).getByRole('button', { name: 'Sign everyone out' }));

        expect(await screen.findByText('1 user was signed out.')).toBeInTheDocument();
    });

    it('cancel closes the dialog, sends nothing, and clears what was typed', async () => {
        const { writes } = setup();
        const user = userEvent.setup();
        await openLogin();

        await screen.findByRole('region', { name: 'Sign everyone out' });
        await user.click(section().getByRole('button', { name: 'Sign everyone out…' }));
        let dialog = await screen.findByRole('dialog');
        await user.type(within(dialog).getByLabelText(/Type/), SIGN_OUT_PHRASE);
        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(writes).toEqual([]);

        // Opened again, the phrase is gone: the owner must type it again.
        await user.click(section().getByRole('button', { name: 'Sign everyone out…' }));
        dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByLabelText(/Type/)).toHaveValue('');
    });

    it('shows the server error inside the dialog and keeps it open', async () => {
        setup();
        server.use(http.post('/api/admin/access/sign-out-everyone', () => HttpResponse.json({ message: 'Boom' }, { status: 500 })));
        const user = userEvent.setup();
        await openLogin();

        await screen.findByRole('region', { name: 'Sign everyone out' });
        await user.click(section().getByRole('button', { name: 'Sign everyone out…' }));
        const dialog = await screen.findByRole('dialog');
        await user.type(within(dialog).getByLabelText(/Reason/), 'test');
        await user.type(within(dialog).getByLabelText(/Type/), SIGN_OUT_PHRASE);
        await user.click(within(dialog).getByRole('button', { name: 'Sign everyone out' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Boom');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});
