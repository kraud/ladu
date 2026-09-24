import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail, getUserAccountShape, getVerifyToken } from '../fixtures/db';
import { routeGoogleConnectTo, routeGoogleStartTo } from '../fixtures/oauthRouting';

/**
 * OAuth Phase 5 — connected methods in the Account profile
 * (.dev-context/oauth-login-strategy.md §4 Phase 5).
 *
 * Walks the real "Connect"/"Disconnect" controls in the profile's edit mode
 * through the real backend — `POST /api/auth/:provider/link` (protected
 * start) and `DELETE /api/auth/identities/:id` — no step of this is mocked.
 * Also proves the last-method guard: a password-less user whose only
 * sign-in method is Google is blocked from unlinking it, with a message,
 * not by a pre-emptively disabled button (the attempt has to reach the
 * backend for that message to mean anything).
 *
 * Runs against `keelapp_v2_dev`. Each run uses unique `e2e-*@ladu.test`
 * emails and deletes them in `afterAll`.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5001';
const run = Date.now();
let seq = 0;
const uniqueEmail = (workerIndex: number) => `e2e-oauth5-${run}-w${workerIndex}-${++seq}@ladu.test`;
const createdEmails: string[] = [];

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

async function registerVerifyAndOpenAccount(
    page: Page,
    request: APIRequestContext,
    email: string,
    name: string,
    username: string,
): Promise<void> {
    const res = await request.post(`${API_URL}/api/users`, {
        data: {
            name,
            username,
            email,
            password: 'password123',
            languages: ['English', 'Spanish'],
            uiLanguage: 'English',
        },
    });
    expect(res.status()).toBe(201);

    const { userId, token } = await getVerifyToken(email);
    await page.goto(`/user/${userId}/verify/${token}`);
    await page.getByRole('button', { name: 'Enter now' }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/user');
    await page.getByRole('button', { name: 'Edit profile' }).click();
}

test.describe('OAuth Phase 5 — connected methods in the Account profile', () => {
    test('links Google from the profile edit view, sees it listed, then unlinks it', async ({ page, request }, testInfo) => {
        const email = uniqueEmail(testInfo.parallelIndex);
        createdEmails.push(email);
        const username = `e2e5connect${run}${testInfo.parallelIndex}${seq}`;
        await registerVerifyAndOpenAccount(page, request, email, 'Connects Google', username);

        const sub = `e2e-connect-sub-${run}-${testInfo.parallelIndex}-${seq}`;
        await routeGoogleConnectTo(page, { email, sub });
        await page.getByRole('button', { name: 'Connect Google' }).click();

        await expect(page).toHaveURL('/user');
        await expect(page.getByText('Connected your Google sign-in!')).toBeVisible();

        let shape = await getUserAccountShape(email);
        expect(shape).toMatchObject({ passwordIsNull: false, oauthIdentityCount: 1 });

        // Read-only view also reflects it once edit mode is left.
        await expect(page.getByText('Google', { exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'Edit profile' }).click();
        await page.getByRole('button', { name: 'Disconnect' }).click();
        const dialog = page.getByRole('alertdialog');
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Disconnect' }).click();

        await expect(page.getByText('Disconnected')).toBeVisible();
        shape = await getUserAccountShape(email);
        expect(shape?.oauthIdentityCount).toBe(0);
    });

    test('a user whose only sign-in method is Google is blocked from unlinking it, with a clear message', async ({
        page,
    }, testInfo) => {
        const email = uniqueEmail(testInfo.parallelIndex);
        createdEmails.push(email);
        const sub = `e2e-lastmethod-sub-${run}-${testInfo.parallelIndex}-${seq}`;
        await routeGoogleStartTo(page, { email, sub, name: 'Only Google' });

        await page.goto('/login');
        await page.getByRole('link', { name: 'Continue with Google' }).click();

        // Signup-completion screen (outcome (b), Phase 3) — no password ever set.
        const username = `e2e5lastm${run}${testInfo.parallelIndex}${seq}`;
        await page.getByLabel(/^Username/).fill(username);
        await page.getByRole('button', { name: 'English' }).click();
        await page.getByRole('button', { name: 'Español' }).click();
        await page.getByRole('button', { name: 'Create account' }).click();
        await expect(page).toHaveURL('/');

        await page.goto('/user');
        await page.getByRole('button', { name: 'Edit profile' }).click();
        await page.getByRole('button', { name: 'Disconnect' }).click();
        const dialog = page.getByRole('alertdialog');
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Disconnect' }).click();

        await expect(page.getByText("You can't remove your only sign-in method.")).toBeVisible();
        // Rejected by the backend, not removed — still there after the attempt.
        await expect(page.getByText('Google', { exact: true })).toBeVisible();
        const shape = await getUserAccountShape(email);
        expect(shape).toMatchObject({ passwordIsNull: true, oauthIdentityCount: 1 });
    });
});
