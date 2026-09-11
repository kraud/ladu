import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Lang, NounCases } from '@/ts/enums';
import { TranslationCard } from './TranslationCard';

describe('TranslationCard', () => {
    it.each([
        [Lang.EN, 'English'],
        [Lang.ES, 'Español'],
        [Lang.DE, 'Deutsch'],
        [Lang.EE, 'Eesti'],
    ])('mounts a %s noun card with its native language name and required fields', (lang, native) => {
        renderWithProviders(<TranslationCard lang={lang} />);
        expect(screen.getByText(native)).toBeInTheDocument();
        expect(screen.getByText('Regularity')).toBeInTheDocument();
    });

    it('hydrates from initialCases', () => {
        renderWithProviders(
            <TranslationCard lang={Lang.EN} initialCases={[{ caseName: NounCases.singularEN, word: 'cat' }]} />
        );
        expect(screen.getByDisplayValue('cat')).toBeInTheDocument();
    });

    it('shows Clear and Remove actions unless displayOnly', () => {
        renderWithProviders(<TranslationCard lang={Lang.EN} />);
        expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('hides Clear/Remove in displayOnly mode', () => {
        renderWithProviders(<TranslationCard lang={Lang.EN} displayOnly />);
        expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    });

    it('disables Remove when removeDisabled is set', () => {
        renderWithProviders(<TranslationCard lang={Lang.EN} removeDisabled />);
        expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
    });
});
