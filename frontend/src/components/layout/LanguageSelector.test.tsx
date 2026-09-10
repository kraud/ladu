import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { useAuthStore } from '@/stores/authStore';
import { futureToken } from '@/test/tokens';
import { LanguageSelector } from './LanguageSelector';

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

describe('LanguageSelector', () => {
    it('persists uiLanguage with a complete updateProfile payload (nativeLanguage included)', async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            http.put('*/api/users/updateUser', async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({
                    ...SESSION,
                    token: undefined,
                    uiLanguage: body.uiLanguage,
                });
            }),
        );

        const user = userEvent.setup();
        renderWithProviders(<LanguageSelector />, { session: SESSION });

        await user.click(screen.getByRole('button', { name: /interface language/i }));
        await user.click(await screen.findByRole('menuitem', { name: /Español/ }));

        await waitFor(() => expect(body).toBeDefined());
        // Every field the endpoint needs — omitting `nativeLanguage` would clear it.
        expect(body).toEqual({
            email: 'kai@example.com',
            name: 'Kai',
            username: 'kai',
            languages: ['English', 'Spanish'],
            uiLanguage: 'Spanish',
            nativeLanguage: null,
        });

        // …and the fresh row is folded back into the session.
        await waitFor(() =>
            expect(useAuthStore.getState().user?.uiLanguage).toBe('Spanish'),
        );
        // token survives a tokenless updateUser response
        expect(useAuthStore.getState().token).toBe(SESSION.token);
    });
});
