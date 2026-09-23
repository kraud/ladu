import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { OAuthButtons } from './OAuthButtons';

describe('OAuthButtons', () => {
    it('renders a real link (not a JS-driven button) to the backend start endpoint once Google is configured', async () => {
        server.use(http.get('*/api/auth/providers', () => HttpResponse.json({ google: true })));
        renderWithProviders(<OAuthButtons />);

        const link = await screen.findByRole('link', { name: 'Continue with Google' });
        expect(link.tagName).toBe('A');
        expect(link).toHaveAttribute('href', '/api/auth/google/start');
        expect(screen.getByText('or continue with')).toBeInTheDocument();
    });

    it('renders nothing once no provider is configured', async () => {
        let called = false;
        server.use(
            http.get('*/api/auth/providers', () => {
                called = true;
                return HttpResponse.json({ google: false });
            }),
        );
        renderWithProviders(<OAuthButtons />);

        await waitFor(() => expect(called).toBe(true));
        expect(screen.queryByRole('link', { name: 'Continue with Google' })).not.toBeInTheDocument();
        expect(screen.queryByText('or continue with')).not.toBeInTheDocument();
    });
});
