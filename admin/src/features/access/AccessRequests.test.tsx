/**
 * The access requests in the admin app (access-requests.md, Slice 3): the Requests card under the invite
 * list and under the allowed accounts, Approve and Remove with a confirm dialog, the "no account found"
 * row, and the "Send email" button on the allowed accounts.
 */
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/renderApp';
import { accessHandlers, makeAccess, makeAllowed, makeLoginRequest, makeRequest, type AccessWrite } from '@/test/access';
import type { AccessState } from '@/features/access/types';

const setup = (initial: AccessState) => {
    const state = { current: initial };
    const writes: AccessWrite[] = [];
    server.use(...accessHandlers(state, writes));
    return { state, writes };
};
const withRequests = (extra: Partial<AccessState> = {}) =>
    makeAccess({
        registration: { mode: 'limited', note: '' },
        login: { mode: 'limited', note: '' },
        requests: {
            registration: [makeRequest()],
            login: [makeLoginRequest()],
        },
        ...extra,
    });

const openRegistration = async () => {
    await renderApp({ initialEntry: '/access', role: 'owner' });
    return within(await screen.findByRole('region', { name: 'Access requests (1)' }));
};
const openLogin = async () => {
    await renderApp({ initialEntry: '/access?tab=login', role: 'owner' });
    return within(await screen.findByRole('region', { name: 'Access requests (1)' }));
};
const dialog = () => within(screen.getByRole('dialog'));

describe('the registration requests card', () => {
    it('lists the request under the invite list, with its date', async () => {
        setup(withRequests());
        const card = await openRegistration();

        expect(card.getByText('newcomer@example.test')).toBeInTheDocument();
        expect(card.getByRole('button', { name: 'Approve newcomer@example.test' })).toBeEnabled();
        expect(card.queryByText('Account')).not.toBeInTheDocument();
        // It sits after the invite list in the page.
        const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
        expect(headings.findIndex((h) => h?.startsWith('Invite list'))).toBeLessThan(headings.findIndex((h) => h?.startsWith('Access requests')));
    });

    it('shows an empty state', async () => {
        setup(withRequests({ requests: { registration: [], login: [] } }));
        await renderApp({ initialEntry: '/access', role: 'owner' });
        const card = within(await screen.findByRole('region', { name: 'Access requests (0)' }));
        expect(card.getByText('There are no requests.')).toBeInTheDocument();
    });

    it('asks to confirm, says that no email is sent, then approves with the reason and moves the email to the invite list', async () => {
        const { writes } = setup(withRequests());
        const user = userEvent.setup();
        const card = await openRegistration();

        await user.click(card.getByRole('button', { name: 'Approve newcomer@example.test' }));
        expect(dialog().getByText(/Add newcomer@example.test to the invite list/)).toBeInTheDocument();
        expect(dialog().getByText(/does not send an email/)).toBeInTheDocument();
        // Nothing is sent before the confirm.
        expect(writes).toEqual([]);

        await user.type(dialog().getByLabelText(/Reason/), 'friend of the team');
        await user.click(dialog().getByRole('button', { name: 'Approve' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(writes).toEqual([
            { method: 'POST', path: '/api/admin/access/requests/request-1/approve', body: { reason: 'friend of the team' } },
        ]);
        expect(screen.getByRole('status')).toHaveTextContent('Added newcomer@example.test to the invite list.');
        // The row left the requests card and joined the invite list.
        const invites = within(screen.getByRole('region', { name: /^Invite list/ }));
        expect(invites.getByText('newcomer@example.test')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Access requests (0)' })).toBeInTheDocument();
    });

    it('sends no reason when the box is empty', async () => {
        const { writes } = setup(withRequests());
        const user = userEvent.setup();
        const card = await openRegistration();
        await user.click(card.getByRole('button', { name: 'Approve newcomer@example.test' }));
        await user.click(dialog().getByRole('button', { name: 'Approve' }));
        await waitFor(() => expect(writes).toHaveLength(1));
        expect(writes[0].body).toEqual({});
    });

    it('does nothing when the confirm is cancelled', async () => {
        const { writes } = setup(withRequests());
        const user = userEvent.setup();
        const card = await openRegistration();
        await user.click(card.getByRole('button', { name: 'Approve newcomer@example.test' }));
        await user.click(dialog().getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(writes).toEqual([]);
        expect(card.getByText('newcomer@example.test')).toBeInTheDocument();
    });

    it('removes a request after a confirm, and adds nothing to a list', async () => {
        const { writes } = setup(withRequests());
        const user = userEvent.setup();
        const card = await openRegistration();

        await user.click(card.getByRole('button', { name: 'Remove the request from newcomer@example.test' }));
        expect(dialog().getByText(/Nothing is added to a list/)).toBeInTheDocument();
        await user.click(dialog().getByRole('button', { name: 'Remove' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(writes).toEqual([{ method: 'DELETE', path: '/api/admin/access/requests/request-1', body: {} }]);
        expect(screen.getByRole('status')).toHaveTextContent('Removed the request from newcomer@example.test.');
        expect(screen.getByRole('region', { name: 'Access requests (0)' })).toBeInTheDocument();
        expect(within(screen.getByRole('region', { name: /^Invite list/ })).queryByText('newcomer@example.test')).not.toBeInTheDocument();
    });

    it('shows the server error in the dialog and keeps the request', async () => {
        setup(withRequests());
        server.use(
            http.post('/api/admin/access/requests/:id/approve', () =>
                HttpResponse.json({ message: 'This email already has an account, so an invite is not needed' }, { status: 409 }),
            ),
        );
        const user = userEvent.setup();
        const card = await openRegistration();
        await user.click(card.getByRole('button', { name: 'Approve newcomer@example.test' }));
        await user.click(dialog().getByRole('button', { name: 'Approve' }));

        expect(await dialog().findByRole('alert')).toHaveTextContent('already has an account');
        expect(card.getByText('newcomer@example.test')).toBeInTheDocument();
    });

    it('says when the gate is closed that an approved email takes effect later', async () => {
        setup(withRequests({ registration: { mode: 'closed', note: '' } }));
        const card = await openRegistration();
        expect(card.getByText(/takes effect when the gate is limited/)).toBeInTheDocument();
    });
});

describe('the login requests card', () => {
    it('shows the matching account with its status, and approves it into the allowed accounts', async () => {
        const { writes } = setup(withRequests());
        const user = userEvent.setup();
        const card = await openLogin();

        expect(card.getByText('Kaja Tamm')).toBeInTheDocument();
        await user.click(card.getByRole('button', { name: 'Approve kaja@example.com' }));
        expect(dialog().getByText(/Allow kaja@example.com to sign in/)).toBeInTheDocument();
        expect(dialog().getByText(/does not send an email/)).toBeInTheDocument();
        await user.click(dialog().getByRole('button', { name: 'Approve' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(writes).toEqual([{ method: 'POST', path: '/api/admin/access/requests/login-request-1/approve', body: {} }]);
        expect(screen.getByRole('status')).toHaveTextContent('Added kaja@example.com to the allowed accounts.');
        const allowed = within(screen.getByRole('region', { name: /^Allowed accounts/ }));
        expect(allowed.getByText('kaja@example.com')).toBeInTheDocument();
    });

    it('turns Approve off for a request with no account, and says why', async () => {
        setup(withRequests({ requests: { registration: [], login: [makeLoginRequest({ email: 'ghost@example.com', account: null })] } }));
        const card = await openLogin();

        expect(card.getByText('No account found')).toBeInTheDocument();
        const approve = card.getByRole('button', { name: 'Approve ghost@example.com' });
        expect(approve).toBeDisabled();
        expect(approve).toHaveAttribute('title', expect.stringContaining('cannot be allowed to sign in'));
        // The owner can still clear it.
        expect(card.getByRole('button', { name: 'Remove the request from ghost@example.com' })).toBeEnabled();
    });

    it('turns Approve off for a deleted account', async () => {
        setup(
            withRequests({
                requests: { registration: [], login: [makeLoginRequest({ account: { userId: 'u1', name: 'Kaja Tamm', status: 'deleted' } })] },
            }),
        );
        const card = await openLogin();
        expect(card.getByRole('button', { name: 'Approve kaja@example.com' })).toBeDisabled();
    });

    it('keeps the registration requests off the login tab', async () => {
        setup(withRequests());
        const card = await openLogin();
        expect(card.queryByText('newcomer@example.test')).not.toBeInTheDocument();
    });
});

describe('Send email on the allowed accounts', () => {
    const allowedState = () =>
        withRequests({
            requests: { registration: [], login: [makeLoginRequest({ email: 'other@example.com', account: null })] },
            loginAllowed: [makeAllowed()],
        });

    it('confirms, sends the email with the reason, keeps the account on the list, and offers to send again', async () => {
        const { writes } = setup(allowedState());
        const user = userEvent.setup();
        await openLogin();
        const allowed = within(screen.getByRole('region', { name: /^Allowed accounts/ }));

        await user.click(allowed.getByRole('button', { name: 'Send email to kaja@example.com' }));
        expect(dialog().getByText(/Email kaja@example.com to say that this account can sign in now/)).toBeInTheDocument();
        expect(writes).toEqual([]);

        await user.type(dialog().getByLabelText(/Reason/), 'opening day');
        await user.click(dialog().getByRole('button', { name: 'Send email' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(writes).toEqual([{ method: 'POST', path: '/api/admin/access/login-allowed/u1/send', body: { reason: 'opening day' } }]);
        expect(screen.getByRole('status')).toHaveTextContent('Sign-in email sent to kaja@example.com.');
        expect(allowed.getByText('kaja@example.com')).toBeInTheDocument();
        expect(allowed.getByRole('button', { name: 'Send email to kaja@example.com' })).toHaveTextContent('Send again');
    });

    it('does not send when the confirm is cancelled', async () => {
        const { writes } = setup(allowedState());
        const user = userEvent.setup();
        await openLogin();
        const allowed = within(screen.getByRole('region', { name: /^Allowed accounts/ }));
        await user.click(allowed.getByRole('button', { name: 'Send email to kaja@example.com' }));
        await user.click(dialog().getByRole('button', { name: 'Cancel' }));
        expect(writes).toEqual([]);
        expect(allowed.getByRole('button', { name: 'Send email to kaja@example.com' })).toHaveTextContent('Send email');
    });

    it('turns the button off for a banned or deleted account', async () => {
        setup(
            withRequests({
                requests: { registration: [], login: [] },
                loginAllowed: [makeAllowed({ userId: 'u2', email: 'banned@example.com', status: 'banned' }), makeAllowed({ userId: 'u3', email: 'gone@example.com', status: 'deleted' })],
            }),
        );
        await renderApp({ initialEntry: '/access?tab=login', role: 'owner' });
        const allowed = within(await screen.findByRole('region', { name: /^Allowed accounts/ }));
        expect(allowed.getByRole('button', { name: 'Send email to banned@example.com' })).toBeDisabled();
        expect(allowed.getByRole('button', { name: 'Send email to gone@example.com' })).toBeDisabled();
    });

    it('shows the server error in the dialog', async () => {
        setup(allowedState());
        server.use(
            http.post('/api/admin/access/login-allowed/:userId/send', () =>
                HttpResponse.json({ message: 'This account is not on the allowed list' }, { status: 404 }),
            ),
        );
        const user = userEvent.setup();
        await openLogin();
        const allowed = within(screen.getByRole('region', { name: /^Allowed accounts/ }));
        await user.click(allowed.getByRole('button', { name: 'Send email to kaja@example.com' }));
        await user.click(dialog().getByRole('button', { name: 'Send email' }));
        expect(await dialog().findByRole('alert')).toHaveTextContent('not on the allowed list');
    });
});
