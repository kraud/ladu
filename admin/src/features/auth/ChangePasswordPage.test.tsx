import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/renderApp';
import { makeStaff } from '@/test/msw/handlers';
import { usersListHandler } from '@/test/users';
import { useAuthStore } from '@/stores/authStore';
import { fakeToken } from '@/test/token';

const TEMP_STAFF = makeStaff('admin', { mustChangePassword: true });

/** Serves `me` as a person with a temporary password, and records change-password requests. */
function serveTemporary() {
    const calls: Record<string, unknown>[] = [];
    server.use(
        http.get('/api/admin/auth/me', () => HttpResponse.json(TEMP_STAFF)),
        http.post('/api/admin/auth/change-password', async ({ request }) => {
            calls.push((await request.json()) as Record<string, unknown>);
            return HttpResponse.json({ ...makeStaff('admin'), token: fakeToken() });
        }),
    );
    return calls;
}

const fill = async (current: string, next: string, repeat: string) => {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/(Temporary|Current) password/), current);
    await user.type(screen.getByLabelText('New password'), next);
    await user.type(screen.getByLabelText('Repeat the new password'), repeat);
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    return user;
};

describe('a temporary password', () => {
    it('sends the person from any page to the change form, with the other links hidden', async () => {
        serveTemporary();

        const { router } = await renderApp({ initialEntry: '/', session: { staff: TEMP_STAFF } });

        expect(router.state.location.pathname).toBe('/account/password');
        expect(await screen.findByRole('heading', { name: 'Choose your own password' })).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('temporary password');
        expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Health' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Cancel' })).not.toBeInTheDocument();
    });

    it('cannot open another page by typing its address', async () => {
        serveTemporary();

        const { router } = await renderApp({ initialEntry: '/users', session: { staff: TEMP_STAFF } });

        expect(router.state.location.pathname).toBe('/account/password');
    });

    it('is sent to the form right after signing in', async () => {
        server.use(
            http.post('/api/admin/auth/login', () => HttpResponse.json({ ...TEMP_STAFF, token: fakeToken() })),
            http.get('/api/admin/auth/me', () => HttpResponse.json(TEMP_STAFF)),
        );
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/login' });

        await user.type(screen.getByLabelText('Email'), 'new@example.com');
        await user.type(screen.getByLabelText('Password'), 'temporary-pass-123');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/account/password'));
    });

    it('saves a new password, then opens the tool with the new session', async () => {
        const calls = serveTemporary();
        server.use(usersListHandler());
        const { router } = await renderApp({ initialEntry: '/account/password', session: { staff: TEMP_STAFF, token: fakeToken(2 * 60 * 60) } });
        await screen.findByRole('heading', { name: 'Choose your own password' });
        const oldToken = useAuthStore.getState().token;

        await fill('temporary-pass-123', 'my-own-new-password', 'my-own-new-password');

        await waitFor(() => expect(router.state.location.pathname).toBe('/'));
        expect(calls).toEqual([{ currentPassword: 'temporary-pass-123', newPassword: 'my-own-new-password' }]);
        expect(useAuthStore.getState().staff?.mustChangePassword).toBe(false);
        expect(useAuthStore.getState().token).not.toBe(oldToken);
        expect(await screen.findByRole('link', { name: 'Users' })).toBeInTheDocument();
    });
});

describe('the form', () => {
    it('refuses a short password, a different repeat and an unchanged password, and sends nothing', async () => {
        const calls = serveTemporary();
        await renderApp({ initialEntry: '/account/password', session: { staff: TEMP_STAFF } });
        await screen.findByRole('heading', { name: 'Choose your own password' });

        const user = await fill('temporary-pass-123', 'short', 'short');
        expect(await screen.findByRole('alert')).toHaveTextContent('at least 12 characters');

        await user.clear(screen.getByLabelText('New password'));
        await user.clear(screen.getByLabelText('Repeat the new password'));
        await user.type(screen.getByLabelText('New password'), 'long-enough-password-1');
        await user.type(screen.getByLabelText('Repeat the new password'), 'long-enough-password-2');
        await user.click(screen.getByRole('button', { name: 'Save new password' }));
        expect(await screen.findByText('The two new passwords are not the same.')).toBeInTheDocument();

        await user.clear(screen.getByLabelText('New password'));
        await user.clear(screen.getByLabelText('Repeat the new password'));
        await user.type(screen.getByLabelText('New password'), 'temporary-pass-123');
        await user.type(screen.getByLabelText('Repeat the new password'), 'temporary-pass-123');
        await user.click(screen.getByRole('button', { name: 'Save new password' }));
        expect(await screen.findByText(/different from the current one/)).toBeInTheDocument();

        expect(calls).toEqual([]);
    });

    it('does not scold before the first try', async () => {
        serveTemporary();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/account/password', session: { staff: TEMP_STAFF } });
        await screen.findByRole('heading', { name: 'Choose your own password' });

        await user.type(screen.getByLabelText('New password'), 'abc');

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the server message, for example a wrong current password, and keeps the session', async () => {
        server.use(
            http.get('/api/admin/auth/me', () => HttpResponse.json(TEMP_STAFF)),
            http.post('/api/admin/auth/change-password', () => HttpResponse.json({ message: 'The current password is not correct' }, { status: 400 })),
        );
        await renderApp({ initialEntry: '/account/password', session: { staff: TEMP_STAFF } });
        await screen.findByRole('heading', { name: 'Choose your own password' });

        await fill('wrong-current-pass', 'my-own-new-password', 'my-own-new-password');

        expect(await screen.findByRole('alert')).toHaveTextContent('The current password is not correct');
        expect(useAuthStore.getState().staff?.mustChangePassword).toBe(true);
    });
});

describe('error messages', () => {
    it('shows only the latest one: a new try clears the server message of the old try', async () => {
        server.use(
            http.get('/api/admin/auth/me', () => HttpResponse.json(TEMP_STAFF)),
            http.post('/api/admin/auth/change-password', () => HttpResponse.json({ message: 'The current password is not correct' }, { status: 400 })),
        );
        await renderApp({ initialEntry: '/account/password', session: { staff: TEMP_STAFF } });
        await screen.findByRole('heading', { name: 'Choose your own password' });
        const user = await fill('wrong-current-pass', 'my-own-new-password', 'my-own-new-password');
        expect(await screen.findByRole('alert')).toHaveTextContent('The current password is not correct');

        await user.clear(screen.getByLabelText('New password'));
        await user.type(screen.getByLabelText('New password'), 'short');
        await user.click(screen.getByRole('button', { name: 'Save new password' }));

        const alerts = await screen.findAllByRole('alert');
        expect(alerts).toHaveLength(1);
        expect(alerts[0]).toHaveTextContent('at least 12 characters');
    });
});

describe('a normal change (no temporary password)', () => {
    it('shows the plain title, a Cancel link, and the note about other sessions', async () => {
        server.use(http.post('/api/admin/auth/change-password', () => HttpResponse.json({ ...makeStaff('support'), token: fakeToken() })));
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/account/password', role: 'support' });

        expect(await screen.findByRole('heading', { name: 'Change password' })).toBeInTheDocument();
        expect(screen.getByLabelText('Current password')).toBeInTheDocument();
        expect(screen.getByText(/ends your sessions on all other devices/)).toBeInTheDocument();
        await user.click(screen.getByRole('link', { name: 'Cancel' }));
        expect(router.state.location.pathname).toBe('/');
    });

    it('is reachable from the header', async () => {
        const user = userEvent.setup();
        const { router } = await renderApp({ role: 'viewer' });

        await user.click(await screen.findByRole('link', { name: 'Change password' }));

        expect(router.state.location.pathname).toBe('/account/password');
    });
});

describe('when the server says a password change is required', () => {
    it('moves a person who is mid-session to the form, and hides the other links', async () => {
        // The server is consistent: the list is refused, and `me` says the same thing.
        server.use(
            usersListHandler(() => HttpResponse.json({ message: 'You must change your temporary password first', code: 'password_change_required' }, { status: 403 })),
            http.get('/api/admin/auth/me', () => HttpResponse.json(TEMP_STAFF)),
        );
        // The session starts as it was saved before the reset: no temporary password yet.
        const { router } = await renderApp({ initialEntry: '/users', session: { staff: makeStaff('admin') } });

        await waitFor(() => expect(router.state.location.pathname).toBe('/account/password'));
        expect(useAuthStore.getState().staff?.mustChangePassword).toBe(true);
        expect(await screen.findByRole('heading', { name: 'Choose your own password' })).toBeInTheDocument();
    });

    it('does nothing special for another 403', async () => {
        server.use(usersListHandler(() => HttpResponse.json({ message: 'Forbidden' }, { status: 403 })));
        const { router } = await renderApp({ initialEntry: '/users', role: 'viewer' });

        expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
        expect(router.state.location.pathname).toBe('/users');
        expect(useAuthStore.getState().staff?.mustChangePassword).toBe(false);
    });
});
