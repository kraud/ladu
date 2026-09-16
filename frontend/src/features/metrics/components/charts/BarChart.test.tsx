import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    afterEach(() => {
        vi.useRealTimers();
    });

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

    it('lays a hit area over every non-zero bar, in the bar’s own coordinates', () => {
        const { container } = render(
            <BarChart groups={GROUPS} series={SERIES} stacked={false} unitLabel="words" ariaLabel="chart" />,
        );
        const rects = Array.from(container.querySelectorAll('rect.bar'));
        const hits = Array.from(container.querySelectorAll<HTMLElement>('.bar-hit'));

        // 2026-07 Verbs: 0 has no bar, so it gets no hit area either.
        expect(rects).toHaveLength(3);
        expect(hits).toHaveLength(3);

        // The hit area must sit exactly on its bar, or the tooltip fires from the wrong place.
        rects.forEach((rect, index) => {
            const hit = hits[index]!;
            expect(hit.style.left).toBe(`${(Number(rect.getAttribute('x')) / 640) * 100}%`);
            expect(hit.style.top).toBe(`${(Number(rect.getAttribute('y')) / 240) * 100}%`);
            expect(hit.style.width).toBe(`${(Number(rect.getAttribute('width')) / 640) * 100}%`);
            expect(hit.style.height).toBe(`${(Number(rect.getAttribute('height')) / 240) * 100}%`);
        });
    });

    // A real hover fires mouseenter then mousemove; Base UI starts its open
    // timer off that pair. Fake timers then pin the delay exactly.
    it('opens the bar value in a tooltip only after the default 100 ms hover delay', async () => {
        vi.useFakeTimers();
        const { container } = render(
            <BarChart groups={GROUPS} series={SERIES} stacked={false} unitLabel="words" ariaLabel="chart" />,
        );
        const hit = container.querySelector<HTMLElement>('.bar-hit')!;

        fireEvent.mouseEnter(hit);
        fireEvent.mouseMove(hit);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(99);
        });
        expect(screen.queryByText('Nouns: 3 words')).not.toBeInTheDocument();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        expect(screen.getByText('Nouns: 3 words')).toBeInTheDocument();
    });

    it('honours a custom tooltipDelay', async () => {
        vi.useFakeTimers();
        const { container } = render(
            <BarChart
                groups={GROUPS}
                series={SERIES}
                stacked={false}
                unitLabel="words"
                ariaLabel="chart"
                tooltipDelay={500}
            />,
        );
        const hit = container.querySelector<HTMLElement>('.bar-hit')!;

        fireEvent.mouseEnter(hit);
        fireEvent.mouseMove(hit);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });
        expect(screen.queryByText('Nouns: 3 words')).not.toBeInTheDocument();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
        });
        expect(screen.getByText('Nouns: 3 words')).toBeInTheDocument();
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

    it('scales the y axis to the data instead of a fixed 20 when values are small', () => {
        const fewGroups: BarChartGroup[] = [{ xLabel: '2026-09', values: [3, 0] }];
        const { container } = render(
            <BarChart groups={fewGroups} series={SERIES} stacked={false} unitLabel="words" ariaLabel="chart" />,
        );
        const labels = Array.from(container.querySelectorAll('line.grid-line + text')).map((t) => t.textContent);
        // Highest value is 3: top gridline is exactly 1 tick above the tick it fits under (0/1/2/3/4), not 20.
        expect(labels).toEqual(['0', '1', '2', '3', '4']);
    });

    it('never lets the tallest bar reach the top gridline (always keeps 1 tick of headroom)', () => {
        const tallGroups: BarChartGroup[] = [{ xLabel: '2026-09', values: [17, 0] }];
        const { container } = render(
            <BarChart groups={tallGroups} series={SERIES} stacked={false} unitLabel="words" ariaLabel="chart" />,
        );
        const labels = Array.from(container.querySelectorAll('line.grid-line + text')).map((t) =>
            Number(t.textContent),
        );
        const niceMax = Math.max(...labels);
        expect(17).toBeLessThan(niceMax);
        // The tallest bar never spans more than the first 3 of the 4 gridline steps.
        expect(17).toBeLessThanOrEqual((niceMax * 3) / 4);
    });
});
