import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
    closePool,
    createStaffAccount,
    deleteAccessTestData,
    deleteStaffByEmail,
    deleteUsersByEmail,
    getAccessRequestKinds,
    countAuditByEmail,
    hasInvite,
    hasLoginAllowed,
    seedUser,
    setAccessSettings,
    setLoginAccess,
    userExists,
} from '../fixtures/db';

/**
 * Access requests (`.context/plans/access-requests.md`, Slice 4) — the whole flow against the real backend +
 * Postgres + the `admin/` UI + the learner app.
 *
 * A visitor asks for access on `/request` (from the button on `/register` or `/login`), the owner approves in
 * the admin panel with a confirm dialog, and the person then gets in: a real sign-up for a registration request,
 * a real sign-in for a login request. It also checks that the server answers the same 202 for a repeat or a
 * useless request, refuses a request while the gate is open, and that Remove drops a request with no list change.
 *
 * The gates are global state, so this spec runs in its own Playwright project (`*-gate.spec.ts`), after every
 * other spec. `afterAll` always puts both gates back to open. The team email is off in e2e (`ACCESS_REQUEST_EMAIL`
 * is empty in `playwright.config.ts`); the captcha switch is off, and Jest and Vitest cover the captcha.
 *
 * Uses unique `e2e-req-*` emails and removes them in `afterAll`.
 */

const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174';
const API = process.env.E2E_API_URL ?? 'http://localhost:5001';

const run = Date.now();
const STAFF_PASSWORD = 'e2e-staff-password';
const LEARNER_PASSWORD = 'e2e-learner-password';
const ownerEmail = `e2e-req-${run}-owner@ladu.test`;
const email = (key: string) => `e2e-req-${run}-${key}@ladu.test`;
const newcomer = email('newcomer'); // asks to register, gets approved, registers
const refused = email('refused'); // asks to register, the owner removes the request
const ghost = email('ghost'); // a login request for an email with no account
const member = email('member'); // has an account, asks to sign in, gets approved
const closedAsker = email('closed');
const allEmails = [newcomer, refused, ghost, member, closedAsker];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
    // A run that was killed may have left a gate shut.
    await setAccessSettings('open');
    await setLoginAccess('open');
    await createStaffAccount(ownerEmail, 'owner', STAFF_PASSWORD);
    await seedUser(member, { name: 'Learner member', username: `req${run}`, learnerPassword: LEARNER_PASSWORD });
});

test.afterAll(async () => {
    await setAccessSettings('open');
    await setLoginAccess('open');
    await deleteUsersByEmail(allEmails);
    await deleteAccessTestData(allEmails);
    await deleteStaffByEmail([ownerEmail]);
    await closePool();
});

async function ownerSignIn(page: Page, goTo: string) {
    await page.goto(`${ADMIN_URL}${goTo}`);
    await page.getByLabel('Email').fill(ownerEmail);
    await page.getByLabel('Password', { exact: true }).fill(STAFF_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
}

const askApi = (request: APIRequestContext, body: Record<string, unknown>) => request.post(`${API}/api/access/request`, { data: body });
const login = (request: APIRequestContext, address: string) =>
    request.post(`${API}/api/users/login`, { data: { email: address, password: LEARNER_PASSWORD } });

/** The requests card on the open Access tab. Other runs may leave requests, so it is found by its heading only. */
const requestsCard = (page: Page) => page.getByRole('region', { name: /^Access requests/ });
const requestRow = (page: Page, address: string) => requestsCard(page).getByRole('row').filter({ hasText: address });
const dialog = (page: Page) => page.getByRole('dialog');

/** The visitor's form on `/request`: type the email, press the button. */
async function submitRequest(page: Page, address: string) {
    const button = page.getByRole('button', { name: 'Request access', exact: true });
    await expect(button).toBeDisabled();
    await page.getByLabel('Email').fill('not-an-email');
    await expect(button).toBeDisabled();
    await page.getByLabel('Email').fill(address);
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page.getByText('Request received')).toBeVisible();
}

test('registration limited: the register page offers "Request access", and a visitor asks to register', async ({ page }) => {
    await setAccessSettings('limited');

    await page.goto('/register');
    await expect(page.getByRole('status')).toContainText('Sign-ups are open by invitation only right now.');
    await page.getByRole('link', { name: 'Request access' }).click();

    await expect(page).toHaveURL(/\/request$/);
    await expect(page.getByRole('checkbox', { name: 'I already have an account' })).not.toBeChecked();
    await submitRequest(page, newcomer);

    expect(await getAccessRequestKinds(newcomer)).toEqual(['registration']);
    expect(await countAuditByEmail('access.request_create', newcomer)).toBe(1);
    // Asking is not a permission: the email is not on the invite list.
    expect(await hasInvite(newcomer)).toBe(false);
});

test('a repeat request, a bad email and a useless request: the same 202 or a clear 400, and no extra rows', async ({ request }) => {
    const again = await askApi(request, { email: newcomer.toUpperCase(), hasAccount: false });
    expect(again.status()).toBe(202);
    expect(await again.json()).toEqual({ received: true });
    expect(await getAccessRequestKinds(newcomer)).toEqual(['registration']);
    expect(await countAuditByEmail('access.request_create', newcomer)).toBe(1);

    // A person with an account who asks to register, and a visitor with no account who asks to sign in: both
    // get the same answer, and nothing is saved, so the route never tells what exists.
    await setLoginAccess('limited');
    const hasAccount = await askApi(request, { email: member, hasAccount: false });
    const noAccount = await askApi(request, { email: ghost, hasAccount: true });
    for (const res of [hasAccount, noAccount]) {
        expect(res.status()).toBe(202);
        expect(await res.json()).toEqual({ received: true });
    }
    expect(await getAccessRequestKinds(member)).toEqual([]);
    expect(await getAccessRequestKinds(ghost)).toEqual([]);

    expect((await askApi(request, { email: 'not-an-email', hasAccount: false })).status()).toBe(400);
    expect((await askApi(request, { email: newcomer })).status()).toBe(400);
    await setLoginAccess('open');
});

test('the owner approves the registration request with a confirm; the email joins the invite list, and the person registers', async ({ page, request }) => {
    await ownerSignIn(page, '/access');
    await expect(requestRow(page, newcomer)).toBeVisible();

    await requestRow(page, newcomer).getByRole('button', { name: `Approve ${newcomer}` }).click();
    // The dialog says what will happen and what will not.
    await expect(dialog(page)).toContainText(`Add ${newcomer} to the invite list`);
    await expect(dialog(page)).toContainText('does not send an email');
    // Nothing changed before the confirm.
    expect(await hasInvite(newcomer)).toBe(false);
    await dialog(page).getByRole('button', { name: 'Approve', exact: true }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole('status').first()).toContainText(`Added ${newcomer} to the invite list.`);
    expect(await hasInvite(newcomer)).toBe(true);
    expect(await getAccessRequestKinds(newcomer)).toEqual([]);
    await expect(requestRow(page, newcomer)).toHaveCount(0);
    await expect(page.getByRole('region', { name: /^Invite list/ })).toContainText(newcomer);

    // The invite works: a real sign-up with that email passes the limited gate.
    const created = await request.post(`${API}/api/users`, {
        data: { name: 'E2E Newcomer', email: newcomer, username: `reqn${run}`, password: 'a-good-password-1', languages: ['English', 'Spanish'] },
    });
    expect(created.status()).toBe(201);
    expect(await userExists(newcomer)).toBe(true);
    expect(await hasInvite(newcomer)).toBe(false);
});

test('registration closed: the button is still there, a request is accepted, and Remove drops it with no list change', async ({ page }) => {
    await setAccessSettings('closed');

    await page.goto('/register');
    await expect(page.getByLabel(/^Name/)).toBeDisabled();
    await page.getByRole('link', { name: 'Request access' }).click();
    await submitRequest(page, refused);
    expect(await getAccessRequestKinds(refused)).toEqual(['registration']);

    await ownerSignIn(page, '/access');
    await expect(requestsCard(page)).toContainText('takes effect when the gate is limited');
    await requestRow(page, refused).getByRole('button', { name: `Remove the request from ${refused}` }).click();
    await expect(dialog(page)).toContainText('Nothing is added to a list');
    await dialog(page).getByRole('button', { name: 'Remove', exact: true }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole('status').first()).toContainText(`Removed the request from ${refused}.`);
    await expect(requestRow(page, refused)).toHaveCount(0);
    expect(await getAccessRequestKinds(refused)).toEqual([]);
    expect(await hasInvite(refused)).toBe(false);
});

test('login limited: the login page opens /request with the box ticked; the owner approves; the account signs in and gets the email button', async ({ page, request }) => {
    await setAccessSettings('open');
    await setLoginAccess('limited');
    // An account that is not allowed hears "not allowed" ONLY after a correct password.
    expect(((await (await login(request, member)).json()) as { code: string }).code).toBe('login_not_allowed');

    await page.goto('/login');
    await page.getByRole('link', { name: 'Request access' }).click();
    await expect(page).toHaveURL(/\/request\?account=true$/);
    await expect(page.getByRole('checkbox', { name: 'I already have an account' })).toBeChecked();
    await submitRequest(page, member);
    expect(await getAccessRequestKinds(member)).toEqual(['login']);
    expect(await hasLoginAllowed(member)).toBe(false);

    // A request with no account is never saved (the route answered 202 for it above), so the card has no "No account found" row here.
    await ownerSignIn(page, '/access?tab=login');
    const row = requestRow(page, member);
    await expect(row).toContainText('Learner member');
    await row.getByRole('button', { name: `Approve ${member}` }).click();
    await expect(dialog(page)).toContainText(`Allow ${member} to sign in`);
    await expect(dialog(page)).toContainText('does not send an email');
    await dialog(page).getByRole('button', { name: 'Approve', exact: true }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole('status').first()).toContainText(`Added ${member} to the allowed accounts.`);
    expect(await hasLoginAllowed(member)).toBe(true);
    expect(await getAccessRequestKinds(member)).toEqual([]);
    expect((await login(request, member)).status()).toBe(200);

    // The new button on the allowed accounts: a confirm, then the notice. (The mail provider is not checked here.)
    const allowedRow = page.getByRole('region', { name: /^Allowed accounts/ }).getByRole('row').filter({ hasText: member });
    await allowedRow.getByRole('button', { name: `Send email to ${member}` }).click();
    await expect(dialog(page)).toContainText(`Email ${member} to say that this account can sign in now`);
    await dialog(page).getByRole('button', { name: 'Send email', exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole('status').first()).toContainText(`Sign-in email sent to ${member}.`);
    await expect(allowedRow.getByRole('button', { name: `Send email to ${member}` })).toHaveText('Send again');
});

test('a request is refused while the gate is open, and the buttons are gone', async ({ page, request }) => {
    await setAccessSettings('open');
    await setLoginAccess('open');

    const res = await askApi(request, { email: closedAsker, hasAccount: false });
    expect(res.status()).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('access_not_needed');
    expect(await getAccessRequestKinds(closedAsker)).toEqual([]);

    await page.goto('/register');
    await expect(page.getByLabel(/^Name/)).toBeEnabled();
    await expect(page.getByRole('link', { name: 'Request access' })).toHaveCount(0);
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request access' })).toHaveCount(0);

    // The page itself says that a request is not needed, and keeps the button off.
    await page.goto('/request');
    await page.getByLabel('Email').fill(closedAsker);
    await expect(page.getByText(/This is open now/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request access', exact: true })).toBeDisabled();
});
