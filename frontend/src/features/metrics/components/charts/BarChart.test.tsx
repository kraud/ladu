import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarChart, type BarChartGroup, type BarSeriesMeta } from './BarChart';

const SERIES: BarSeriesMeta[] = [
    { key: 'Noun', label: 'Nouns', color: 'var(--accent)' },
    { key: 'Verb', label: 'Verbs', color: 'var(--lang-es)' },
];

const GROUPS: BarChartGroup[] = [
    { xLabel: '2026-07', values: [3, 0] },
    { xLabel: '2026-08', values: [5, 2] },
];

describe('BarChart', () => {
    it('renders the svg with an accessible label', () => {
        render(<BarChart groups={GROUPS} series={SERIES} stacked={false} unitLabel="words" ariaLabel="Words per month" />);
        expect(screen.getByRole('img', { name: 'Words per month' })).toBeInTheDocument();
    });

    it('renders an x-axis label per group', () => {
        render(<BarChart groups={GROUPS} series={SERIES} stacked={false} unitLabel="words" ariaLabel="chart" />);
        expect(screen.getByText('2026-07')).toBeInTheDocument();
        expect(screen.getByText('2026-08')).toBeInTheDocument();
    });

    it('renders a legend entry per series', () => {
        render(<BarChart groups={GROUPS} series={SERIES} stacked={false} unitLabel="words" ariaLabel="chart" />);
        expect(screen.getByText('Nouns')).toBeInTheDocument();
        expect(screen.getByText('Verbs')).toBeInTheDocument();
    });

    it('renders a native tooltip title for every non-zero bar, skipping zero-value ones', () => {
        const { container } = render(
            <BarChart groups={GROUPS} series={SERIES} stacked={false} unitLabel="words" ariaLabel="chart" />,
        );
        const titles = Array.from(container.querySelectorAll('title')).map((t) => t.textContent);
        expect(titles).toEqual(
            expect.arrayContaining(['Nouns: 3 words', 'Verbs: 2 words', 'Nouns: 5 words']),
        );
        // 2026-07 has Verbs: 0 — no bar/tooltip for it.
        expect(titles).not.toContain('Verbs: 0 words');
        expect(titles).toHaveLength(3);
    });

    it('renders the same bar count whether stacked or grouped (layout differs, data does not)', () => {
        const grouped = render(
            <BarChart groups={GROUPS} series={SERIES} stacked={false} unitLabel="words" ariaLabel="chart" />,
        );
        const stacked = render(
            <BarChart groups={GROUPS} series={SERIES} stacked unitLabel="words" ariaLabel="chart" />,
        );
        const groupedBars = grouped.container.querySelectorAll('rect.bar').length;
        const stackedBars = stacked.container.querySelectorAll('rect.bar').length;
        expect(groupedBars).toBe(3);
        expect(stackedBars).toBe(3);
    });

    it('renders y-axis gridline labels at five steps', () => {
        const { container } = render(
            <BarChart groups={GROUPS} series={SERIES} stacked={false} unitLabel="words" ariaLabel="chart" />,
        );
        expect(container.querySelectorAll('line.grid-line')).toHaveLength(5);
    });

    it('handles an empty group list without crashing', () => {
        render(<BarChart groups={[]} series={SERIES} stacked={false} unitLabel="words" ariaLabel="chart" />);
        expect(screen.getByRole('img', { name: 'chart' })).toBeInTheDocument();
    });
});
