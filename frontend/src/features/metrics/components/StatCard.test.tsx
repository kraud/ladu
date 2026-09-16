import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard, StatCardSkeleton } from './StatCard';

describe('StatCard', () => {
    it('renders the number, label and sub-line', () => {
        render(<StatCard value="42" label="Total words" sub="+3 this month" />);
        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText('Total words')).toBeInTheDocument();
        expect(screen.getByText('+3 this month')).toBeInTheDocument();
    });

    it('renders a meter instead of the sub-line when meterPercent is given', () => {
        render(<StatCard value="25%" label="Incomplete words" sub="ignored" meterPercent={25} />);
        expect(screen.queryByText('ignored')).not.toBeInTheDocument();
        const meter = screen.getByRole('progressbar', { name: 'Incomplete words' });
        expect(meter).toHaveAttribute('aria-valuenow', '25');
        expect((meter.firstElementChild as HTMLElement).style.width).toBe('25%');
    });

    it('clamps an out-of-range meterPercent to 0-100', () => {
        render(<StatCard value="120%" label="Incomplete words" meterPercent={120} />);
        const meter = screen.getByRole('progressbar');
        expect((meter.firstElementChild as HTMLElement).style.width).toBe('100%');
    });

    it('applies the warn modifier class', () => {
        const { container } = render(<StatCard value="9%" label="Incomplete words" meterPercent={9} warn />);
        expect(container.querySelector('.stat-card.warn')).toBeInTheDocument();
    });

    it('renders a ReactNode sub (e.g. a link) as-is', () => {
        render(<StatCard value="—" label="Incomplete words" sub={<a href="/user">Add your languages</a>} />);
        expect(screen.getByRole('link', { name: 'Add your languages' })).toBeInTheDocument();
    });
});

describe('StatCardSkeleton', () => {
    it('renders two skeleton placeholders', () => {
        const { container } = render(<StatCardSkeleton />);
        expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
    });
});
