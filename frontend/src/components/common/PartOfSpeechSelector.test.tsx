import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PartOfSpeech } from '@/ts/enums';
import { PartOfSpeechSelector } from './PartOfSpeechSelector';

describe('PartOfSpeechSelector', () => {
    it('enables only Noun; the rest are disabled with the missing-implementation caption', () => {
        renderWithProviders(<PartOfSpeechSelector value={undefined} onChange={vi.fn()} />);

        // Base UI's radio renders as `<span role="radio">`, not a native
        // `<input>` — jest-dom's toBeDisabled()/toBeEnabled() only recognise
        // actual form-control elements, so assert `aria-disabled` directly.
        expect(screen.getByRole('radio', { name: /Noun/ })).not.toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('radio', { name: /Verb/ })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getAllByText("This part of speech is not implemented yet, we're sorry!")).toHaveLength(9);
    });

    it('calls onChange with Noun when picked', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        renderWithProviders(<PartOfSpeechSelector value={undefined} onChange={onChange} />);

        await user.click(screen.getByRole('radio', { name: /Noun/ }));

        expect(onChange).toHaveBeenCalledWith(PartOfSpeech.noun);
    });
});
