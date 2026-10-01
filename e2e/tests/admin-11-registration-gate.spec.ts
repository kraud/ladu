import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
    closePool,
    countAuditByEmail,
    createStaffAccount,
    deleteAccessTestData,
    deleteStaffByEmail,
    deleteUsersByEmail,
    getRegistrationSettings,
    hasInvite,
    setAccessSettings,
    userExists,
} from '../fixtures/db';

/**
 * Access gates, PR 1 — the registration gate, against the real backend + Postgres + the
 * `admin/` UI + the learner app.
 *
 * The owner sets the state from the admin page (open → limited → closed → open) and, after each
 * change, the spec makes a REAL `POST /api/users` and reads the learner register page. It checks
 * the database for the invite and for the audit row of an invite that was used.
 *
 * The gate is one row of global state, so this spec runs in its own Playwright project, after
 * every other spec (`playwright.config.ts`). `afterAll` always puts the gate back to open.
 *
 * Uses unique `e2e-admin11-*` emails and removes them in `afterAll`.
 */

const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5001';

const run = Date.now();
const STAFF_PASSWORD = 'e2e-staff-password';
const staffEmail = (role: string) => `e2e-admin11-${run}-${role}@ladu.test`;
const learnerEmail = (key: string) => `e2e-admin11-${run}-${key}@ladu.test`;
const staffRoles = ['owner', 'support'];

const invited = learnerEmail('invited');
const stranger = learnerEmail('stranger');
const second = learnerEmail('second');
const lateOpen = learnerEmail('late');
const allLearners = [invited, stranger, second, lateOpen];

let seq = 0;
const registerBody = (email: string) => {
    seq += 1;
    return { name: `E2E ${seq}`, email, username: `e11u${run}${seq}`, password: 'a-good-password-1', languages: ['English', 'Spanish'] };
};
const register = (request: APIRequestContext, email: string) =>
    request.post(`${API_URL}/api/users`, { data: registerBody(email) });

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
    // A run that was killed may have left the gate shut.
    await setAccessSettings('open');
    for (const role of staffRoles) await createStaffAccount(staffEmail(role), role, STAFF_PASSWORD);
});

test.afterAll(async () => {
    await setAccessSettings('open');
    await deleteUsersByEmail(allLearners);
    await deleteAccessTestData(allLearners);
    await deleteStaffByEmail(staffRoles.map(staffEmail));
    await closePool();
});

async function staffSignIn(page: Page, role: string, goTo: string) {
    await page.goto(`${ADMIN_URL}${goTo}`);
    await page.getByLabel('Email').fill(staffEmail(role));
    await page.getByLabel('Password').fill(STAFF_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Picks a state on the admin page and confirms. The notice names the new state. */
async function setState(page: Page, label: 'Open' | 'Closed' | 'Limited', opts: { note?: string; reason?: string } = {}) {
    await page.getByRole('group', { name: 'Registration' }).getByRole('button', { name: label, exact: true }).click();
    if (opts.note !== undefined) await page.getByLabel(/Extra line/).fill(opts.note);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const dialog = page.getByRole('dialog');
    if (opts.reason) await dialog.getByLabel(/Reason/).fill(opts.reason);
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('status').first()).toContainText(`Registration is now ${label.toLowerCase()}.`);
}

test('only an owner sees the page', async ({ page }) => {
    await staffSignIn(page, 'support', '/access');
    // Sent back to the overview, with no header link.
    await expect(page).toHaveURL(`${ADMIN_URL}/`);
    await expect(page.getByRole('link', { name: 'Access' })).toHaveCount(0);
});

test('limited: the owner sets it and sees the empty-list warning; the learner page shows the banner and the line', async ({ page }) => {
    await staffSignIn(page, 'owner', '/access');
    await expect(page.getByRole('heading', { name: 'Registration' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Access' })).toBeVisible();

    // Picking "Limited" with no invites warns at once.
    await page.getByRole('group', { name: 'Registration' }).getByRole('button', { name: 'Limited', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('the invite list is empty, so nobody can register');

    await page.getByLabel(/Extra line/).fill('E2E invitation week');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('The list is empty, so nobody can register now.');
    await dialog.getByLabel(/Reason/).fill('e2e');
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByRole('status').first()).toContainText('Registration is now limited.');

    expect(await getRegistrationSettings()).toEqual({ mode: 'limited', note: 'E2E invitation week' });

    // The learner app reads the same row.
    await page.goto('/register');
    await expect(page.getByRole('status')).toContainText('Sign-ups are open by invitation only right now.');
    await expect(page.getByRole('status')).toContainText('E2E invitation week');
    await expect(page.getByLabel(/^Name/)).toBeEnabled();
});

test('invites: add by paste, see the skipped ones, then only the listed email can register, and it leaves the list', async ({ page, request }) => {
    await staffSignIn(page, 'owner', '/access');
    await page.getByLabel('Add emails').fill(`${invited.toUpperCase()}, not-an-email`);
    await page.getByRole('button', { name: 'Add to the list' }).click();

    const summary = page.getByRole('status', { name: 'Result of the last add' });
    await expect(summary).toContainText('Added 1. Skipped 1.');
    await expect(summary).toContainText('not-an-email: not a valid email');
    // Stored in lower case, with the owner's name beside it.
    await expect(page.getByRole('table').getByText(invited)).toBeVisible();
    await expect(page.getByRole('table')).toContainText('E2E owner');
    expect(await hasInvite(invited)).toBe(true);

    // A real sign-up: the unlisted email is refused with a code, and no account is made.
    const refused = await register(request, stranger);
    expect(refused.status()).toBe(403);
    expect((await refused.json()).code).toBe('registration_not_invited');
    expect(await userExists(stranger)).toBe(false);

    // The listed email works, in any case, and the invite is used up.
    const ok = await register(request, invited.toUpperCase());
    expect(ok.status()).toBe(201);
    expect(await userExists(invited)).toBe(true);
    expect(await hasInvite(invited)).toBe(false);
    expect(await countAuditByEmail('access.invite_used', invited)).toBe(1);

    // The page shows the list without it.
    await page.reload();
    await expect(page.getByText('The invite list is empty.')).toBeVisible();
});

test('remove: an invite that is removed cannot be used', async ({ page, request }) => {
    await staffSignIn(page, 'owner', '/access');
    await page.getByLabel('Add emails').fill(second);
    await page.getByRole('button', { name: 'Add to the list' }).click();
    await expect(page.getByRole('table').getByText(second)).toBeVisible();

    await page.getByRole('button', { name: `Remove ${second}` }).click();
    await expect(page.getByRole('table').getByText(second)).toHaveCount(0);
    expect(await hasInvite(second)).toBe(false);

    const refused = await register(request, second);
    expect(refused.status()).toBe(403);
    expect((await refused.json()).code).toBe('registration_not_invited');
});

test('closed: nobody can register, even an invited email; the learner page turns the form off and shows the line', async ({ page, request }) => {
    await staffSignIn(page, 'owner', '/access');
    await page.getByLabel('Add emails').fill(second);
    await page.getByRole('button', { name: 'Add to the list' }).click();
    await expect(page.getByRole('table').getByText(second)).toBeVisible();

    await setState(page, 'Closed', { note: 'E2E back at 14:00 UTC', reason: 'e2e closed' });
    expect(await getRegistrationSettings()).toEqual({ mode: 'closed', note: 'E2E back at 14:00 UTC' });

    const refused = await register(request, second);
    expect(refused.status()).toBe(403);
    expect((await refused.json()).code).toBe('registration_closed');
    expect(await userExists(second)).toBe(false);
    // A refusal keeps the invite.
    expect(await hasInvite(second)).toBe(true);

    await page.goto('/register');
    await expect(page.getByRole('status')).toContainText('Sign-ups are closed for now. Please check back later.');
    await expect(page.getByRole('status')).toContainText('E2E back at 14:00 UTC');
    await expect(page.getByLabel(/^Name/)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
});

test('staff are never blocked: the owner still signs in and reopens the gate while it is closed', async ({ page }) => {
    expect((await getRegistrationSettings()).mode).toBe('closed');
    await staffSignIn(page, 'owner', '/access');
    await expect(page.getByRole('heading', { name: 'Registration' })).toBeVisible();
    await setState(page, 'Open', { reason: 'e2e reopen' });
    expect((await getRegistrationSettings()).mode).toBe('open');
});

test('open: anybody can register again, and the leftover invite stays for another email', async ({ page, request }) => {
    expect(await hasInvite(second)).toBe(true);

    const ok = await register(request, lateOpen);
    expect(ok.status()).toBe(201);
    expect(await userExists(lateOpen)).toBe(true);
    // Not this email's invite, so it stays.
    expect(await hasInvite(second)).toBe(true);

    await page.goto('/register');
    await expect(page.getByLabel(/^Name/)).toBeEnabled();
    await expect(page.getByRole('status')).toHaveCount(0);
});
