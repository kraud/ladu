import { test, expect, type APIRequestContext } from '@playwright/test';
import { closePool, deleteUsersByEmail, getVerifyToken } from '../fixtures/db';

/**
 * Phase 3 — form engine completion, autocomplete, Review table, vertical
 * slice against the real stack (`.context/plans/phase-3-forms-autocomplete-review.md`
 * Slice 11 gate).
 *
 * A logged-in user creates a German noun through the real "+ Add translation"
 * flow, lets the real (offline, dictionary-backed) autocomplete lookup fill
 * its gender -> creates a verb, exercising the Slice 9/10 wide-shell
 * tense-grid layout for the first time in e2e -> goes to `/review`, filters
 * to Verb, confirms the filter survives a reload -> pages in the next batch
 * with Load more -> selects a row from that second, filtered page and lands
 * on the correct word via View, proving selection tracks a stable id across
 * both a filter change and pagination, not a positional index.
 *
 * Runs against `keelapp_v2_dev`. Uses a unique `e2e-*@ladu.test` email and
 * deletes it in `afterAll` — `words`/`translations`/`cases` cascade off the
 * `users` row (`backend/src/db/schema.ts`).
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

/** Number of extra Verb words seeded directly via the API so Load more has a real second page under a PoS filter (50 = the backend's default page size). */
const BULK_VERB_COUNT = 50;

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

test.describe.serial('Phase 3 — form engine, autocomplete, Review', () => {
    let owner: Account;

    test.beforeAll(async ({ request }) => {
        owner = await registerAndVerify(request, ['English', 'German']);

        const loginRes = await request.post(`${API}/api/users/login`, {
            data: { email: owner.email, password: owner.password },
        });
        expect(loginRes.ok()).toBeTruthy();
        const { token } = (await loginRes.json()) as { token: string };

        // Seeded oldest-first (`bulk0` first, `bulk49` last), so under the
        // real `created_at DESC` ordering `bulk0` ends up on the second page
        // -- the row the test later selects by name.
        for (let i = 0; i < BULK_VERB_COUNT; i++) {
            const res = await request.post(`${API}/api/words`, {
                headers: { Authorization: `Bearer ${token}` },
                data: {
                    partOfSpeech: 'Verb',
                    translations: [
                        { language: 'English', cases: [{ caseName: 'simplePresent1sEN', word: `bulk${i}` }] },
                        { language: 'German', cases: [{ caseName: 'infinitiveDE', word: `bulkde${i}` }] },
                    ],
                },
            });
            expect(res.ok()).toBeTruthy();
        }
    });

    test('creates words across parts of speech, autocompletes a German noun, and browses/filters/paginates Review by stable id', async ({
        page,
    }) => {
        await page.goto('/login');
        await page.getByLabel('Email').fill(owner.email);
        await page.getByLabel('Password').fill(owner.password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page.getByRole('heading', { name: /Welcome, Kai Rebane/ })).toBeVisible();

        // --- German noun, letting the real (offline) autocomplete fill gender ---
        await page.getByRole('link', { name: 'add word' }).click();
        await expect(page).toHaveURL('/addWord');
        await page.getByRole('radio', { name: /Noun/ }).click();

        await page.getByRole('button', { name: 'Add translation' }).click();
        await page.getByRole('button', { name: 'Deutsch' }).click();
        await page.getByLabel('Singular nominative').fill('Baum');
        await expect(
            page.getByText('There is information about this word stored in our system.'),
        ).toBeVisible({ timeout: 10_000 });
        await page.getByRole('button', { name: 'Fill in' }).click();
        await expect(page.getByRole('radio', { name: 'der', exact: true })).toBeChecked();

        await page.getByRole('button', { name: 'Add translation' }).click();
        await page.getByRole('button', { name: 'English' }).click();
        await page.getByLabel('Singular', { exact: true }).fill('Tree');

        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByText('Word was created successfully')).toBeVisible();

        // --- Verb, exercising the Slice 9/10 wide-shell tense-grid layout ---
        await page.getByRole('link', { name: 'add word' }).click();
        await expect(page).toHaveURL('/addWord');
        await page.getByRole('radio', { name: /Verb/ }).click();

        await page.getByRole('button', { name: 'Add translation' }).click();
        await page.getByRole('button', { name: 'English' }).click();
        // Every simple-tense 1s field shares the pronoun label "I" (verbs.ts
        // labels conjugation fields by pronoun, not by tense) — only
        // `simplePresent1s` is required, addressed by its RHF field name.
        await page.locator('input[name="simplePresent1s"]').fill('run');

        await page.getByRole('button', { name: 'Add translation' }).click();
        await page.getByRole('button', { name: 'Deutsch' }).click();
        await page.getByLabel('Infinitive').fill('laufen');

        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByText('Word was created successfully')).toBeVisible();

        // --- Review: filter survives a reload, Load more pages in the rest ---
        await page.goto('/review');
        await expect(page.getByText('run')).toBeVisible();

        await page.getByRole('button', { name: 'v.', exact: true }).click();
        await expect(page).toHaveURL(/pos=%5B%22Verb%22%5D/);
        await expect(page.getByText('run')).toBeVisible();
        await expect(page.getByText('tree')).not.toBeVisible();
        await expect(page.getByText('bulk0')).not.toBeVisible(); // page 2, not loaded yet

        await page.reload();
        await expect(page).toHaveURL(/pos=%5B%22Verb%22%5D/);
        await expect(page.getByRole('button', { name: 'v.', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByText('run')).toBeVisible();

        await page.getByRole('button', { name: 'Load more' }).click();
        await expect(page.getByText('bulk0')).toBeVisible();

        // Select the one row that only exists on the second, filtered page
        // and land on it via View -- stable-id selection, not a positional
        // index a second page's rows would otherwise shift.
        const bulk0Row = page.getByRole('row', { name: /bulk0/ });
        await bulk0Row.getByRole('checkbox').click();
        await page.getByRole('button', { name: 'View' }).click();

        await expect(page).toHaveURL(/\/word\/.+/);
        await expect(page.getByRole('heading', { level: 1, name: 'bulk0' })).toBeVisible();
    });
});
