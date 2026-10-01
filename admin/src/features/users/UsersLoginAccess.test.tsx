/**
 * Who may sign in (access-gates.md, PR 2), seen from the users list and the user page: a column, a filter,
 * ticks with a bar for many users, and a section with a button on the user page. Only a role with
 * `access.manage` (the owner) sees any of it.
 */
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/renderApp';
import { accessHandlers, makeAccess, type AccessWrite } from '@/test/access';
import { makeDetail, makeListItem, usersListHandler } from '@/test/users';

const KAJA = makeListItem({ id: 'u1', name: 'Kaja Tamm', email: 'kaja@example.com', loginAllowed: true });
const MART = makeListItem({ id: 'u2', name: 'Mart Kask', email: 'mart@example.com', username: 'mart', loginAllowed: false });
const LIIS = makeListItem({ id: 'u3', name: 'Liis Mets', email: 'liis@example.com', username: 'liis', loginAllowed: false });

const serveList = (requests: URLSearchParams[] = []) => {
    server.use(usersListHandler(() => ({ items: [KAJA, MART, LIIS] }), requests));
    return requests;
};
const serveAccess = () => {
    const writes: AccessWrite[] = [];
    server.use(...accessHandlers({ current: makeAccess() }, writes));
    return writes;
};
const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

describe('users list: who may sign in', () => {
    it('shows an owner a checkbox on each row, a select-all box, and a Login allowed column', async () => {
        serveList();
        await renderApp({ initialEntry: '/users', role: 'owner' });

        await screen.findByRole('link', { name: 'Kaja Tamm' });
        expect(screen.getByRole('columnheader', { name: 'Login allowed' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Select all users on this page' })).toBeInTheDocument();
        expect(within(rowOf('Kaja Tamm')).getByRole('checkbox', { name: 'Select Kaja Tamm' })).toBeInTheDocument();
        expect(within(rowOf('Kaja Tamm')).getByText('Yes')).toBeInTheDocument();
        expect(within(rowOf('Mart Kask')).getByText('No')).toBeInTheDocument();
    });

    it('shows no checkbox, no column and no filter to a role without access.manage', async () => {
        server.use(usersListHandler(() => ({ items: [makeListItem()] })));
        for (const role of ['admin', 'support', 'viewer'] as const) {
            const { unmount } = await renderApp({ initialEntry: '/users', role });
            await screen.findByRole('link', { name: 'Kaja Tamm' });
            expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
            expect(screen.queryByRole('columnheader', { name: 'Login allowed' })).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Login allowed')).not.toBeInTheDocument();
            unmount();
        }
    });

    it('filters by Login allowed, and keeps the choice in the URL', async () => {
        const requests = serveList();
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/users', role: 'owner' });
        await screen.findByRole('link', { name: 'Kaja Tamm' });

        await user.selectOptions(screen.getByLabelText('Login allowed'), 'true');

        await waitFor(() => expect(router.state.location.search).toMatchObject({ loginAllowed: 'true' }));
        await waitFor(() => expect(requests.some((p) => p.get('loginAllowed') === 'true')).toBe(true));
        expect(requests[0].has('loginAllowed')).toBe(false);
    });

    it('reads the filter from the URL, and drops a bad value', async () => {
        const requests = serveList();
        await renderApp({ initialEntry: '/users?loginAllowed=false', role: 'owner' });
        await screen.findByRole('link', { name: 'Kaja Tamm' });
        expect(requests[0].get('loginAllowed')).toBe('false');
        expect(screen.getByLabelText('Login allowed')).toHaveValue('false');
    });

    it('drops a bad filter value in the URL instead of showing an error', async () => {
        const requests = serveList();
        await renderApp({ initialEntry: '/users?loginAllowed=maybe', role: 'owner' });
        await screen.findByRole('link', { name: 'Kaja Tamm' });
        expect(requests[0].has('loginAllowed')).toBe(false);
    });

    it('shows a bar only while something is ticked, and counts the ticks', async () => {
        serveList();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/users', role: 'owner' });
        await screen.findByRole('link', { name: 'Kaja Tamm' });

        expect(screen.queryByRole('toolbar', { name: 'Selected users' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('checkbox', { name: 'Select Kaja Tamm' }));
        const bar = screen.getByRole('toolbar', { name: 'Selected users' });
        expect(bar).toHaveTextContent('1 selected:');
        await user.click(screen.getByRole('checkbox', { name: 'Select Mart Kask' }));
        expect(bar).toHaveTextContent('2 selected:');
        await user.click(screen.getByRole('checkbox', { name: 'Select Mart Kask' }));
        expect(bar).toHaveTextContent('1 selected:');
        await user.click(within(bar).getByRole('button', { name: 'Clear selection' }));
        expect(screen.queryByRole('toolbar', { name: 'Selected users' })).not.toBeInTheDocument();
    });

    it('selects every row on the page with the top box, shows a half state, and clears with a second click', async () => {
        serveList();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/users', role: 'owner' });
        await screen.findByRole('link', { name: 'Kaja Tamm' });
        const all = screen.getByRole('checkbox', { name: 'Select all users on this page' }) as HTMLInputElement;

        await user.click(screen.getByRole('checkbox', { name: 'Select Kaja Tamm' }));
        expect(all.checked).toBe(false);
        expect(all.indeterminate).toBe(true);

        await user.click(all);
        expect(screen.getByRole('toolbar', { name: 'Selected users' })).toHaveTextContent('3 selected:');
        expect(all.checked).toBe(true);
        expect(all.indeterminate).toBe(false);
        for (const name of ['Kaja Tamm', 'Mart Kask', 'Liis Mets']) {
            expect(screen.getByRole('checkbox', { name: `Select ${name}` })).toBeChecked();
        }

        await user.click(all);
        expect(screen.queryByRole('toolbar', { name: 'Selected users' })).not.toBeInTheDocument();
        expect(all.checked).toBe(false);
    });

    it('allows the ticked users to sign in: sends their ids, shows the result, and clears the ticks', async () => {
        serveList();
        const writes = serveAccess();
        server.use(
            http.post('/api/admin/access/login-allowed', async ({ request }) => {
                writes.push({ method: 'POST', path: '/api/admin/access/login-allowed', body: (await request.json()) as Record<string, unknown> });
                return HttpResponse.json({
                    ...makeAccess(),
                    added: [{ userId: 'u2', email: 'mart@example.com' }],
                    skipped: [
                        { value: 'u1', reason: 'already_allowed' },
                        { value: 'u3', reason: 'deleted' },
                    ],
                });
            }),
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/users', role: 'owner' });
        await screen.findByRole('link', { name: 'Kaja Tamm' });

        await user.click(screen.getByRole('checkbox', { name: 'Select all users on this page' }));
        await user.click(screen.getByRole('button', { name: 'Allow to sign in' }));

        expect(await screen.findByRole('status')).toHaveTextContent(
            'Allowed 1 to sign in. Skipped 2: 1 already on the allowed list, 1 the account is deleted.',
        );
        expect(writes).toEqual([{ method: 'POST', path: '/api/admin/access/login-allowed', body: { userIds: ['u1', 'u2', 'u3'] } }]);
        expect(screen.queryByRole('toolbar', { name: 'Selected users' })).not.toBeInTheDocument();
    });

    it('removes the ticked users from the allowed list: sends their ids and shows the result', async () => {
        serveList();
        const writes = serveAccess();
        server.use(
            http.post('/api/admin/access/login-allowed/remove', async ({ request }) => {
                writes.push({ method: 'POST', path: '/api/admin/access/login-allowed/remove', body: (await request.json()) as Record<string, unknown> });
                return HttpResponse.json({ ...makeAccess(), removed: 1, skipped: 1 });
            }),
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/users', role: 'owner' });
        await screen.findByRole('link', { name: 'Kaja Tamm' });

        await user.click(screen.getByRole('checkbox', { name: 'Select Kaja Tamm' }));
        await user.click(screen.getByRole('checkbox', { name: 'Select Mart Kask' }));
        await user.click(screen.getByRole('button', { name: 'Remove from allowed' }));

        expect(await screen.findByRole('status')).toHaveTextContent('Removed 1 from the allowed list. Skipped 1: not on the list.');
        expect(writes).toEqual([{ method: 'POST', path: '/api/admin/access/login-allowed/remove', body: { userIds: ['u1', 'u2'] } }]);
    });

    it('reads the list again after a change, so the column is current', async () => {
        let mart = false;
        server.use(usersListHandler(() => ({ items: [KAJA, makeListItem({ ...MART, loginAllowed: mart })] })));
        const writes: AccessWrite[] = [];
        server.use(
            http.post('/api/admin/access/login-allowed', async ({ request }) => {
                writes.push({ method: 'POST', path: '/api/admin/access/login-allowed', body: (await request.json()) as Record<string, unknown> });
                mart = true;
                return HttpResponse.json({ ...makeAccess(), added: [{ userId: 'u2', email: 'mart@example.com' }], skipped: [] });
            }),
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/users', role: 'owner' });
        await screen.findByRole('link', { name: 'Kaja Tamm' });
        expect(within(rowOf('Mart Kask')).getByText('No')).toBeInTheDocument();

        await user.click(screen.getByRole('checkbox', { name: 'Select Mart Kask' }));
        await user.click(screen.getByRole('button', { name: 'Allow to sign in' }));

        await waitFor(() => expect(within(rowOf('Mart Kask')).getByText('Yes')).toBeInTheDocument());
    });

    it('clears the ticks when the list changes (a new filter shows other rows)', async () => {
        serveList();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/users', role: 'owner' });
        await screen.findByRole('link', { name: 'Kaja Tamm' });

        await user.click(screen.getByRole('checkbox', { name: 'Select Kaja Tamm' }));
        expect(screen.getByRole('toolbar', { name: 'Selected users' })).toBeInTheDocument();
        await user.selectOptions(screen.getByLabelText('Status'), 'active');

        await waitFor(() => expect(screen.queryByRole('toolbar', { name: 'Selected users' })).not.toBeInTheDocument());
    });

    it('shows the server error in the bar and keeps the ticks', async () => {
        serveList();
        serveAccess();
        server.use(http.post('/api/admin/access/login-allowed', () => HttpResponse.json({ message: 'Boom' }, { status: 500 })));
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/users', role: 'owner' });
        await screen.findByRole('link', { name: 'Kaja Tamm' });

        await user.click(screen.getByRole('checkbox', { name: 'Select Kaja Tamm' }));
        await user.click(screen.getByRole('button', { name: 'Allow to sign in' }));

        expect(await within(screen.getByRole('toolbar', { name: 'Selected users' })).findByRole('alert')).toHaveTextContent('Boom');
        expect(screen.getByRole('checkbox', { name: 'Select Kaja Tamm' })).toBeChecked();
    });
});

describe('user page: sign-in access', () => {
    const serveDetail = (loginAllowed: boolean | null) => {
        let allowed = loginAllowed;
        server.use(http.get('/api/admin/users/:id', () => HttpResponse.json(makeDetail({ loginAllowed: allowed }))));
        return (next: boolean) => {
            allowed = next;
        };
    };

    it('shows an owner the state and a button to allow', async () => {
        serveDetail(false);
        await renderApp({ initialEntry: '/users/u1', role: 'owner' });

        const section = within((await screen.findByRole('heading', { name: 'Sign-in access' })).closest('section') as HTMLElement);
        expect(section.getByText('No')).toBeInTheDocument();
        expect(section.getByText(/It only matters while login is limited/)).toBeInTheDocument();
        expect(section.getByRole('button', { name: 'Allow to sign in' })).toBeInTheDocument();
    });

    it('shows a button to remove when the account is on the list', async () => {
        serveDetail(true);
        await renderApp({ initialEntry: '/users/u1', role: 'owner' });

        const section = within((await screen.findByRole('heading', { name: 'Sign-in access' })).closest('section') as HTMLElement);
        expect(section.getByText('Yes')).toBeInTheDocument();
        expect(section.getByRole('button', { name: 'Remove from the allowed list' })).toBeInTheDocument();
    });

    it('has no section for a role that may not see it', async () => {
        for (const role of ['admin', 'support', 'viewer'] as const) {
            serveDetail(null);
            const { unmount } = await renderApp({ initialEntry: '/users/u1', role });
            await screen.findByRole('heading', { name: 'Kaja Tamm' });
            expect(screen.queryByRole('heading', { name: 'Sign-in access' })).not.toBeInTheDocument();
            unmount();
        }
    });

    it('allows the account, and shows the new state after the page reads the user again', async () => {
        const set = serveDetail(false);
        const writes: AccessWrite[] = [];
        server.use(
            http.post('/api/admin/access/login-allowed', async ({ request }) => {
                writes.push({ method: 'POST', path: '/api/admin/access/login-allowed', body: (await request.json()) as Record<string, unknown> });
                set(true);
                return HttpResponse.json({ ...makeAccess(), added: [{ userId: 'u1', email: 'kaja@example.com' }], skipped: [] });
            }),
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/users/u1', role: 'owner' });

        await user.click(await screen.findByRole('button', { name: 'Allow to sign in' }));

        expect(await screen.findByText('This account can now sign in while login is limited.')).toBeInTheDocument();
        expect(writes).toEqual([{ method: 'POST', path: '/api/admin/access/login-allowed', body: { userIds: ['u1'] } }]);
        expect(await screen.findByRole('button', { name: 'Remove from the allowed list' })).toBeInTheDocument();
    });

    it('says why when the server cannot add the account (a deleted one)', async () => {
        serveDetail(false);
        server.use(
            http.post('/api/admin/access/login-allowed', () =>
                HttpResponse.json({ ...makeAccess(), added: [], skipped: [{ value: 'u1', reason: 'deleted' }] }, { status: 200 }),
            ),
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/users/u1', role: 'owner' });

        await user.click(await screen.findByRole('button', { name: 'Allow to sign in' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Not added: the account is deleted.');
    });

    it('removes the account from the allowed list', async () => {
        const set = serveDetail(true);
        const writes = serveAccess();
        server.use(
            http.delete('/api/admin/access/login-allowed/:userId', ({ params }) => {
                writes.push({ method: 'DELETE', path: `/api/admin/access/login-allowed/${String(params.userId)}`, body: {} });
                set(false);
                return HttpResponse.json(makeAccess());
            }),
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/users/u1', role: 'owner' });

        await user.click(await screen.findByRole('button', { name: 'Remove from the allowed list' }));

        expect(await screen.findByText('This account was removed from the allowed list.')).toBeInTheDocument();
        expect(writes).toEqual([{ method: 'DELETE', path: '/api/admin/access/login-allowed/u1', body: {} }]);
        expect(await screen.findByRole('button', { name: 'Allow to sign in' })).toBeInTheDocument();
    });

    it('shows the server error', async () => {
        serveDetail(false);
        server.use(http.post('/api/admin/access/login-allowed', () => HttpResponse.json({ message: 'Boom' }, { status: 500 })));
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/users/u1', role: 'owner' });

        await user.click(await screen.findByRole('button', { name: 'Allow to sign in' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
    });
});
