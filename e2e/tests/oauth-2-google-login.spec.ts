import { test, expect } from '@playwright/test';
import { closePool, createLinkedOAuthUser, deleteUsersByEmail } from '../fixtures/db';
import { routeGoogleStartTo } from '../fixtures/oauthRouting';

/**
 * OAuth Phase 2 — Google sign-in, already-linked identity only
 * (.dev-context/oauth-login-strategy.md §4).
 *
 * Walks the real button through the real backend and the Phase 0 stub
 * issuer — see `fixtures/oauthRouting.ts` for how these specs control which
 * identity a click becomes.
 *
 * Runs against `keelapp_v2_dev`. Each run uses unique `e2e-*@ladu.test`
 * emails and deletes them in `afterAll`. The suffix includes Playwright's
 * `parallelIndex` (unique per worker *process*) as well as a counter —
 * `Date.now()` alone can collide when two of this file's tests happen to
 * start in the same millisecond in different parallel workers.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5001';
const run = Date.now();
let seq = 0;
const uniqueEmail = (workerIndex: number) => `e2e-oauth2-${run}-w${workerIndex}-${++seq}@ladu.test`;
const createdEmails: string[] = [];

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

test.describe('OAuth Phase 2 — Google sign-in', () => {
    test('an already-linked identity walks through the stub and lands signed in on Home', async ({ page }, testInfo) => {
        const email = uniqueEmail(testInfo.parallelIndex);
        createdEmails.push(email);
        const sub = `e2e-linked-sub-${run}-${testInfo.parallelIndex}-${seq}`;
        await createLinkedOAuthUser(email, 'google', sub, { name: 'Google Linked' });
        await routeGoogleStartTo(page, { email, sub });

        await page.goto('/login');
        await page.getByRole('link', { name: 'Continue with Google' }).click();

        await expect(page).toHaveURL('/');
        await expect(page.getByRole('heading', { name: /Welcome, Google Linked/ })).toBeVisible();
    });

    test('existing email+password sign-in is unaffected by the OAuth button', async ({ page, request }, testInfo) => {
        const email = uniqueEmail(testInfo.parallelIndex);
        createdEmails.push(email);

        const res = await request.post(`${API_URL}/api/users`, {
            data: {
                name: 'Password Still Works',
                username: `pwstill${run}${testInfo.parallelIndex}${seq}`,
                email,
                password: 'password123',
                languages: ['English', 'Spanish'],
                uiLanguage: 'English',
            },
        });
        expect(res.status()).toBe(201);

        // Verify directly via DB token read (no inbox in e2e) so this test
        // stays focused on the login form, not the registration flow.
        const { getVerifyToken } = await import('../fixtures/db');
        const { userId, token } = await getVerifyToken(email);
        await page.goto(`/user/${userId}/verify/${token}`);
        await page.getByRole('button', { name: 'Enter now' }).click();
        await expect(page).toHaveURL('/');

        await page.getByRole('button', { name: 'Open settings' }).click();
        await page.getByRole('menuitem', { name: 'Logout' }).click();
        await expect(page).toHaveURL(/\/login/);

        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').fill('password123');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page.getByRole('heading', { name: /Welcome, Password Still Works/ })).toBeVisible();
    });
});
