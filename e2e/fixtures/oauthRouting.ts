/**
 * Makes the next click on "Continue with Google" mint an authorize URL for
 * exactly one test identity, against the Phase 0 stub issuer.
 *
 * Rewriting the *request* URL to the stub's `/authorize` via
 * `route.continue({ url })` doesn't reliably apply to a top-level
 * navigation (verified while building oauth-2-google-login.spec.ts — the
 * seeded identity was never found; every run landed on the stub's fixed
 * default instead). Intercepting the backend's own `/start` *response* and
 * rewriting its `Location` header is reliable instead — with one trap:
 * `route.fetch()` follows redirects by default, so without `maxRedirects: 0`
 * it silently walks the *entire* chain (stub + callback) and hands back the
 * final page, not `/start`'s own raw 302. `route.fulfill()` then forwards
 * every header from that raw redirect — including `Set-Cookie`, which the
 * flow breaks without — except the one being rewritten.
 */
import type { Page } from '@playwright/test';

export async function routeGoogleStartTo(
    page: Page,
    identity: { email: string; sub: string; name?: string; emailVerified?: boolean },
): Promise<void> {
    await page.route('**/api/auth/google/start*', async (route) => {
        const response = await route.fetch({ maxRedirects: 0 });
        const location = response.headers()['location'];
        if (!location) {
            await route.fulfill({ response });
            return;
        }
        const url = new URL(location);
        url.searchParams.set('login_hint', identity.email);
        url.searchParams.set('sub', identity.sub);
        if (identity.name) url.searchParams.set('name', identity.name);
        if (identity.emailVerified === false) url.searchParams.set('email_verified', 'false');
        await route.fulfill({
            status: response.status(),
            headers: { ...response.headers(), location: url.toString() },
        });
    });
}

/**
 * Same idea as `routeGoogleStartTo`, but for the protected, JSON-returning
 * `/api/auth/google/link` endpoint used by the Account page's "Connect"
 * button (oauth-login-strategy.md Phase 5) — there's no redirect chain to
 * worry about here, just a `{ url }` body to rewrite before the page reads
 * it and navigates itself.
 */
export async function routeGoogleConnectTo(
    page: Page,
    identity: { email: string; sub: string; name?: string; emailVerified?: boolean },
): Promise<void> {
    await page.route('**/api/auth/google/link', async (route) => {
        const response = await route.fetch();
        const body = (await response.json()) as { url: string };
        const url = new URL(body.url);
        url.searchParams.set('login_hint', identity.email);
        url.searchParams.set('sub', identity.sub);
        if (identity.name) url.searchParams.set('name', identity.name);
        if (identity.emailVerified === false) url.searchParams.set('email_verified', 'false');
        await route.fulfill({
            status: response.status(),
            headers: response.headers(),
            body: JSON.stringify({ ...body, url: url.toString() }),
        });
    });
}
