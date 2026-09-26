import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { useAuthStore } from '@/stores/authStore';
import { futureToken } from '@/test/tokens';
import { ThemeSelector } from './ThemeSelector';
import { useSessionTheme } from './useSessionTheme';

const SESSION = {
    id: 'u1',
    name: 'Kai',
    email: 'kai@example.com',
    username: 'kai',
    languages: ['English', 'Spanish'],
    uiLanguage: 'English',
    nativeLanguage: null,
    verified: true,
    token: futureToken(),
};

beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
});

describe('ThemeSelector', () => {
    it('changes the page at once, then saves the theme with a complete updateProfile payload', async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            http.put('*/api/users/updateUser', async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ ...SESSION, token: undefined, theme: body.theme });
            }),
        );

        const user = userEvent.setup();
        renderWithProviders(<ThemeSelector />, { session: SESSION });

        await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

        // Local and immediate — before the response arrives.
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(localStorage.getItem('ladu.theme')).toBe('dark');

        await waitFor(() => expect(body).toBeDefined());
        // Every field the endpoint needs — omitting `nativeLanguage` would clear it.
        expect(body).toEqual({
            email: 'kai@example.com',
            name: 'Kai',
            username: 'kai',
            languages: ['English', 'Spanish'],
            uiLanguage: 'English',
            nativeLanguage: null,
            theme: 'dark',
        });

        await waitFor(() => expect(useAuthStore.getState().user?.theme).toBe('dark'));
        expect(useAuthStore.getState().token).toBe(SESSION.token);
        expect(await screen.findByRole('button', { name: 'Switch to light theme' })).toBeEnabled();
    });

    it('is disabled while the save is in flight', async () => {
        let release: () => void = () => {};
        server.use(
            http.put('*/api/users/updateUser', async () => {
                await new Promise<void>((resolve) => {
                    release = resolve;
                });
                return HttpResponse.json({ ...SESSION, token: undefined, theme: 'dark' });
            }),
        );

        const user = userEvent.setup();
        renderWithProviders(<ThemeSelector />, { session: SESSION });
        await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

        await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
        release();
        await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    });

    it('keeps the chosen theme on the page when the save fails', async () => {
        server.use(
            http.put('*/api/users/updateUser', () =>
                HttpResponse.json({ message: 'Invalid theme selection' }, { status: 400 }),
            ),
        );

        const user = userEvent.setup();
        renderWithProviders(<ThemeSelector />, { session: SESSION });
        await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

        await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(useAuthStore.getState().user?.theme).toBeNull();
    });

    it('renders nothing without a session', () => {
        renderWithProviders(<ThemeSelector />);
        expect(screen.queryByRole('button')).toBeNull();
    });
});

describe('useSessionTheme', () => {
    it('applies and saves the row theme when the browser has no saved choice', () => {
        useAuthStore.getState().setSession({ ...SESSION, theme: 'dark' });
        renderHook(() => useSessionTheme());

        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(localStorage.getItem('ladu.theme')).toBe('dark');
    });

    it('lets the row theme win over a different saved browser choice', () => {
        localStorage.setItem('ladu.theme', 'light');
        useAuthStore.getState().setSession({ ...SESSION, theme: 'dark' });
        renderHook(() => useSessionTheme());

        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(localStorage.getItem('ladu.theme')).toBe('dark');
    });

    it('does nothing when the row has no theme (nothing is saved for the browser)', () => {
        useAuthStore.getState().setSession({ ...SESSION, theme: null });
        renderHook(() => useSessionTheme());

        expect(localStorage.getItem('ladu.theme')).toBeNull();
        expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    });
});
