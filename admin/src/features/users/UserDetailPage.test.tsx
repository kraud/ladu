import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/renderApp';
import { makeDetail } from '@/test/users';

const serve = (detail: ReturnType<typeof makeDetail>) =>
    server.use(http.get('/api/admin/users/:id', () => HttpResponse.json(detail)));

describe('UserDetailPage', () => {
    it('shows the profile, activity, sign-in methods, counts and logins', async () => {
        serve(makeDetail());

        await renderApp({ initialEntry: '/users/u1', session: true });

        expect(await screen.findByRole('heading', { name: 'Kaja Tamm' })).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('English, Estonian')).toBeInTheDocument();

        const signIn = within(screen.getByRole('heading', { name: 'Sign-in methods' }).closest('section') as HTMLElement);
        expect(signIn.getByText('Password')).toBeInTheDocument();
        expect(signIn.getByText(/kaja@gmail.com/)).toBeInTheDocument();

        const content = within(screen.getByRole('heading', { name: 'Content' }).closest('section') as HTMLElement);
        expect(content.getByText('Words').nextSibling).toHaveTextContent('12');
        expect(content.getByText('Translations').nextSibling).toHaveTextContent('30');
        expect(content.getByText('Saved practice sessions').nextSibling).toHaveTextContent('3');

        const logins = within(screen.getByRole('heading', { name: 'Recent logins' }).closest('section') as HTMLElement);
        expect(logins.getAllByRole('row')).toHaveLength(2);
    });

    it('hides the audit section from a role that may not read it', async () => {
        serve(makeDetail({ audit: null }));

        await renderApp({ initialEntry: '/users/u1', session: true });
        await screen.findByRole('heading', { name: 'Kaja Tamm' });

        expect(screen.queryByRole('heading', { name: 'Audit history' })).not.toBeInTheDocument();
    });

    it('shows the audit section, empty or filled, to a role that may read it', async () => {
        serve(makeDetail({ audit: [] }));
        const { unmount } = await renderApp({ initialEntry: '/users/u1', session: true });
        expect(await screen.findByText('No staff actions on this account.')).toBeInTheDocument();
        unmount();

        serve(makeDetail({ audit: [{ id: 'a1', action: 'user.ban', reason: 'spam', staffName: 'Sam Staff', createdAt: '2026-09-30T10:00:00.000Z' }] }));
        await renderApp({ initialEntry: '/users/u1', session: true });
        expect(await screen.findByText('user.ban')).toBeInTheDocument();
        expect(screen.getByText(/by Sam Staff/)).toBeInTheDocument();
        expect(screen.getByText('Reason: spam')).toBeInTheDocument();
    });

    it('explains a ban and a deletion', async () => {
        serve(makeDetail({ status: 'banned', bannedAt: '2026-09-30T10:00:00.000Z', banReason: 'spam' }));
        const { unmount } = await renderApp({ initialEntry: '/users/u1', session: true });
        expect(await screen.findByText(/Reason: spam/)).toBeInTheDocument();
        expect(screen.getByText('Banned', { selector: 'span' })).toBeInTheDocument();
        unmount();

        serve(makeDetail({ status: 'deleted', deletedAt: '2026-09-30T10:00:00.000Z', deletedByStaffName: 'Dee Leter' }));
        await renderApp({ initialEntry: '/users/u1', session: true });
        expect(await screen.findByText(/by Dee Leter/)).toBeInTheDocument();
    });

    it('says so for an account with no sign-in method, no logins and no unset fields shown as "null"', async () => {
        serve(makeDetail({ hasPassword: false, identities: [], recentLogins: [], theme: null, nativeLanguage: null, lastLoginAt: null, lastSeenAt: null, lastLoginCountry: null }));

        await renderApp({ initialEntry: '/users/u1', session: true });

        expect(await screen.findByText('None')).toBeInTheDocument();
        expect(screen.getByText(/No logins recorded/)).toBeInTheDocument();
        expect(document.body).not.toHaveTextContent(/null|Invalid Date|undefined/);
    });

    it('shows "User not found" for a 404', async () => {
        server.use(http.get('/api/admin/users/:id', () => HttpResponse.json({ message: 'User not found' }, { status: 404 })));

        await renderApp({ initialEntry: '/users/missing', session: true });

        expect(await screen.findByRole('heading', { name: 'User not found' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    });

    it('goes back to the list from the link', async () => {
        serve(makeDetail());
        server.use(http.get('/api/admin/users', () => HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 25 })));
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/users/u1', session: true });

        await user.click(await screen.findByRole('link', { name: /All users/ }));

        expect(router.state.location.pathname).toBe('/users');
    });
});
