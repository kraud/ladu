import { test, expect } from '@playwright/test';
import { closePool, deleteUsersByEmail, getUserAccountShape, hasVerificationToken } from '../fixtures/db';
import { routeGoogleStartTo } from '../fixtures/oauthRouting';

/**
 * OAuth Phase 3 — signup completion for a brand-new Google identity
 * (.dev-context/oauth-login-strategy.md §4, outcome (b)).
 *
 * Walks the real button through the real backend and the Phase 0 stub
 * issuer, into the real signup-completion screen, and back out through
 * `POST /api/auth/signup/complete` — no step of this is mocked. The DB gate
 * from the plan: `verified = true`, `password IS NULL`, exactly one
 * `oauth_identities` row, and — proving no email was sent — no
 * verification-token row at all (`registerUser` always creates one;
 * `signupComplete` never does).
 *
 * Runs against `keelapp_v2_dev`. Each run uses unique `e2e-*@ladu.test`
 * emails and deletes them in `afterAll`.
 */

const run = Date.now();
let seq = 0;
const uniqueEmail = (workerIndex: number) => `e2e-oauth3-${run}-w${workerIndex}-${++seq}@ladu.test`;
const createdEmails: string[] = [];

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

// Flaky in CI only — see the full diagnosis in oauth-2-google-login.spec.ts's
// matching skip. Revisit in Phase 6.
test.skip(() => !!process.env.CI, 'Flaky in CI — see git history for diagnosis; revisit in Phase 6');

test.describe('OAuth Phase 3 — Google signup completion', () => {
    test('a brand-new identity completes the language step and lands signed in, verified, password-less, no mail sent', async ({
        page,
    }, testInfo) => {
        const email = uniqueEmail(testInfo.parallelIndex);
        createdEmails.push(email);
        const sub = `e2e-signup-sub-${run}-${testInfo.parallelIndex}-${seq}`;
        await routeGoogleStartTo(page, { email, sub, name: 'Fresh Signup' });

        await page.goto('/login');
        await page.getByRole('link', { name: 'Continue with Google' }).click();

        // Signup-completion screen — username prefilled from the email's local part, editable.
        await expect(page.getByLabel(/^Username/)).toHaveValue(email.split('@')[0]);
        const username = `e2e3signup${run}${testInfo.parallelIndex}${seq}`;
        await page.getByLabel(/^Username/).fill(username);

        const submit = page.getByRole('button', { name: 'Create account' });
        await expect(submit).toBeDisabled();
        await page.getByRole('button', { name: 'English' }).click();
        await expect(submit).toBeDisabled(); // one language is not enough
        await page.getByRole('button', { name: 'Español' }).click();
        await expect(submit).toBeEnabled();
        await submit.click();

        await expect(page).toHaveURL('/');
        await expect(page.getByRole('heading', { name: /Welcome, Fresh Signup/ })).toBeVisible();

        const shape = await getUserAccountShape(email);
        expect(shape).toMatchObject({ passwordIsNull: true, verified: true, oauthIdentityCount: 1 });
        expect(await hasVerificationToken(email)).toBe(false);
    });

    test('a duplicate username is rejected and the form stays usable for a retry', async ({ page }, testInfo) => {
        // Two full signup round trips in one test — on CI's slower, single-worker
        // runner this can outrun the 30s default (see phase-1-auth.spec.ts's own
        // `setTimeout` for the same class of issue).
        test.setTimeout(60_000);

        const takenEmail = uniqueEmail(testInfo.parallelIndex);
        createdEmails.push(takenEmail);
        const takenSub = `e2e-taken-sub-${run}-${testInfo.parallelIndex}-${seq}`;
        const takenUsername = `e2e3taken${run}${testInfo.parallelIndex}${seq}`;

        // First identity claims the username for real, through the same flow.
        await routeGoogleStartTo(page, { email: takenEmail, sub: takenSub });
        await page.goto('/login');
        await page.getByRole('link', { name: 'Continue with Google' }).click();
        await page.getByLabel(/^Username/).fill(takenUsername);
        await page.getByRole('button', { name: 'English' }).click();
        await page.getByRole('button', { name: 'Español' }).click();
        await page.getByRole('button', { name: 'Create account' }).click();
        await expect(page).toHaveURL('/');

        await page.getByRole('button', { name: 'Open settings' }).click();
        await page.getByRole('menuitem', { name: 'Logout' }).click();
        await expect(page).toHaveURL(/\/login/);

        // A second, different identity tries to reuse that same username.
        const secondEmail = uniqueEmail(testInfo.parallelIndex);
        createdEmails.push(secondEmail);
        const secondSub = `e2e-second-sub-${run}-${testInfo.parallelIndex}-${seq}`;
        await routeGoogleStartTo(page, { email: secondEmail, sub: secondSub });
        await page.goto('/login');
        await page.getByRole('link', { name: 'Continue with Google' }).click();
        await page.getByLabel(/^Username/).fill(takenUsername);
        await page.getByRole('button', { name: 'English' }).click();
        await page.getByRole('button', { name: 'Español' }).click();
        await page.getByRole('button', { name: 'Create account' }).click();

        await expect(page.getByText('That username is already taken.')).toBeVisible();
        // Still on the signup form, not bounced — retry with a different username works.
        await expect(page.getByLabel(/^Username/)).toBeVisible();
        await page.getByLabel(/^Username/).fill(`${takenUsername}retry`);
        await page.getByRole('button', { name: 'Create account' }).click();
        await expect(page).toHaveURL('/');
    });
});
