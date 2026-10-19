import { test, expect, type Page } from '@playwright/test';
import {
    closePool,
    deleteUsersByEmail,
    getOnboardingState,
    seedUser,
    setOnboardingEnabled,
    setOnboardingPending,
} from '../fixtures/db';

/**
 * First-login onboarding, Slice 4e — the whole flow against the real backend + Postgres + the learner
 * app (.context/plans/onboarding.md).
 *
 * A `pending` account signs in and the app opens the full-screen `/onboarding`: Welcome, then the four
 * questions (languages, levels, interests, word count), then Create. The building screen shows for at
 * least 3 s, and the dashboard shows the result card. The spec reads the words and tags from the database.
 * A second account skips, through the confirmation dialog.
 *
 * It turns the onboarding switch on, which is the global `access_settings` row, so it is a `-gate` spec
 * (its own Playwright project, after every other spec). `fixtures/global-setup.ts` turns the switch off
 * at the start of every run, and `afterAll` puts it back off.
 *
 * The accounts are seeded with English + Spanish and `pending` status; the words come from the committed
 * pool (no lexicon, no Ekilex call), so the spec needs no seed data.
 */

const run = Date.now();
const PASSWORD = 'a-good-password-1';
const offEmail = `e2e-onb-${run}-off@ladu.test`;
const flowEmail = `e2e-onb-${run}-flow@ladu.test`;
const skipEmail = `e2e-onb-${run}-skip@ladu.test`;
const emails = [offEmail, flowEmail, skipEmail];
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5001';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
    await setOnboardingEnabled(false);
    for (const [i, email] of emails.entries()) {
        await seedUser(email, {
            name: 'E2E Onboarding',
            username: `e2eonb${run}${i}`,
            learnerPassword: PASSWORD,
            languages: ['English', 'Spanish'],
        });
        await setOnboardingPending(email);
    }
});

test.afterAll(async () => {
    await setOnboardingEnabled(false);
    await deleteUsersByEmail(emails);
    await closePool();
});

async function signIn(page: Page, email: string): Promise<void> {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
}

/** The session token the app keeps in localStorage (`ladu.session`). */
async function readToken(page: Page): Promise<string> {
    const token = await page.evaluate(() => {
        const raw = localStorage.getItem('ladu.session');
        return raw ? (JSON.parse(raw).state?.token as string | null) : null;
    });
    if (!token) throw new Error('no session token');
    return token;
}

test('the switch is off: a pending account goes to the dashboard and the server refuses the routes', async ({ page }) => {
    await signIn(page, offEmail);
    await expect(page.getByRole('heading', { name: /^Welcome, / })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    const res = await page.request.post(`${API_URL}/api/onboarding/capacity`, {
        headers: { Authorization: `Bearer ${await readToken(page)}` },
        data: { levels: { Spanish: 'beginner' }, topics: ['clothing', 'animals', 'weather'] },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe('onboarding_disabled');

    // Nothing was created, and the account is still waiting for the flow.
    expect(await getOnboardingState(offEmail)).toMatchObject({ status: 'pending', words: 0, tags: [] });
});

test('the switch is on: the flow creates tagged words and the dashboard shows the result card', async ({ page }) => {
    await setOnboardingEnabled(true);
    await signIn(page, flowEmail);

    // Welcome: full screen, no app header, the language and theme switches are in the rail.
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole('heading', { name: /Welcome to Ladu\s+let's create your first Words and Tags\./ })).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
    const rail = page.getByRole('complementary', { name: 'Setup progress' });
    await expect(rail.getByRole('button', { name: 'Interface language' })).toBeVisible();
    await expect(rail.getByRole('button', { name: /^Switch to (dark|light) theme$/ })).toBeVisible();
    await page.getByRole('button', { name: 'Start' }).click();

    // 1 Languages: only the registration languages, all selected. English is the native language.
    await expect(page.getByRole('heading', { name: 'Which languages do you want us to use?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Deutsch' })).toHaveCount(0);
    await expect(page.getByText('2 languages selected')).toBeVisible();
    await page.getByRole('region', { name: 'Your native language' }).getByRole('button', { name: 'English' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    // 2 Levels: one level for Spanish (the only language to learn). Next waits for it.
    await expect(page.getByRole('heading', { name: 'What is your level?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
    await page.getByRole('radio', { name: 'Beginner' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    // 3 Interests: at least 4 topics, no maximum.
    await expect(page.getByRole('heading', { name: 'What interests you?' })).toBeVisible();
    await page.getByRole('button', { name: 'Clothing' }).click();
    await page.getByRole('button', { name: 'Animals' }).click();
    await page.getByRole('button', { name: 'Weather' }).click();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
    await page.getByRole('button', { name: 'Feelings' }).click();
    await expect(rail.getByText('Weather')).toBeVisible(); // the summary follows the answers
    await page.getByRole('button', { name: 'Next' }).click();

    // 4 Word count: the slider ends at what the pool can deliver.
    await expect(page.getByRole('heading', { name: 'How many words?' })).toBeVisible();
    const create = page.getByRole('button', { name: /^Add \d+ words$/ });
    await expect(create).toBeVisible();
    const words = Number((await create.textContent())?.match(/\d+/)?.[0]);
    expect(words).toBeGreaterThanOrEqual(10);

    // Create: the building screen shows for at least 3 s, then the dashboard opens with the result card.
    const started = Date.now();
    await create.click();
    await expect(page.getByRole('heading', { name: 'Building your dictionary…' })).toBeVisible();
    const card = page.getByRole('region', { name: 'Your new words' });
    await expect(card).toBeVisible({ timeout: 20_000 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(2_900);
    await expect(page).toHaveURL(/\/$/);
    await expect(card.getByText(`${words} words added in 4 topics`)).toBeVisible();

    // The database: the account is done, with the words, one tag for each topic and the core tag.
    const state = await getOnboardingState(flowEmail);
    expect(state.status).toBe('done');
    expect(state.words).toBe(words);
    expect(state.taggedWords).toBe(words);
    expect(state.tags).toHaveLength(5);
    for (const label of ['Clothing', 'Animals', 'Weather', 'Feelings', 'Core vocabulary']) {
        expect(state.tags.some((tag) => tag.startsWith(label))).toBe(true);
    }

    // The card links to the tags and to practice, stays after a reload, and goes when it is closed.
    await expect(card.getByRole('link', { name: 'Start practising' })).toHaveAttribute('href', '/practice');
    await card.getByRole('link', { name: /^Clothing/ }).click();
    await expect(page).toHaveURL(/\/tag\//);
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Your new words' })).toBeVisible();
    await page.getByRole('region', { name: 'Your new words' }).getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('region', { name: 'Your new words' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: /^Welcome, / })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Your new words' })).toHaveCount(0);

    // A done account is not sent back to the flow.
    await page.goto('/onboarding');
    await expect(page.getByRole('heading', { name: /Welcome to Ladu\s+let's create/ })).toHaveCount(0);
});

test('Skip asks first; confirming leaves the account empty and opens the dashboard', async ({ page }) => {
    await setOnboardingEnabled(true);
    await signIn(page, skipEmail);
    await expect(page).toHaveURL(/\/onboarding$/);

    // "Continue setup" closes the dialog and changes nothing.
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText(/does not add any words or tags/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Continue setup' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/onboarding$/);
    expect((await getOnboardingState(skipEmail)).status).toBe('pending');

    // "Skip setup" skips the whole flow.
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Skip setup' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /^Welcome, / })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Your new words' })).toHaveCount(0);
    expect(await getOnboardingState(skipEmail)).toMatchObject({ status: 'skipped', words: 0, tags: [] });
});
