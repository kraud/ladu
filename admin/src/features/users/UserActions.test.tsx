import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/renderApp';
import { makeDetail, usersListHandler } from '@/test/users';
import type { UserDetail } from '@/features/users/types';
import type { StaffRole } from '@/stores/authStore';

/** Serves the detail and records every action request. The detail is what the next GET and the next action return. */
function serveUser(initial: UserDetail, actionResult?: (action: string) => UserDetail | { purged: true } | Response) {
    let current = initial;
    const calls: { action: string; body: Record<string, unknown> }[] = [];
    server.use(
        http.get('/api/admin/users/:id', () => HttpResponse.json(current)),
        http.post('/api/admin/users/:id/:action', async ({ params, request }) => {
            const action = String(params.action);
            calls.push({ action, body: (await request.json()) as Record<string, unknown> });
            const result = actionResult?.(action) ?? current;
            if (result instanceof Response) return result;
            if (!('purged' in result)) current = result;
            return HttpResponse.json(result);
        }),
    );
    return calls;
}

const open = (role: StaffRole) => renderApp({ initialEntry: '/users/u1', role });
const buttonNames = () =>
    within(screen.getByRole('heading', { name: 'Actions' }).closest('section') as HTMLElement)
        .getAllByRole('button')
        .map((b) => b.textContent);

describe('which buttons are shown', () => {
    it.each<[StaffRole, UserDetail['status'], string[] | null]>([
        ['support', 'active', ['Ban', 'Force logout', 'Send password reset']],
        ['admin', 'active', ['Ban', 'Force logout', 'Send password reset', 'Delete']],
        ['owner', 'active', ['Ban', 'Force logout', 'Send password reset', 'Delete']],
        ['admin', 'banned', ['Unban', 'Force logout', 'Send password reset', 'Delete']],
        ['support', 'banned', ['Unban', 'Force logout', 'Send password reset']],
        ['admin', 'deleted', ['Restore']],
        ['owner', 'deleted', ['Restore', 'Delete for good']],
        ['support', 'deleted', null],
        ['viewer', 'active', null],
    ])('%s on a %s account', async (role, status, expected) => {
        serveUser(makeDetail({ status }));

        await open(role);
        await screen.findByRole('heading', { name: 'Kaja Tamm' });

        if (expected === null) expect(screen.queryByRole('heading', { name: 'Actions' })).not.toBeInTheDocument();
        else expect(buttonNames()).toEqual(expected);
    });
});

describe('email actions', () => {
    it('show only for an account that needs them', async () => {
        serveUser(makeDetail({ verified: false, hasPassword: false }));
        await open('support');
        await screen.findByRole('heading', { name: 'Kaja Tamm' });
        // Not verified, and no password (a Google-only account): verification only.
        expect(buttonNames()).toEqual(['Ban', 'Force logout', 'Resend verification email']);
    });

    it('a viewer sees neither', async () => {
        serveUser(makeDetail({ verified: false }));
        await open('viewer');
        await screen.findByRole('heading', { name: 'Kaja Tamm' });
        expect(screen.queryByRole('button', { name: /Resend verification|Send password reset/ })).not.toBeInTheDocument();
    });

    it('sends without a reason and does not say "sent" or "delivered"', async () => {
        const calls = serveUser(makeDetail({ verified: false }));
        const user = userEvent.setup();
        await open('support');

        await user.click(await screen.findByRole('button', { name: 'Resend verification email' }));
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Send email' }));

        await waitFor(() => expect(calls).toEqual([{ action: 'resend-verification', body: {} }]));
        const notice = await screen.findByRole('status');
        expect(notice).toHaveTextContent('The email was handed to the mail service. We cannot tell if it arrived.');
        expect(notice).not.toHaveTextContent(/delivered|was sent/);
    });

    it('shows the cooldown message of the server inside the dialog', async () => {
        serveUser(makeDetail(), () =>
            HttpResponse.json({ message: 'This email was sent a moment ago. Try again in 4 minutes.' }, { status: 429 }),
        );
        const user = userEvent.setup();
        await open('support');

        await user.click(await screen.findByRole('button', { name: 'Send password reset' }));
        const dialog = await screen.findByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: 'Send email' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Try again in 4 minutes.');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});

describe('ban', () => {
    it('needs a reason, sends it, and shows the new status', async () => {
        const calls = serveUser(makeDetail(), () => makeDetail({ status: 'banned', bannedAt: '2026-10-01T10:00:00.000Z', banReason: 'spam links' }));
        const user = userEvent.setup();
        await open('support');

        await user.click(await screen.findByRole('button', { name: 'Ban' }));
        const dialog = await screen.findByRole('dialog');
        const confirm = within(dialog).getByRole('button', { name: 'Ban account' });
        expect(confirm).toBeDisabled();

        await user.type(within(dialog).getByLabelText(/Reason/), '  spam links ');
        expect(confirm).toBeEnabled();
        await user.click(confirm);

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(calls).toEqual([{ action: 'ban', body: { reason: 'spam links' } }]);
        expect(screen.getByRole('status')).toHaveTextContent('The account is banned.');
        expect(screen.getByText('Banned', { selector: 'span' })).toBeInTheDocument();
        // The buttons follow the new status.
        expect(buttonNames()).toEqual(['Unban', 'Force logout', 'Send password reset']);
    });

    it('does not accept a reason of only spaces', async () => {
        serveUser(makeDetail());
        const user = userEvent.setup();
        await open('support');

        await user.click(await screen.findByRole('button', { name: 'Ban' }));
        const dialog = await screen.findByRole('dialog');
        await user.type(within(dialog).getByLabelText(/Reason/), '    ');

        expect(within(dialog).getByRole('button', { name: 'Ban account' })).toBeDisabled();
    });

    it('closes on Cancel and sends nothing', async () => {
        const calls = serveUser(makeDetail());
        const user = userEvent.setup();
        await open('support');

        await user.click(await screen.findByRole('button', { name: 'Ban' }));
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(calls).toEqual([]);
    });

    it('starts empty each time the dialog opens', async () => {
        serveUser(makeDetail());
        const user = userEvent.setup();
        await open('support');

        await user.click(await screen.findByRole('button', { name: 'Ban' }));
        await user.type(within(await screen.findByRole('dialog')).getByLabelText(/Reason/), 'typed once');
        await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: 'Ban' }));

        expect(within(await screen.findByRole('dialog')).getByLabelText(/Reason/)).toHaveValue('');
    });

    it('shows the server message and keeps the dialog open when the server refuses', async () => {
        serveUser(makeDetail(), () => HttpResponse.json({ message: 'This account is already banned' }, { status: 409 }));
        const user = userEvent.setup();
        await open('support');

        await user.click(await screen.findByRole('button', { name: 'Ban' }));
        const dialog = await screen.findByRole('dialog');
        await user.type(within(dialog).getByLabelText(/Reason/), 'spam');
        await user.click(within(dialog).getByRole('button', { name: 'Ban account' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('This account is already banned');
        expect(within(dialog).getByRole('button', { name: 'Ban account' })).toBeEnabled();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});

describe('optional reason', () => {
    it('unban can be confirmed at once, and sends no reason', async () => {
        const calls = serveUser(makeDetail({ status: 'banned', bannedAt: '2026-10-01T10:00:00.000Z' }), () => makeDetail());
        const user = userEvent.setup();
        await open('support');

        await user.click(await screen.findByRole('button', { name: 'Unban' }));
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Unban account' }));

        await waitFor(() => expect(calls).toHaveLength(1));
        expect(calls[0]).toEqual({ action: 'unban', body: {} });
        expect(await screen.findByRole('status')).toHaveTextContent('The account is unbanned.');
    });

    it('force logout sends a reason when one is typed', async () => {
        const calls = serveUser(makeDetail());
        const user = userEvent.setup();
        await open('support');

        await user.click(await screen.findByRole('button', { name: 'Force logout' }));
        const dialog = await screen.findByRole('dialog');
        await user.type(within(dialog).getByLabelText(/Reason/), 'stolen laptop');
        await user.click(within(dialog).getByRole('button', { name: 'Force logout' }));

        await waitFor(() => expect(calls).toEqual([{ action: 'force-logout', body: { reason: 'stolen laptop' } }]));
    });
});

describe('delete (type the username)', () => {
    it('stays disabled until the exact username is typed, then sends it with the reason', async () => {
        const calls = serveUser(makeDetail(), () =>
            makeDetail({ status: 'deleted', deletedAt: '2026-10-01T10:00:00.000Z', deletedByStaffName: 'Sam Staff' }),
        );
        const user = userEvent.setup();
        await open('admin');

        await user.click(await screen.findByRole('button', { name: 'Delete' }));
        const dialog = await screen.findByRole('dialog');
        const confirm = within(dialog).getByRole('button', { name: 'Delete account' });
        await user.type(within(dialog).getByLabelText(/Reason/), 'gdpr request');
        expect(confirm).toBeDisabled();

        const typed = within(dialog).getByLabelText(/to confirm/);
        await user.type(typed, 'KAJA');
        expect(confirm).toBeDisabled();
        await user.clear(typed);
        await user.type(typed, 'kaja');
        expect(confirm).toBeEnabled();
        await user.click(confirm);

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(calls).toEqual([{ action: 'delete', body: { reason: 'gdpr request', confirmUsername: 'kaja' } }]);
        expect(screen.getByText(/Deleted on .* by Sam Staff/)).toBeInTheDocument();
        expect(buttonNames()).toEqual(['Restore']);
    });

    it('does not let Enter submit before the form is valid', async () => {
        const calls = serveUser(makeDetail());
        const user = userEvent.setup();
        await open('admin');

        await user.click(await screen.findByRole('button', { name: 'Delete' }));
        const dialog = await screen.findByRole('dialog');
        await user.type(within(dialog).getByLabelText(/to confirm/), 'kaja{Enter}');

        expect(calls).toEqual([]);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});

describe('restore and purge', () => {
    it('restores an account', async () => {
        const calls = serveUser(makeDetail({ status: 'deleted', deletedAt: '2026-10-01T10:00:00.000Z' }), () => makeDetail());
        const user = userEvent.setup();
        await open('admin');

        await user.click(await screen.findByRole('button', { name: 'Restore' }));
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restore account' }));

        await waitFor(() => expect(calls).toEqual([{ action: 'restore', body: {} }]));
        expect(await screen.findByRole('status')).toHaveTextContent('The account is restored.');
        expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('purges for good, then goes back to the users list', async () => {
        const calls = serveUser(makeDetail({ status: 'deleted', deletedAt: '2026-10-01T10:00:00.000Z' }), () => ({ purged: true }));
        server.use(usersListHandler(() => ({ items: [], total: 0 })));
        const user = userEvent.setup();
        const { router } = await open('owner');

        await user.click(await screen.findByRole('button', { name: 'Delete for good' }));
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText(/cannot undo/)).toBeInTheDocument();
        await user.type(within(dialog).getByLabelText(/Reason/), 'gdpr erasure');
        await user.type(within(dialog).getByLabelText(/to confirm/), 'kaja');
        await user.click(within(dialog).getByRole('button', { name: 'Delete for good' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/users'));
        expect(calls).toEqual([{ action: 'purge', body: { reason: 'gdpr erasure', confirmUsername: 'kaja' } }]);
        expect(await screen.findByText('No users match.')).toBeInTheDocument();
    });
});

describe('cache', () => {
    it('marks the users list stale after an action, so a status filter is not wrong', async () => {
        serveUser(makeDetail(), () => makeDetail({ status: 'banned', bannedAt: '2026-10-01T10:00:00.000Z', banReason: 'spam' }));
        let listCalls = 0;
        server.use(
            usersListHandler(() => {
                listCalls += 1;
                return {};
            }),
        );
        const user = userEvent.setup();
        const { queryClient } = await open('support');
        await queryClient.prefetchQuery({ queryKey: ['users', 'list', {}], queryFn: async () => ({ items: [], total: 0, page: 1, pageSize: 25 }) });
        expect(queryClient.getQueryState(['users', 'list', {}])?.isInvalidated).toBe(false);

        await user.click(await screen.findByRole('button', { name: 'Ban' }));
        const dialog = await screen.findByRole('dialog');
        await user.type(within(dialog).getByLabelText(/Reason/), 'spam');
        await user.click(within(dialog).getByRole('button', { name: 'Ban account' }));

        await waitFor(() => expect(queryClient.getQueryState(['users', 'list', {}])?.isInvalidated).toBe(true));
        expect(listCalls).toBe(0); // no list is on screen, so nothing is refetched yet
    });
});
