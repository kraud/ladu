import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

    it('calls onChange with completionState:false while the required field is empty', () => {
        const onChange = vi.fn();
        renderWithProviders(<TranslationCard lang={Lang.EN} onChange={onChange} />);

        expect(onChange).toHaveBeenCalledWith({ cases: [], completionState: false, isDirty: false });
    });

    it('pushes up lowercased cases and flips complete/dirty once the required field is filled', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        renderWithProviders(<TranslationCard lang={Lang.EN} onChange={onChange} />);

        await user.type(screen.getByLabelText('Singular'), 'House');

        await waitFor(() =>
            expect(onChange).toHaveBeenLastCalledWith({
                cases: [{ caseName: NounCases.singularEN, word: 'house' }],
                completionState: true,
                isDirty: true,
            }),
        );
    });

    it('resetKey forces a resync back to initialCases (the Clear-button fix)', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const { rerender } = renderWithProviders(
            <TranslationCard lang={Lang.EN} onChange={onChange} resetKey={0} />,
        );

        await user.type(screen.getByLabelText('Singular'), 'House');
        expect(screen.getByLabelText('Singular')).toHaveValue('House');

        // Mirrors `useWordFormState.clearTranslation`: the parent empties
        // `initialCases` *and* bumps `resetKey` in the same update.
        rerender(<TranslationCard lang={Lang.EN} initialCases={[]} onChange={onChange} resetKey={1} />);

        await waitFor(() => expect(screen.getByLabelText('Singular')).toHaveValue(''));
        await waitFor(() =>
            expect(onChange).toHaveBeenLastCalledWith({ cases: [], completionState: false, isDirty: false }),
        );

        // The card still works normally afterward.
        await user.type(screen.getByLabelText('Singular'), 'Cat');
        expect(screen.getByLabelText('Singular')).toHaveValue('Cat');
    });

    it('an unrelated initialCases identity change (the self-echo) does not reset the card when resetKey is unchanged', async () => {
        const user = userEvent.setup();
        const { rerender } = renderWithProviders(<TranslationCard lang={Lang.EN} resetKey={0} />);

        await user.type(screen.getByLabelText('Singular'), 'House');
        expect(screen.getByLabelText('Singular')).toHaveValue('House');

        // A *new* array reference with the same content — exactly what
        // `WordForm` echoes back in as `initialCases` after every keystroke.
        rerender(
            <TranslationCard
                lang={Lang.EN}
                initialCases={[{ caseName: NounCases.singularEN, word: 'house' }]}
                resetKey={0}
            />,
        );

        expect(screen.getByLabelText('Singular')).toHaveValue('House');
    });

    it('never calls onChange in displayOnly mode', async () => {
        const onChange = vi.fn();
        renderWithProviders(
            <TranslationCard
                lang={Lang.EN}
                displayOnly
                initialCases={[{ caseName: NounCases.singularEN, word: 'house' }]}
                onChange={onChange}
            />,
        );

        expect(onChange).not.toHaveBeenCalled();
    });
});
