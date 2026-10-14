import { test, expect, type APIRequestContext } from '@playwright/test';
import { clickUseValues, closeTypeAheadList } from '../fixtures/autocomplete';
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
 * to Verb, confirms the filter survives a reload -> goes to page 2 of the
 * numbered pages (page, page size and sort live in the URL and survive a
 * reload) -> selects a row on each of the two pages, and lands on the
 * correct word via View, proving selection tracks a stable id across both a
 * filter change and a change of page, not a positional index.
 * (Numbered pages: `.context/plans/words-pagination.md` Slice 3.)
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

/** Number of extra Verb words seeded directly via the API so the Verb filter has a real second page (50 = the default page size; with the `run` verb that makes 51). */
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
        await page.getByRole('link', { name: 'words', exact: true }).click();
        await page.getByRole('link', { name: 'New word' }).click();
        await expect(page).toHaveURL('/addWord');
        await page.getByRole('radio', { name: /Noun/ }).click();

        await page.getByRole('button', { name: 'Deutsch' }).click();
        await page.getByLabel('Singular nominative').fill('Baum');
        await clickUseValues(page);
        await expect(page.getByRole('radio', { name: 'der', exact: true })).toBeChecked();

        await page.getByRole('button', { name: 'English' }).click();
        await page.getByLabel('Singular', { exact: true }).fill('Tree');
        await closeTypeAheadList(page);

        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByText('Word was created successfully')).toBeVisible();

        // --- Verb, exercising the Slice 9/10 wide-shell tense-grid layout ---
        await page.getByRole('link', { name: 'words', exact: true }).click();
        await page.getByRole('link', { name: 'New word' }).click();
        await expect(page).toHaveURL('/addWord');
        await page.getByRole('radio', { name: /Verb/ }).click();

        await page.getByRole('button', { name: 'English' }).click();
        // Every simple-tense 1s field shares the pronoun label "I" (verbs.ts
        // labels conjugation fields by pronoun, not by tense) — only
        // `simplePresent1s` is required, addressed by its RHF field name.
        await page.locator('input[name="simplePresent1s"]').fill('run');
        await closeTypeAheadList(page);

        await page.getByRole('button', { name: 'Deutsch' }).click();
        await page.getByLabel('Infinitive').fill('laufen');
        await closeTypeAheadList(page);

        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByText('Word was created successfully')).toBeVisible();

        // --- Review: filter survives a reload, then numbered pages, page size and sort ---
        await page.goto('/words');
        await expect(page.getByText('run')).toBeVisible();

        // The filter sidebar starts collapsed (and again after a reload): open it to reach the chips.
        await page.getByRole('button', { name: 'Expand sidebar' }).click();
        await page.getByRole('button', { name: 'v.', exact: true }).click();
        await expect(page).toHaveURL(/pos=%5B%22Verb%22%5D/);
        await expect(page.getByText('run')).toBeVisible();
        await expect(page.getByText('tree')).not.toBeVisible();
        await expect(page.getByText('bulk0')).not.toBeVisible(); // page 2, not loaded yet

        await page.reload();
        await expect(page).toHaveURL(/pos=%5B%22Verb%22%5D/);
        await page.getByRole('button', { name: 'Expand sidebar' }).click();
        await expect(page.getByRole('button', { name: 'v.', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByText('run')).toBeVisible();

        // --- Numbered pages: 51 verbs, 50 per page ---
        await expect(page.getByTestId('pagination-range')).toHaveText('Showing 1–50 of 51');
        await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
        await page.getByRole('button', { name: 'Next page' }).click();
        await expect(page).toHaveURL(/page=2/);
        await expect(page.getByText('bulk0')).toBeVisible();
        await expect(page.getByTestId('pagination-range')).toHaveText('Showing 51–51 of 51');

        // The page is in the URL: a reload keeps it.
        await page.reload();
        await expect(page).toHaveURL(/page=2/);
        await expect(page.getByText('bulk0')).toBeVisible();

        // Page size: All shows every verb on one page; 50 goes back to two pages (and back to page 1).
        await page.getByRole('combobox', { name: 'Rows per page' }).click();
        await page.getByRole('option', { name: 'All' }).click();
        await expect(page).toHaveURL(/size=all/);
        await expect(page).not.toHaveURL(/page=/);
        await expect(page.getByText('bulk0')).toBeVisible();
        await expect(page.getByText('run', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Next page' })).toHaveCount(0);
        await page.getByRole('combobox', { name: 'Rows per page' }).click();
        await page.getByRole('option', { name: '50' }).click();
        await expect(page).toHaveURL(/size=50/);
        await expect(page.getByText('bulk0')).not.toBeVisible();

        // Sort is in the URL too, and survives a reload.
        await page.getByRole('button', { name: 'Sort EN from A to Z' }).click();
        await expect(page).toHaveURL(/sort=EN/);
        await page.reload();
        await expect(page).toHaveURL(/sort=EN/);
        await page.getByRole('button', { name: 'Sorted EN from A to Z. Sort from Z to A' }).click();
        await expect(page).toHaveURL(/dir=desc/);
        await page.getByRole('button', { name: 'Sorted EN from Z to A. Remove the sort' }).click();
        await expect(page).not.toHaveURL(/sort=/);

        // --- Selection by stable id across pages ---
        // Default order again: `run` (the newest verb) is on page 1, `bulk0` (the oldest) on page 2.
        await page.getByRole('row', { name: /run/ }).getByRole('checkbox').click();
        await page.getByRole('button', { name: 'Next page' }).click();
        await expect(page.getByText('bulk0')).toBeVisible();
        await page.getByRole('row', { name: /bulk0/ }).getByRole('checkbox').click();
        await expect(page.locator('.bulkbar .count')).toHaveText('2');
        await expect(page.getByRole('button', { name: 'View' })).toHaveCount(0); // no View button: a click on the row opens the word

        // Back on page 1 the first selection is still there; unselect it, and only bulk0 (off this page) is left.
        await page.getByRole('button', { name: 'Page 1' }).click();
        const runCheckbox = page.getByRole('row', { name: /run/ }).getByRole('checkbox');
        await expect(runCheckbox).toBeChecked();
        await runCheckbox.click();
        await expect(page.locator('.bulkbar .count')).toHaveText('1');
        // `bulk0` is on page 2. A click on its row (the owner dot is no button) asks first, then opens the word.
        await page.getByRole('button', { name: 'Next page' }).click();
        await page.getByRole('row', { name: /bulk0/ }).locator('.owner-dot').click();
        await expect(page.getByRole('alertdialog').getByText('Open this word?')).toBeVisible();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Open' }).click();

        await expect(page).toHaveURL(/\/word\/.+/);
        await expect(page.getByRole('heading', { level: 1, name: 'bulk0' })).toBeVisible();
    });
});
