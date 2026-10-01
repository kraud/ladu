import { test, expect, type Page } from '@playwright/test';
import {
    closePool,
    createStaffAccount,
    deleteStaffByEmail,
    deleteUsersByEmail,
    seedAuditEntry,
    seedGoogleIdentity,
    seedLoginEvent,
    seedTag,
    seedUser,
    seedWord,
} from '../fixtures/db';

/**
 * Admin dashboard, slice 4 — the read-only users list and detail, against the
 * real backend + Postgres + the `admin/` UI (`.context/plans/admin-dashboard.md`).
 *
 * Seeds one staff account per role and three users with a known history, then
 * signs in through the real admin login page: guard -> login -> search ->
 * filter -> sort -> open a user -> check the detail. A second test proves the
 * audit section follows the role (admin sees it, viewer does not).
 *
 * Uses unique `e2e-admin-*` emails and removes them in `afterAll`.
 */

const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174';

const run = Date.now();
const PASSWORD = 'e2e-staff-password';
const staffEmail = (role: string) => `e2e-admin-${run}-${role}@ladu.test`;
const userEmail = (key: string) => `e2e-admin-${run}-${key}@ladu.test`;
// A search that matches only this run's users.
const SEARCH = `e2e-admin-${run}`;

const createdUserEmails = ['active', 'banned', 'google'].map(userEmail);
const createdStaffEmails = ['admin', 'viewer'].map(staffEmail);

let activeUserId: string;

test.beforeAll(async () => {
    const { staffId } = await createStaffAccount(staffEmail('admin'), 'admin', PASSWORD);
    await createStaffAccount(staffEmail('viewer'), 'viewer', PASSWORD);

    const active = await seedUser(userEmail('active'), { name: 'Anna Active', username: `anna${run}`, lastLoginCountry: 'EE' });
    activeUserId = active.userId;
    await seedWord(active.userId, ['English', 'Estonian']);
    await seedWord(active.userId, ['English', 'Spanish', 'German']);
    await seedTag(active.userId, 'travel');
    await seedLoginEvent(active.userId, 'password', 'EE');
    await seedLoginEvent(active.userId, 'password', null);
    await seedAuditEntry(staffId, active.userId, 'user.note', 'checked by e2e');

    await seedUser(userEmail('banned'), { name: 'Bob Banned', username: `bob${run}`, banned: true, verified: false });

    const google = await seedUser(userEmail('google'), { name: 'Gerda Google', username: `gerda${run}`, hasPassword: false });
    await seedGoogleIdentity(google.userId, `gerda-${run}@gmail.test`);
});

test.afterAll(async () => {
    await deleteUsersByEmail(createdUserEmails);
    await deleteStaffByEmail(createdStaffEmails);
    await closePool();
});

async function signIn(page: Page, email: string, password = PASSWORD) {
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
}

// One worker for both tests: they share the rows seeded in `beforeAll`, and a
// second worker would run `beforeAll` again (duplicate staff emails) and its
// `afterAll` would delete the first worker's data.
test.describe.configure({ mode: 'serial' });

test.describe('Admin dashboard — users (slice 4)', () => {
    test('guard, login, search, filter, sort and open a user', async ({ page }) => {
        // Guard: a visitor without a session is sent to the login page.
        await page.goto(`${ADMIN_URL}/users`);
        await expect(page).toHaveURL(/\/login\?redirect=/);

        // A wrong password stays on the page with the server's message.
        await signIn(page, staffEmail('admin'), 'wrong-password');
        await expect(page.getByRole('alert')).toHaveText('Invalid credentials');

        // The right one returns to the page that was asked for first.
        await signIn(page, staffEmail('admin'));
        await expect(page).toHaveURL(`${ADMIN_URL}/users`);
        await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

        // Search narrows to this run's three users.
        await page.getByLabel('Search').fill(SEARCH);
        await expect(page).toHaveURL(new RegExp(`q=${SEARCH}`));
        const rows = page.getByRole('row');
        await expect(rows).toHaveCount(4); // header + 3
        await expect(page.getByText('1–3 of 3')).toBeVisible();

        // The row shows status and sign-in methods.
        const anna = rows.filter({ hasText: 'Anna Active' });
        await expect(anna).toContainText('Active');
        await expect(anna).toContainText('Password');
        await expect(anna).toContainText('(EE)');
        await expect(rows.filter({ hasText: 'Gerda Google' })).toContainText('Google');

        // Filter by status.
        await page.getByLabel('Status').selectOption('banned');
        await expect(rows).toHaveCount(2);
        await expect(rows.filter({ hasText: 'Bob Banned' })).toContainText('Banned');
        await expect(rows.filter({ hasText: 'Bob Banned' })).toContainText('not verified');
        await page.getByLabel('Status').selectOption('');

        // Filter by sign-in method.
        await page.getByLabel('Sign-in method').selectOption('google');
        await expect(rows).toHaveCount(2);
        await expect(rows.filter({ hasText: 'Gerda Google' })).toBeVisible();
        await page.getByLabel('Sign-in method').selectOption('');
        await expect(rows).toHaveCount(4);

        // Sort by name, A to Z, then Z to A.
        await page.getByRole('button', { name: 'Name' }).click();
        await expect(page.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'ascending');
        await expect(rows.nth(1)).toContainText('Anna Active');
        await page.getByRole('button', { name: 'Name' }).click();
        await expect(rows.nth(1)).toContainText('Gerda Google');

        // A reload keeps the same list: the state is in the URL.
        await page.reload();
        await expect(page.getByLabel('Search')).toHaveValue(SEARCH);
        await expect(rows).toHaveCount(4);
        await expect(rows.nth(1)).toContainText('Gerda Google');

        // Open the detail page.
        await page.getByRole('link', { name: 'Anna Active' }).click();
        await expect(page).toHaveURL(`${ADMIN_URL}/users/${activeUserId}`);
        await expect(page.getByRole('heading', { name: 'Anna Active' })).toBeVisible();
        await expect(page.getByText(userEmail('active'))).toBeVisible();

        const content = page.locator('section', { has: page.getByRole('heading', { name: 'Content' }) });
        await expect(content.locator('div', { hasText: /^Words2$/ })).toBeVisible();
        await expect(content.locator('div', { hasText: /^Translations5$/ })).toBeVisible();
        await expect(content.locator('div', { hasText: /^Tags1$/ })).toBeVisible();
        await expect(content.locator('div', { hasText: /^Friends0$/ })).toBeVisible();

        const logins = page.locator('section', { has: page.getByRole('heading', { name: 'Recent logins' }) });
        await expect(logins.getByRole('row')).toHaveCount(3); // header + 2
        await expect(logins.getByRole('row').filter({ hasText: 'EE' })).toHaveCount(1);

        // An admin may read the audit history.
        await expect(page.getByRole('heading', { name: 'Audit history' })).toBeVisible();
        await expect(page.getByText('user.note')).toBeVisible();
        await expect(page.getByText('Reason: checked by e2e')).toBeVisible();

        // Back to the list, then sign out from the account page.
        await page.getByRole('link', { name: /All users/ }).click();
        await expect(page).toHaveURL(/\/users/);
        await page.getByRole('link', { name: 'Account' }).click();
        await expect(page).toHaveURL(`${ADMIN_URL}/account`);
        await expect(page.getByText(staffEmail('admin'))).toBeVisible();
        await page.getByRole('button', { name: 'Sign out' }).click();
        await expect(page).toHaveURL(`${ADMIN_URL}/login`);

        // The session is gone: the guard sends the visitor back again.
        await page.goto(`${ADMIN_URL}/users`);
        await expect(page).toHaveURL(/\/login\?redirect=/);
    });

    test('a viewer cannot see the audit history, and a missing user shows "not found"', async ({ page }) => {
        await page.goto(`${ADMIN_URL}/users/${activeUserId}`);
        await signIn(page, staffEmail('viewer'));

        await expect(page.getByRole('heading', { name: 'Anna Active' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Recent logins' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Audit history' })).toHaveCount(0);
        await expect(page.getByText('user.note')).toHaveCount(0);

        await page.goto(`${ADMIN_URL}/users/00000000-0000-4000-8000-000000000000`);
        await expect(page.getByRole('heading', { name: 'User not found' })).toBeVisible();
    });
});
