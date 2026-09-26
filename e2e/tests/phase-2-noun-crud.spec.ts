import { test, expect, type APIRequestContext } from '@playwright/test';
import { closePool, deleteUsersByEmail, getVerifyToken } from '../fixtures/db';

/**
 * Phase 2 — noun create / view (form engine v1), vertical slice against the
 * real stack (`.context/plans/phase-2-noun-crud.md` Slice 6 gate).
 *
 * A logged-in user adds a noun with three language translations through the
 * real "+ Add language" form -> `WordPage` shows every translation's case
 * fields -> the data survives a reload -> editing one case persists after a
 * second reload. Then decision D3: a second user hitting the first user's
 * `/word/:id` is refused — surfaced as a toast + navigate-away (the real code
 * path a user hits), not a raw API assertion.
 *
 * Runs against `keelapp_v2_dev`. Each run uses unique `e2e-*@ladu.test`
 * emails and deletes them in `afterAll` — `words`/`translations`/`cases`
 * cascade off the `users` row (`backend/src/db/schema.ts`).
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

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

test.describe.serial('Phase 2 — noun create / view', () => {
    let owner: Account;
    let ownerWordId: string;

    test.beforeAll(async ({ request }) => {
        owner = await registerAndVerify(request, ['English', 'Spanish', 'German']);
    });

    test('adds a noun with 3 translations, views it, edits a case, and it persists across reloads', async ({
        page,
    }) => {
        await page.goto('/login');
        await page.getByLabel('Email').fill(owner.email);
        await page.getByLabel('Password').fill(owner.password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page.getByRole('heading', { name: /Welcome, Kai Rebane/ })).toBeVisible();

        await page.getByRole('link', { name: 'add word' }).click();
        await expect(page).toHaveURL('/addWord');
        // D37: the gate's prompt is the page's subtitle paragraph; the `h1` is "Add a new word".
        await expect(page.getByText('What kind of word is it?')).toBeVisible();
        await page.getByRole('radio', { name: /Noun/ }).click();

        // English
        await page.getByRole('button', { name: 'English' }).click();
        await page.getByLabel('Singular', { exact: true }).first().fill('House');

        // Español — required gender + singular
        await page.getByRole('button', { name: 'Español' }).click();
        // Exact match — "el" would otherwise also match the "el/la" (neutral) option.
        await page.getByRole('radio', { name: 'el', exact: true }).click();
        await page.getByLabel('Singular', { exact: true }).last().fill('Casa');

        // Deutsch — required gender + singular nominative
        await page.getByRole('button', { name: 'Deutsch' }).click();
        await page.getByRole('radio', { name: 'der', exact: true }).click();
        await page.getByLabel('Singular nominative').fill('Haus');

        const save = page.getByRole('button', { name: 'Save' });
        await expect(save).toBeEnabled();
        await save.click();

        await expect(page.getByText('Word was created successfully')).toBeVisible();
        await page.getByRole('button', { name: 'Click here to see the new word' }).click();
        await expect(page).toHaveURL(/\/word\/.+/);
        ownerWordId = page.url().split('/word/')[1]!;

        // View — every translation's required case renders read-only.
        await expect(page.getByRole('heading', { level: 1, name: 'house' })).toBeVisible();
        await expect(page.getByText('Detailed view: Noun')).toBeVisible();
        await expect(page.getByText('casa')).toBeVisible();
        await expect(page.getByText('Haus')).toBeVisible(); // German case values keep their casing

        // Survives a reload.
        await page.reload();
        await expect(page.getByRole('heading', { level: 1, name: 'house' })).toBeVisible();
        await expect(page.getByText('casa')).toBeVisible();
        await expect(page.getByText('Haus')).toBeVisible();

        // Edit one case.
        await page.getByRole('button', { name: 'Edit' }).click();
        const singularEN = page.getByLabel('Singular', { exact: true }).first();
        await singularEN.fill('');
        await singularEN.fill('Cottage');
        await page.getByRole('button', { name: 'Save' }).click();

        await expect(page.getByText('Word was updated successfully')).toBeVisible();
        await expect(page.getByRole('heading', { level: 1, name: 'cottage' })).toBeVisible();

        // The edit persists after a second reload.
        await page.reload();
        await expect(page.getByRole('heading', { level: 1, name: 'cottage' })).toBeVisible();
    });

    test("GET /api/words/:id for another user's word is refused", async ({ page, request }) => {
        const other = await registerAndVerify(request, ['English', 'Spanish']);

        await page.goto('/login');
        await page.getByLabel('Email').fill(other.email);
        await page.getByLabel('Password').fill(other.password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page).toHaveURL('/');

        // A hard `goto` here means the SPA boots fresh on `/word/:id` with no
        // client-side history to pop into — `WordPage` detects that
        // (`useCanGoBack`) and falls back to a client-side `navigate({ to:
        // '/' })` instead of `history.back()`, so the toast survives the
        // transition (see `WordPage.tsx`).
        await page.goto(`/word/${ownerWordId}`);
        await expect(page.getByText("You don't have access to this word.")).toBeVisible();
        await expect(page).toHaveURL('/');
    });
});
