import { test, expect } from '@playwright/test';
import { closePool, createLinkedOAuthUser, deleteUsersByEmail } from '../fixtures/db';

/**
 * OAuth Phase 2 — Google sign-in, already-linked identity only
 * (.dev-context/oauth-login-strategy.md §4).
 *
 * Walks the real button through the real backend and the Phase 0 stub
 * issuer. The stub has no real consent screen to pick an identity from, so
 * these specs need a way to control which one a click becomes. Rewriting the
 * *request* URL to the stub's `/authorize` via `route.continue({ url })`
 * turned out not to take effect for a top-level navigation (verified by
 * running this spec — the seeded identity was never found, every run landed
 * on the stub's fixed default instead). Intercepting the backend's own
 * `/start` *response* and rewriting its `Location` header is reliable
 * instead — with one trap: `route.fetch()` follows redirects by default, so
 * without `maxRedirects: 0` it silently walks the *entire* chain (stub +
 * callback) and hands back the final page, not `/start`'s own raw 302.
 * `route.fulfill()` then forwards every header from that raw redirect —
 * including `Set-Cookie`, which the flow breaks without — except the one
 * being rewritten.
 *
 * Runs against `keelapp_v2_dev`. Each run uses unique `e2e-*@ladu.test`
 * emails and deletes them in `afterAll`. The suffix includes Playwright's
 * `parallelIndex` (unique per worker *process*) as well as a counter —
 * `Date.now()` alone can collide when two of this file's tests happen to
 * start in the same millisecond in different parallel workers.
 */

const run = Date.now();
let seq = 0;
const uniqueEmail = (workerIndex: number) => `e2e-oauth2-${run}-w${workerIndex}-${++seq}@ladu.test`;
const createdEmails: string[] = [];

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

/** Makes the next `/start` click mint an authorize URL for exactly this (email, sub) pair. */
async function routeGoogleStartTo(page: import('@playwright/test').Page, email: string, sub: string) {
    await page.route('**/api/auth/google/start*', async (route) => {
        const response = await route.fetch({ maxRedirects: 0 });
        const location = response.headers()['location'];
        if (!location) {
            await route.fulfill({ response });
            return;
        }
        const url = new URL(location);
        url.searchParams.set('login_hint', email);
        url.searchParams.set('sub', sub);
        await route.fulfill({
            status: response.status(),
            headers: { ...response.headers(), location: url.toString() },
        });
    });
}

test.describe('OAuth Phase 2 — Google sign-in', () => {
    test('an already-linked identity walks through the stub and lands signed in on Home', async ({ page }, testInfo) => {
        const email = uniqueEmail(testInfo.parallelIndex);
        createdEmails.push(email);
        const sub = `e2e-linked-sub-${run}-${testInfo.parallelIndex}-${seq}`;
        await createLinkedOAuthUser(email, 'google', sub, { name: 'Google Linked' });
        await routeGoogleStartTo(page, email, sub);

        await page.goto('/login');
        await page.getByRole('link', { name: 'Continue with Google' }).click();

        await expect(page).toHaveURL('/');
        await expect(page.getByRole('heading', { name: /Welcome, Google Linked/ })).toBeVisible();
    });

    test('an unlinked identity gets a clear "not yet supported" message and stays on /login', async ({ page }, testInfo) => {
        const sub = `e2e-unlinked-sub-${run}-${testInfo.parallelIndex}-${++seq}`;
        const email = `unlinked-${run}-${testInfo.parallelIndex}-${seq}@ladu.test`;
        await routeGoogleStartTo(page, email, sub);

        await page.goto('/login');
        await page.getByRole('link', { name: 'Continue with Google' }).click();

        await expect(page).toHaveURL(/\/login/);
        await expect(
            page.getByText(/isn't linked to a Ladu account yet/),
        ).toBeVisible();
    });

    test('existing email+password sign-in is unaffected by the OAuth button', async ({ page, request }, testInfo) => {
        const email = uniqueEmail(testInfo.parallelIndex);
        createdEmails.push(email);

        const res = await request.post(`${process.env.E2E_API_URL ?? 'http://localhost:5001'}/api/users`, {
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
