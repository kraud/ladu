import { describe, expect, it } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/renderApp';
import { makeActivity, makeStats, statsHandler, TODAY } from '@/test/stats';

const open = (role: 'viewer' | 'support' | 'admin' | 'owner' = 'viewer') => renderApp({ initialEntry: '/', role });
const card = (title: string) => within(screen.getByRole('heading', { name: title }).closest('section') as HTMLElement);
const tile = (label: string) => within(screen.getByText(label, { selector: 'dt' }).closest('div') as HTMLElement);
const columnsOf = (title: string) => card(title).getAllByTestId('column');

describe('the numbers', () => {
    it('shows each total, with a note where one helps', async () => {
        server.use(statsHandler());

        await open();
        await screen.findByText('1,234');

        expect(tile('Users').getByText('1,234')).toBeInTheDocument();
        // The newest 7 daily counts of the fixture are 3, 0, 1, 2, 3, 0, 1.
        expect(tile('Users').getByText('+10 in the last 7 days')).toBeInTheDocument();
        expect(tile('Verified').getByText('1,000')).toBeInTheDocument();
        expect(tile('Verified').getByText('81% of users')).toBeInTheDocument();
        expect(tile('Words').getByText('50,000')).toBeInTheDocument();
        expect(tile('Translations').getByText('120,000')).toBeInTheDocument();
        expect(tile('Practised translations').getByText('900')).toBeInTheDocument();
        expect(tile('Saved practice sessions').getByText('7')).toBeInTheDocument();
        expect(tile('Tags').getByText('40')).toBeInTheDocument();
        expect(tile('Not verified').getByText('234')).toBeInTheDocument();
        expect(tile('Not verified').getByText('19% of users')).toBeInTheDocument();
        expect(screen.getByText(/Banned: 3 \(counted as users\) · Waiting to be deleted for good: 2 \(not counted as users\)/)).toBeInTheDocument();
    });

    it('says the days are UTC, and greets by name', async () => {
        server.use(statsHandler());

        await open();

        expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
        expect(screen.getByText(/Welcome, Sam Staff/)).toBeInTheDocument();
        expect(screen.getByText(/Days and weeks are in UTC, and a week starts on Monday/)).toBeInTheDocument();
    });

    it('shows no "+" when nobody signed up this week', async () => {
        server.use(statsHandler(() => makeStats({ signups: { ...makeStats().signups, daily: makeStats().signups.daily.map((d) => ({ ...d, count: 0 })) } })));

        await open();

        expect(await screen.findByText('0 in the last 7 days')).toBeInTheDocument();
    });

    it('shows the active-user tiles from the newest point, and says when they are a lower bound', async () => {
        server.use(statsHandler());

        await open();
        await screen.findByText('1,234');

        // 7 days: the window starts on 8 Oct, after counting began on 5 Oct, so it is complete.
        expect(tile('Active, last 7 days').getByText('80')).toBeInTheDocument();
        // 30 days: the window starts on 15 Sep, before counting began, so it is "at least".
        expect(tile('Active, last 30 days').getByText('300')).toBeInTheDocument();
        expect(tile('Active, last 30 days').getByText(/Counting started on 5 Oct: at least this many/)).toBeInTheDocument();
    });

    it('shows a dash, not a 0, while nothing is recorded', async () => {
        server.use(statsHandler(() => makeStats({ active: { since: null, points: makeActivity(Date.parse(`${TODAY}T00:00:00Z`), null, { daily: 0, weekly: 0, monthly: 0 }) } })));

        await open();
        await screen.findByText('1,234');

        expect(tile('Active, last 7 days').getByText('–')).toBeInTheDocument();
        expect(tile('Active, last 7 days').getByText('No data yet')).toBeInTheDocument();
        expect(tile('Active, last 30 days').getByText('–')).toBeInTheDocument();
    });
});

describe('new accounts', () => {
    it('shows the last 30 days, with today lighter because it is not over', async () => {
        server.use(statsHandler());

        await open();
        await screen.findByText('1,234');

        const columns = columnsOf('New accounts');
        expect(columns).toHaveLength(30);
        expect(columns.at(-1)).toHaveAttribute('data-partial', 'true');
        expect(columns[0]).not.toHaveAttribute('data-partial');
        expect(card('New accounts').getByRole('img', { name: /Wed, 14 Oct 2026: 1 new accounts \(Today is not over yet\)/ })).toBeInTheDocument();
        expect(card('New accounts').getByText('Accounts created on each of the last 30 days')).toBeInTheDocument();
    });

    it('switches to 12 weeks, named by the Monday that starts each, with the current week lighter', async () => {
        server.use(statsHandler());
        const user = userEvent.setup();
        await open();
        await screen.findByText('1,234');

        await user.click(card('New accounts').getByRole('button', { name: '12 weeks' }));

        const columns = columnsOf('New accounts');
        expect(columns).toHaveLength(12);
        expect(columns.at(-1)).toHaveAttribute('data-partial', 'true');
        expect(card('New accounts').getByRole('img', { name: /Week of 12 Oct: 21 new accounts \(This week is not over yet\)/ })).toBeInTheDocument();
        expect(card('New accounts').getByRole('button', { name: '12 weeks' })).toHaveAttribute('aria-pressed', 'true');
        expect(card('New accounts').getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('says what an empty period means, and keeps the frame', async () => {
        server.use(statsHandler(() => makeStats({ signups: { daily: makeStats().signups.daily.map((d) => ({ ...d, count: 0 })), weekly: makeStats().signups.weekly } })));

        await open();
        await screen.findByText('1,234');

        expect(card('New accounts').getByText('No new accounts in this period.')).toBeInTheDocument();
        expect(columnsOf('New accounts')).toHaveLength(30);
    });

    it('has a table view of every value', async () => {
        server.use(statsHandler());
        const user = userEvent.setup();
        await open();
        await screen.findByText('1,234');

        await user.click(card('New accounts').getByText('Show as table'));

        const rows = within(card('New accounts').getByRole('table')).getAllByRole('row');
        expect(rows).toHaveLength(31); // header + 30 days
        expect(rows[1]).toHaveTextContent('Wed, 14 Oct 2026');
    });
});

describe('active users', () => {
    it('draws no bar for the days before counting began, and says so', async () => {
        server.use(statsHandler());
        const user = userEvent.setup();
        await open();
        await screen.findByText('1,234');

        const columns = columnsOf('Active users');
        expect(columns).toHaveLength(30);
        // 15 Sep to 4 Oct are before 5 Oct: 20 days without data.
        expect(columns.filter((c) => c.getAttribute('data-value') === 'none')).toHaveLength(20);
        expect(card('Active users').getByText(/Counting started on 5 Oct\. Earlier days have no data\. Lighter columns are lower bounds/)).toBeInTheDocument();

        await user.hover(columns[0]);
        expect(screen.getByRole('tooltip')).toHaveTextContent('No data');
        expect(screen.getByRole('tooltip')).toHaveTextContent('Counting started on 5 Oct');
    });

    it('marks the first day of counting, and today, as lower bounds', async () => {
        server.use(statsHandler());
        await open();
        await screen.findByText('1,234');

        const columns = columnsOf('Active users');
        // Index 20 is 5 Oct, the first day. Index 29 is today.
        expect(columns[20]).toHaveAttribute('data-partial', 'true');
        expect(columns[21]).not.toHaveAttribute('data-partial');
        expect(columns[29]).toHaveAttribute('data-partial', 'true');
    });

    it('switches the window to 7 days and 30 days, and says which windows are complete', async () => {
        server.use(statsHandler());
        const user = userEvent.setup();
        await open();
        await screen.findByText('1,234');

        await user.click(card('Active users').getByRole('button', { name: '7 days' }));
        let columns = columnsOf('Active users');
        expect(card('Active users').getByRole('img', { name: /7 days to Mon, 12 Oct 2026: 80 active users$/ })).toBeInTheDocument();
        // A window that ends on 11 Oct starts on 5 Oct, the first day: still a lower bound. One day later it is complete.
        expect(columns[26]).toHaveAttribute('data-partial', 'true'); // 11 Oct
        expect(columns[27]).not.toHaveAttribute('data-partial'); // 12 Oct

        await user.click(card('Active users').getByRole('button', { name: '30 days' }));
        columns = columnsOf('Active users');
        expect(card('Active users').getByRole('img', { name: /30 days to Mon, 12 Oct 2026: 300 active users/ })).toBeInTheDocument();
        // The 30-day window is incomplete for the whole range shown.
        expect(columns.filter((c) => c.getAttribute('data-value') !== 'none').every((c) => c.getAttribute('data-partial') === 'true')).toBe(true);
    });

    it('says nothing is recorded yet, when it is not', async () => {
        server.use(statsHandler(() => makeStats({ active: { since: null, points: makeActivity(Date.parse(`${TODAY}T00:00:00Z`), null, { daily: 0, weekly: 0, monthly: 0 }) } })));

        await open();
        await screen.findByText('1,234');

        expect(card('Active users').getByText(/Nothing is recorded yet\. Counting starts with the first request after this release\./)).toBeInTheDocument();
        expect(columnsOf('Active users').every((c) => c.getAttribute('data-value') === 'none')).toBe(true);
        expect(card('Active users').getByText('A user counts once for each day on which they used the app.')).toBeInTheDocument();
    });

    it('says "no active users" when counting has started and a period is empty', async () => {
        server.use(
            statsHandler(() =>
                makeStats({ active: { since: '2026-10-05', points: makeActivity(Date.parse(`${TODAY}T00:00:00Z`), '2026-10-05', { daily: 0, weekly: 0, monthly: 0 }) } }),
            ),
        );

        await open();
        await screen.findByText('1,234');

        expect(card('Active users').getByText('No active users in this period.')).toBeInTheDocument();
    });
});

describe('languages', () => {
    it('lists each language with its users and its share of all users', async () => {
        server.use(statsHandler());

        await open();
        await screen.findByText('1,234');

        const items = within(card('Languages').getByRole('list')).getAllByRole('listitem');
        expect(items.map((li) => li.textContent)).toEqual(['English900 · 73%', 'Spanish450 · 36%', 'German120 · 10%', 'Estonian30 · 2%']);
        expect(card('Languages').getByText(/add up to more than 100%/)).toBeInTheDocument();
    });

    it('says so when no language has been chosen', async () => {
        server.use(statsHandler(() => makeStats({ languages: [] })));

        await open();

        expect(await screen.findByText('No user has chosen a language yet.')).toBeInTheDocument();
    });
});

describe('loading, errors and refreshing', () => {
    it('shows "Loading…" first, then the page', async () => {
        server.use(
            http.get('/api/admin/stats', async () => {
                await delay(100);
                return HttpResponse.json(makeStats());
            }),
        );

        await open();

        expect(await screen.findByText('Loading…')).toBeInTheDocument();
        expect(await screen.findByText('1,234')).toBeInTheDocument();
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });

    it('shows the server error and tries again', async () => {
        let fail = true;
        server.use(statsHandler(() => (fail ? (HttpResponse.json({ message: 'Boom' }, { status: 500 }) as unknown as Response) : makeStats())));
        const user = userEvent.setup();
        await open();

        expect(await screen.findByRole('alert')).toHaveTextContent('The statistics could not be loaded.');
        expect(screen.getByRole('alert')).toHaveTextContent('Boom');
        fail = false;
        await user.click(screen.getByRole('button', { name: 'Try again' }));

        expect(await screen.findByText('1,234')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('keeps the page and dims it while it asks again, then shows the new numbers', async () => {
        let calls = 0;
        server.use(
            http.get('/api/admin/stats', async () => {
                calls += 1;
                if (calls > 1) await delay(150);
                return HttpResponse.json(makeStats({ totals: { ...makeStats().totals, users: calls === 1 ? 1234 : 1240 } }));
            }),
        );
        const user = userEvent.setup();
        await open();
        await screen.findByText('1,234');

        await user.click(screen.getByRole('button', { name: 'Refresh' }));

        // While it loads: the old numbers stay (no skeleton, no jump), and the button waits.
        expect(screen.getByText('1,234')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
        expect(screen.getByText('1,234').closest('div[class*="opacity-60"]')).not.toBeNull();
        expect(await screen.findByText('1,240')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled());
        expect(calls).toBe(2);
    });

    it('keeps a chosen range while the numbers reload', async () => {
        server.use(statsHandler());
        const user = userEvent.setup();
        await open();
        await screen.findByText('1,234');
        await user.click(card('New accounts').getByRole('button', { name: '12 weeks' }));

        await user.click(screen.getByRole('button', { name: 'Refresh' }));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled());
        expect(columnsOf('New accounts')).toHaveLength(12);
    });
});

describe('who can see it', () => {
    it('is the home page of every role', async () => {
        server.use(statsHandler());

        for (const role of ['viewer', 'support', 'admin', 'owner'] as const) {
            const { unmount } = await open(role);
            expect([role, await screen.findByText('1,234')]).toEqual([role, expect.anything()]);
            unmount();
        }
    });
});
