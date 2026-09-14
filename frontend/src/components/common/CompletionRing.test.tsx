import { render, screen } from '@testing-library/react';
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

    it('always renders the (CSS-hidden-until-hover) detail text', () => {
        render(<CompletionRing value={1} total={4} detail="1 of 4 cases" />);
        expect(screen.getByText('1 of 4 cases')).toBeInTheDocument();
    });
});
