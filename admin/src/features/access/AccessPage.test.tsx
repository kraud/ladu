import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/renderApp';
import { accessHandlers, makeAccess, makeInvite, type AccessWrite } from '@/test/access';
import { parseEmails } from '@/features/access/pages/AccessPage';
import type { AccessState } from '@/features/access/types';

const open = () => renderApp({ initialEntry: '/access', role: 'owner' });
const setup = (initial: AccessState = makeAccess()) => {
    const state = { current: initial };
    const writes: AccessWrite[] = [];
    server.use(...accessHandlers(state, writes));
    return { state, writes };
};
const modeButton = (name: string) => screen.getByRole('button', { name });

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

        expect(await screen.findByRole('heading', { name: 'Registration' })).toBeInTheDocument();
        expect(screen.queryByText('Boom')).not.toBeInTheDocument();
    });
});

describe('registration', () => {
    it('shows the saved state, who changed it, and an explanation of each state', async () => {
        setup(makeAccess({ registration: { mode: 'closed', note: 'Back at 14:00 UTC' }, updatedAt: '2026-10-01T10:00:00.000Z', updatedBy: 'Sam Staff' }));
        await open();

        await screen.findByRole('heading', { name: 'Registration' });
        expect(modeButton('Closed')).toHaveAttribute('aria-pressed', 'true');
        expect(modeButton('Open')).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByLabelText(/Extra line/)).toHaveValue('Back at 14:00 UTC');
        expect(screen.getByText(/Last changed .* by Sam Staff/)).toBeInTheDocument();
        expect(screen.getByText('Anybody can register.')).toBeInTheDocument();
        expect(screen.getByText(/Nobody can register\. A banner/)).toBeInTheDocument();
        expect(screen.getByText(/Only emails on the invite list can register\. An email leaves/)).toBeInTheDocument();
    });

    it('keeps Save off until something changes', async () => {
        setup();
        const user = userEvent.setup();
        await open();

        await screen.findByRole('heading', { name: 'Registration' });
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
        await user.click(modeButton('Closed'));
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
        await user.click(modeButton('Open'));
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('asks to confirm, says what will happen, then sends the mode, the line and the reason', async () => {
        const { writes } = setup();
        const user = userEvent.setup();
        await open();

        await screen.findByRole('heading', { name: 'Registration' });
        await user.click(modeButton('Closed'));
        await user.type(screen.getByLabelText(/Extra line/), '  Back at 14:00 UTC ');
        await user.click(screen.getByRole('button', { name: 'Save' }));

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
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('leaves the state alone when the owner cancels', async () => {
        const { writes } = setup();
        const user = userEvent.setup();
        await open();

        await screen.findByRole('heading', { name: 'Registration' });
        await user.click(modeButton('Closed'));
        await user.click(screen.getByRole('button', { name: 'Save' }));
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(writes).toEqual([]);
    });

    it('can save only the extra line, with its own wording', async () => {
        const { writes } = setup(makeAccess({ registration: { mode: 'closed', note: '' } }));
        const user = userEvent.setup();
        await open();

        await screen.findByRole('heading', { name: 'Registration' });
        await user.type(screen.getByLabelText(/Extra line/), 'Soon');
        await user.click(screen.getByRole('button', { name: 'Save' }));
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

        await screen.findByRole('heading', { name: 'Registration' });
        const note = screen.getByLabelText(/Extra line/);
        await user.click(note);
        await user.paste('x'.repeat(320));
        expect((note as HTMLTextAreaElement).value).toHaveLength(300);
        expect(screen.getByText(/300\/300/)).toBeInTheDocument();
    });

    it('warns when the state is limited and the list is empty, in the page and in the confirm', async () => {
        setup();
        const user = userEvent.setup();
        await open();

        await screen.findByRole('heading', { name: 'Registration' });
        expect(screen.queryByText(/invite list is empty, so nobody can register/)).not.toBeInTheDocument();
        await user.click(modeButton('Limited'));
        expect(screen.getByRole('alert')).toHaveTextContent('Registration is limited and the invite list is empty, so nobody can register.');
        await user.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByRole('dialog')).toHaveTextContent('The list is empty, so nobody can register now.');
    });

    it('does not warn when the list has emails', async () => {
        setup(makeAccess({ invites: [makeInvite()] }));
        const user = userEvent.setup();
        await open();

        await screen.findByRole('heading', { name: 'Registration' });
        await user.click(modeButton('Limited'));
        expect(screen.queryByText(/so nobody can register\./)).not.toBeInTheDocument();
    });

    it('shows the server error inside the dialog and keeps it open', async () => {
        setup();
        server.use(http.put('/api/admin/access/registration', () => HttpResponse.json({ message: 'Boom' }, { status: 500 })));
        const user = userEvent.setup();
        await open();

        await screen.findByRole('heading', { name: 'Registration' });
        await user.click(modeButton('Closed'));
        await user.click(screen.getByRole('button', { name: 'Save' }));
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
        expect(await screen.findByText('The invite list is empty.')).toBeInTheDocument();
        expect(screen.getByText(/The list stays when you switch to another state/)).toBeInTheDocument();
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
