import { test, expect, type Page } from '@playwright/test';
import {
    closePool,
    deleteDemoSessions,
    deleteUsersByEmail,
    expireDemoSession,
    resetDemoSettings,
    seedUser,
    setDemoEnabled,
} from '../fixtures/db';

/**
 * Demo access, Slice 1 — the whole demo loop against the real backend + Postgres + the learner app
 * (.context/plans/demo-access.md).
 *
 * The visitor opens `/demo` (the landing page's "Try the demo" link points there; the landing page is
 * not served in e2e, so its link is checked by the landing node tests), starts a demo, sees the seed,
 * adds a word with the demo token, and the demo ends: the spec moves the expiry into the past in the
 * database, and the next request sends the app to `/demo/ended` (the server is the boundary, not the
 * clock in the browser). A signed-in user is warned that the demo logs them out.
 *
 * It turns the demo on, which is the global `access_settings` row, so it is a `-gate` spec (Review log
 * S1-5): its own Playwright project, after every other spec. `afterAll` puts the demo back off.
 *
 * Starts 3 demos at most: with a reused local `npm run dev` the per-IP limit stays at its default of 5.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5001';
const run = Date.now();
const learnerEmail = `e2e-demo-${run}-learner@ladu.test`;
const LEARNER_PASSWORD = 'a-good-password-1';

/** The demo accounts this spec started, removed in `afterAll`. */
const demoIds: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
    // A run that was killed may have left the demo on.
    await resetDemoSettings();
    await seedUser(learnerEmail, { name: 'E2E Demo Learner', username: `e2edemo${run}`, learnerPassword: LEARNER_PASSWORD, languages: ['English', 'Spanish'] });
});

test.afterAll(async () => {
    await resetDemoSettings();
    await deleteDemoSessions(demoIds);
    await deleteUsersByEmail([learnerEmail]);
    await closePool();
});

/** The session the app keeps in localStorage (`ladu.session`). */
async function readSession(page: Page): Promise<{ user: { id: string; isDemo?: boolean } | null; token: string | null }> {
    return page.evaluate(() => {
        const raw = localStorage.getItem('ladu.session');
        return raw ? JSON.parse(raw).state : { user: null, token: null };
    });
}

/** Starts a demo from `/demo` and records its id for the teardown. */
async function startDemo(page: Page, buttonName = 'Start the demo'): Promise<{ id: string; token: string }> {
    await page.getByRole('button', { name: buttonName }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: /^Demo: \d+:\d\d left/ })).toBeVisible();
    const { user, token } = await readSession(page);
    expect(user?.isDemo).toBe(true);
    if (!user || !token) throw new Error('no demo session');
    demoIds.push(user.id);
    return { id: user.id, token };
}

test('the demo is off: /demo says so and offers sign-up, and the server refuses a start', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByRole('heading', { name: 'The demo is off' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create an account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start the demo' })).toHaveCount(0);

    const res = await page.request.post(`${API_URL}/api/demo`, { data: {} });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe('demo_disabled');
});

test('a visitor starts a demo, sees the seed, adds a word, and the demo ends on the server', async ({ page }) => {
    await setDemoEnabled(true);
    await page.goto('/demo');
    await expect(page.getByRole('heading', { name: 'Try the demo' })).toBeVisible();
    await expect(page.getByText(/By starting the demo/)).toBeVisible();
    await expect(page.getByText(/logs you out/)).toHaveCount(0);

    const demo = await startDemo(page);

    // The seed: five nouns, shown in the UI language.
    await page.goto('/words');
    await expect(page.getByText('house', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('apple', { exact: true }).first()).toBeVisible();

    // The Account page explains the demo and shows the time left.
    await page.goto('/user');
    const card = page.getByRole('region', { name: 'Demo account' });
    await expect(card.getByRole('timer')).toHaveText(/^Time left: \d+:\d\d$/);

    // The demo token writes like any session.
    const added = await page.request.post(`${API_URL}/api/words`, {
        headers: { Authorization: `Bearer ${demo.token}` },
        data: {
            partOfSpeech: 'Noun',
            translations: [
                { language: 'English', cases: [{ caseName: 'singularEN', word: 'window' }] },
                { language: 'Spanish', cases: [{ caseName: 'singularES', word: 'ventana' }] },
            ],
            tags: [],
        },
    });
    expect(added.ok()).toBe(true);
    await page.goto('/words');
    await expect(page.getByText('window', { exact: true }).first()).toBeVisible();

    // The time is over on the server. The clock in the browser still shows minutes left, but the next
    // request is refused, and the app goes to the "ended" page, not to /login.
    await expireDemoSession(demo.id);
    await page.getByRole('link', { name: 'practice' }).first().click();
    await expect(page).toHaveURL(/\/demo\/ended$/);
    await expect(page.getByRole('heading', { name: 'The demo has ended' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start a new demo' })).toBeVisible();
    expect((await readSession(page)).token).toBeNull();

    // The old token stays refused.
    const replay = await page.request.get(`${API_URL}/api/users/me`, { headers: { Authorization: `Bearer ${demo.token}` } });
    expect(replay.status()).toBe(401);
});

test('a signed-in user is warned that the demo logs them out, and the demo replaces the session', async ({ page }) => {
    await setDemoEnabled(true);
    await page.goto('/login');
    await page.getByLabel('Email').fill(learnerEmail);
    await page.getByLabel('Password').fill(LEARNER_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/demo');
    await expect(page.getByText('You are logged in. Starting the demo logs you out of your account.')).toBeVisible();
    await startDemo(page, 'Log out and start the demo');

    // A demo that is still running goes straight back into the app from /demo.
    await page.goto('/demo');
    await expect(page).toHaveURL(/\/$/);

    // Log-out of a demo ends it.
    await page.goto('/user');
    await page.getByRole('button', { name: 'Logout' }).last().click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/demo\/ended$/);
});
