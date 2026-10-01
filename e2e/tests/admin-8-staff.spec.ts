import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import { auditLogContains, closePool, createStaffAccount, deleteStaffByEmail } from '../fixtures/db';

/**
 * Admin dashboard, slice 8 — staff management and the audit log, against the real
 * backend + Postgres + the `admin/` UI (`.context/plans/admin-dashboard.md`).
 *
 * Two browser windows: an owner, and a new staff member. The owner adds the person
 * with a temporary password; the person is forced to choose their own before they can
 * do anything; the owner changes their role, disables, enables and resets them, and
 * each step is felt in the other window. The audit page then shows every step.
 *
 * Uses unique `e2e-admin8-*` emails and removes them in `afterAll`.
 */

const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174';
const API = process.env.E2E_API_URL ?? 'http://localhost:5001';

const run = Date.now();
const PASSWORD = 'e2e-staff-password';
const OWNER = `e2e-admin8-${run}-owner@ladu.test`;
const ADMIN = `e2e-admin8-${run}-admin@ladu.test`;
const HIRE = `e2e-admin8-${run}-hire@ladu.test`;
// Names are unique to this run: other admin specs also create an "E2E owner", and the page lists everyone.
const OWNER_NAME = `Owner E8 ${run}`;
const ADMIN_NAME = `Admin E8 ${run}`;
const HIRE_NAME = `New Hire E8 ${run}`;
const HIRE_OWN_PASSWORD = `own-password-${run}`;
const HIRE_RESET_PASSWORD = `reset-temp-${run}`;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
    await createStaffAccount(OWNER, 'owner', PASSWORD, OWNER_NAME);
    await createStaffAccount(ADMIN, 'admin', PASSWORD, ADMIN_NAME);
});

test.afterAll(async () => {
    await deleteStaffByEmail([OWNER, ADMIN, HIRE]);
    await closePool();
});

async function signIn(page: Page, email: string, password: string, goTo = '/') {
    await page.goto(`${ADMIN_URL}${goTo}`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
}

const staffRow = (page: Page, name: string): Locator => page.getByRole('table').getByRole('row').filter({ hasText: name });

async function newWindow(browser: Browser): Promise<Page> {
    return (await browser.newContext()).newPage();
}

test.describe('Admin dashboard — staff and audit (slice 8)', () => {
    test('an owner adds a person, who must choose their own password; every later step is felt at once', async ({ page, browser }) => {
        let temporary = '';

        // --- The owner opens the staff page.
        await signIn(page, OWNER, PASSWORD, '/staff');
        await expect(page.getByRole('heading', { name: 'Staff' })).toBeVisible();
        const me = staffRow(page, OWNER_NAME);
        await expect(me).toContainText('(you)');
        // No buttons on your own row: an owner cannot demote or disable themselves.
        await expect(me.getByRole('button')).toHaveCount(0);

        // --- Add a person with a generated temporary password.
        await page.getByRole('button', { name: 'Add staff member' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('button', { name: 'Add staff member' })).toBeDisabled();
        await dialog.getByLabel('Email').fill(HIRE);
        await dialog.getByLabel('Name').fill(HIRE_NAME);
        await dialog.getByLabel('Role').selectOption('support');
        await dialog.getByRole('button', { name: 'Generate' }).click();
        temporary = await dialog.getByLabel('Temporary password').inputValue();
        expect(temporary).toHaveLength(20);
        await dialog.getByLabel(/Reason/).fill('new support hire');
        await dialog.getByRole('button', { name: 'Add staff member' }).click();
        await expect(dialog).toHaveCount(0);
        await expect(page.getByRole('status')).toContainText(`${HIRE_NAME} was added`);
        const hire = staffRow(page, HIRE_NAME);
        await expect(hire).toContainText('Temporary password');
        await expect(hire).toContainText('support');
        // The temporary password is not left on the page.
        await expect(page.locator('body')).not.toContainText(temporary);

        // A second add with the same email is refused, with the server's message.
        await page.getByRole('button', { name: 'Add staff member' }).click();
        await dialog.getByLabel('Email').fill(HIRE.toUpperCase());
        await dialog.getByLabel('Name').fill('Same Person');
        await dialog.getByRole('button', { name: 'Generate' }).click();
        await dialog.getByRole('button', { name: 'Add staff member' }).click();
        await expect(dialog.getByRole('alert')).toHaveText('A staff account with this email already exists');
        await dialog.getByRole('button', { name: 'Cancel' }).click();

        // --- The new person signs in (a second window): forced to the password form.
        const other = await newWindow(browser);
        await signIn(other, HIRE, temporary);
        await expect(other).toHaveURL(`${ADMIN_URL}/account/password`);
        await expect(other.getByRole('heading', { name: 'Choose your own password' })).toBeVisible();
        // Nothing else opens: the other links are gone, and typing an address leads back here.
        await expect(other.getByRole('link', { name: 'Users' })).toHaveCount(0);
        await other.goto(`${ADMIN_URL}/users`);
        await expect(other).toHaveURL(`${ADMIN_URL}/account/password`);
        // The API refuses too, whatever the page does.
        const token = JSON.parse((await other.evaluate(() => localStorage.getItem('ladu-admin.session'))) as string).state.token as string;
        const refused = await other.request.get(`${API}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
        expect(refused.status()).toBe(403);
        expect(((await refused.json()) as { code: string }).code).toBe('password_change_required');

        // Wrong temporary password: refused. A weak new password: refused before it is sent.
        await other.getByLabel('Temporary password').fill('not-the-temporary-one');
        await other.getByLabel('New password', { exact: true }).fill(HIRE_OWN_PASSWORD);
        await other.getByLabel('Repeat the new password').fill(HIRE_OWN_PASSWORD);
        await other.getByRole('button', { name: 'Save new password' }).click();
        await expect(other.getByRole('alert')).toHaveText('The current password is not correct');
        await other.getByLabel('Temporary password').fill(temporary);
        await other.getByLabel('New password', { exact: true }).fill('short');
        await other.getByLabel('Repeat the new password').fill('short');
        await other.getByRole('button', { name: 'Save new password' }).click();
        await expect(other.getByRole('alert')).toContainText('at least 12 characters');

        // The right one: the person is in.
        await other.getByLabel('New password', { exact: true }).fill(HIRE_OWN_PASSWORD);
        await other.getByLabel('Repeat the new password').fill(HIRE_OWN_PASSWORD);
        await other.getByRole('button', { name: 'Save new password' }).click();
        await expect(other).toHaveURL(`${ADMIN_URL}/`);
        await expect(other.getByRole('link', { name: 'Users' })).toBeVisible();
        // A support role has neither the staff page nor the audit log.
        await expect(other.getByRole('link', { name: 'Staff' })).toHaveCount(0);
        await expect(other.getByRole('link', { name: 'Audit' })).toHaveCount(0);
        await other.goto(`${ADMIN_URL}/staff`);
        await expect(other).toHaveURL(`${ADMIN_URL}/`);

        // --- The owner sees the temporary mark gone, and a last sign-in time.
        await page.reload();
        await expect(staffRow(page, HIRE_NAME)).not.toContainText('Temporary password');

        // --- Change the role: the open window gets the Audit link after a reload, no new sign-in.
        await staffRow(page, HIRE_NAME).getByRole('button', { name: 'Change role' }).click();
        await expect(dialog.getByRole('button', { name: 'Change role' })).toBeDisabled();
        await dialog.getByLabel('Role').selectOption('admin');
        await dialog.getByRole('button', { name: 'Change role' }).click();
        await expect(page.getByRole('status')).toHaveText(`${HIRE_NAME} is now admin.`);
        await other.reload();
        await expect(other.getByRole('link', { name: 'Audit' })).toBeVisible();
        await expect(other.getByRole('link', { name: 'Staff' })).toHaveCount(0);

        // --- Disable (a reason is needed): the open window is out at once.
        await staffRow(page, HIRE_NAME).getByRole('button', { name: 'Disable' }).click();
        await expect(dialog.getByRole('button', { name: 'Disable account' })).toBeDisabled();
        await dialog.getByLabel(/Reason/).fill('on leave');
        await dialog.getByRole('button', { name: 'Disable account' }).click();
        await expect(staffRow(page, HIRE_NAME)).toContainText('Disabled');
        await other.reload();
        await expect(other).toHaveURL(/\/login/);
        await other.getByLabel('Email').fill(HIRE);
        await other.getByLabel('Password').fill(HIRE_OWN_PASSWORD);
        await other.getByRole('button', { name: 'Sign in' }).click();
        await expect(other.getByRole('alert')).toHaveText('Invalid credentials');

        // --- Enable: the person's own password works again.
        await staffRow(page, HIRE_NAME).getByRole('button', { name: 'Enable' }).click();
        await dialog.getByRole('button', { name: 'Enable account' }).click();
        await expect(staffRow(page, HIRE_NAME)).toContainText('Active');
        await other.getByLabel('Password').fill(HIRE_OWN_PASSWORD);
        await other.getByRole('button', { name: 'Sign in' }).click();
        await expect(other).toHaveURL(`${ADMIN_URL}/`);

        // --- Reset the password: the open window is out, the old password is dead, a new temporary one forces a change.
        await staffRow(page, HIRE_NAME).getByRole('button', { name: 'Reset password' }).click();
        await dialog.getByLabel('Temporary password').fill(HIRE_RESET_PASSWORD);
        await dialog.getByRole('button', { name: 'Reset password' }).click();
        await expect(page.getByRole('status')).toContainText(`The password of ${HIRE_NAME} is reset`);
        await expect(staffRow(page, HIRE_NAME)).toContainText('Temporary password');
        await other.reload();
        await expect(other).toHaveURL(/\/login/);
        await other.getByLabel('Email').fill(HIRE);
        await other.getByLabel('Password').fill(HIRE_OWN_PASSWORD);
        await other.getByRole('button', { name: 'Sign in' }).click();
        await expect(other.getByRole('alert')).toHaveText('Invalid credentials');
        await other.getByLabel('Password').fill(HIRE_RESET_PASSWORD);
        await other.getByRole('button', { name: 'Sign in' }).click();
        await expect(other).toHaveURL(`${ADMIN_URL}/account/password`);
        await other.context().close();

        // --- No password of any step was written to the audit log.
        expect(await auditLogContains(temporary)).toBe(false);
        expect(await auditLogContains(HIRE_OWN_PASSWORD)).toBe(false);
        expect(await auditLogContains(HIRE_RESET_PASSWORD)).toBe(false);
    });

    test('the audit page shows every staff step, and filters by action and by staff member', async ({ page }) => {
        await signIn(page, OWNER, PASSWORD, '/audit');
        await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();

        // Narrow to this run's staff steps, newest first.
        await page.getByRole('combobox', { name: 'Action' }).selectOption('staff.create');
        await expect(page).toHaveURL(/action=staff\.create/);
        const createRow = page.getByRole('row').filter({ hasText: HIRE_NAME }).first();
        await expect(createRow).toContainText('staff.create');
        await expect(createRow).toContainText(OWNER_NAME);
        await expect(createRow).toContainText('new support hire');
        await expect(createRow).toContainText(`email: ${HIRE}`);

        await page.getByRole('combobox', { name: 'Action' }).selectOption('staff.role_change');
        const roleRow = page.getByRole('row').filter({ hasText: HIRE }).first();
        await expect(roleRow).toContainText('support → admin');

        await page.getByRole('combobox', { name: 'Action' }).selectOption('staff.disable');
        await expect(page.getByRole('row').filter({ hasText: 'on leave' }).first()).toBeVisible();

        for (const action of ['staff.enable', 'staff.password_reset', 'staff.password_change']) {
            await page.getByRole('combobox', { name: 'Action' }).selectOption(action);
            await expect(page.getByRole('row').filter({ hasText: HIRE_NAME }).first()).toContainText(action);
        }

        // Filter by staff member: only the owner's rows, so the new hire's own password change is not among them.
        await page.getByRole('combobox', { name: 'Action' }).selectOption('');
        await page.getByRole('combobox', { name: 'Staff' }).selectOption({ label: OWNER_NAME });
        await expect(page).toHaveURL(/staff=/);
        await expect(page.getByRole('row').filter({ hasText: 'staff.create' }).first()).toBeVisible();
        // The new hire still appears as the TARGET of the owner's steps ("About"), but never as the actor
        // (second column), and their own password change is not in this list.
        await expect(page.locator('tbody tr td:nth-child(2)', { hasText: HIRE_NAME })).toHaveCount(0);
        await expect(page.getByRole('cell', { name: 'staff.password_change', exact: true })).toHaveCount(0);

        // A date range with no rows says so.
        await page.getByLabel('From').fill('2001-01-01');
        await page.getByLabel('To').fill('2001-01-02');
        await expect(page.getByText('No entries match these filters.')).toBeVisible();
        await page.getByRole('button', { name: 'Clear filters' }).click();
        await expect(page.getByText('No entries match these filters.')).toHaveCount(0);
    });

    test('an admin has no staff page, the API refuses it, but the admin can read the audit log', async ({ page }) => {
        await signIn(page, ADMIN, PASSWORD);
        await expect(page.getByRole('link', { name: 'Audit' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Staff' })).toHaveCount(0);

        await page.goto(`${ADMIN_URL}/staff`);
        await expect(page).toHaveURL(`${ADMIN_URL}/`);

        const token = JSON.parse((await page.evaluate(() => localStorage.getItem('ladu-admin.session'))) as string).state.token as string;
        const headers = { Authorization: `Bearer ${token}` };
        expect((await page.request.get(`${API}/api/admin/staff`, { headers })).status()).toBe(403);
        expect((await page.request.post(`${API}/api/admin/staff`, { headers, data: { email: 'x@ladu.test', name: 'X', role: 'owner', password: 'twelve-chars-ok' } })).status()).toBe(403);
        expect((await page.request.get(`${API}/api/admin/audit`, { headers })).status()).toBe(200);

        await page.goto(`${ADMIN_URL}/audit`);
        await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
    });
});
