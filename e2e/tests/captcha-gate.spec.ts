import { test, expect, type Page } from '@playwright/test';
import {
    closePool,
    countResetTokens,
    deleteDemoSessions,
    deleteUsersByEmail,
    resetDemoSettings,
    seedUser,
    setCaptchaEnabled,
    setDemoEnabled,
    userExists,
} from '../fixtures/db';

/**
 * The Turnstile captcha, Slice 3 — the three protected forms against the real backend + Postgres + the
 * learner app (.context/plans/captcha.md).
 *
 * The backend runs with Cloudflare's TEST keys (`playwright.config.ts`): the widget always passes, and so
 * does the server check. So the spec needs internet (the widget script and `siteverify` are Cloudflare's).
 * With the switch on, the demo start, the sign-up and the password-reset request each show the widget, keep
 * their button off until the token arrives, and then work. A direct API call with no token is refused with
 * 400 `captcha_failed`, and nothing is written. With the switch off again, the widget is gone.
 *
 * It turns the captcha switch on, which is the global `access_settings` row, so it is a `-gate` spec (its
 * own Playwright project, after every other spec). `fixtures/global-setup.ts` turns the switch off at the
 * start of every run, and `afterAll` puts it back off.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5001';
const run = Date.now();
const PASSWORD = 'a-good-password-1';
const resetEmail = `e2e-captcha-${run}-reset@ladu.test`;
const signupEmail = `e2e-captcha-${run}-signup@ladu.test`;
const blockedEmail = `e2e-captcha-${run}-blocked@ladu.test`;
/** The widget takes a moment to load and run its check. */
const WIDGET_TIMEOUT = 30_000;

let resetUserId = '';
/** The demo accounts this spec started, removed in `afterAll`. */
const demoIds: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
    // A run that was killed may have left a switch on.
    await setCaptchaEnabled(false);
    await resetDemoSettings();
    ({ userId: resetUserId } = await seedUser(resetEmail, {
        name: 'E2E Captcha',
        username: `e2ecaptcha${run}`,
        learnerPassword: PASSWORD,
        languages: ['English', 'Spanish'],
    }));
    await setDemoEnabled(true);
    await setCaptchaEnabled(true);
});

test.afterAll(async () => {
    await setCaptchaEnabled(false);
    await resetDemoSettings();
    await deleteDemoSessions(demoIds);
    await deleteUsersByEmail([resetEmail, signupEmail, blockedEmail]);
    await closePool();
});

/**
 * The box the app draws the widget into. Turnstile puts its iframe in a closed shadow root, which a test cannot
 * enter, so the box counts as "visible" (Playwright needs a non-empty size) once the widget has drawn itself.
 */
const widget = (page: Page) => page.getByTestId('captcha-widget');

test('the public access answer carries the site key while the switch is on', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/access`);
    expect((await res.json()).captcha).toEqual({ enabled: true, siteKey: '1x00000000000000000000AA' });
});

test('a visitor passes the check and starts a demo', async ({ page }) => {
    await page.goto('/demo');
    await page.getByRole('button', { name: 'Get started' }).click();
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.getByRole('button', { name: 'Español', exact: true }).click();

    await expect(widget(page)).toBeVisible({ timeout: WIDGET_TIMEOUT });
    // Start waits for the token; the test key passes by itself.
    const start = page.getByRole('button', { name: 'Start', exact: true });
    await expect(start).toBeEnabled({ timeout: WIDGET_TIMEOUT });
    await start.click();

    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page.getByRole('link', { name: /^Demo: \d+:\d\d left/ })).toBeVisible();
    const id = await page.evaluate(() => {
        const raw = localStorage.getItem('ladu.session');
        return raw ? (JSON.parse(raw).state?.user?.id as string | undefined) : undefined;
    });
    if (id) demoIds.push(id);
    expect(id).toBeTruthy();
});

test('a visitor passes the check and signs up', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(/^Name/).fill('E2E Captcha Signup');
    await page.getByLabel(/^Username/).fill(`e2ecaptchasu${run}`);
    await page.getByLabel(/^Email/).fill(signupEmail);
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByLabel(/^Confirm password/).fill(PASSWORD);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'English', pressed: false }).click();
    await page.getByRole('button', { name: 'Español', pressed: false }).click();

    await expect(widget(page)).toBeVisible({ timeout: WIDGET_TIMEOUT });
    const create = page.getByRole('button', { name: 'Create account' });
    await expect(create).toBeEnabled({ timeout: WIDGET_TIMEOUT });
    await create.click();

    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    expect(await userExists(signupEmail)).toBe(true);
});

test('a visitor passes the check and asks for a password reset', async ({ page }) => {
    expect(await countResetTokens(resetUserId)).toBe(0);
    await page.goto('/resetPassword');
    await page.getByLabel('Email').fill(resetEmail);

    await expect(widget(page)).toBeVisible({ timeout: WIDGET_TIMEOUT });
    const send = page.getByRole('button', { name: 'Send reset link' });
    await expect(send).toBeEnabled({ timeout: WIDGET_TIMEOUT });
    await send.click();

    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect.poll(() => countResetTokens(resetUserId)).toBe(1);
});

test('a direct API call with no token is refused, and nothing is written', async ({ request }) => {
    const demo = await request.post(`${API_URL}/api/demo`, { data: {} });
    expect(demo.status()).toBe(400);
    expect((await demo.json()).code).toBe('captcha_failed');

    const signup = await request.post(`${API_URL}/api/users`, {
        data: {
            name: 'E2E Blocked',
            username: `e2eblocked${run}`,
            email: blockedEmail,
            password: PASSWORD,
            languages: ['English', 'Spanish'],
        },
    });
    expect(signup.status()).toBe(400);
    expect((await signup.json()).code).toBe('captcha_failed');
    expect(await userExists(blockedEmail)).toBe(false);

    const before = await countResetTokens(resetUserId);
    const reset = await request.post(`${API_URL}/api/users/requestPasswordReset`, { data: { email: resetEmail } });
    expect(reset.status()).toBe(400);
    expect((await reset.json()).code).toBe('captcha_failed');
    expect(await countResetTokens(resetUserId)).toBe(before);
});

test('with the switch off, the forms have no widget', async ({ page }) => {
    await setCaptchaEnabled(false);
    await page.goto('/resetPassword');
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
    await expect(page.getByTestId('captcha-widget')).toHaveCount(0);
});
