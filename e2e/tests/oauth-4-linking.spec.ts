import { test, expect, type APIRequestContext } from '@playwright/test';
import { closePool, deleteUsersByEmail, getUserAccountShape, getVerifyToken } from '../fixtures/db';
import { routeGoogleStartTo } from '../fixtures/oauthRouting';

/**
 * OAuth Phase 4 — linking to an existing password account
 * (.dev-context/oauth-login-strategy.md §4, outcome (c)).
 *
 * Walks the real button through the real backend and the Phase 0 stub
 * issuer, into the real password-confirm screen, and back out through
 * `POST /api/auth/link` — no step of this is mocked. Also proves the
 * `email_verified` guard this phase adds actually does something: an
 * unverified-email identity matching a password account must not be
 * offered a link screen at all (oauth-login-strategy.md's own "provider
 * quirks" note — password confirmation is the real safety net either way,
 * but this is the cheap defense-in-depth on top of it).
 *
 * Runs against `keelapp_v2_dev`. Each run uses unique `e2e-*@ladu.test`
 * emails and deletes them in `afterAll`.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5001';
const run = Date.now();
let seq = 0;
const uniqueEmail = (workerIndex: number) => `e2e-oauth4-${run}-w${workerIndex}-${++seq}@ladu.test`;
const createdEmails: string[] = [];

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

async function registerAndVerify(
    page: import('@playwright/test').Page,
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

    await page.getByRole('button', { name: 'Open settings' }).click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/);
}

test.describe('OAuth Phase 4 — linking to an existing password account', () => {
    test('confirms with the password once, links, and a later visit signs in with one click, no password', async ({
        page,
        request,
    }, testInfo) => {
        const email = uniqueEmail(testInfo.parallelIndex);
        createdEmails.push(email);
        const username = `e2e4link${run}${testInfo.parallelIndex}${seq}`;
        await registerAndVerify(page, request, email, 'Has Password', username);

        const sub = `e2e-link-sub-${run}-${testInfo.parallelIndex}-${seq}`;
        await routeGoogleStartTo(page, { email, sub });
        await page.getByRole('link', { name: 'Continue with Google' }).click();

        // Password-confirm screen, naming the matched account's email.
        await expect(page.getByText(email)).toBeVisible();
        await page.getByLabel(/^Password/).fill('password123');
        await page.getByRole('button', { name: 'Connect Google sign-in' }).click();

        await expect(page).toHaveURL('/');
        await expect(page.getByRole('heading', { name: /Welcome, Has Password/ })).toBeVisible();

        const shape = await getUserAccountShape(email);
        expect(shape?.oauthIdentityCount).toBe(1);

        // A later visit: the same identity now signs in with one click, no password.
        await page.getByRole('button', { name: 'Open settings' }).click();
        await page.getByRole('menuitem', { name: 'Logout' }).click();
        await expect(page).toHaveURL(/\/login/);
        await routeGoogleStartTo(page, { email, sub });
        await page.getByRole('link', { name: 'Continue with Google' }).click();

        await expect(page).toHaveURL('/');
        await expect(page.getByRole('heading', { name: /Welcome, Has Password/ })).toBeVisible();
    });

    test('a wrong password is rejected and the form stays usable for a retry', async ({ page, request }, testInfo) => {
        const email = uniqueEmail(testInfo.parallelIndex);
        createdEmails.push(email);
        const username = `e2e4wrong${run}${testInfo.parallelIndex}${seq}`;
        await registerAndVerify(page, request, email, 'Wrong Then Right', username);

        const sub = `e2e-wrongpw-sub-${run}-${testInfo.parallelIndex}-${seq}`;
        await routeGoogleStartTo(page, { email, sub });
        await page.getByRole('link', { name: 'Continue with Google' }).click();

        await page.getByLabel(/^Password/).fill('totally-wrong');
        await page.getByRole('button', { name: 'Connect Google sign-in' }).click();
        await expect(page.getByText('Invalid email or password.')).toBeVisible();
        // Still on the confirm screen, not bounced — the ticket isn't
        // consumed by a failed attempt.
        await expect(page).toHaveURL(/\/auth\/callback/);

        await page.getByLabel(/^Password/).fill('password123');
        await page.getByRole('button', { name: 'Connect Google sign-in' }).click();
        await expect(page).toHaveURL('/');
        await expect(page.getByRole('heading', { name: /Welcome, Wrong Then Right/ })).toBeVisible();
    });

    test('an unverified-email identity matching a password account gets the signup screen, not the link screen', async ({
        page,
        request,
    }, testInfo) => {
        const email = uniqueEmail(testInfo.parallelIndex);
        createdEmails.push(email);
        const username = `e2e4unver${run}${testInfo.parallelIndex}${seq}`;
        await registerAndVerify(page, request, email, 'Real Account', username);

        const sub = `e2e-unverified-sub-${run}-${testInfo.parallelIndex}-${seq}`;
        await routeGoogleStartTo(page, { email, sub, emailVerified: false });
        await page.getByRole('link', { name: 'Continue with Google' }).click();

        // Never offered the password-confirm screen — an unverified email
        // isn't trusted as authoritative for linking, so this falls through
        // to a fresh signup attempt instead (outcome (b)).
        await expect(page.getByLabel(/^Username/)).toBeVisible();
    });
});
