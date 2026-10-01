import { test, expect, type Page } from '@playwright/test';
import {
    closePool,
    countResetTokens,
    createStaffAccount,
    deleteStaffByEmail,
    deleteUsersByEmail,
    getAuditForUser,
    hasVerificationToken,
    seedUser,
} from '../fixtures/db';

/**
 * Admin user emails — "Resend verification email" and "Send password reset",
 * against the real backend + Postgres + the `admin/` UI.
 *
 * The e2e backend cannot reach a mail server, and `sendMail` swallows that, so
 * no inbox is checked. The spec checks what the admin panel controls: the
 * buttons, the notice, the cooldown message, and the database (a token row and
 * an audit row). The audit row never holds a token or a link.
 *
 * Uses unique `e2e-admin10-*` emails and removes them in `afterAll`.
 */

const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174';

const run = Date.now();
const STAFF_PASSWORD = 'e2e-staff-password';
const staffEmail = (role: string) => `e2e-admin10-${run}-${role}@ladu.test`;
const learnerEmail = (key: string) => `e2e-admin10-${run}-${key}@ladu.test`;

const learnerKeys = ['unverified', 'verified', 'google'];
const staffRoles = ['support', 'viewer'];
const ids: Record<string, string> = {};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
    for (const role of staffRoles) await createStaffAccount(staffEmail(role), role, STAFF_PASSWORD);
    const specs: Record<string, { verified: boolean; hasPassword: boolean }> = {
        unverified: { verified: false, hasPassword: true },
        verified: { verified: true, hasPassword: true },
        google: { verified: true, hasPassword: false },
    };
    for (const key of learnerKeys) {
        const { userId } = await seedUser(learnerEmail(key), {
            name: `Learner ${key}`,
            username: `l10${key}${run}`,
            ...specs[key],
        });
        ids[key] = userId;
    }
});

test.afterAll(async () => {
    await deleteUsersByEmail(learnerKeys.map(learnerEmail));
    await deleteStaffByEmail(staffRoles.map(staffEmail));
    await closePool();
});

async function staffSignIn(page: Page, role: string, goTo: string) {
    await page.goto(`${ADMIN_URL}${goTo}`);
    await page.getByLabel('Email').fill(staffEmail(role));
    await page.getByLabel('Password').fill(STAFF_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
}

const actionButton = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test('buttons follow the account: verification for an unverified one, reset for one with a password', async ({ page }) => {
    await staffSignIn(page, 'support', `/users/${ids.unverified}`);
    await expect(actionButton(page, 'Resend verification email')).toBeVisible();
    await expect(actionButton(page, 'Send password reset')).toBeVisible();

    await page.goto(`${ADMIN_URL}/users/${ids.verified}`);
    await expect(actionButton(page, 'Send password reset')).toBeVisible();
    await expect(actionButton(page, 'Resend verification email')).toHaveCount(0);

    await page.goto(`${ADMIN_URL}/users/${ids.google}`);
    await expect(actionButton(page, 'Ban')).toBeVisible();
    await expect(actionButton(page, 'Send password reset')).toHaveCount(0);
    await expect(actionButton(page, 'Resend verification email')).toHaveCount(0);
});

test('a viewer sees neither button', async ({ page }) => {
    await staffSignIn(page, 'viewer', `/users/${ids.unverified}`);
    await expect(page.getByRole('heading', { name: 'Learner unverified' })).toBeVisible();
    await expect(actionButton(page, 'Resend verification email')).toHaveCount(0);
    await expect(actionButton(page, 'Send password reset')).toHaveCount(0);
});

test('resend verification: notice, token row, audit row; a second try is refused for 5 minutes', async ({ page }) => {
    await staffSignIn(page, 'support', `/users/${ids.unverified}`);
    expect(await hasVerificationToken(learnerEmail('unverified'))).toBe(false);

    await actionButton(page, 'Resend verification email').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Reason/).fill('user wrote to support');
    await dialog.getByRole('button', { name: 'Send email', exact: true }).click();
    await expect(dialog).toHaveCount(0);

    const notice = page.getByRole('status');
    await expect(notice).toContainText('The email was handed to the mail service. We cannot tell if it arrived.');
    expect(await hasVerificationToken(learnerEmail('unverified'))).toBe(true);

    const audit = (await getAuditForUser(ids.unverified)).filter((a) => a.action === 'user.resend_verification');
    expect(audit).toHaveLength(1);
    expect(audit[0].reason).toBe('user wrote to support');
    expect(audit[0].metadata).toMatchObject({ email: learnerEmail('unverified') });
    expect(JSON.stringify(audit[0])).not.toContain('/verify/');

    // The cooldown message of the server shows inside the dialog.
    await actionButton(page, 'Resend verification email').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Send email', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Try again in');
    expect((await getAuditForUser(ids.unverified)).filter((a) => a.action === 'user.resend_verification')).toHaveLength(1);
});

test('send password reset: a new token row and an audit row', async ({ page }) => {
    await staffSignIn(page, 'support', `/users/${ids.verified}`);
    expect(await countResetTokens(ids.verified)).toBe(0);

    await actionButton(page, 'Send password reset').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Send email', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('handed to the mail service');

    expect(await countResetTokens(ids.verified)).toBe(1);
    const audit = (await getAuditForUser(ids.verified)).filter((a) => a.action === 'user.send_password_reset');
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit[0])).not.toContain('/resetPassword/');
});
