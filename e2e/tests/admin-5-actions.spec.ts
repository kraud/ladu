import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
    closePool,
    createStaffAccount,
    deleteStaffByEmail,
    deleteUsersByEmail,
    getAuditForUser,
    seedUser,
} from '../fixtures/db';

/**
 * Admin dashboard, slice 5 — the actions (ban, unban, force logout, delete,
 * restore, purge now), against the real backend + Postgres + the `admin/` UI.
 *
 * Each action is done through the admin UI, and its effect is checked from the
 * other side, with a real learner session on the learner API: a banned user's
 * token stops working and login is refused; a forced logout kills one token but
 * not the account; a deleted user cannot sign in; a restore brings it back.
 * The roles are checked too: support cannot delete, only an owner can purge.
 *
 * Uses unique `e2e-admin5-*` emails and removes them in `afterAll`.
 */

const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174';
const API = process.env.E2E_API_URL ?? 'http://localhost:5001';

const run = Date.now();
const STAFF_PASSWORD = 'e2e-staff-password';
const LEARNER_PASSWORD = 'e2e-learner-password';
const staffEmail = (role: string) => `e2e-admin5-${run}-${role}@ladu.test`;
const learnerEmail = (key: string) => `e2e-admin5-${run}-${key}@ladu.test`;

const learnerKeys = ['lifecycle', 'support', 'purge', 'viewer'];
const staffRoles = ['admin', 'support', 'owner', 'viewer'];
const ids: Record<string, string> = {};

// The roles share rows seeded once; serial keeps them in one worker (see admin-4).
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
    for (const role of staffRoles) await createStaffAccount(staffEmail(role), role, STAFF_PASSWORD);
    for (const key of learnerKeys) {
        const { userId } = await seedUser(learnerEmail(key), {
            name: `Learner ${key}`,
            username: `l5${key}${run}`,
            learnerPassword: LEARNER_PASSWORD,
        });
        ids[key] = userId;
    }
});

test.afterAll(async () => {
    await deleteUsersByEmail(learnerKeys.map(learnerEmail));
    await deleteStaffByEmail(staffRoles.map(staffEmail));
    await closePool();
});

const username = (key: string) => `l5${key}${run}`;

async function staffSignIn(page: Page, role: string, goTo: string) {
    await page.goto(`${ADMIN_URL}${goTo}`);
    await page.getByLabel('Email').fill(staffEmail(role));
    await page.getByLabel('Password').fill(STAFF_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
}

const learnerLogin = (request: APIRequestContext, key: string) =>
    request.post(`${API}/api/users/login`, { data: { email: learnerEmail(key), password: LEARNER_PASSWORD } });

async function learnerToken(request: APIRequestContext, key: string): Promise<string> {
    const res = await learnerLogin(request, key);
    expect(res.status()).toBe(200);
    return ((await res.json()) as { token: string }).token;
}

const learnerMe = async (request: APIRequestContext, token: string) =>
    (await request.get(`${API}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })).status();

/** Opens the dialog for `button`, fills it, and confirms. */
async function doAction(page: Page, button: string, confirm: string, fields: { reason?: string; typeUsername?: string } = {}) {
    await page.getByRole('button', { name: button, exact: true }).click();
    const dialog = page.getByRole('dialog');
    if (fields.reason) await dialog.getByLabel(/Reason/).fill(fields.reason);
    if (fields.typeUsername) await dialog.getByLabel(/to confirm/).fill(fields.typeUsername);
    await dialog.getByRole('button', { name: confirm, exact: true }).click();
    await expect(dialog).toHaveCount(0);
}

const badge = (page: Page, text: string) => page.locator('h1 + span', { hasText: text });

test.describe('Admin dashboard — actions (slice 5)', () => {
    test('admin: ban, unban, force logout, delete and restore — each one felt by the learner', async ({ page, request }) => {
        const key = 'lifecycle';
        await staffSignIn(page, 'admin', `/users/${ids[key]}`);
        await expect(page.getByRole('heading', { name: `Learner ${key}` })).toBeVisible();
        await expect(badge(page, 'Active')).toBeVisible();

        // A learner is signed in.
        const first = await learnerToken(request, key);
        expect(await learnerMe(request, first)).toBe(200);

        // --- Ban: needs a reason. The confirm button is disabled without one.
        await page.getByRole('button', { name: 'Ban', exact: true }).click();
        await expect(page.getByRole('dialog').getByRole('button', { name: 'Ban account' })).toBeDisabled();
        await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
        await doAction(page, 'Ban', 'Ban account', { reason: 'spam links' });
        await expect(badge(page, 'Banned')).toBeVisible();
        await expect(page.getByText(/Banned on .*Reason: spam links/)).toBeVisible();
        await expect(page.getByRole('status')).toHaveText('The account is banned.');
        // The learner is locked out at once: old token refused, login refused.
        expect(await learnerMe(request, first)).toBe(401);
        const refused = await learnerLogin(request, key);
        expect(refused.status()).toBe(403);
        expect(((await refused.json()) as { message: string }).message).toBe('This account is suspended');
        // The audit history (an admin may read it) shows the action.
        await expect(page.getByText('user.ban', { exact: true })).toBeVisible();
        await expect(page.getByText('Reason: spam links', { exact: true })).toBeVisible();

        // --- Unban: the reason is optional.
        await doAction(page, 'Unban', 'Unban account');
        await expect(badge(page, 'Active')).toBeVisible();
        const second = await learnerToken(request, key);
        expect(await learnerMe(request, second)).toBe(200);

        // --- Force logout: one token stops, the account keeps working.
        await doAction(page, 'Force logout', 'Force logout', { reason: 'stolen laptop' });
        await expect(page.getByRole('status')).toHaveText('All sessions of this user are closed.');
        expect(await learnerMe(request, second)).toBe(401);
        const third = await learnerToken(request, key);
        expect(await learnerMe(request, third)).toBe(200);

        // --- Delete: the username must be typed, exactly.
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel(/Reason/).fill('gdpr request');
        await dialog.getByLabel(/to confirm/).fill(username(key).toUpperCase());
        await expect(dialog.getByRole('button', { name: 'Delete account' })).toBeDisabled();
        await dialog.getByLabel(/to confirm/).fill(username(key));
        await dialog.getByRole('button', { name: 'Delete account' }).click();
        await expect(dialog).toHaveCount(0);
        await expect(badge(page, 'Deleted')).toBeVisible();
        await expect(page.getByText(/Deleted on .* by E2E admin/)).toBeVisible();
        // The learner sees an account that is gone.
        expect(await learnerMe(request, third)).toBe(401);
        const gone = await learnerLogin(request, key);
        expect(gone.status()).toBe(400);
        expect(((await gone.json()) as { message: string }).message).toBe('Invalid credentials');
        // An admin cannot purge: there is no such button.
        await expect(page.getByRole('button', { name: 'Delete for good' })).toHaveCount(0);

        // --- Restore: the account comes back, and the old token works again.
        await doAction(page, 'Restore', 'Restore account', { reason: 'mistake' });
        await expect(badge(page, 'Active')).toBeVisible();
        expect(await learnerMe(request, third)).toBe(200);
        expect((await learnerLogin(request, key)).status()).toBe(200);

        // The audit rows are in the database, in order, each with the account's email.
        const audit = await getAuditForUser(ids[key]);
        expect(audit.map((a) => a.action)).toEqual([
            'user.ban', 'user.unban', 'user.force_logout', 'user.delete', 'user.restore',
        ]);
        expect(audit[0].reason).toBe('spam links');
        expect(audit[1].reason).toBeNull();
        expect(audit.every((a) => a.metadata?.email === learnerEmail(key))).toBe(true);
    });

    test('support can ban but cannot delete; a reload keeps the result', async ({ page, request }) => {
        const key = 'support';
        await staffSignIn(page, 'support', `/users/${ids[key]}`);

        await expect(page.getByRole('button', { name: 'Ban', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Force logout' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
        // Support may not read the audit history.
        await expect(page.getByRole('heading', { name: 'Audit history' })).toHaveCount(0);

        await doAction(page, 'Ban', 'Ban account', { reason: 'abuse' });
        await expect(badge(page, 'Banned')).toBeVisible();
        expect((await learnerLogin(request, key)).status()).toBe(403);

        await page.reload();
        await expect(badge(page, 'Banned')).toBeVisible();

        // The list shows it, and the Banned filter finds it.
        await page.getByRole('link', { name: /All users/ }).click();
        await page.getByLabel('Search').fill(learnerEmail(key));
        await page.getByLabel('Status').selectOption('banned');
        await expect(page.getByRole('row').filter({ hasText: `Learner ${key}` })).toContainText('Banned');
    });

    test('owner: delete, then delete for good — the account and its data are gone, the audit stays', async ({ page, request }) => {
        const key = 'purge';
        await staffSignIn(page, 'owner', `/users/${ids[key]}`);

        // An active account has no "Delete for good": it must be deleted first.
        await expect(page.getByRole('button', { name: 'Delete for good' })).toHaveCount(0);
        await doAction(page, 'Delete', 'Delete account', { reason: 'gdpr erasure', typeUsername: username(key) });
        await expect(badge(page, 'Deleted')).toBeVisible();

        await page.getByRole('button', { name: 'Delete for good' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByText(/cannot undo/)).toBeVisible();
        await dialog.getByLabel(/Reason/).fill('gdpr erasure, confirmed by email');
        await dialog.getByLabel(/to confirm/).fill(username(key));
        await dialog.getByRole('button', { name: 'Delete for good' }).click();

        // Back on the list; the account is not there.
        await expect(page).toHaveURL(`${ADMIN_URL}/users`);
        await page.getByLabel('Search').fill(learnerEmail(key));
        await expect(page.getByText('No users match.')).toBeVisible();
        await page.goto(`${ADMIN_URL}/users/${ids[key]}`);
        await expect(page.getByRole('heading', { name: 'User not found' })).toBeVisible();
        expect((await learnerLogin(request, key)).status()).toBe(400);

        // The row is gone, but the audit trail still names the account.
        const audit = await getAuditForUser(ids[key]);
        expect(audit.map((a) => a.action)).toEqual(['user.delete', 'user.purge']);
        expect(audit[1]).toMatchObject({ reason: 'gdpr erasure, confirmed by email', metadata: { email: learnerEmail(key), username: username(key) } });
        expect(audit[1].staffId).not.toBeNull();
    });

    test('a viewer sees the account but no actions', async ({ page }) => {
        const key = 'viewer';
        await staffSignIn(page, 'viewer', `/users/${ids[key]}`);

        await expect(page.getByRole('heading', { name: `Learner ${key}` })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Actions' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Ban', exact: true })).toHaveCount(0);
    });
});
