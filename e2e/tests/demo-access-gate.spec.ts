import { test, expect, type Page } from '@playwright/test';
import {
    closePool,
    deleteDemoSessions,
    deleteUsersByEmail,
    expireDemoSession,
    resetDemoSettings,
    seedTag,
    seedUser,
    setDemoCaps,
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
 * Slice 2: every demo is a copy of the template (seeded at e2e start-up, `npm run demo:template`).
 * The last test checks the copy, the word and tag caps and the counters, and that a demo is offered
 * no Follow and no visibility choice. The purge of expired demos is tested in Jest
 * (tests/demoExclusions.test.js): it is a nightly job, not something the browser sees.
 *
 * Slice 3: the visitor picks 2 or more languages before Start (D16). The last test picks German and
 * English and checks them on the account, as the Review columns and in the copied saved configs (D17).
 * Slice 4: every start passes through the transition screen (D18), checked in `startDemo`.
 *
 * Starts 4 demos at most: with a reused local `npm run dev` the per-IP limit stays at its default of 5.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5001';
const run = Date.now();
const learnerEmail = `e2e-demo-${run}-learner@ladu.test`;
/** A real user's Public tag, for the Discover check. */
const publicTagLabel = `E2E demo discover ${run}`;
const LEARNER_PASSWORD = 'a-good-password-1';

/** The demo accounts this spec started, removed in `afterAll`. */
const demoIds: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
    // A run that was killed may have left the demo on.
    await resetDemoSettings();
    const { userId } = await seedUser(learnerEmail, {
        name: 'E2E Demo Learner',
        username: `e2edemo${run}`,
        learnerPassword: LEARNER_PASSWORD,
        languages: ['English', 'Spanish'],
    });
    await seedTag(userId, publicTagLabel, 'Public');
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

/**
 * Starts a demo from `/demo` and records its id for the teardown. "Get started" opens step 2, then it
 * picks `languages` (the tile names, D16): Start waits for 2 or more.
 */
async function startDemo(
    page: Page,
    buttonName = 'Start',
    languages: string[] = ['English', 'Español'],
): Promise<{ id: string; token: string }> {
    await page.getByRole('button', { name: 'Get started' }).click();
    await expect(page.getByRole('heading', { name: 'Which languages do you use?' })).toBeVisible();
    const button = page.getByRole('button', { name: buttonName, exact: true });
    await expect(button).toBeDisabled();
    for (const name of languages) await page.getByRole('button', { name, exact: true }).click();
    await button.click();
    // The transition screen (D18) covers the start for about 3 s, then fades out over the dashboard.
    const transition = page.getByRole('status', { name: 'Starting the demo' });
    await expect(transition).toBeVisible();
    await expect(transition.getByRole('img')).toHaveCount(0); // the logo is decorative
    await expect(transition.getByRole('progressbar', { name: 'Demo start progress' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
    await expect(transition).toHaveCount(0);
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
    await expect(page.getByRole('button', { name: 'Get started' })).toHaveCount(0);

    const res = await page.request.post(`${API_URL}/api/demo`, { data: {} });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe('demo_disabled');
});

test('a visitor starts a demo, sees the seed, adds a word, and the demo ends on the server', async ({ page }) => {
    await setDemoEnabled(true);
    await page.goto('/demo');
    await expect(page.getByRole('heading', { name: 'Try the demo' })).toBeVisible();
    await expect(page.getByText(/logs you out/)).toHaveCount(0);
    // Step 2 (the languages, Start and the Terms note): the back arrow returns to step 1.
    await page.getByRole('button', { name: 'Get started' }).click();
    await expect(page.getByRole('heading', { name: 'Which languages do you use?' })).toBeVisible();
    await expect(page.getByText(/By starting the demo/)).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'Try the demo' })).toBeVisible();

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
    await startDemo(page, 'Log out and start');

    // A demo that is still running goes straight back into the app from /demo.
    await page.goto('/demo');
    await expect(page).toHaveURL(/\/$/);

    // Log-out of a demo ends it.
    await page.goto('/user');
    await page.getByRole('button', { name: 'Logout' }).last().click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/demo\/ended$/);
});

test('the demo is a copy of the template in the picked languages, with word and tag caps, and no Follow or visibility choice', async ({ page }) => {
    await setDemoEnabled(true);
    // On top of the template: room for 1 more word and no more tags (frozen when the demo starts).
    await setDemoCaps({ maxWords: 1, maxTags: 0 });
    await page.goto('/demo');
    // German first, then English (D16): the account keeps this order.
    const demo = await startDemo(page, 'Start', ['Deutsch', 'English']);

    // The picked languages: on the account, as the Review columns, and in the copied saved configs (D17).
    const me = await page.request.get(`${API_URL}/api/users/me`, { headers: { Authorization: `Bearer ${demo.token}` } });
    expect(await me.json()).toMatchObject({ languages: ['German', 'English'], nativeLanguage: 'English' });
    await page.goto('/review');
    await expect(page.getByRole('columnheader', { name: /\bDE\b/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /\bEN\b/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /\b(ES|EE)\b/ })).toHaveCount(0);
    const configs = await page.request.get(`${API_URL}/api/practice/configs`, { headers: { Authorization: `Bearer ${demo.token}` } });
    const configLanguages = ((await configs.json()) as { params: { languages: string[] } }[]).map((c) => c.params.languages);
    expect(configLanguages.length).toBeGreaterThan(0);
    for (const languages of configLanguages) expect([...languages].sort()).toEqual(['English', 'German']);

    // The template's tags and words (scripts/demo-template/data.json), all four parts of speech.
    await page.goto('/tags');
    for (const label of ['Nouns', 'Verbs', 'Adjectives', 'Adverbs', 'Everyday words']) {
        await expect(page.locator('.tagcard', { hasText: label }).first()).toBeVisible();
    }
    await page.goto('/words');
    for (const word of ['house', 'dance', 'big', 'often']) {
        await expect(page.getByText(word, { exact: true }).first()).toBeVisible();
    }

    // The counters: the frozen caps minus what the demo has.
    await page.goto('/user');
    const card = page.getByRole('region', { name: 'Demo account' });
    await expect(card.getByText('Words you can add: 1')).toBeVisible();
    await expect(card.getByText('Tags you can add: 0')).toBeVisible();

    // The word cap: one more word fits, the next is refused.
    const addWord = (en: string, es: string) =>
        page.request.post(`${API_URL}/api/words`, {
            headers: { Authorization: `Bearer ${demo.token}` },
            data: {
                partOfSpeech: 'Noun',
                translations: [
                    { language: 'English', cases: [{ caseName: 'singularEN', word: en }] },
                    { language: 'Spanish', cases: [{ caseName: 'singularES', word: es }] },
                ],
                tags: [],
            },
        });
    expect((await addWord('window', 'ventana')).ok()).toBe(true);
    const refused = await addWord('door', 'puerta');
    expect(refused.status()).toBe(403);
    expect((await refused.json()).code).toBe('demo_word_limit');
    await page.reload();
    await expect(page.getByRole('region', { name: 'Demo account' }).getByText('Words you can add: 0')).toBeVisible();

    // The tag cap, in the app: the form offers no visibility choice, and the refusal is explained.
    await page.goto('/tags');
    await page.getByRole('button', { name: 'New tag' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('radio')).toHaveCount(0);
    await dialog.getByLabel(/Label/).fill('One too many');
    await dialog.getByRole('button', { name: 'Create tag' }).click();
    await expect(page.getByText('The demo cannot have more tags. Create an account to add more.').first()).toBeVisible();
    await page.keyboard.press('Escape');

    // Discover: a real user's Public tag can be copied, not followed.
    await page.getByRole('button', { name: 'Discover', exact: true }).click();
    const discovered = page.locator('.tagcard', { hasText: publicTagLabel });
    await expect(discovered).toBeVisible();
    await expect(discovered.getByRole('button', { name: 'Clone' })).toBeVisible();
    await expect(discovered.getByRole('button', { name: 'Follow' })).toHaveCount(0);
});

