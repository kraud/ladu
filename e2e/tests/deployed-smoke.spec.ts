import { test, expect } from '@playwright/test';

/**
 * Post-deploy smoke test — runs in `deploy.yml`'s `smoke` job, between the
 * `staging` deploy job and (once it exists) `production`, against a real
 * deployed environment (`playwright.deploy.config.ts`, no local servers, no
 * DB access — see that file's own comment).
 *
 * `/api/health` reports the SHA just deployed -> log in with the persistent
 * smoke account -> dashboard loads -> create a word through the real form
 * -> delete it through the real UI. Cleans up after itself since there is
 * no DB fixture to do it for us (`.dev-context/deployment-strategy.md` §3).
 *
 * Requires BASE_URL, SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD, EXPECTED_SHA —
 * see playwright.deploy.config.ts.
 */

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not set — required by deployed-smoke.spec.ts`);
    }
    return value;
}

const SMOKE_EMAIL = requireEnv('SMOKE_TEST_EMAIL');
const SMOKE_PASSWORD = requireEnv('SMOKE_TEST_PASSWORD');
const EXPECTED_SHA = requireEnv('EXPECTED_SHA');

test.describe.serial('Post-deploy smoke', () => {
    test('/api/health reports the deployed SHA', async ({ request, baseURL }) => {
        const res = await request.get(`${baseURL}/api/health`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.status).toBe('ok');
        expect(body.sha).toBe(EXPECTED_SHA);
    });

    test('logs in, creates a word, and deletes it', async ({ page }) => {
        await page.goto('/login');
        await page.getByLabel('Email').fill(SMOKE_EMAIL);
        await page.getByLabel('Password').fill(SMOKE_PASSWORD);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page.getByRole('heading', { name: /Welcome, Smoke Test/ })).toBeVisible();

        await page.getByRole('link', { name: 'add word' }).click();
        await expect(page).toHaveURL('/addWord');
        await page.getByRole('radio', { name: /Noun/ }).click();

        await page.getByRole('button', { name: 'Add translation' }).click();
        await page.getByRole('button', { name: 'English' }).click();
        await page.getByLabel('Singular', { exact: true }).first().fill('Smoke');

        await page.getByRole('button', { name: 'Add translation' }).click();
        await page.getByRole('button', { name: 'Español' }).click();
        await page.getByRole('radio', { name: 'el', exact: true }).click();
        await page.getByLabel('Singular', { exact: true }).last().fill('Humo');

        const save = page.getByRole('button', { name: 'Save' });
        await expect(save).toBeEnabled();
        await save.click();

        await expect(page.getByText('Word was created successfully')).toBeVisible();
        await page.getByRole('button', { name: 'Click here to see the new word' }).click();
        await expect(page).toHaveURL(/\/word\/.+/);

        // Delete through the real sidebar -> confirm dialog flow (WordPage.tsx).
        // Radix's AlertDialog renders role="alertdialog", distinct from the
        // sidebar's own "Delete" trigger button, so this scoping is required
        // to avoid matching two same-named buttons at once.
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

        await expect(page.getByText('Word deleted successfully')).toBeVisible();
        await expect(page).toHaveURL('/');
    });
});
