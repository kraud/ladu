import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedToggle } from './segmented-toggle';

const OPTIONS = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
];

describe('SegmentedToggle', () => {
    it('selects the clicked option', async () => {
        const onValueChange = vi.fn();
        render(<SegmentedToggle value="" onValueChange={onValueChange} options={OPTIONS} />);
        await userEvent.click(screen.getByRole('radio', { name: 'B' }));
        expect(onValueChange).toHaveBeenCalledWith('b');
    });

    it('clears the value when the active option is clicked again (default behaviour)', async () => {
        const onValueChange = vi.fn();
        render(<SegmentedToggle value="a" onValueChange={onValueChange} options={OPTIONS} />);
        await userEvent.click(screen.getByRole('radio', { name: 'A' }));
        expect(onValueChange).toHaveBeenCalledWith('');
    });

    it('keeps the active option selected when allowDeselect is false', async () => {
        const onValueChange = vi.fn();
        render(<SegmentedToggle value="a" onValueChange={onValueChange} options={OPTIONS} allowDeselect={false} />);
        await userEvent.click(screen.getByRole('radio', { name: 'A' }));
        expect(onValueChange).not.toHaveBeenCalled();
    });

    it('still switches to the other option when allowDeselect is false', async () => {
        const onValueChange = vi.fn();
        render(<SegmentedToggle value="a" onValueChange={onValueChange} options={OPTIONS} allowDeselect={false} />);
        await userEvent.click(screen.getByRole('radio', { name: 'B' }));
        expect(onValueChange).toHaveBeenCalledWith('b');
    });
});
