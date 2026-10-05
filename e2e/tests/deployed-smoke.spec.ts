import { test, expect } from '@playwright/test';

/**
 * Post-deploy smoke test — runs in `deploy.yml`'s `smoke` job, between the
 * `staging` deploy job and (once it exists) `production`, against a real
 * deployed environment (`playwright.deploy.config.ts`, no local servers, no
 * DB access — see that file's own comment).
 *
 * `/api/health` reports the SHA just deployed -> log in with the persistent
 * smoke account -> dashboard loads -> create a word through the real form
 * -> delete it through the real UI. Cleans up after itself since there is
 * no DB fixture to do it for us (`.dev-context/deployment-strategy.md` §3).
 *
 * A second describe block checks the Google sign-in wiring without logging
 * in: `/api/auth/google/start` must send Google our real client ID and
 * registered redirect URI, and Google must show its sign-in page for them
 * (not its `/signin/oauth/error` page). That is the one piece of the OAuth
 * setup only Google can confirm — the stub-based specs cannot. See
 * `.dev-context/oauth-backlog-plan.md` Slice B for why it stops short of a
 * full login.
 *
 * Requires BASE_URL, SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD, EXPECTED_SHA,
 * GOOGLE_CLIENT_ID — see playwright.deploy.config.ts.
 */

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not set — required by deployed-smoke.spec.ts`);
    }
    return value;
}

const SMOKE_EMAIL = requireEnv('SMOKE_TEST_EMAIL');
const SMOKE_PASSWORD = requireEnv('SMOKE_TEST_PASSWORD');
const EXPECTED_SHA = requireEnv('EXPECTED_SHA');
const GOOGLE_CLIENT_ID = requireEnv('GOOGLE_CLIENT_ID');

const GOOGLE_ERROR_PATH = '/signin/oauth/error';

/**
 * Google's error page carries the reason in `?authError=`, a base64url
 * protobuf whose first field is the error code (e.g. `redirect_uri_mismatch`,
 * `invalid_client`). Used only to make a failure message readable — never to
 * decide pass/fail, since the page text itself is localized.
 */
function googleErrorReason(url: URL): string {
    try {
        const bytes = Buffer.from(url.searchParams.get('authError') ?? '', 'base64url');
        return bytes.subarray(2, 2 + bytes[1]).toString() || 'unknown';
    } catch {
        return 'unknown';
    }
}

test.describe.serial('Post-deploy smoke', () => {
    test('/api/health reports the deployed SHA', async ({ request, baseURL }) => {
        const res = await request.get(`${baseURL}/api/health`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.status).toBe('ok');
        expect(body.sha).toBe(EXPECTED_SHA);
    });

    // The login gate (`.context/plans/access-gates.md`) can stop the smoke account
    // before the flow below starts: the account is a learner, and the server refuses a
    // learner's sign-in while login is `closed` (nobody) or `limited` (only the accounts
    // on its list). Staff are exempt, so the admin panel keeps working and a closed gate
    // is easy to forget. Without this check, the next test fails on a missing "Welcome"
    // heading, which reads like a broken deploy. `GET /api/access` is public.
    //
    // Only `closed` can be judged from here: the public answer carries no allowed list,
    // so a `limited` gate may still let the smoke account in. That case is annotated, and
    // the login test adds the gate state to its own failure message.
    test('the login gate is open', async ({ request, baseURL }) => {
        const res = await request.get(`${baseURL}/api/access`);
        expect(res.ok()).toBeTruthy();
        const { login } = (await res.json()) as { login: { mode: string; note: string } };
        test.info().annotations.push({ type: 'access-gate', description: `login: ${login.mode}` });

        expect(
            login.mode,
            `Login is "${login.mode}"${login.note ? ` (note: "${login.note}")` : ''}, so no learner can sign in — the smoke account included. Reopen it in the admin panel (Access, Login) and run the job again.`,
        ).not.toBe('closed');
    });

    test('logs in, creates a word, and deletes it', async ({ page, request, baseURL }) => {
        await page.goto('/login');
        await page.getByLabel('Email').fill(SMOKE_EMAIL);
        await page.getByLabel('Password').fill(SMOKE_PASSWORD);
        await page.getByRole('button', { name: 'Sign in' }).click();
        try {
            await expect(page.getByRole('heading', { name: /Welcome, Smoke Test/ })).toBeVisible();
        } catch (error) {
            // A learner's sign-in is refused while the gate blocks it, and the login page
            // does not say which state the environment is in. Read it and put it in the
            // failure: a "limited" gate reaches here whenever the smoke account is not on
            // the allowed list, and that is the one case the preflight cannot judge.
            const { login } = (await (await request.get(`${baseURL}/api/access`)).json()) as {
                login: { mode: string; note: string };
            };
            throw new Error(
                `${(error as Error).message}\n\nThe login gate of this environment is "${login.mode}"${login.note ? ` (note: "${login.note}")` : ''}. A learner cannot sign in while it is "closed", and only an account on the allowed list can while it is "limited".`,
            );
        }

        await page.getByRole('link', { name: 'words', exact: true }).click();

        await page.getByRole('link', { name: 'New word' }).click();
        await expect(page).toHaveURL('/addWord');
        await page.getByRole('radio', { name: /Noun/ }).click();

        await page.getByRole('button', { name: 'English' }).click();
        await page.getByLabel('Singular', { exact: true }).first().fill('Smoke');

        await page.getByRole('button', { name: 'Español' }).click();
        await page.getByRole('radio', { name: 'el', exact: true }).click();
        await page.getByLabel('Singular', { exact: true }).last().fill('Humo');

        const save = page.getByRole('button', { name: 'Save' });
        await expect(save).toBeEnabled();
        await save.click();

        await expect(page.getByText('Word was created successfully')).toBeVisible();
        await page.getByRole('button', { name: 'Click here to see the new word' }).click();
        await expect(page).toHaveURL(/\/word\/.+/);

        // Delete through the real bottom bar -> confirm dialog flow (WordPage.tsx).
        // Radix's AlertDialog renders role="alertdialog", distinct from the
        // bar's own "Delete" trigger button, so this scoping is required
        // to avoid matching two same-named buttons at once.
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

        await expect(page.getByText('Word deleted successfully')).toBeVisible();
        await expect(page).toHaveURL('/');
    });
});

// Its own block, not part of the serial one above: this check has nothing to
// do with the smoke account, so a login failure should not hide it (and the
// reverse).
test.describe('Post-deploy smoke — Google sign-in wiring', () => {
    test('/api/auth/google/start sends Google our client ID and redirect URI, and Google accepts them', async ({
        request,
        page,
        baseURL,
    }) => {
        // Raw 302 from our own backend — not followed, so the authorize URL can be read.
        const res = await request.get(`${baseURL}/api/auth/google/start`, { maxRedirects: 0 });
        expect(res.status()).toBe(302);
        expect(res.headers()['set-cookie']).toContain('__Host-ladu_oauth=');

        const location = res.headers()['location'];
        expect(location).toBeTruthy();
        const authorizeUrl = new URL(location);
        expect(authorizeUrl.host).toBe('accounts.google.com');

        const params = authorizeUrl.searchParams;
        expect(params.get('client_id')).toBe(GOOGLE_CLIENT_ID);
        expect(params.get('redirect_uri')).toBe(`${baseURL}/api/auth/google/callback`);
        expect(params.get('response_type')).toBe('code');
        expect(params.get('scope')).toBe('openid email profile');
        expect(params.get('code_challenge_method')).toBe('S256');
        expect(params.get('code_challenge')).toBeTruthy();
        expect(params.get('state')).toBeTruthy();
        expect(params.get('nonce')).toBeTruthy();

        // Only Google can say whether it accepts that client ID + redirect URI
        // pair. A rejection lands on its error page; anything else (today, the
        // sign-in page) counts as accepted, so a redesign of Google's own
        // sign-in path does not block a deploy.
        await page.goto(location);
        const finalUrl = new URL(page.url());
        expect(finalUrl.host).toBe('accounts.google.com');
        expect(
            finalUrl.pathname,
            `Google rejected the request (${googleErrorReason(finalUrl)}) — check the OAuth client in Google Cloud Console`,
        ).not.toBe(GOOGLE_ERROR_PATH);
    });
});
