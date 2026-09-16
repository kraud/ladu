import { test, expect, type APIRequestContext } from '@playwright/test';
import { backdateWordsCreatedAt, closePool, deleteUsersByEmail, getVerifyToken } from '../fixtures/db';

/**
 * Phase 3.5 — Dashboard + user metrics, vertical slice against the real
 * stack (`.context/plans/phase-3-5-dashboard-metrics.md` Slice 7 gate).
 *
 * A logged-in user with a seeded, known set of words sees the three stat
 * cards, the pie chart, and the bar chart match the real backend's
 * `getUserMetrics` aggregation -> drives every chart control (both pie
 * modes + the worst-category link, the bar chart's month-range select,
 * grouping toggle, and X-axis toggle, plus a bar tooltip) -> adds a word
 * through the real `/addWord` form and confirms the numbers refresh, the
 * first consumer of the `['metrics']` invalidation edge declared in Phase 2.
 * A second, fresh account proves the empty state.
 *
 * Runs against `keelapp_v2_dev`. Uses unique `e2e-*@ladu.test` emails and
 * deletes them in `afterAll` — `words`/`translations`/`cases` cascade off
 * the `users` row (`backend/src/db/schema.ts`).
 */

const API = process.env.E2E_API_URL ?? 'http://localhost:5001';

const run = Date.now();
let seq = 0;
const uniqueEmail = () => `e2e-${run}-${++seq}@ladu.test`;
const createdEmails: string[] = [];

interface Account {
    name: string;
    username: string;
    email: string;
    password: string;
}

/** Registers + verifies a user directly via the API (no UI, no SMTP wait) — login still goes through the real form. */
async function registerAndVerify(request: APIRequestContext, languages: string[]): Promise<Account> {
    const account: Account = {
        name: 'Kai Rebane',
        username: `kai${run}${++seq}`,
        email: uniqueEmail(),
        password: 'password123',
    };
    createdEmails.push(account.email);

    const res = await request.post(`${API}/api/users`, {
        data: { ...account, languages, uiLanguage: 'English' },
    });
    expect(res.status()).toBe(201);

    const { userId, token } = await getVerifyToken(account.email);
    const verifyRes = await request.get(`${API}/api/users/${userId}/verify/${token}`);
    expect(verifyRes.ok()).toBeTruthy();

    return account;
}

const t = (language: string, word: string, caseName: string) => ({ language, cases: [{ word, caseName }] });

async function createWord(
    request: APIRequestContext,
    token: string,
    partOfSpeech: string,
    translations: ReturnType<typeof t>[],
): Promise<string> {
    const res = await request.post(`${API}/api/words`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { partOfSpeech, translations },
    });
    expect(res.ok()).toBeTruthy();
    return ((await res.json()) as { id: string }).id;
}

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

test.describe.serial('Phase 3.5 — Dashboard + user metrics', () => {
    let owner: Account;

    test.beforeAll(async ({ request }) => {
        owner = await registerAndVerify(request, ['English', 'Spanish']);

        const loginRes = await request.post(`${API}/api/users/login`, {
            data: { email: owner.email, password: owner.password },
        });
        expect(loginRes.ok()).toBeTruthy();
        const { token } = (await loginRes.json()) as { token: string };

        // Same fixture set `backend/tests/metrics.test.js` asserts against —
        // the two suites corroborate each other's numbers.
        const oldVerbId = await createWord(request, token, 'Verb', [
            t('English', 'run', 'simplePresent1sEN'),
            t('Spanish', 'correr', 'infinitiveNonFiniteSimpleES'),
        ]);
        await createWord(request, token, 'Verb', [
            t('English', 'run', 'simplePresent1sEN'),
            t('Spanish', 'correr', 'infinitiveNonFiniteSimpleES'),
        ]);
        await createWord(request, token, 'Noun', [t('English', 'cat', 'singularEN'), t('Spanish', 'gato', 'singularES')]);
        // Incomplete: English + German, missing the account's Spanish.
        await createWord(request, token, 'Noun', [
            t('English', 'dog', 'singularEN'),
            t('German', 'Hund', 'singularNominativDE'),
        ]);

        // Push one word 13 months into the past so `availableBarMonthRanges`
        // offers more than the single-option "this month only" set an
        // account created during the run would otherwise be stuck with.
        const past = new Date();
        past.setMonth(past.getMonth() - 13);
        await backdateWordsCreatedAt([oldVerbId], past);
    });

    test('renders real metrics, drives every chart control, and refreshes after a word is added', async ({ page }) => {
        await page.goto('/login');
        await page.getByLabel('Email').fill(owner.email);
        await page.getByLabel('Password').fill(owner.password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page.getByRole('heading', { level: 1, name: /Welcome, Kai Rebane/ })).toBeVisible();

        // --- wait past the skeletons ---
        await expect(page.getByRole('img', { name: 'Distribution of word types' })).toBeVisible();

        // --- stat cards ---
        const stats = page.locator('.stat-stack');
        await expect(stats.getByText('4', { exact: true })).toBeVisible(); // totalWords
        await expect(stats.getByText('Total words')).toBeVisible();
        await expect(stats.getByText('+3 this month')).toBeVisible(); // 1 of 4 words backdated
        await expect(stats.getByText('8', { exact: true })).toBeVisible(); // totalTranslations
        await expect(stats.getByText('Total translations')).toBeVisible();
        await expect(stats.getByText('2.0 per word average')).toBeVisible();
        await expect(stats.getByText('1', { exact: true })).toBeVisible(); // incompleteWordsCount
        await expect(stats.getByText('25% incomplete')).toBeVisible();
        await expect(page.getByRole('progressbar', { name: 'Incomplete words' })).toHaveAttribute('aria-valuenow', '25');

        // --- pie: word-type mode, worst segment links to /addWord/<pos> ---
        const pieLegend = page.locator('.pie-legend');
        await expect(pieLegend.getByText('Noun', { exact: true })).toBeVisible();
        await expect(pieLegend.getByText('Verb', { exact: true })).toBeVisible();
        const worstWordType = pieLegend.getByRole('button');
        await expect(worstWordType).toHaveAccessibleName(/Adjective/);
        await worstWordType.click();
        await expect(page).toHaveURL('/addWord/adjective');
        await page.goBack();
        await expect(page.getByRole('img', { name: 'Distribution of word types' })).toBeVisible();

        // --- pie toggle: language mode, worst segment links to plain /addWord ---
        await page
            .getByRole('radiogroup', { name: 'Pie chart distribution' })
            .getByRole('radio', { name: 'Language' })
            .click();
        await expect(page.getByRole('img', { name: 'Distribution of languages' })).toBeVisible();
        await expect(pieLegend.getByText('Español')).toBeVisible();
        await expect(pieLegend.getByText('Deutsch')).toBeVisible();
        const worstLanguage = pieLegend.getByRole('button');
        await expect(worstLanguage).toHaveAccessibleName(/Eesti/);
        await worstLanguage.click();
        await expect(page).toHaveURL('/addWord');
        await page.goBack();
        // Toggle state is local component state (D4) — navigating away and back
        // remounts the panel, so the pie resets to its "words" default rather
        // than restoring "translations".
        await expect(page.getByRole('img', { name: 'Distribution of word types' })).toBeVisible();

        // --- bar: month-range select default, and its bar tooltip ---
        // Under the default 6-month window only the current month has any
        // data (the other word is backdated 13 months out), so the two
        // `.bar-hit`s present are exactly this month's Noun (2) and Verb (1),
        // in `CREATABLE_POS` order — the first is Noun.
        const monthSelect = page.getByLabel('Bar chart month range');
        await expect(monthSelect).toContainText('Last 6 months'); // trailing text is the trigger's caret icon
        const barLegend = page.locator('.bar-legend');
        await expect(barLegend.getByText('Noun', { exact: true })).toBeVisible();
        await page.locator('.bar-hit').first().hover();
        await expect(page.getByText(/Noun: 2 words/)).toBeVisible();

        // --- bar: switching the range to "All time" brings the backdated month back into view ---
        await monthSelect.click();
        await page.getByRole('option', { name: 'All time' }).click();
        await expect(monthSelect).toContainText('All time');

        // --- bar grouping toggle: allowDeselect=false keeps exactly one option checked ---
        const groupingGroup = page.getByRole('radiogroup', { name: 'Bar chart grouping' });
        const groupedRadio = groupingGroup.getByRole('radio', { name: 'Grouped' });
        await groupedRadio.click();
        await expect(groupedRadio).toHaveAttribute('aria-checked', 'true');
        await groupedRadio.click(); // clicking the already-active option must not deselect it
        await expect(groupedRadio).toHaveAttribute('aria-checked', 'true');

        // --- bar X-axis toggle: language mode drops the month select ---
        await page.getByRole('radiogroup', { name: 'Bar chart X axis' }).getByRole('radio', { name: 'Language' }).click();
        await expect(page.getByRole('img', { name: 'Words per language' })).toBeVisible();
        await expect(page.getByLabel('Bar chart month range')).toHaveCount(0);

        // --- add a word through the real form; Dashboard totals refresh (['metrics'] invalidation) ---
        // The "+ Add translation" language picker only offers the account's
        // own configured languages (English, Spanish here) — not all four
        // supported ones — so this word is EN+ES, same as the seeded fixtures.
        await page.goto('/addWord');
        await page.getByRole('radio', { name: /Noun/ }).click();
        await page.getByRole('button', { name: 'Add translation' }).click();
        await page.getByRole('button', { name: 'English' }).click();
        await page.getByRole('button', { name: 'Add translation' }).click();
        await page.getByRole('button', { name: 'Español' }).click();
        const [singularEN, singularES] = await page.getByLabel('Singular').all();
        await singularEN!.fill('House');
        await singularES!.fill('Casa');
        await page.getByRole('radio', { name: 'el', exact: true }).click();
        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByText('Word was created successfully')).toBeVisible();

        await page.goto('/');
        await expect(page.getByRole('img', { name: 'Distribution of word types' })).toBeVisible();
        const refreshedStats = page.locator('.stat-stack');
        await expect(refreshedStats.getByText('5', { exact: true })).toBeVisible(); // totalWords
        await expect(refreshedStats.getByText('10', { exact: true })).toBeVisible(); // totalTranslations (House/Casa adds EN+ES)
        await expect(refreshedStats.getByText('1', { exact: true })).toBeVisible(); // incompleteWordsCount unchanged — the new word is complete
        await expect(refreshedStats.getByText('20% incomplete')).toBeVisible();
    });

    test('a fresh account shows the empty state', async ({ page, request }) => {
        const fresh = await registerAndVerify(request, ['English', 'German']);

        await page.goto('/login');
        await page.getByLabel('Email').fill(fresh.email);
        await page.getByLabel('Password').fill(fresh.password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page.getByRole('heading', { level: 1, name: /Welcome, Kai Rebane/ })).toBeVisible();

        await expect(page.getByText('No words yet')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Add your first words' })).toBeVisible();
        await expect(page.locator('.card.metrics').getByRole('img')).toHaveCount(0); // no chart svgs

        const stats = page.locator('.stat-stack');
        await expect(stats.getByText('0', { exact: true }).first()).toBeVisible();
    });
});
