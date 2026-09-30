import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/renderApp';
import { useAuthStore } from '@/stores/authStore';
import { fakeToken } from '@/test/token';
import { staffFixture } from '@/test/msw/handlers';
import { safeRedirect } from '@/features/auth/pages/LoginPage';

describe('route guard', () => {
    it('sends a visitor without a session to /login, remembering where they went', async () => {
        const { router } = await renderApp({ initialEntry: '/' });

        expect(router.state.location.pathname).toBe('/login');
        expect(router.state.location.search).toMatchObject({ redirect: '/' });
        expect(screen.getByRole('heading', { name: 'Ladu Admin' })).toBeInTheDocument();
    });

    it('treats an expired token as no session', async () => {
        const { router } = await renderApp({ session: { token: fakeToken(-5) } });

        expect(router.state.location.pathname).toBe('/login');
    });

    it('shows the overview and the header to a signed-in member', async () => {
        await renderApp({ session: true });

        expect(await screen.findByRole('heading', { name: /Welcome, Sam Staff/ })).toBeInTheDocument();
        expect(screen.getByText('support')).toBeInTheDocument();
    });

    it('sends a signed-in member away from /login', async () => {
        const { router } = await renderApp({ initialEntry: '/login', session: true });

        expect(router.state.location.pathname).toBe('/');
    });

    it('shows a not-found page for an unknown path', async () => {
        await renderApp({ initialEntry: '/nope', session: true });

        expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    });
});

describe('session check against the server', () => {
    it('logs out and returns to /login when the server rejects the token', async () => {
        server.use(http.get('/api/admin/auth/me', () => HttpResponse.json({ message: 'Not authorized' }, { status: 401 })));

        const { router } = await renderApp({ session: true });

        await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
        expect(useAuthStore.getState().token).toBeNull();
    });

    it('updates the stored role when the server reports a new one', async () => {
        server.use(http.get('/api/admin/auth/me', () => HttpResponse.json({ id: 'staff-1', email: 'staff@example.com', name: 'Sam Staff', role: 'viewer' })));

        await renderApp({ session: true });

        expect(await screen.findByText('viewer')).toBeInTheDocument();
        expect(useAuthStore.getState().staff?.role).toBe('viewer');
    });
});

describe('login and sign out', () => {
    it('logs in with valid credentials and lands on the overview', async () => {
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/login' });

        await user.type(screen.getByLabelText('Email'), 'staff@example.com');
        await user.type(screen.getByLabelText('Password'), 'correct-password');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        expect(await screen.findByRole('heading', { name: /Welcome, Sam Staff/ })).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
        expect(useAuthStore.getState().token).not.toBeNull();
    });

    it('returns to the page the visitor first asked for', async () => {
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/login?redirect=%2Fnope' });

        await user.type(screen.getByLabelText('Email'), 'staff@example.com');
        await user.type(screen.getByLabelText('Password'), 'correct-password');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/nope'));
    });

    it('shows the server message for wrong credentials and stays signed out', async () => {
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/login' });

        await user.type(screen.getByLabelText('Email'), 'staff@example.com');
        await user.type(screen.getByLabelText('Password'), 'wrong');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
        expect(useAuthStore.getState().token).toBeNull();
    });

    it('says so when the server cannot be reached', async () => {
        server.use(http.post('/api/admin/auth/login', () => HttpResponse.error()));
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/login' });

        await user.type(screen.getByLabelText('Email'), 'staff@example.com');
        await user.type(screen.getByLabelText('Password'), 'x');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
    });

    it('signs out: clears the session and returns to /login', async () => {
        const user = userEvent.setup();
        const { router } = await renderApp({ session: true });

        await user.click(await screen.findByRole('button', { name: /Sign out/ }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
        expect(useAuthStore.getState().token).toBeNull();
        expect(localStorage.getItem('ladu-admin.session')).toContain('"token":null');
    });

    it('does not call /auth/me again after signing out', async () => {
        let meCalls = 0;
        server.use(
            http.get('/api/admin/auth/me', () => {
                meCalls += 1;
                return HttpResponse.json(staffFixture);
            }),
        );
        const user = userEvent.setup();
        const { router } = await renderApp({ session: true });
        await waitFor(() => expect(meCalls).toBe(1));

        await user.click(screen.getByRole('button', { name: /Sign out/ }));
        await waitFor(() => expect(router.state.location.pathname).toBe('/login'));

        expect(meCalls).toBe(1);
    });
});

describe('safeRedirect', () => {
    it('allows only same-origin paths', () => {
        expect(safeRedirect('/users?x=1')).toBe('/users?x=1');
        expect(safeRedirect(undefined)).toBe('/');
        expect(safeRedirect('https://evil.example')).toBe('/');
        expect(safeRedirect('//evil.example')).toBe('/');
    });
});
