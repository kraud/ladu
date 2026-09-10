import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { PublicLanguageSelector } from './PublicLanguageSelector';

describe('PublicLanguageSelector', () => {
    it('changes the i18n language without needing a session', async () => {
        const user = userEvent.setup();
        const { i18n } = renderWithProviders(<PublicLanguageSelector />);
        expect(i18n.language).toBe('en');

        await user.click(screen.getByRole('button', { name: /interface language/i }));
        await user.click(await screen.findByRole('menuitem', { name: 'Deutsch' }));

        await waitFor(() => expect(i18n.language).toBe('de'));
    });
});
