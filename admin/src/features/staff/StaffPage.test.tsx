import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/renderApp';
import { makeStaff } from '@/test/msw/handlers';
import { makeMember, staffHandlers } from '@/test/staff';
import { passwordProblem } from '@/lib/password';
import type { StaffMember } from '@/features/staff/types';

const ME = makeMember({ id: 'staff-1', name: 'Sam Staff', email: 'staff@example.com', role: 'owner' });
const ROBIN = makeMember();
const disabledOne = makeMember({ id: 'staff-3', name: 'Dana Disabled', email: 'dana@example.test', role: 'viewer', status: 'disabled' });
const tempOne = makeMember({ id: 'staff-4', name: 'Tess Temp', email: 'tess@example.test', role: 'admin', mustChangePassword: true, lastLoginAt: null });

const open = () => renderApp({ initialEntry: '/staff', role: 'owner' });
// Inside the table only: the signed-in person's name is also in the header.
const rowOf = (name: string) => within(screen.getByRole('table')).getByText(name).closest('tr') as HTMLElement;

describe('who may open the page', () => {
    it('sends everyone without staff.manage to the overview, and hides the header link', async () => {
        server.use(...staffHandlers(() => [ME]));

        for (const role of ['viewer', 'support', 'admin'] as const) {
            const { router, unmount } = await renderApp({ initialEntry: '/staff', role });
            expect([role, router.state.location.pathname]).toEqual([role, '/']);
            expect(screen.queryByRole('link', { name: 'Staff' })).not.toBeInTheDocument();
            unmount();
        }
    });

    it('shows an owner the page, and the header link', async () => {
        server.use(...staffHandlers(() => [ME]));

        await open();

        expect(await screen.findByRole('heading', { name: 'Staff' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Staff' })).toBeInTheDocument();
    });
});

describe('the list', () => {
    it('shows each person with role, status, a temporary-password mark and the right buttons', async () => {
        server.use(...staffHandlers(() => [ME, ROBIN, disabledOne, tempOne]));

        await open();
        await screen.findByText('Robin Support');

        // Your own row: no action buttons, a pointer to "Change password".
        const mine = within(rowOf('Sam Staff'));
        expect(mine.getByText('(you)')).toBeInTheDocument();
        expect(mine.queryByRole('button')).not.toBeInTheDocument();

        const robin = within(rowOf('Robin Support'));
        expect(robin.getByText('support')).toBeInTheDocument();
        expect(robin.getByText('Active')).toBeInTheDocument();
        expect(robin.getAllByRole('button').map((b) => b.textContent)).toEqual(['Change role', 'Reset password', 'Disable']);

        const dana = within(rowOf('Dana Disabled'));
        expect(dana.getByText('Disabled')).toBeInTheDocument();
        expect(dana.getAllByRole('button').map((b) => b.textContent)).toEqual(['Change role', 'Reset password', 'Enable']);

        const tess = within(rowOf('Tess Temp'));
        expect(tess.getByText('Temporary password')).toBeInTheDocument();
        // Never signed in: a dash, not "Invalid Date".
        expect(tess.getAllByText('—').length).toBeGreaterThanOrEqual(1);
        expect(document.body).not.toHaveTextContent(/Invalid Date|undefined|null/);
    });

    it('shows the server error and tries again', async () => {
        let fail = true;
        server.use(http.get('/api/admin/staff', () => (fail ? HttpResponse.json({ message: 'Boom' }, { status: 500 }) : HttpResponse.json({ items: [ME] }))));
        const user = userEvent.setup();
        await open();

        expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
        fail = false;
        await user.click(screen.getByRole('button', { name: 'Try again' }));

        expect(await screen.findByText('(you)')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});

describe('add a staff member', () => {
    it('stays disabled until every field is valid, then sends the account with a role and a password', async () => {
        const writes: { method: string; path: string; body: Record<string, unknown> }[] = [];
        let members: StaffMember[] = [ME];
        server.use(
            ...staffHandlers(() => members, writes, (_path, body) => {
                const created = makeMember({ id: 'staff-new', name: String(body.name), email: String(body.email), role: body.role as StaffMember['role'], mustChangePassword: true });
                members = [...members, created];
                return created;
            }),
        );
        const user = userEvent.setup();
        await open();

        await user.click(await screen.findByRole('button', { name: 'Add staff member' }));
        const dialog = await screen.findByRole('dialog');
        const submit = within(dialog).getByRole('button', { name: 'Add staff member' });
        expect(submit).toBeDisabled();

        await user.type(within(dialog).getByLabelText('Email'), ' new@example.test ');
        await user.type(within(dialog).getByLabelText('Name'), 'New Person');
        expect(submit).toBeDisabled(); // no password yet
        await user.selectOptions(within(dialog).getByLabelText('Role'), 'admin');
        expect(within(dialog).getByText(/Users, deleting accounts, health and the audit log/)).toBeInTheDocument();
        await user.type(within(dialog).getByLabelText('Temporary password'), 'short');
        expect(within(dialog).getByText(/at least 12 characters/)).toBeInTheDocument();
        expect(submit).toBeDisabled();
        await user.clear(within(dialog).getByLabelText('Temporary password'));
        await user.type(within(dialog).getByLabelText('Temporary password'), 'twelve-chars-ok');
        expect(submit).toBeEnabled();
        await user.type(within(dialog).getByLabelText(/Reason/), 'new hire');
        await user.click(submit);

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(writes).toEqual([
            {
                method: 'POST',
                path: '/api/admin/staff',
                body: { email: 'new@example.test', name: 'New Person', role: 'admin', password: 'twelve-chars-ok', reason: 'new hire' },
            },
        ]);
        expect(screen.getByRole('status')).toHaveTextContent('New Person was added. Give them the temporary password.');
        // The list shows the new person without a reload.
        expect(await screen.findByText('New Person')).toBeInTheDocument();
        // The password is not left on the page.
        expect(document.body).not.toHaveTextContent('twelve-chars-ok');
    });

    it('can generate a password that the rules accept', async () => {
        server.use(...staffHandlers(() => [ME]));
        const user = userEvent.setup();
        await open();

        await user.click(await screen.findByRole('button', { name: 'Add staff member' }));
        const dialog = await screen.findByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: 'Generate' }));

        const value = (within(dialog).getByLabelText('Temporary password') as HTMLInputElement).value;
        expect(value).toHaveLength(20);
        expect(passwordProblem(value)).toBeNull();
        expect(within(dialog).getByRole('button', { name: 'Copy' })).toBeEnabled();
    });

    it('shows the server message when the email is taken, and keeps the dialog open', async () => {
        server.use(
            ...staffHandlers(() => [ME], [], () => HttpResponse.json({ message: 'A staff account with this email already exists' }, { status: 409 })),
        );
        const user = userEvent.setup();
        await open();

        await user.click(await screen.findByRole('button', { name: 'Add staff member' }));
        const dialog = await screen.findByRole('dialog');
        await user.type(within(dialog).getByLabelText('Email'), 'robin@example.test');
        await user.type(within(dialog).getByLabelText('Name'), 'Robin');
        await user.click(within(dialog).getByRole('button', { name: 'Generate' }));
        await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('A staff account with this email already exists');
        expect(within(dialog).getByRole('button', { name: 'Add staff member' })).toBeEnabled();
    });

    it('closes on Cancel and sends nothing', async () => {
        const writes: { method: string; path: string; body: Record<string, unknown> }[] = [];
        server.use(...staffHandlers(() => [ME], writes));
        const user = userEvent.setup();
        await open();

        await user.click(await screen.findByRole('button', { name: 'Add staff member' }));
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(writes).toEqual([]);
    });
});

describe('the other actions', () => {
    it('change role: disabled until the role differs, then sends it', async () => {
        const writes: { method: string; path: string; body: Record<string, unknown> }[] = [];
        server.use(...staffHandlers(() => [ME, ROBIN], writes));
        const user = userEvent.setup();
        await open();
        await screen.findByText('Robin Support');

        await user.click(within(rowOf('Robin Support')).getByRole('button', { name: 'Change role' }));
        const dialog = await screen.findByRole('dialog');
        const submit = within(dialog).getByRole('button', { name: 'Change role' });
        expect(submit).toBeDisabled();
        await user.selectOptions(within(dialog).getByLabelText('Role'), 'viewer');
        await user.click(submit);

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(writes).toEqual([{ method: 'POST', path: '/api/admin/staff/staff-2/role', body: { role: 'viewer' } }]);
        expect(screen.getByRole('status')).toHaveTextContent('Robin Support is now viewer.');
    });

    it('disable: needs a reason, and sends it', async () => {
        const writes: { method: string; path: string; body: Record<string, unknown> }[] = [];
        server.use(...staffHandlers(() => [ME, ROBIN], writes));
        const user = userEvent.setup();
        await open();
        await screen.findByText('Robin Support');

        await user.click(within(rowOf('Robin Support')).getByRole('button', { name: 'Disable' }));
        const dialog = await screen.findByRole('dialog');
        const submit = within(dialog).getByRole('button', { name: 'Disable account' });
        expect(submit).toBeDisabled();
        await user.type(within(dialog).getByLabelText(/Reason/), '   ');
        expect(submit).toBeDisabled();
        await user.type(within(dialog).getByLabelText(/Reason/), 'left the team');
        await user.click(submit);

        await waitFor(() => expect(writes).toEqual([{ method: 'POST', path: '/api/admin/staff/staff-2/disable', body: { reason: 'left the team' } }]));
        expect(await screen.findByRole('status')).toHaveTextContent('Robin Support is disabled.');
    });

    it('enable: can be confirmed at once', async () => {
        const writes: { method: string; path: string; body: Record<string, unknown> }[] = [];
        server.use(...staffHandlers(() => [ME, disabledOne], writes));
        const user = userEvent.setup();
        await open();
        await screen.findByText('Dana Disabled');

        await user.click(within(rowOf('Dana Disabled')).getByRole('button', { name: 'Enable' }));
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Enable account' }));

        await waitFor(() => expect(writes).toEqual([{ method: 'POST', path: '/api/admin/staff/staff-3/enable', body: {} }]));
    });

    it('reset password: needs a valid temporary password, sends it, and does not keep it on the page', async () => {
        const writes: { method: string; path: string; body: Record<string, unknown> }[] = [];
        server.use(...staffHandlers(() => [ME, ROBIN], writes));
        const user = userEvent.setup();
        await open();
        await screen.findByText('Robin Support');

        await user.click(within(rowOf('Robin Support')).getByRole('button', { name: 'Reset password' }));
        const dialog = await screen.findByRole('dialog');
        const submit = within(dialog).getByRole('button', { name: 'Reset password' });
        expect(submit).toBeDisabled();
        await user.type(within(dialog).getByLabelText('Temporary password'), 'a-fresh-temporary-1');
        await user.click(submit);

        await waitFor(() => expect(writes).toEqual([{ method: 'POST', path: '/api/admin/staff/staff-2/reset-password', body: { password: 'a-fresh-temporary-1' } }]));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(document.body).not.toHaveTextContent('a-fresh-temporary-1');
        expect(screen.getByRole('status')).toHaveTextContent('The password of Robin Support is reset.');
    });

    it('shows the server refusal inside the dialog, for example the last owner rule', async () => {
        server.use(
            ...staffHandlers(() => [ME, makeMember({ id: 'staff-9', name: 'Other Owner', role: 'owner' })], [], () =>
                HttpResponse.json({ message: 'This is the last active owner. Make another owner first' }, { status: 409 }),
            ),
        );
        const user = userEvent.setup();
        await open();
        await screen.findByText('Other Owner');

        await user.click(within(rowOf('Other Owner')).getByRole('button', { name: 'Disable' }));
        const dialog = await screen.findByRole('dialog');
        await user.type(within(dialog).getByLabelText(/Reason/), 'x');
        await user.click(within(dialog).getByRole('button', { name: 'Disable account' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('last active owner');
    });
});

describe('after a change', () => {
    it('marks the audit queries stale, because the change wrote an audit row', async () => {
        server.use(...staffHandlers(() => [ME, ROBIN]));
        const user = userEvent.setup();
        const { queryClient } = await open();
        await queryClient.prefetchQuery({ queryKey: ['audit', 'list', {}], queryFn: async () => ({ items: [], total: 0, page: 1, pageSize: 25 }) });
        expect(queryClient.getQueryState(['audit', 'list', {}])?.isInvalidated).toBe(false);
        await screen.findByText('Robin Support');

        await user.click(within(rowOf('Robin Support')).getByRole('button', { name: 'Disable' }));
        const dialog = await screen.findByRole('dialog');
        await user.type(within(dialog).getByLabelText(/Reason/), 'x');
        await user.click(within(dialog).getByRole('button', { name: 'Disable account' }));

        await waitFor(() => expect(queryClient.getQueryState(['audit', 'list', {}])?.isInvalidated).toBe(true));
    });
});

// A guard against the page and the fixture drifting apart.
describe('test data', () => {
    it('uses the same owner permissions as the server', () => {
        expect(makeStaff('owner').permissions).toContain('staff.manage');
        expect(makeStaff('admin').permissions).not.toContain('staff.manage');
    });
});
