import { test, expect, type APIRequestContext } from '@playwright/test';
import {
    closePool,
    createStaffAccount,
    deleteStaffByEmail,
    deleteUsersByEmail,
    getActivityDays,
    seedActivityDay,
    seedUser,
} from '../fixtures/db';

/**
 * Admin dashboard, slice 9 — the overview statistics, against the real backend + Postgres +
 * the `admin/` UI (`.context/plans/admin-dashboard.md`).
 *
 * Other specs create and delete users at the same time, so the totals of the whole database
 * cannot be asserted exactly. This spec reads the API BEFORE it seeds anything, then seeds rows
 * on days in the PAST (nobody else writes those), and checks that exactly its own rows appear:
 * in the signup chart, in the active-user chart, and in the language list. A last test proves
 * that a real request through the learner app writes today's active day.
 *
 * Uses unique `e2e-admin9-*` emails and removes them in `afterAll`.
 */

const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174';
const API = process.env.E2E_API_URL ?? 'http://localhost:5001';

const run = Date.now();
const PASSWORD = 'e2e-staff-password';
const viewerEmail = `e2e-admin9-${run}-viewer@ladu.test`;
const userEmails = [1, 2, 3, 4].map((n) => `e2e-admin9-${run}-u${n}@ladu.test`);
const activeEmail = `e2e-admin9-${run}-active@ladu.test`;

// Dates are UTC days, the way the server counts them.
const DAY = 24 * 60 * 60 * 1000;
const todayMs = (() => {
    const d = new Date();
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
})();
const dayString = (offset: number) => new Date(todayMs + offset * DAY).toISOString().slice(0, 10);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// The same text the page writes: "Sat, 12 Sep 2026".
const longDay = (offset: number) => {
    const d = new Date(todayMs + offset * DAY);
    return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

interface Stats {
    totals: { users: number };
    signups: { daily: { day: string; count: number }[] };
    active: { since: string | null; points: { day: string; daily: { count: number | null } }[] };
    languages: { language: string; users: number }[];
}

let before: Stats;
let staffToken: string;

async function api(request: APIRequestContext, token?: string) {
    return request.get(`${API}/api/admin/stats`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
    await createStaffAccount(viewerEmail, 'viewer', PASSWORD, `Viewer E9 ${run}`);
    const login = await request.post(`${API}/api/admin/auth/login`, { data: { email: viewerEmail, password: PASSWORD } });
    staffToken = ((await login.json()) as { token: string }).token;

    // Read the numbers first: everything below is checked as "before + what this spec added".
    before = (await (await api(request, staffToken)).json()) as Stats;

    // Three accounts created 20 days ago, one 45 days ago (outside the 30-day chart).
    const seeded = [
        await seedUser(userEmails[0], { name: 'Stats A', username: `sa${run}`, createdAt: `${dayString(-20)}T12:00:00`, languages: ['Estonian', 'German'] }),
        await seedUser(userEmails[1], { name: 'Stats B', username: `sb${run}`, createdAt: `${dayString(-20)}T13:00:00`, languages: ['Estonian'] }),
        await seedUser(userEmails[2], { name: 'Stats C', username: `sc${run}`, createdAt: `${dayString(-20)}T14:00:00`, languages: ['German', 'Spanish'] }),
        await seedUser(userEmails[3], { name: 'Stats D', username: `sd${run}`, createdAt: `${dayString(-45)}T12:00:00` }),
    ];
    // Activity on two past days: A and B on day -3, A on day -2.
    await seedActivityDay(seeded[0].userId, dayString(-3));
    await seedActivityDay(seeded[1].userId, dayString(-3));
    await seedActivityDay(seeded[0].userId, dayString(-2));
});

test.afterAll(async () => {
    await deleteUsersByEmail([...userEmails, activeEmail]);
    await deleteStaffByEmail([viewerEmail]);
    await closePool();
});

const baselineSignups = (offset: number) => before.signups.daily.find((d) => d.day === dayString(offset))?.count ?? 0;
const baselineActive = (offset: number) => before.active.points.find((p) => p.day === dayString(offset))?.daily.count ?? 0;

test.describe('Admin dashboard — overview statistics (slice 9)', () => {
    test('a viewer sees exactly the rows this spec added, in tiles, charts and the language list', async ({ page }) => {
        await page.goto(`${ADMIN_URL}/login`);
        await page.getByLabel('Email').fill(viewerEmail);
        await page.getByLabel('Password').fill(PASSWORD);
        await page.getByRole('button', { name: 'Sign in' }).click();

        // The home page is the overview, for every role.
        await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
        await expect(page.getByText(/Days and weeks are in UTC/)).toBeVisible();
        for (const label of ['Users', 'Verified', 'Active, last 7 days', 'Active, last 30 days', 'Words', 'Translations', 'Tags']) {
            await expect(page.locator('dt', { hasText: new RegExp(`^${label}$`) })).toBeVisible();
        }

        // --- New accounts: day -20 holds the 3 accounts this spec created, on top of what was there.
        const signups = page.locator('section', { has: page.getByRole('heading', { name: 'New accounts', exact: true }) });
        await expect(signups.getByTestId('column')).toHaveCount(30);
        const expectedSignups = baselineSignups(-20) + 3;
        await expect(signups.getByRole('img', { name: `${longDay(-20)}: ${expectedSignups} new accounts` })).toBeVisible();
        // The account from 45 days ago is outside the 30 days: the day -30 is not on the chart at all.
        await expect(signups.getByRole('img', { name: new RegExp(`^${longDay(-30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`) })).toHaveCount(0);
        // Today is not over: the newest bar is marked as a lower bound.
        await expect(signups.getByTestId('column').last()).toHaveAttribute('data-partial', 'true');

        // Hovering the column shows the same number in a tooltip, value first.
        await signups.getByRole('img', { name: `${longDay(-20)}: ${expectedSignups} new accounts` }).hover();
        await expect(page.getByRole('tooltip')).toContainText(`${expectedSignups} new accounts`);
        await expect(page.getByRole('tooltip')).toContainText(longDay(-20));

        // The table view carries every value without hovering.
        await signups.getByText('Show as table').click();
        await expect(signups.getByRole('row').filter({ hasText: longDay(-20) })).toContainText(String(expectedSignups));

        // 12 weeks: twelve columns, and the current week is lighter.
        await signups.getByRole('button', { name: '12 weeks' }).click();
        await expect(signups.getByTestId('column')).toHaveCount(12);
        await expect(signups.getByTestId('column').last()).toHaveAttribute('data-partial', 'true');
        await signups.getByRole('button', { name: '30 days' }).click();

        // --- Active users: day -3 has A and B, day -2 has A, on top of any earlier rows.
        const active = page.locator('section', { has: page.getByRole('heading', { name: 'Active users', exact: true }) });
        await expect(active.getByTestId('column')).toHaveCount(30);
        await expect(active.getByRole('img', { name: `${longDay(-3)}: ${baselineActive(-3) + 2} active users` })).toBeVisible();
        await expect(active.getByRole('img', { name: `${longDay(-2)}: ${baselineActive(-2) + 1} active users` })).toBeVisible();
        // Counting started on a real day, and the page says which.
        await expect(active.getByText(/Counting started on \d+ \w+\. Earlier days have no data/)).toBeVisible();
        // The rolling windows count a user once: A was active on two days, and counts once in 7 days.
        await active.getByRole('button', { name: '7 days' }).click();
        await expect(active.getByRole('img', { name: new RegExp(`^7 days to ${longDay(-2)}: \\d+ active users`) })).toBeVisible();

        // --- Languages: the three languages this spec used are listed, each with at least its own users.
        const languages = page.locator('section', { has: page.getByRole('heading', { name: 'Languages', exact: true }) });
        for (const [language, atLeast] of [['Estonian', 2], ['German', 2], ['Spanish', 1]] as const) {
            const row = languages.getByRole('img', { name: new RegExp(`^${language}: (\\d[\\d,]*) users`) });
            await expect(row).toBeVisible();
            const text = (await row.getAttribute('aria-label')) ?? '';
            const users = Number(/: ([\d,]+) users/.exec(text)?.[1].replace(/,/g, ''));
            expect(users).toBeGreaterThanOrEqual(atLeast);
        }

        // A reload keeps the session and shows the page again.
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
        await expect(signups.getByTestId('column')).toHaveCount(30);
    });

    test('the API answers staff only, with numbers and labels and no personal data', async ({ request }) => {
        expect((await api(request)).status()).toBe(401);
        expect((await api(request, 'not-a-token')).status()).toBe(401);

        const res = await api(request, staffToken);
        expect(res.status()).toBe(200);
        const body = (await res.json()) as Stats;
        expect(body.signups.daily).toHaveLength(30);
        expect(body.active.points).toHaveLength(30);
        // This spec's three accounts at day -20 are in the API too. (The database-wide total is not
        // asserted: other specs create and delete users at the same time.)
        expect(body.signups.daily.find((d) => d.day === dayString(-20))?.count).toBe(baselineSignups(-20) + 3);
        const text = JSON.stringify(body);
        expect(text).not.toContain('ladu.test');
        expect(text).not.toContain(`sa${run}`);
    });

    test('a real request through the learner app records today as an active day', async ({ request }) => {
        // A real learner session, so the line that writes the day runs in the real backend, not in a test.
        const { userId } = await seedUser(activeEmail, {
            name: 'Active E9',
            username: `ae${run}`,
            learnerPassword: 'e2e-learner-password',
        });
        const login = await request.post(`${API}/api/users/login`, { data: { email: activeEmail, password: 'e2e-learner-password' } });
        expect(login.status()).toBe(200);
        const token = ((await login.json()) as { token: string }).token;
        expect(await getActivityDays(userId)).toEqual([]);

        // Two requests on the same day: still one row.
        expect((await request.get(`${API}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(200);
        expect((await request.get(`${API}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(200);

        expect(await getActivityDays(userId)).toEqual([dayString(0)]);
    });
});
