import { describe, expect, it } from 'vitest';
import { HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/renderApp';
import { makeListItem, usersListHandler } from '@/test/users';

describe('UsersPage', () => {
    it('lists users with status, sign-in methods and last login', async () => {
        server.use(
            usersListHandler(() => ({
                items: [
                    makeListItem(),
                    makeListItem({ id: 'u2', name: 'Mart Kask', email: 'mart@example.com', username: 'mart', status: 'banned', verified: false, hasPassword: false, hasGoogle: true, lastLoginAt: null, lastLoginCountry: null, lastSeenAt: null }),
                ],
            })),
        );

        await renderApp({ initialEntry: '/users', session: true });

        await screen.findByRole('link', { name: 'Kaja Tamm' });
        const rows = screen.getAllByRole('row');
        const kaja = within(rows[1]);
        expect(kaja.getByRole('link', { name: 'Kaja Tamm' })).toHaveAttribute('href', '/users/u1');
        expect(kaja.getByText('kaja@example.com')).toBeInTheDocument();
        expect(kaja.getByText('Active')).toBeInTheDocument();
        expect(kaja.getByText('Password')).toBeInTheDocument();
        expect(kaja.getByText(/\(EE\)/)).toBeInTheDocument();

        const mart = within(rows[2]);
        expect(mart.getByText('Banned')).toBeInTheDocument();
        expect(mart.getByText('not verified')).toBeInTheDocument();
        expect(mart.getByText('Google')).toBeInTheDocument();
        // No login yet: a dash, not "Invalid Date".
        expect(mart.getAllByText('—').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText('1–2 of 2')).toBeInTheDocument();
    });

    it('asks for the first page of 25, newest registration first, with no filters', async () => {
        const requests: URLSearchParams[] = [];
        server.use(usersListHandler(undefined, requests));

        await renderApp({ initialEntry: '/users', session: true });
        await screen.findByText('Kaja Tamm');

        expect(Object.fromEntries(requests[0])).toEqual({ pageSize: '25' });
    });

    it('searches after a pause, and returns to page 1', async () => {
        const requests: URLSearchParams[] = [];
        server.use(usersListHandler(() => ({ total: 80 }), requests));
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/users?page=2', session: true });
        await screen.findByText('Kaja Tamm');

        await user.type(screen.getByLabelText('Search'), 'kaja');

        await waitFor(() => expect(router.state.location.search).toMatchObject({ q: 'kaja' }));
        expect(router.state.location.search).not.toHaveProperty('page');
        await waitFor(() => expect(requests.at(-1)?.get('search')).toBe('kaja'));
        // One request for the whole word, not one per key press.
        expect(requests.filter((r) => r.get('search')).length).toBe(1);
    });

    it('starts with the text of a shared link in the box and in the request', async () => {
        const requests: URLSearchParams[] = [];
        server.use(usersListHandler(undefined, requests));

        await renderApp({ initialEntry: '/users?q=tamm&status=banned&sort=name&order=asc', session: true });

        expect(screen.getByLabelText('Search')).toHaveValue('tamm');
        expect(screen.getByLabelText('Status')).toHaveValue('banned');
        await waitFor(() => expect(requests.length).toBeGreaterThan(0));
        expect(Object.fromEntries(requests[0])).toMatchObject({ search: 'tamm', status: 'banned', sort: 'name', order: 'asc' });
    });

    it('applies and clears a filter', async () => {
        const requests: URLSearchParams[] = [];
        server.use(usersListHandler(undefined, requests));
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/users?page=3', session: true });
        await screen.findByText('Kaja Tamm');

        await user.selectOptions(screen.getByLabelText('Sign-in method'), 'google');
        await waitFor(() => expect(requests.at(-1)?.get('method')).toBe('google'));
        expect(router.state.location.search).toMatchObject({ method: 'google' });
        expect(router.state.location.search).not.toHaveProperty('page');

        await user.selectOptions(screen.getByLabelText('Sign-in method'), 'All');
        await waitFor(() => expect(requests.at(-1)?.has('method')).toBe(false));
        expect(router.state.location.search).not.toHaveProperty('method');
    });

    it('sorts by a column, then reverses it', async () => {
        const requests: URLSearchParams[] = [];
        server.use(usersListHandler(undefined, requests));
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/users', session: true });
        await screen.findByText('Kaja Tamm');
        const header = () => screen.getByRole('columnheader', { name: /Name/ });

        await user.click(within(header()).getByRole('button'));
        await waitFor(() => expect(header()).toHaveAttribute('aria-sort', 'ascending'));
        expect(requests.at(-1)?.get('sort')).toBe('name');
        expect(requests.at(-1)?.get('order')).toBe('asc');

        await user.click(within(header()).getByRole('button'));
        await waitFor(() => expect(header()).toHaveAttribute('aria-sort', 'descending'));

        // A date column starts newest first.
        await user.click(within(screen.getByRole('columnheader', { name: /Last login/ })).getByRole('button'));
        await waitFor(() => expect(requests.at(-1)?.get('sort')).toBe('lastLoginAt'));
        expect(requests.at(-1)?.get('order')).toBe('desc');
    });

    it('pages forwards and back, and disables the buttons at the ends', async () => {
        const requests: URLSearchParams[] = [];
        server.use(
            usersListHandler((params) => ({ total: 60, page: Number(params.get('page') ?? 1) }), requests),
        );
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/users', session: true });

        expect(await screen.findByText('1–25 of 60')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

        await user.click(screen.getByRole('button', { name: 'Next' }));
        expect(await screen.findByText('26–50 of 60')).toBeInTheDocument();
        expect(requests.at(-1)?.get('page')).toBe('2');

        await user.click(screen.getByRole('button', { name: 'Next' }));
        expect(await screen.findByText('51–60 of 60')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

        await user.click(screen.getByRole('button', { name: 'Previous' }));
        await user.click(screen.getByRole('button', { name: 'Previous' }));
        await waitFor(() => expect(router.state.location.search).not.toHaveProperty('page'));
    });

    it('says so when nothing matches', async () => {
        server.use(usersListHandler(() => ({ items: [], total: 0 })));

        await renderApp({ initialEntry: '/users', session: true });

        expect(await screen.findByText('No users match.')).toBeInTheDocument();
        expect(screen.getByText('0–0 of 0')).toBeInTheDocument();
    });

    it('shows the server error and retries', async () => {
        let fail = true;
        server.use(
            usersListHandler(() => (fail ? HttpResponse.json({ message: 'Boom' }, { status: 500 }) : {})),
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/users', session: true });

        expect(await screen.findByRole('alert')).toHaveTextContent('Boom');

        fail = false;
        await user.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByText('Kaja Tamm')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('opens from the header link', async () => {
        server.use(usersListHandler());
        const user = userEvent.setup();
        const { router } = await renderApp({ session: true });

        await user.click(await screen.findByRole('link', { name: 'Users' }));

        expect(router.state.location.pathname).toBe('/users');
        expect(await screen.findByText('Kaja Tamm')).toBeInTheDocument();
    });
});
