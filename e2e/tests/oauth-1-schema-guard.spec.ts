import { test, expect } from '@playwright/test';
import { closePool, createPasswordlessUser, deleteUsersByEmail } from '../fixtures/db';

/**
 * OAuth Phase 1 — schema + password-less login guard (.dev-context/oauth-login-strategy.md §4).
 *
 * Migration 0004 makes `users.password` nullable and adds `oauth_identities`
 * (empty until Phase 2). This spec proves the migration applied (the seed
 * insert below would fail otherwise) and that `loginUser`'s guard against a
 * NULL password hash actually fires through the real form — a DB-seeded
 * password-less account (there's no signup flow that creates one yet) sees a
 * distinct, provider-naming message instead of "Invalid credentials"; an
 * ordinary password account still gets the generic message.
 *
 * Runs against `keelapp_v2_dev`. Each run uses unique `e2e-*@ladu.test`
 * emails and deletes them in `afterAll`.
 */

const API = process.env.E2E_API_URL ?? 'http://localhost:5001';

const run = Date.now();
let seq = 0;
const uniqueEmail = () => `e2e-oauth1-${run}-${++seq}@ladu.test`;
const createdEmails: string[] = [];

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

test.describe('OAuth Phase 1 — schema + login guard', () => {
    test('a password-less account cannot sign in through the password form and sees the provider-specific message', async ({
        page,
    }) => {
        const email = uniqueEmail();
        createdEmails.push(email);
        await createPasswordlessUser(email);

        await page.goto('/login');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').fill('anything at all');
        await page.getByRole('button', { name: 'Sign in' }).click();

        await expect(
            page.getByText('This account signs in with Google — use the Google button instead.'),
        ).toBeVisible();
        await expect(page).toHaveURL(/\/login/);
    });

    test('an ordinary password account still gets the generic invalid-credentials message', async ({
        page,
        request,
    }) => {
        const email = uniqueEmail();
        createdEmails.push(email);

        const res = await request.post(`${API}/api/users`, {
            data: {
                name: 'Ordinary Password',
                username: `ordpw${run}${seq}`,
                email,
                password: 'password123',
                languages: ['English', 'Spanish'],
                uiLanguage: 'English',
            },
        });
        expect(res.status()).toBe(201);

        await page.goto('/login');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').fill('wrong password');
        await page.getByRole('button', { name: 'Sign in' }).click();

        await expect(page.getByText('Invalid email or password.')).toBeVisible();
        await expect(
            page.getByText('This account signs in with Google — use the Google button instead.'),
        ).not.toBeVisible();
    });
});
