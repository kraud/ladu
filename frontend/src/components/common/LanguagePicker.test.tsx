import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguagePicker } from './LanguagePicker';

function Harness({ onChange }: { onChange: (next: string[]) => void }) {
    const [value, setValue] = useState<string[]>([]);
    return (
        <LanguagePicker
            value={value}
            onChange={(next) => {
                onChange(next);
                setValue(next);
            }}
        />
    );
}

describe('LanguagePicker', () => {
    it('toggles a language on and off, preserving selection order', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);

        await user.click(screen.getByRole('button', { name: 'Deutsch' }));
        await user.click(screen.getByRole('button', { name: 'English' }));
        expect(onChange).toHaveBeenLastCalledWith(['German', 'English']);

        // Deselect the first pick — the rest keep their order.
        await user.click(screen.getByRole('button', { name: 'Deutsch' }));
        expect(onChange).toHaveBeenLastCalledWith(['English']);

        expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'false');
    });
});
