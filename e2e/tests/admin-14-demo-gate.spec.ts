import { test, expect, type Page } from '@playwright/test';
import {
    closePool,
    countLiveDemos,
    createStaffAccount,
    deleteDemoSessions,
    deleteStaffByEmail,
    deleteUsersByEmail,
    getAuditByReason,
    getDemoSettings,
    expireDemoSession,
    resetDemoSettings,
    seedDemoUser,
    setDemoEnabled,
} from '../fixtures/db';

/**
 * Demo access, Slice 0 — the demo gate and its caps (.context/plans/demo-access.md), against the
 * real backend + Postgres + the `admin/` UI.
 *
 * The owner opens the Demo tab, sees the defaults and the live count, turns the demo on with new
 * caps, and turns it off again. After each change the spec reads the database row, the audit row and
 * the public `GET /api/access` (which the learner `/demo` page reads in Slice 1). No demo can start
 * yet: `POST /api/demo` arrives in Slice 1.
 *
 * The settings are one row of global state, so this spec runs in its own Playwright project, after
 * every other spec (`playwright.config.ts`). `beforeAll` and `afterAll` put the demo settings back to
 * the defaults (off).
 *
 * Slice 5 (D19, D20): the owner sees a demo that a visitor starts in the usage banner and in the demo
 * accounts table, first Live with the word it added, then Expired.
 *
 * Uses unique `e2e-admin14-*` emails and removes them in `afterAll`. Other demos may be live in the
 * local database (manual testing), so the live counts are checked against the count before the seed.
 */

const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5001';

const run = Date.now();
const STAFF_PASSWORD = 'e2e-staff-password';
const ownerEmail = `e2e-admin14-${run}-owner@ladu.test`;
const reason = `e2e-admin14-${run}`;

// Two live demos, one expired (not purged yet) and one template: only the two live ones count.
const demoAccounts: { key: string; expiresInMinutes: number | null }[] = [
    { key: 'live1', expiresInMinutes: 10 },
    { key: 'live2', expiresInMinutes: 5 },
    { key: 'expired', expiresInMinutes: -5 },
    { key: 'template', expiresInMinutes: null },
];
const demoEmail = (key: string) => `e2e-admin14-${run}-${key}@ladu.invalid`;
/** Live demos in the database before this spec seeds its own. */
let liveBefore = 0;
/** Demos this spec starts through `POST /api/demo`, removed in `afterAll`. */
const startedDemoIds: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
    // A run that was killed may have left the demo on.
    await resetDemoSettings();
    await createStaffAccount(ownerEmail, 'owner', STAFF_PASSWORD);
    liveBefore = await countLiveDemos();
    for (const { key, expiresInMinutes } of demoAccounts) {
        await seedDemoUser(demoEmail(key), `e2e-admin14-${run}-${key}`, expiresInMinutes);
    }
});

test.afterAll(async () => {
    await resetDemoSettings();
    await deleteDemoSessions(startedDemoIds);
    await deleteUsersByEmail(demoAccounts.map(({ key }) => demoEmail(key)));
    await deleteStaffByEmail([ownerEmail]);
    await closePool();
});

async function ownerSignIn(page: Page, goTo: string) {
    await page.goto(`${ADMIN_URL}${goTo}`);
    await page.getByLabel('Email').fill(ownerEmail);
    await page.getByLabel('Password').fill(STAFF_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
}

const demoCard = (page: Page) => page.getByRole('region', { name: 'Demo', exact: true });
const demoSwitch = (page: Page, name: 'On' | 'Off') =>
    demoCard(page).getByRole('group', { name: 'Demo' }).getByRole('button', { name, exact: true });

/** What the public endpoint says, read the way the learner app reads it. */
const publicDemo = async (page: Page) => {
    const res = await page.request.get(`${API_URL}/api/access`);
    expect(res.ok()).toBe(true);
    return (await res.json()).demo;
};

test('the Demo tab shows the defaults and the number of live demos', async ({ page }) => {
    await ownerSignIn(page, '/access');
    await page.getByRole('link', { name: 'Demo', exact: true }).click();
    await expect(page).toHaveURL(`${ADMIN_URL}/access?tab=demo`);

    await expect(demoSwitch(page, 'Off')).toHaveAttribute('aria-pressed', 'true');
    await expect(demoCard(page).getByLabel('Duration (minutes)')).toHaveValue('15');
    await expect(demoCard(page).getByLabel('Maximum words')).toHaveValue('30');
    await expect(demoCard(page).getByLabel('Maximum tags')).toHaveValue('5');
    await expect(demoCard(page).getByLabel('Maximum live demos')).toHaveValue('200');
    await expect(demoCard(page).getByText(/Running now:/)).toHaveText(`Running now: ${liveBefore + 2} of 200 demos.`);
    await expect(demoCard(page).getByRole('button', { name: 'Save', exact: true })).toBeDisabled();

    expect(await publicDemo(page)).toEqual({ enabled: false });
});

test('the owner turns the demo on with new caps: the row, the audit and the public status follow', async ({ page }) => {
    await ownerSignIn(page, '/access?tab=demo');
    await expect(demoCard(page)).toBeVisible();

    await demoSwitch(page, 'On').click();
    await demoCard(page).getByLabel('Duration (minutes)').fill('20');

    // A zero cap with the demo on is warned about.
    await demoCard(page).getByLabel('Maximum words').fill('0');
    await expect(demoCard(page).getByRole('alert')).toHaveText('Visitors can look, but cannot add words.');
    await demoCard(page).getByLabel('Maximum words').fill('40');
    await expect(demoCard(page).getByRole('alert')).toHaveCount(0);

    // A value out of bounds keeps Save off.
    await demoCard(page).getByLabel('Maximum live demos').fill('1001');
    await expect(demoCard(page).getByText('Enter a whole number from 1 to 1000.')).toBeVisible();
    await expect(demoCard(page).getByRole('button', { name: 'Save', exact: true })).toBeDisabled();

    await demoCard(page).getByLabel('Maximum tags').fill('8');
    await demoCard(page).getByLabel('Maximum live demos').fill('50');
    await demoCard(page).getByRole('button', { name: 'Save', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Turn the demo on?');
    await expect(dialog).toContainText('Each demo will last 20 minutes.');
    await dialog.getByLabel(/Reason/).fill(reason);
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('status').first()).toContainText('The demo is now on.');
    await expect(demoCard(page).getByText(/Running now:/)).toHaveText(`Running now: ${liveBefore + 2} of 50 demos.`);

    const on = { enabled: true, durationMinutes: 20, maxWords: 40, maxTags: 8, maxLive: 50 };
    expect(await getDemoSettings()).toEqual(on);

    const audits = await getAuditByReason('access.demo_configure', reason);
    expect(audits).toHaveLength(1);
    expect(audits[0].metadata).toEqual({
        from: { enabled: false, durationMinutes: 15, maxWords: 30, maxTags: 5, maxLive: 200 },
        to: on,
    });

    // Public: on, and only on/off — the caps stay private.
    expect(await publicDemo(page)).toEqual({ enabled: true });

    // The saved values survive a reload.
    await page.reload();
    await expect(demoSwitch(page, 'On')).toHaveAttribute('aria-pressed', 'true');
    await expect(demoCard(page).getByLabel('Maximum live demos')).toHaveValue('50');
});

test('the owner turns the demo off again', async ({ page }) => {
    await ownerSignIn(page, '/access?tab=demo');
    await expect(demoSwitch(page, 'On')).toHaveAttribute('aria-pressed', 'true');

    await demoSwitch(page, 'Off').click();
    await demoCard(page).getByRole('button', { name: 'Save', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Turn the demo off?');
    await expect(dialog).toContainText('Demos that are running continue until they end.');
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByRole('status').first()).toContainText('The demo is now off.');

    // Off keeps the caps: only the switch changed.
    expect(await getDemoSettings()).toEqual({ enabled: false, durationMinutes: 20, maxWords: 40, maxTags: 8, maxLive: 50 });
    expect(await publicDemo(page)).toEqual({ enabled: false });
});

test('a demo a visitor starts shows in the usage banner and the accounts table, Live and then Expired', async ({ page }) => {
    await ownerSignIn(page, '/access?tab=demo');
    const usage = page.getByRole('region', { name: 'Demo usage' });
    const tile = (label: string) => usage.locator('div', { has: page.getByText(label, { exact: true }) }).last().locator('dd');
    await expect(tile('Started, last 24 hours')).toHaveText(/^\d[\d,]*$/);
    const startsBefore = Number((await tile('Started, last 24 hours').textContent())!.replace(/,/g, ''));

    // A visitor starts a demo (the API, as the /demo page calls it) and adds one word.
    await setDemoEnabled(true);
    const started = await page.request.post(`${API_URL}/api/demo`, {
        data: { uiLanguage: 'English', languages: ['Estonian', 'English'] },
    });
    expect(started.status()).toBe(201);
    const demo = (await started.json()) as { id: string; token: string };
    startedDemoIds.push(demo.id);
    const word = await page.request.post(`${API_URL}/api/words`, {
        headers: { Authorization: `Bearer ${demo.token}` },
        data: {
            partOfSpeech: 'Noun',
            translations: [
                { language: 'English', cases: [{ caseName: 'singularEN', word: 'window' }] },
                { language: 'Estonian', cases: [{ caseName: 'singularNimetavEE', word: 'aken' }] },
            ],
            tags: [],
        },
    });
    expect(word.ok()).toBe(true);

    await page.reload();
    await expect(tile('Started, last 24 hours')).toHaveText(String(startsBefore + 1));
    const accounts = page.getByRole('region', { name: /^Demo accounts/ });
    // The newest demo is the first row: live, its two languages, 1 word added of its cap (40, saved above).
    const first = accounts.getByRole('row').nth(1);
    await expect(first.getByRole('cell').nth(0)).toHaveText('Live');
    await expect(first.getByRole('cell').nth(3)).toHaveText('Estonian, English');
    await expect(first.getByRole('cell').nth(4)).toHaveText('English');
    await expect(first.getByRole('cell').nth(5)).toHaveText('1 / 40');

    // Its time is over: the row stays, as Expired, until the nightly purge.
    await expireDemoSession(demo.id);
    await page.reload();
    await expect(accounts.getByRole('row').nth(1).getByRole('cell').nth(0)).toHaveText('Expired');
});

