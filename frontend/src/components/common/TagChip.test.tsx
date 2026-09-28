import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TagChip } from './TagChip';

describe('TagChip', () => {
    it('renders the label with no lock icon and no remove button by default', () => {
        const { container } = render(<TagChip label="Kitchen" />);
        expect(screen.getByText('Kitchen')).toBeInTheDocument();
        expect(container.querySelector('svg')).not.toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows a lock icon when locked', () => {
        const { container } = render(<TagChip label="Kitchen" locked />);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('shows a remove button when removable, and calls onRemove', async () => {
        const onRemove = vi.fn();
        const user = userEvent.setup();
        render(<TagChip label="Kitchen" removable onRemove={onRemove} removeAriaLabel="Remove Kitchen" />);

        const button = screen.getByRole('button', { name: 'Remove Kitchen' });
        await user.click(button);
        expect(onRemove).toHaveBeenCalled();
    });

    it('titles the chip with the label by default', () => {
        render(<TagChip label="Kitchen" />);
        expect(screen.getByText('Kitchen').closest('.tagchip')).toHaveAttribute('title', 'Kitchen');
    });
});
