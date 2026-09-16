import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PieChart, type PieChartSegment } from './PieChart';

const SEGMENTS: PieChartSegment[] = [
    { key: 'Noun', label: 'Nouns', count: 30, color: 'var(--accent)' },
    { key: 'Verb', label: 'Verbs', count: 60, color: 'var(--lang-es)' },
    { key: 'Adjective', label: 'Adjectives', count: 10, color: 'var(--warning)' },
];

describe('PieChart', () => {
    it('renders the svg with an accessible label', () => {
        render(
            <PieChart
                segments={SEGMENTS}
                total={100}
                unitLabel="words"
                worst={SEGMENTS[2]!}
                ariaLabel="Words by part of speech"
            />,
        );
        expect(screen.getByRole('img', { name: 'Words by part of speech' })).toBeInTheDocument();
    });

    it('renders the centre total and unit label', () => {
        render(<PieChart segments={SEGMENTS} total={100} unitLabel="words" worst={SEGMENTS[2]!} ariaLabel="chart" />);
        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText('words')).toBeInTheDocument();
    });

    it('renders one legend row per segment with name, count and percent', () => {
        render(<PieChart segments={SEGMENTS} total={100} unitLabel="words" worst={SEGMENTS[2]!} ariaLabel="chart" />);
        expect(screen.getByText('Nouns')).toBeInTheDocument();
        expect(screen.getByText('[30]')).toBeInTheDocument();
        expect(screen.getByText('30%')).toBeInTheDocument();
        expect(screen.getByText('Verbs')).toBeInTheDocument();
        expect(screen.getByText('[60]')).toBeInTheDocument();
        expect(screen.getByText('60%')).toBeInTheDocument();
        expect(screen.getByText('Adjectives')).toBeInTheDocument();
        expect(screen.getByText('[10]')).toBeInTheDocument();
        expect(screen.getByText('10%')).toBeInTheDocument();
    });

    it('renders the worst segment as a clickable button and fires onWorstClick', async () => {
        const onWorstClick = vi.fn();
        render(
            <PieChart
                segments={SEGMENTS}
                total={100}
                unitLabel="words"
                worst={SEGMENTS[2]!}
                onWorstClick={onWorstClick}
                ariaLabel="chart"
            />,
        );
        const button = screen.getByRole('button', { name: /Adjectives/ });
        await userEvent.click(button);
        expect(onWorstClick).toHaveBeenCalledTimes(1);
    });

    it('does not make non-worst segments interactive', () => {
        render(<PieChart segments={SEGMENTS} total={100} unitLabel="words" worst={SEGMENTS[2]!} ariaLabel="chart" />);
        expect(screen.queryByRole('button', { name: /Nouns/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Verbs/ })).not.toBeInTheDocument();
    });

    it('handles an empty total without crashing', () => {
        render(<PieChart segments={[]} total={0} unitLabel="words" worst={null} ariaLabel="chart" />);
        expect(screen.getByRole('img', { name: 'chart' })).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
    });
});
