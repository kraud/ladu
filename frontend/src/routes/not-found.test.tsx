import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeAuthHandlers } from '@/test/msw/authHandlers';

describe('404 page theme switch', () => {
    beforeEach(() => {
        document.documentElement.removeAttribute('data-theme');
        // The login screen (the 404's exit) asks which OAuth providers exist.
        server.use(...makeAuthHandlers().handlers);
    });

    it('shows a theme switch and still no interface-language selector', async () => {
        await renderApp({ initialEntry: '/nope' });

        expect(await screen.findByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /interface language/i })).toBeNull();
    });

    it('changes the page only: nothing is saved, and leaving the page restores the normal theme', async () => {
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/nope' });

        await user.click(await screen.findByRole('button', { name: 'Switch to dark theme' }));
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
        // Not saved, so nothing follows the user into a later login.
        expect(localStorage.getItem('ladu.theme')).toBeNull();

        // Leave the 404 (signed out: the button goes to the login screen).
        await user.click(screen.getByRole('link', { name: /login/i }));
        await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('light'));
        expect(localStorage.getItem('ladu.theme')).toBeNull();
    });

    it('goes back to a saved choice, not to the OS value, when leaving', async () => {
        localStorage.setItem('ladu.theme', 'dark');
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/nope' });

        await user.click(await screen.findByRole('button', { name: 'Switch to light theme' }));
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');

        await user.click(screen.getByRole('link', { name: /login/i }));
        await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'));
        expect(localStorage.getItem('ladu.theme')).toBe('dark');
    });
});
