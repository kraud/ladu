import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail, getUserTheme, getVerifyToken } from '../fixtures/db';

/**
 * Phase 3.9 — dark mode, against the real stack
 * (`.context/plans/phase-3-9-dark-mode.md` Slice 6 gate).
 *
 *  1. The landing page's `?lng=&theme=` handoff: applied, saved, and removed
 *     from the address; other parameters stay.
 *  2. A theme chosen on the auth screen rides along with the login and lands
 *     on the user row.
 *  3. The header switch saves to the row; a fresh browser (OS light, no saved
 *     choice) that logs in without touching the theme gets the row's theme
 *     back — and does NOT overwrite it.
 *  4. With no saved choice the page follows the OS preference; a pressed switch
 *     beats it, also after a reload.
 *  5. The 404 page has its own switch that only lives on that page: nothing is
 *     saved, and it is gone after a reload (Slice 7).
 *  6. `<html lang>` follows the interface language, Estonian as `et` (Slice 7).
 *
 * The landing page itself (`landing/`) is a separate static site that this
 * suite does not serve; test 1 walks the link it produces.
 *
 * Runs against `keelapp_v2_dev`. Uses unique `e2e-*@ladu.test` emails and
 * deletes them in `afterAll`.
 */

const API = process.env.E2E_API_URL ?? 'http://localhost:5001';

const run = Date.now();
let seq = 0;
const createdEmails: string[] = [];

interface Account {
    name: string;
    username: string;
    email: string;
    password: string;
}

/** Registers + verifies a user directly via the API (no UI, no SMTP wait) — login still goes through the real form. */
async function registerAndVerify(request: APIRequestContext): Promise<Account> {
    const account: Account = {
        name: 'Theme Tester',
        username: `theme${run}${++seq}`,
        email: `e2e-${run}-${seq}@ladu.test`,
        password: 'password123',
    };
    createdEmails.push(account.email);

    const res = await request.post(`${API}/api/users`, {
        data: { ...account, languages: ['English', 'Spanish'], uiLanguage: 'English' },
    });
    expect(res.status()).toBe(201);

    const { userId, token } = await getVerifyToken(account.email);
    const verifyRes = await request.get(`${API}/api/users/${userId}/verify/${token}`);
    expect(verifyRes.ok()).toBeTruthy();
    return account;
}

const html = (page: Page) => page.locator('html');

async function signIn(page: Page, account: Account): Promise<void> {
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /Welcome, Theme Tester/ })).toBeVisible();
}

/** A browser profile of its own — no shared storage, like a second device. */
async function freshPage(browser: Browser, colorScheme: 'light' | 'dark' = 'light'): Promise<Page> {
    const context = await browser.newContext({ colorScheme });
    return context.newPage();
}

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

test.describe('Phase 3.9 — dark mode', () => {
    test('the landing handoff (?lng=&theme=) is applied, saved and removed from the address', async ({ page }) => {
        await page.goto('/login?lng=es&theme=dark');

        await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
        await expect(html(page)).toHaveAttribute('data-theme', 'dark');
        await expect(page).toHaveURL(/\/login$/); // no query string left

        // Saved: a reload without the parameters keeps both.
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
        await expect(html(page)).toHaveAttribute('data-theme', 'dark');

        // Other parameters survive; an address value beats the saved choice.
        await page.goto('/login?redirect=%2Freview&lng=de&theme=light');
        await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
        await expect(html(page)).toHaveAttribute('data-theme', 'light');
        await expect(page).toHaveURL(/\/login\?redirect=%2Freview$/);

        // A protected address from the landing page: the guard's redirect keeps
        // only its own parameter.
        await page.goto('/?lng=ee&theme=dark');
        await expect(page).toHaveURL(/\/login\?redirect=%2F$/);
        await expect(page.getByRole('heading', { name: 'Logi sisse' })).toBeVisible();
        await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    });

    test('a theme chosen on the auth screen rides along with the login and lands on the row', async ({ page, request }) => {
        const account = await registerAndVerify(request);
        expect(await getUserTheme(account.email)).toBeNull();

        await page.goto('/login');
        await page.getByRole('button', { name: 'Switch to dark theme' }).click();
        await expect(html(page)).toHaveAttribute('data-theme', 'dark');

        await signIn(page, account);

        await expect(html(page)).toHaveAttribute('data-theme', 'dark');
        await expect.poll(() => getUserTheme(account.email)).toBe('dark');
        // The header switch now offers the other theme.
        await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
    });

    test('the header switch saves to the row; a fresh browser gets it back without overwriting it', async ({ page, browser, request }) => {
        const account = await registerAndVerify(request);

        // Device A — OS light, no choice made: the login leaves the row empty.
        await page.goto('/login');
        await signIn(page, account);
        await expect(html(page)).toHaveAttribute('data-theme', 'light');
        expect(await getUserTheme(account.email)).toBeNull();

        await page.getByRole('button', { name: 'Switch to dark theme' }).click();
        await expect(html(page)).toHaveAttribute('data-theme', 'dark');
        await expect.poll(() => getUserTheme(account.email)).toBe('dark');
        // Save finished: the switch is usable again.
        await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeEnabled();

        // Device B — a fresh profile, OS light, never touched the theme.
        const deviceB = await freshPage(browser);
        await deviceB.goto('/login');
        await expect(html(deviceB)).toHaveAttribute('data-theme', 'light'); // start value, before the row is known
        await signIn(deviceB, account);

        await expect(html(deviceB)).toHaveAttribute('data-theme', 'dark'); // the row wins
        expect(await getUserTheme(account.email)).toBe('dark'); // and was not overwritten by the login
        await deviceB.reload();
        await expect(html(deviceB)).toHaveAttribute('data-theme', 'dark'); // saved in the browser too

        // Switching back on device B is saved to the row again.
        await deviceB.getByRole('button', { name: 'Switch to light theme' }).click();
        await expect(html(deviceB)).toHaveAttribute('data-theme', 'light');
        await expect.poll(() => getUserTheme(account.email)).toBe('light');

        await deviceB.context().close();
    });

    test('with no saved choice the page follows the OS; a pressed switch beats it, also after a reload', async ({ browser }) => {
        const dark = await freshPage(browser, 'dark');
        await dark.goto('/login');
        await expect(html(dark)).toHaveAttribute('data-theme', 'dark');
        expect(await dark.evaluate(() => localStorage.getItem('ladu.theme'))).toBeNull(); // the OS value is not saved

        await dark.getByRole('button', { name: 'Switch to light theme' }).click();
        await expect(html(dark)).toHaveAttribute('data-theme', 'light');
        await dark.reload();
        await expect(html(dark)).toHaveAttribute('data-theme', 'light'); // saved choice beats the OS
        expect(await dark.evaluate(() => localStorage.getItem('ladu.theme'))).toBe('light');
        await dark.context().close();

        const light = await freshPage(browser, 'light');
        await light.goto('/login');
        await expect(html(light)).toHaveAttribute('data-theme', 'light');
        await expect(light.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
        await light.context().close();
    });

    test('the 404 page switch changes only that page: nothing is saved and a reload resets it', async ({ page }) => {
        await page.goto('/no-such-page');
        await expect(page.getByText('404')).toBeVisible();
        await expect(html(page)).toHaveAttribute('data-theme', 'light');
        await expect(page.getByRole('button', { name: /interface language/i })).toHaveCount(0);

        await page.getByRole('button', { name: 'Switch to dark theme' }).click();
        await expect(html(page)).toHaveAttribute('data-theme', 'dark');
        expect(await page.evaluate(() => localStorage.getItem('ladu.theme'))).toBeNull();

        await page.reload();
        await expect(html(page)).toHaveAttribute('data-theme', 'light');
    });

    test('<html lang> follows the interface language, with Estonian as "et"', async ({ page }) => {
        await page.goto('/login?lng=ee');
        await expect(page.getByRole('heading', { name: 'Logi sisse' })).toBeVisible();
        await expect(html(page)).toHaveAttribute('lang', 'et');

        await page.getByRole('button', { name: /Liidese keel/i }).click();
        await page.getByRole('menuitem', { name: 'Español' }).click();
        await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
        await expect(html(page)).toHaveAttribute('lang', 'es');

        await page.reload();
        await expect(html(page)).toHaveAttribute('lang', 'es');
    });
});
