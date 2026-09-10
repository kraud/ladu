import { test, expect } from '@playwright/test';
import { closePool, deleteUsersByEmail, getVerifyToken } from '../fixtures/db';

/**
 * Phase 1 — auth + app shell, vertical slice against the real stack
 * (`.context/.frontend/new-repo-build-plan.md` §5 gate).
 *
 * register (with the >= 2-language picker) -> verify via the DB token ->
 * land on Home -> log out -> log in through the form; plus decision-1
 * (unverified is blocked), the protected-route guard, and the public
 * UI-language selector persisting across reload and into the session.
 *
 * Runs against `keelapp_v2_dev`. Each run uses unique `e2e-*@ladu.test`
 * emails and deletes them in `afterAll`.
 */

const API = process.env.E2E_API_URL ?? 'http://localhost:5001';

const run = Date.now();
let seq = 0;
const uniqueEmail = () => `e2e-${run}-${++seq}@ladu.test`;
const createdEmails: string[] = [];

/** Unsigned JWT — only `exp` is read (by `lib/jwt.ts` / the route guard). */
function jwtWithExp(expSeconds: number): string {
    const b64 = (o: unknown) =>
        Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp: expSeconds })}.sig`;
}

/** Primary account — registered + verified in the first test, reused in the last. */
let primary: { name: string; username: string; email: string; password: string };

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

test.describe.serial('Phase 1 — auth + app shell', () => {
    test('register -> verify -> Home -> logout -> form login', async ({ page }) => {
        // The register request makes a real (error-swallowed) SMTP call.
        test.setTimeout(60_000);

        const email = uniqueEmail();
        createdEmails.push(email);
        primary = { name: 'Kai Rebane', username: `kai${run}${seq}`, email, password: 'password123' };

        await page.goto('/register');
        await page.getByLabel(/^Name/).fill(primary.name);
        await page.getByLabel(/^Username/).fill(primary.username);
        await page.getByLabel(/^Email/).fill(primary.email);
        await page.getByLabel(/^Password/).fill(primary.password);
        await page.getByLabel(/^Confirm password/).fill(primary.password);

        const submit = page.getByRole('button', { name: 'Create account' });
        await expect(submit).toBeDisabled();
        await page.getByRole('button', { name: 'English' }).click();
        await expect(submit).toBeDisabled(); // one language is not enough
        await page.getByRole('button', { name: 'Español' }).click();
        await expect(submit).toBeEnabled();
        await submit.click();

        await expect(page).toHaveURL(/\/login/);
        await expect(page.getByText(primary.email)).toBeVisible();

        // Verify via the emailed link — token read straight from `tokens`.
        const { userId, token } = await getVerifyToken(primary.email);
        await page.goto(`/user/${userId}/verify/${token}`);
        await expect(page.getByText('Validated successfully!')).toBeVisible();
        await page.getByRole('button', { name: 'Enter now' }).click();

        await expect(page).toHaveURL('/');
        await expect(page.getByRole('heading', { name: /Welcome, Kai Rebane/ })).toBeVisible();
        await expect(page.getByRole('link', { name: 'add word' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'review' })).toBeVisible();

        // Log out via the user menu.
        await page.getByRole('button', { name: 'Open settings' }).click();
        await page.getByRole('menuitem', { name: 'Logout' }).click();
        await expect(page).toHaveURL(/\/login/);

        // Log in again through the real form against the now-verified row.
        await page.getByLabel('Email').fill(primary.email);
        await page.getByLabel('Password').fill(primary.password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page.getByRole('heading', { name: /Welcome, Kai Rebane/ })).toBeVisible();
    });

    test('decision 1 — an unverified account cannot sign in', async ({ page, request }) => {
        const email = uniqueEmail();
        createdEmails.push(email);

        const res = await request.post(`${API}/api/users`, {
            data: {
                name: 'Unver Ified',
                username: `unver${run}${seq}`,
                email,
                password: 'password123',
                languages: ['English', 'Spanish'],
                uiLanguage: 'English',
            },
        });
        expect(res.status()).toBe(201);

        await page.goto('/login');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').fill('password123');
        await page.getByRole('button', { name: 'Sign in' }).click();

        await expect(
            page.getByText('You need to verify your account before signing in.'),
        ).toBeVisible();
        await expect(page).toHaveURL(/\/login/);
    });

    test('protected routes require a valid session', async ({ page }) => {
        // No session at all.
        await page.goto('/');
        await expect(page).toHaveURL(/\/login/);

        await page.goto('/review');
        await expect(page).toHaveURL(/\/login\?.*redirect=/);

        // A persisted but expired session is discarded, then the guard redirects.
        await page.addInitScript((token) => {
            localStorage.setItem(
                'ladu.session',
                JSON.stringify({
                    state: {
                        user: {
                            id: 'expired-user',
                            name: 'Expired',
                            email: 'expired@ladu.test',
                            username: 'expired',
                            languages: ['English', 'Spanish'],
                            uiLanguage: 'English',
                            nativeLanguage: null,
                            verified: true,
                        },
                        token,
                    },
                    version: 0,
                }),
            );
        }, jwtWithExp(Math.floor(Date.now() / 1000) - 3600));

        await page.goto('/');
        await expect(page).toHaveURL(/\/login/);
    });

    test('a UI language chosen on a public route persists across reload and into the session', async ({
        page,
    }) => {
        await page.goto('/login');

        await page.getByRole('button', { name: /interface language/i }).click();
        await page.getByRole('menuitem', { name: 'Español' }).click();
        await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

        await page.reload();
        await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

        // Sign in — the choice rode along on the login request and is now on the row.
        await page.getByLabel(/correo electrónico/i).fill(primary.email);
        await page.getByLabel(/contraseña/i).fill(primary.password);
        await page.getByRole('button', { name: /iniciar sesión/i }).click();

        await expect(page.getByRole('heading', { name: /Bienvenido, Kai Rebane/ })).toBeVisible();
        await expect(
            page.getByRole('button', { name: /idioma de la interfaz/i }),
        ).toContainText('ES');
    });
});
