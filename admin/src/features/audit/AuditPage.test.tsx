import { describe, expect, it } from 'vitest';
import { HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/renderApp';
import { auditHandlers, FILTERS, makeEntry } from '@/test/audit';

const open = (path = '/audit') => renderApp({ initialEntry: path, role: 'admin' });
const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('who may open the page', () => {
    it('sends viewer and support to the overview, and shows no header link', async () => {
        server.use(...auditHandlers());

        for (const role of ['viewer', 'support'] as const) {
            const { router, unmount } = await renderApp({ initialEntry: '/audit', role });
            expect([role, router.state.location.pathname]).toEqual([role, '/']);
            expect(screen.queryByRole('link', { name: 'Audit' })).not.toBeInTheDocument();
            unmount();
        }
    });

    it('shows admin and owner the page and the header link', async () => {
        server.use(...auditHandlers());

        for (const role of ['admin', 'owner'] as const) {
            const { unmount } = await renderApp({ initialEntry: '/audit', role });
            expect(await screen.findByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
            expect(screen.getByRole('link', { name: 'Audit' })).toBeInTheDocument();
            unmount();
        }
    });
});

describe('the table', () => {
    it('shows the time, the staff member, the action, what it was about, the reason and the details', async () => {
        server.use(
            ...auditHandlers(() => ({
                items: [
                    makeEntry(),
                    makeEntry({ id: 'a2', action: 'staff.role_change', targetType: 'staff', targetId: 's2', targetStaffName: 'Robin', reason: null, metadata: { email: 'robin@x.test', from: 'support', to: 'viewer' } }),
                    makeEntry({ id: 'a3', staffId: null, staffName: 'System', action: 'user.purge', targetId: 'gone', reason: 'Deleted more than 30 days ago', metadata: { actor: 'system', email: 'old@example.test' } }),
                ],
            })),
        );

        await open();
        await screen.findByRole('link', { name: 'kaja@example.test' });

        const [ban, role, purge] = rows().map((row) => within(row));
        expect(ban.getByText('Sam Staff')).toBeInTheDocument();
        expect(ban.getByText('user.ban')).toBeInTheDocument();
        expect(ban.getByRole('link', { name: 'kaja@example.test' })).toHaveAttribute('href', '/users/u1');
        expect(ban.getByText('spam links')).toBeInTheDocument();
        expect(ban.getByText(/username: kaja/)).toBeInTheDocument();

        expect(role.getByText('Robin')).toBeInTheDocument();
        expect(role.queryByRole('link')).not.toBeInTheDocument();
        expect(role.getByText(/support → viewer/)).toBeInTheDocument();
        expect(role.getByText('—', { selector: 'td' })).toBeInTheDocument(); // no reason

        expect(purge.getByText('System')).toBeInTheDocument();
        // The account is gone, so there is no page to link to.
        expect(purge.getByText('old@example.test (purged)')).toBeInTheDocument();
        expect(purge.queryByRole('link')).not.toBeInTheDocument();
        expect(document.body).not.toHaveTextContent(/Invalid Date|undefined|null/);
    });

    it('says what is missing when nothing is found, with and without filters', async () => {
        server.use(...auditHandlers(() => ({ items: [], total: 0 })));
        const first = await open();
        expect(await screen.findByText('No entries yet.')).toBeInTheDocument();
        first.unmount();

        await open('/audit?action=user.ban');
        expect(await screen.findByText('No entries match these filters.')).toBeInTheDocument();
        expect(screen.getByText('0–0 of 0')).toBeInTheDocument();
    });

    it('shows the server error and tries again', async () => {
        let fail = true;
        server.use(...auditHandlers(() => (fail ? HttpResponse.json({ message: 'Boom' }, { status: 500 }) : {})));
        const user = userEvent.setup();
        await open();

        expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
        fail = false;
        await user.click(screen.getByRole('button', { name: 'Try again' }));

        expect(await screen.findByText('Sam Staff', { selector: 'td' })).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});

describe('the filters', () => {
    it('asks for the first page of 25 with no filters', async () => {
        const requests: URLSearchParams[] = [];
        server.use(...auditHandlers(undefined, requests));

        await open();
        await screen.findByText('Sam Staff', { selector: 'td' });

        expect(Object.fromEntries(requests[0])).toEqual({ pageSize: '25' });
    });

    it('fills the drop-downs from the server, with a "System" choice', async () => {
        server.use(...auditHandlers());

        await open();
        await screen.findByText('Sam Staff', { selector: 'td' });

        const staff = screen.getByLabelText('Staff') as HTMLSelectElement;
        await waitFor(() => expect([...staff.options].map((o) => o.text)).toEqual(['All', 'System (nightly job)', 'Alice Admin', 'Bob Owner']));
        const action = screen.getByLabelText('Action') as HTMLSelectElement;
        expect([...action.options].map((o) => o.text)).toEqual(['All', ...FILTERS.actions]);
    });

    it('sends the staff member, the action and the dates, and writes them into the address', async () => {
        const requests: URLSearchParams[] = [];
        server.use(...auditHandlers(undefined, requests));
        const user = userEvent.setup();
        const { router } = await open('/audit?page=3');
        await screen.findByText('Sam Staff', { selector: 'td' });
        await waitFor(() => expect((screen.getByLabelText('Staff') as HTMLSelectElement).options.length).toBe(4));

        await user.selectOptions(screen.getByLabelText('Staff'), 'Alice Admin');
        await user.selectOptions(screen.getByLabelText('Action'), 'user.ban');
        await user.type(screen.getByLabelText('From'), '2026-10-01');
        await user.type(screen.getByLabelText('To'), '2026-10-03');

        await waitFor(() => expect(router.state.location.search).toMatchObject({ staff: FILTERS.staff[0].id, action: 'user.ban', from: '2026-10-01', to: '2026-10-03' }));
        expect(router.state.location.search).not.toHaveProperty('page');
        await waitFor(() => expect(requests.at(-1)?.get('to')).not.toBeNull());
        const last = requests.at(-1) as URLSearchParams;
        expect(last.get('staff')).toBe(FILTERS.staff[0].id);
        expect(last.get('action')).toBe('user.ban');
        // Whole local days: from the start of the first, to the start of the day after the last.
        expect(new Date(last.get('from') as string).getTime()).toBe(new Date(2026, 9, 1).getTime());
        expect(new Date(last.get('to') as string).getTime()).toBe(new Date(2026, 9, 4).getTime());
    });

    it('can ask for the rows of the nightly job only', async () => {
        const requests: URLSearchParams[] = [];
        server.use(...auditHandlers(undefined, requests));
        const user = userEvent.setup();
        await open();
        await waitFor(() => expect((screen.getByLabelText('Staff') as HTMLSelectElement).options.length).toBe(4));

        await user.selectOptions(screen.getByLabelText('Staff'), 'System (nightly job)');

        await waitFor(() => expect(requests.at(-1)?.get('staff')).toBe('system'));
    });

    it('starts from a shared link, and clears everything with one button', async () => {
        const requests: URLSearchParams[] = [];
        server.use(...auditHandlers(undefined, requests));
        const user = userEvent.setup();
        const { router } = await open(`/audit?action=user.purge&from=2026-09-01&staff=system`);

        expect(screen.getByLabelText('From')).toHaveValue('2026-09-01');
        await waitFor(() => expect(requests.length).toBeGreaterThan(0));
        expect(requests[0].get('action')).toBe('user.purge');
        expect(requests[0].get('staff')).toBe('system');

        await user.click(screen.getByRole('button', { name: 'Clear filters' }));

        await waitFor(() => expect(router.state.location.search).toEqual({}));
        await waitFor(() => expect(requests.at(-1)?.has('action')).toBe(false));
        expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    });

    it('does not offer a "To" before the "From"', async () => {
        server.use(...auditHandlers());

        await open('/audit?from=2026-10-05&to=2026-10-09');

        expect(screen.getByLabelText('To')).toHaveAttribute('min', '2026-10-05');
        expect(screen.getByLabelText('From')).toHaveAttribute('max', '2026-10-09');
    });
});

describe('pages', () => {
    it('goes forward and back, and disables the buttons at the ends', async () => {
        const requests: URLSearchParams[] = [];
        server.use(...auditHandlers((params) => ({ total: 60, page: Number(params.get('page') ?? 1) }), requests));
        const user = userEvent.setup();
        const { router } = await open();

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
});
