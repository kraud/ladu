import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColumnChart, type ColumnPoint } from '@/components/charts/ColumnChart';

const point = (i: number, value: number | null, extra: Partial<ColumnPoint> = {}): ColumnPoint => ({
    key: `p${i}`,
    label: `Day ${i}`,
    axisLabel: `D${i}`,
    value,
    ...extra,
});

const draw = (points: ColumnPoint[], props: Partial<Parameters<typeof ColumnChart>[0]> = {}) =>
    render(
        <ColumnChart
            points={points}
            unit="new accounts"
            ariaLabel="New accounts by day"
            axisLabelEvery={3}
            emptyMessage="Nothing here."
            tableHeading="Day"
            {...props}
        />,
    );

const columns = () => screen.getAllByTestId('column');
const barOf = (column: HTMLElement) => column.firstElementChild as HTMLElement | null;

describe('ColumnChart marks', () => {
    it('draws one column for each point, and a bar as high as its value on a 0 to top scale', () => {
        draw([point(0, 0), point(1, 5), point(2, 10)]);

        expect(columns()).toHaveLength(3);
        // 10 is the largest value, and the axis ends at 10: the tallest bar fills the plot.
        expect(barOf(columns()[2])).toHaveStyle({ height: '100%' });
        expect(barOf(columns()[1])).toHaveStyle({ height: '50%' });
        // A real 0 has no bar.
        expect(barOf(columns()[0])?.getAttribute('style') ?? '').not.toContain('height');
    });

    it('rounds the axis up, so the tallest bar never touches the top of the plot unless the axis ends there', () => {
        draw([point(0, 7)]);

        // Ticks for 7 are 0, 2, 4, 6, 8: the bar is 7 of 8.
        expect(barOf(columns()[0])).toHaveStyle({ height: '87.5%' });
        expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('caps a bar at 24px so it never fills its slot', () => {
        draw([point(0, 4)]);

        expect(barOf(columns()[0])?.className).toContain('max-w-6');
    });

    it('draws a missing value as no bar, and a partial value lighter', () => {
        draw([point(0, null), point(1, 4, { partial: true }), point(2, 4)]);

        expect(barOf(columns()[0])).toBeNull();
        expect(barOf(columns()[1])).toHaveStyle({ opacity: '0.5' });
        expect(barOf(columns()[2])).toHaveStyle({ opacity: '1' });
        expect(columns()[1]).toHaveAttribute('data-partial', 'true');
    });

    it('writes only the newest value on its column, never a number on every bar', () => {
        draw([point(0, 3), point(1, 8), point(2, 5)]);

        // 5 is written on the last bar; 3 and 8 are only on the axis or in the tooltip.
        expect(within(barOf(columns()[2]) as HTMLElement).getByText('5')).toBeInTheDocument();
        expect(barOf(columns()[0])).toHaveTextContent('');
        expect(barOf(columns()[1])).toHaveTextContent('');
    });

    it('writes a 0 for a newest value of 0, because no bar shows it', () => {
        draw([point(0, 3), point(1, 0)]);

        expect(within(columns()[1]).getByText('0')).toBeInTheDocument();
    });
});

describe('ColumnChart axes', () => {
    it('labels the y axis with whole numbers, and every n-th x label plus the last one, without two labels running together', () => {
        draw(Array.from({ length: 8 }, (_, i) => point(i, i + 1)), { axisLabelEvery: 3 });

        // Every 3rd, and the last. D6 is a regular label, but it is one slot from the last, so it is left out.
        for (const label of ['D0', 'D3', 'D7']) expect(screen.getByText(label)).toBeInTheDocument();
        for (const label of ['D1', 'D2', 'D4', 'D5', 'D6']) expect(screen.queryByText(label)).not.toBeInTheDocument();
        // The tallest value is 8: ticks 0, 2, 4, 6, 8.
        expect(screen.getAllByText(/^[0-8]$/).length).toBeGreaterThanOrEqual(5);
    });

    it('keeps its frame when every value is 0 or missing, and says why it is empty', () => {
        draw([point(0, 0), point(1, null), point(2, 0)]);

        expect(screen.getByText('Nothing here.')).toBeInTheDocument();
        // The axis is still there: 0, 1, 2.
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(columns()).toHaveLength(3);
    });

    it('does not show the empty message when there is data', () => {
        draw([point(0, 1)]);

        expect(screen.queryByText('Nothing here.')).not.toBeInTheDocument();
    });
});

describe('ColumnChart x labels on a narrow chart', () => {
    it('never puts two labels closer than n points apart, whatever the number of points', () => {
        for (let length = 2; length <= 40; length += 1) {
            const { unmount } = draw(Array.from({ length }, (_, i) => point(i, i + 1)), { axisLabelEvery: 6 });
            const shown = Array.from({ length }, (_, i) => i).filter((i) => screen.queryByText(`D${i}`));

            expect(shown).toContain(length - 1); // the newest point is always named
            // Regular labels are 6 apart, and one that would sit nearer than 6 to the last is dropped:
            // so no two labels are ever closer than 6 points.
            for (let k = 1; k < shown.length; k += 1) expect(shown[k] - shown[k - 1]).toBeGreaterThanOrEqual(6);
            unmount();
        }
    });
});

describe('ColumnChart tooltip', () => {
    it('shows the value first, then the name and the note, on hover; and hides it when the pointer leaves', async () => {
        const user = userEvent.setup();
        draw([point(0, 2), point(1, 9, { partial: true, note: 'Today is not over yet' })]);

        await user.hover(columns()[1]);

        const tip = screen.getByRole('tooltip');
        expect(tip).toHaveTextContent('9 new accounts');
        expect(tip).toHaveTextContent('Day 1');
        expect(tip).toHaveTextContent('Today is not over yet');
        // The value leads: it is the first line.
        expect(tip.firstElementChild).toHaveTextContent('9 new accounts');

        await user.unhover(columns()[1]);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('shows the same on keyboard focus, so a tooltip is never the only way to a value', async () => {
        const user = userEvent.setup();
        draw([point(0, 2), point(1, 9)]);

        await user.tab();
        expect(screen.getByRole('tooltip')).toHaveTextContent('2 new accounts');
        await user.tab();
        expect(screen.getByRole('tooltip')).toHaveTextContent('9 new accounts');
        await user.tab(); // out of the chart (into the table summary)
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('says "No data" with its reason for a missing value', async () => {
        const user = userEvent.setup();
        draw([point(0, null, { note: 'Counting started on 5 Oct' }), point(1, 3)]);

        await user.hover(columns()[0]);

        expect(screen.getByRole('tooltip')).toHaveTextContent('No data');
        expect(screen.getByRole('tooltip')).toHaveTextContent('Counting started on 5 Oct');
    });

    it('uses text, never markup, for a label that came from the server', async () => {
        const user = userEvent.setup();
        draw([point(0, 1, { label: '<img src=x onerror=alert(1)>' })]);

        await user.hover(columns()[0]);

        expect(screen.getByRole('tooltip')).toHaveTextContent('<img src=x onerror=alert(1)>');
        expect(document.querySelector('img')).toBeNull();
    });

    it('keeps the tooltip inside the chart at both ends', async () => {
        const user = userEvent.setup();
        draw(Array.from({ length: 10 }, (_, i) => point(i, i + 1)));

        await user.hover(columns()[0]);
        expect(screen.getByRole('tooltip').className).not.toContain('-translate-x');
        await user.hover(columns()[9]);
        expect(screen.getByRole('tooltip').className).toContain('-translate-x-full');
        await user.hover(columns()[5]);
        expect(screen.getByRole('tooltip').className).toContain('-translate-x-1/2');
    });
});

describe('ColumnChart for a screen reader and the table view', () => {
    it('names the chart, and gives every column a text that says what it holds', () => {
        draw([point(0, 4), point(1, null, { note: 'No history yet' }), point(2, 6, { partial: true, note: 'Today is not over yet' })]);

        expect(screen.getByRole('group', { name: 'New accounts by day' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Day 0: 4 new accounts' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Day 1: no data. No history yet' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Day 2: 6 new accounts (Today is not over yet)' })).toBeInTheDocument();
    });

    it('has a table view with every value, newest first, with a dash for a missing one', async () => {
        const user = userEvent.setup();
        draw([point(0, 4), point(1, null, { note: 'No history yet' }), point(2, 6)]);

        await user.click(screen.getByText('Show as table'));

        const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
        expect(rows.map((r) => r.textContent)).toEqual(['Day 26', 'Day 1No history yet–', 'Day 04']);
        expect(screen.getByRole('columnheader', { name: 'Day' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Count' })).toBeInTheDocument();
    });

    it('groups thousands in the axis, the tooltip and the table', async () => {
        const user = userEvent.setup();
        draw([point(0, 1500), point(1, 2400)]);

        expect(screen.getAllByText(/1,000|2,000|3,000/).length).toBeGreaterThan(0);
        await user.hover(columns()[1]);
        expect(screen.getByRole('tooltip')).toHaveTextContent('2,400 new accounts');
    });
});
