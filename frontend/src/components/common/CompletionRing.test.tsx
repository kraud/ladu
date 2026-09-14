import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CompletionRing } from './CompletionRing';

describe('CompletionRing', () => {
    it('renders nothing when total is 0 (no config for this pos/language)', () => {
        const { container } = render(<CompletionRing value={0} total={0} detail="0 of 0 cases" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('sets --pct proportionally', () => {
        render(<CompletionRing value={2} total={4} detail="2 of 4 cases" />);
        const ring = document.querySelector('.ring') as HTMLElement;
        expect(ring.style.getPropertyValue('--pct')).toBe('50');
    });

    it('clamps a stored count that exceeds the expected total (a v1-authored word)', () => {
        render(<CompletionRing value={9} total={4} detail="9 of 4 cases" />);
        const ring = document.querySelector('.ring') as HTMLElement;
        expect(ring.style.getPropertyValue('--pct')).toBe('100');
    });

    it('does not render the detail text until the ring is hovered/focused (a real tooltip, not an inline reveal)', () => {
        render(<CompletionRing value={1} total={4} detail="1 of 4 cases" />);
        expect(screen.queryByText('1 of 4 cases')).not.toBeInTheDocument();
    });

    it('shows the detail text in a floating tooltip on hover', async () => {
        const user = userEvent.setup();
        render(<CompletionRing value={1} total={4} detail="1 of 4 cases" />);

        await user.hover(document.querySelector('.ring') as HTMLElement);
        expect(await screen.findByText('1 of 4 cases')).toBeInTheDocument();
    });
});
