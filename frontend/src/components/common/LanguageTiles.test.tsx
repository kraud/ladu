import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { LanguageTiles } from './LanguageTiles';

function Harness({ onChange }: { onChange: (next: string[]) => void }) {
    const [value, setValue] = useState<string[]>([]);
    return (
        <LanguageTiles
            value={value}
            onChange={(next) => {
                onChange(next);
                setValue(next);
            }}
        />
    );
}

describe('LanguageTiles', () => {
    it('toggles a language tile on and off, preserving selection order', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        renderWithProviders(<Harness onChange={onChange} />);

        await user.click(screen.getByRole('button', { name: 'Deutsch' }));
        await user.click(screen.getByRole('button', { name: 'English' }));
        expect(onChange).toHaveBeenLastCalledWith(['German', 'English']);

        // Deselect the first pick — the rest keep their order.
        await user.click(screen.getByRole('button', { name: 'Deutsch' }));
        expect(onChange).toHaveBeenLastCalledWith(['English']);

        expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        expect(screen.getByRole('button', { name: 'Deutsch' })).toHaveAttribute(
            'aria-pressed',
            'false',
        );
    });

    it("shows each tile's real part-of-speech coverage, Estonian excluding adverb", () => {
        renderWithProviders(<Harness onChange={vi.fn()} />);

        const english = screen.getByRole('button', { name: 'English' });
        expect(english).toHaveAccessibleDescription('noun · verb · adjective · adverb');

        const estonian = screen.getByRole('button', { name: 'Eesti' });
        expect(estonian).toHaveAccessibleDescription('noun · verb · adjective');
    });
});
