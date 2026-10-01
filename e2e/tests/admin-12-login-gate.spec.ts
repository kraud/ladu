import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
    closePool,
    createStaffAccount,
    deleteAccessTestData,
    deleteStaffByEmail,
    deleteUsersByEmail,
    getAuditByReason,
    getAuditForUser,
    getLoginSettings,
    getTokenVersion,
    getVerifyToken,
    hasLoginAllowed,
    isVerified,
    seedUser,
    setAccessSettings,
    setLoginAccess,
} from '../fixtures/db';

/**
 * Access gates, PR 2 — the login gate and the "sign everyone out" button, against the real backend +
 * Postgres + the `admin/` UI + the learner app, with REAL learner sessions on the learner API.
 *
 * The owner sets the state from the admin page (closed → limited → open), and after each change the
 * spec tries a real `POST /api/users/login`: `closed` refuses the password login (403, code),
 * `limited` lets in only the listed account (and the other one hears `login_not_allowed` ONLY after a
 * correct password), the allowed list is changed by paste, by ticks in the users table and by the user
 * page, the panic button makes an old token fail with 401 while staff stay signed in, and `open`
 * restores everything. An open session keeps working while a gate is closed.
 *
 * The gates are global state, so this spec runs in its own Playwright project, after every other spec and
 * after the other `*-gate.spec.ts` specs (`playwright.config.ts` chains them). `afterAll` always puts both
 * gates back to open.
 *
 * NOTE: the panic button raises `token_version` for EVERY account in the dev database, so it also ends
 * the sessions of any real dev account. That is harmless (sign in again), but a browser session you had
 * open on the dev stack will go back to the login page.
 *
 * Uses unique `e2e-admin12-*` emails and removes them in `afterAll`.
 */

const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174';
const API = process.env.E2E_API_URL ?? 'http://localhost:5001';

const run = Date.now();
const STAFF_PASSWORD = 'e2e-staff-password';
const LEARNER_PASSWORD = 'e2e-learner-password';
const staffEmail = (role: string) => `e2e-admin12-${run}-${role}@ladu.test`;
const learnerEmail = (key: string) => `e2e-admin12-${run}-${key}@ladu.test`;
const staffRoles = ['owner', 'support'];
const seeded = ['allowed', 'other'];
const newcomer = learnerEmail('newcomer');
const allLearners = [...seeded.map(learnerEmail), newcomer];
const ids: Record<string, string> = {};
const PANIC_REASON = `e2e panic ${run}`;

// Old sessions, taken while the gate allowed them, to check what a closed gate and the panic button do to them.
const tokens: Record<string, string> = {};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
    // A run that was killed may have left a gate shut.
    await setAccessSettings('open');
    await setLoginAccess('open');
    for (const role of staffRoles) await createStaffAccount(staffEmail(role), role, STAFF_PASSWORD);
    for (const key of seeded) {
        const { userId } = await seedUser(learnerEmail(key), { name: `Learner ${key}`, username: `l12${key}${run}`, learnerPassword: LEARNER_PASSWORD });
        ids[key] = userId;
    }
});

test.afterAll(async () => {
    await setAccessSettings('open');
    await setLoginAccess('open');
    // The allowed list goes with the accounts (a cascade).
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

const login = (request: APIRequestContext, email: string, password = LEARNER_PASSWORD) =>
    request.post(`${API}/api/users/login`, { data: { email, password } });

async function sessionToken(request: APIRequestContext, key: string): Promise<string> {
    const res = await login(request, learnerEmail(key));
    expect(res.status()).toBe(200);
    return ((await res.json()) as { token: string }).token;
}

const meStatus = async (request: APIRequestContext, token: string) =>
    (await request.get(`${API}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })).status();

// The page has a Registration tab and a Login tab that share labels and button names, so each query is scoped.
const loginCard = (page: Page) => page.getByRole('region', { name: 'Login', exact: true });
const allowedCard = (page: Page) => page.getByRole('region', { name: /Allowed accounts/ });
const signOutCard = (page: Page) => page.getByRole('region', { name: 'Sign everyone out', exact: true });

/** Picks a login state on the admin page and confirms. The notice names the new state. */
async function setLoginState(page: Page, label: 'Open' | 'Closed' | 'Limited', opts: { note?: string; reason?: string } = {}) {
    await loginCard(page).getByRole('group', { name: 'Login' }).getByRole('button', { name: label, exact: true }).click();
    if (opts.note !== undefined) await loginCard(page).getByLabel(/Extra line/).fill(opts.note);
    await loginCard(page).getByRole('button', { name: 'Save', exact: true }).click();
    const dialog = page.getByRole('dialog');
    if (opts.reason) await dialog.getByLabel(/Reason/).fill(opts.reason);
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('status').first()).toContainText(`Login is now ${label.toLowerCase()}.`);
}

const row = (page: Page, text: string) => page.getByRole('row').filter({ hasText: text });

test('only an owner sees the login controls: the users list of a support person has no ticks, column or filter', async ({ page }) => {
    await staffSignIn(page, 'support', '/users');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Access' })).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Login allowed' })).toHaveCount(0);
    await expect(page.getByLabel('Login allowed')).toHaveCount(0);
});

test('closed: every new sign-in is refused, an open session keeps working, staff are not blocked, and the learner page turns the form off', async ({ page, request }) => {
    // An open session, taken before the gate closes.
    tokens.allowed = await sessionToken(request, 'allowed');

    await staffSignIn(page, 'owner', '/access?tab=login');
    await expect(loginCard(page)).toBeVisible();
    await setLoginState(page, 'Closed', { note: 'E2E login note', reason: 'e2e closed' });
    expect(await getLoginSettings()).toEqual({ mode: 'closed', note: 'E2E login note' });

    // A correct password is refused with a code, and no token is given.
    const refused = await login(request, learnerEmail('allowed'));
    expect(refused.status()).toBe(403);
    const body = (await refused.json()) as { code?: string; token?: string };
    expect(body.code).toBe('login_closed');
    expect(body.token).toBeUndefined();

    // A wrong password still says "Invalid credentials", with no code: the gate never confirms an account.
    const wrong = await login(request, learnerEmail('allowed'), 'not-the-password');
    expect(wrong.status()).toBe(400);
    expect(await wrong.json()).toEqual({ message: 'Invalid credentials' });
    const unknown = await login(request, `nobody-${run}@ladu.test`);
    expect(unknown.status()).toBe(400);

    // The open session keeps working. Staff are not blocked.
    expect(await meStatus(request, tokens.allowed)).toBe(200);
    const staff = await request.post(`${API}/api/admin/auth/login`, { data: { email: staffEmail('support'), password: STAFF_PASSWORD } });
    expect(staff.status()).toBe(200);

    // The learner pages: the login form and the Google button are off, with the banner and the owner's line.
    await page.goto('/login');
    await expect(page.getByRole('status')).toContainText('Sign-in is closed for now. Please check back later.');
    await expect(page.getByRole('status')).toContainText('E2E login note');
    await expect(page.getByLabel('Email')).toBeDisabled();
    await expect(page.getByLabel('Password')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();

    // The two gates are separate: the register page stays usable.
    await page.goto('/register');
    await expect(page.getByLabel(/^Name/)).toBeEnabled();
});

test('limited: the owner sees the empty-list warning and adds an account by paste, and only that account signs in', async ({ page, request }) => {
    await staffSignIn(page, 'owner', '/access?tab=login');
    await loginCard(page).getByRole('group', { name: 'Login' }).getByRole('button', { name: 'Limited', exact: true }).click();
    await expect(loginCard(page).getByRole('alert')).toContainText('the allowed list is empty, so nobody can sign in');
    await loginCard(page).getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('dialog').getByLabel(/Reason/).fill('e2e limited');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByRole('status').first()).toContainText('Login is now limited.');
    expect((await getLoginSettings()).mode).toBe('limited');

    // Nobody is listed yet.
    expect(((await (await login(request, learnerEmail('allowed'))).json()) as { code: string }).code).toBe('login_not_allowed');

    // Paste: one account (in capitals), one email that has no account.
    await allowedCard(page).getByLabel('Add accounts by email').fill(`${learnerEmail('allowed').toUpperCase()}\nnobody-${run}@ladu.test`);
    await allowedCard(page).getByRole('button', { name: 'Add to the allowed list' }).click();
    const summary = page.getByRole('status', { name: 'Result of the last allow' });
    await expect(summary).toContainText('Added 1. Skipped 1.');
    await expect(summary).toContainText(`nobody-${run}@ladu.test: no account with this email or id`);
    await expect(allowedCard(page).getByRole('table')).toContainText('Learner allowed');
    expect(await hasLoginAllowed(learnerEmail('allowed'))).toBe(true);
    const audit = (await getAuditForUser(ids.allowed)).filter((a) => a.action === 'access.login_allow');
    expect(audit).toHaveLength(1);

    // The listed account signs in at once. The other hears "not allowed" ONLY after a correct password.
    const ok = await login(request, learnerEmail('allowed'));
    expect(ok.status()).toBe(200);
    expect(((await ok.json()) as { token?: string }).token).toBeTruthy();
    const notAllowed = await login(request, learnerEmail('other'));
    expect(notAllowed.status()).toBe(403);
    expect(((await notAllowed.json()) as { code: string }).code).toBe('login_not_allowed');
    const wrong = await login(request, learnerEmail('other'), 'not-the-password');
    expect(wrong.status()).toBe(400);
    expect(await wrong.json()).toEqual({ message: 'Invalid credentials' });

    // The learner page shows the limited note and keeps the form on (the server decides by account).
    await page.goto('/login');
    await expect(page.getByRole('status')).toContainText('Sign-in is limited right now. Only some accounts can sign in.');
    await expect(page.getByLabel('Email')).toBeEnabled();
});

test('registration open and login limited: a new account is made and its email link verifies it, but there is no session', async ({ page, request }) => {
    const created = await request.post(`${API}/api/users`, {
        data: { name: 'E2E Newcomer', email: newcomer, username: `e12n${run}`, password: LEARNER_PASSWORD, languages: ['English', 'Spanish'] },
    });
    expect(created.status()).toBe(201);
    const { userId, token } = await getVerifyToken(newcomer);

    // The real link, in the learner app: verified, but no countdown and no session.
    await page.goto(`/user/${userId}/verify/${token}`);
    await expect(page.getByText('Validated successfully!')).toBeVisible();
    await expect(page.getByText('Your email is verified. Sign-in is not open to this account right now. Please check back later.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enter now' })).toHaveCount(0);
    expect(await isVerified(newcomer)).toBe(true);
    // No session was written: the browser holds no token.
    expect(await page.evaluate(() => Object.keys(localStorage).some((k) => /auth|token|session/i.test(k) && /"token":"?[A-Za-z0-9._-]{20,}/.test(localStorage.getItem(k) ?? '')))).toBe(false);

    const refused = await login(request, newcomer);
    expect(refused.status()).toBe(403);
    expect(((await refused.json()) as { code: string }).code).toBe('login_not_allowed');
});

test('the users list: tick an account to allow it, filter by it, and remove it with the bar; the user page does the same', async ({ page, request }) => {
    await staffSignIn(page, 'owner', `/users?q=${encodeURIComponent(`e2e-admin12-${run}`)}`);
    await expect(page.getByRole('link', { name: 'Learner other' })).toBeVisible();
    await expect(row(page, 'Learner allowed')).toContainText('Yes');
    await expect(row(page, 'Learner other')).toContainText('No');

    // Tick "other" and allow it.
    await page.getByRole('checkbox', { name: 'Select Learner other' }).check();
    await expect(page.getByRole('toolbar', { name: 'Selected users' })).toContainText('1 selected:');
    await page.getByRole('button', { name: 'Allow to sign in', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Allowed 1 to sign in.');
    await expect(row(page, 'Learner other')).toContainText('Yes');
    expect(await hasLoginAllowed(learnerEmail('other'))).toBe(true);
    // A new session for "other", taken while it is allowed: it will outlive the allowed list.
    tokens.other = await sessionToken(request, 'other');

    // The filter: only the accounts that are NOT on the list (the newcomer).
    await page.getByLabel('Login allowed').selectOption('false');
    await expect(page.getByRole('link', { name: 'E2E Newcomer' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Learner other' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Learner allowed' })).toHaveCount(0);
    await page.getByLabel('Login allowed').selectOption('true');
    await expect(page.getByRole('link', { name: 'Learner other' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'E2E Newcomer' })).toHaveCount(0);
    await page.getByLabel('Login allowed').selectOption('');

    // Tick "other" again and remove it: its new sign-ins are refused, its open session still works.
    await page.getByRole('checkbox', { name: 'Select Learner other' }).check();
    await page.getByRole('button', { name: 'Remove from allowed', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Removed 1 from the allowed list.');
    await expect(row(page, 'Learner other')).toContainText('No');
    expect(await hasLoginAllowed(learnerEmail('other'))).toBe(false);
    expect(((await (await login(request, learnerEmail('other'))).json()) as { code: string }).code).toBe('login_not_allowed');
    expect(await meStatus(request, tokens.other)).toBe(200);

    // The user page: allow, then remove, with a button.
    await page.getByRole('link', { name: 'Learner other' }).click();
    // A plain <section> on the user page: found through its heading.
    const section = page.locator('section', { has: page.getByRole('heading', { name: 'Sign-in access' }) });
    await expect(section).toContainText('No');
    await section.getByRole('button', { name: 'Allow to sign in' }).click();
    await expect(section.getByRole('status')).toContainText('This account can now sign in while login is limited.');
    await expect(section.getByRole('button', { name: 'Remove from the allowed list' })).toBeVisible();
    expect((await login(request, learnerEmail('other'))).status()).toBe(200);
    await section.getByRole('button', { name: 'Remove from the allowed list' }).click();
    await expect(section.getByRole('status')).toContainText('This account was removed from the allowed list.');
    expect((await login(request, learnerEmail('other'))).status()).toBe(403);
});

test('the panic button: old sessions end at the next request, staff stay signed in, and only an allowed account signs back in', async ({ page, request }) => {
    expect(await meStatus(request, tokens.allowed)).toBe(200);
    expect(await meStatus(request, tokens.other)).toBe(200);
    const before = await getTokenVersion(learnerEmail('allowed'));

    await staffSignIn(page, 'owner', '/access?tab=login');
    await expect(signOutCard(page)).toBeVisible();
    await signOutCard(page).getByRole('button', { name: 'Sign everyone out…' }).click();
    const dialog = page.getByRole('dialog');
    const submit = dialog.getByRole('button', { name: 'Sign everyone out', exact: true });
    // The button stays off until there is a reason and the exact phrase.
    await expect(submit).toBeDisabled();
    await dialog.getByLabel(/Type/).fill('SIGN OUT EVERYONE');
    await expect(submit).toBeDisabled();
    await dialog.getByLabel(/Reason/).fill(PANIC_REASON);
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(dialog).toHaveCount(0);

    // "N users were signed out": every account in the dev database, so at least ours.
    const notice = page.getByRole('status').first();
    await expect(notice).toContainText(/\d+ users? (was|were) signed out\./);
    const count = Number(((await notice.textContent()) ?? '').match(/(\d+) user/)?.[1]);
    expect(count).toBeGreaterThanOrEqual(3);
    expect(await getTokenVersion(learnerEmail('allowed'))).toBe(before + 1);

    // The audit row has the reason and the count, and nothing else.
    const audit = await getAuditByReason('access.sign_out_everyone', PANIC_REASON);
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata).toEqual({ count });

    // Every old learner token fails with 401 at its next request.
    expect(await meStatus(request, tokens.allowed)).toBe(401);
    expect(await meStatus(request, tokens.other)).toBe(401);

    // Staff are not affected: the owner's page still works after a reload.
    await page.reload();
    await expect(signOutCard(page)).toBeVisible();

    // Login is limited: the allowed account signs back in and gets a working session; the other does not.
    const again = await login(request, learnerEmail('allowed'));
    expect(again.status()).toBe(200);
    const fresh = ((await again.json()) as { token: string }).token;
    expect(await meStatus(request, fresh)).toBe(200);
    expect(((await (await login(request, learnerEmail('other'))).json()) as { code: string }).code).toBe('login_not_allowed');
});

test('open: the owner reopens login, everything works again, and the allowed list stays', async ({ page, request }) => {
    expect((await getLoginSettings()).mode).toBe('limited');
    await staffSignIn(page, 'owner', '/access?tab=login');
    await setLoginState(page, 'Open', { reason: 'e2e reopen' });
    expect((await getLoginSettings()).mode).toBe('open');

    // Everyone with an account can sign in again, listed or not.
    expect((await login(request, learnerEmail('other'))).status()).toBe(200);
    expect((await login(request, learnerEmail('allowed'))).status()).toBe(200);
    // The list is kept for the next time login is limited.
    expect(await hasLoginAllowed(learnerEmail('allowed'))).toBe(true);

    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeEnabled();
    await expect(page.getByRole('status')).toHaveCount(0);
});
