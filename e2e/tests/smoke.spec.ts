import { test, expect } from '@playwright/test';

/**
 * Phase 0 — infrastructure smoke.
 *
 * Proves the e2e harness itself works: both servers boot, the browser reaches
 * the SPA shell, and the API answers. Each later phase adds its own
 * `phase-N-*.spec.ts` covering that phase's vertical slice (build plan §5 gate).
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5001';

test.describe('Phase 0 — infrastructure smoke', () => {
    test('frontend dev server serves the SPA shell', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#root')).toBeAttached();
    });

    test('backend API is reachable', async ({ request }) => {
        const res = await request.get(`${API_URL}/`);
        expect(res.ok()).toBeTruthy();
    });

    test('protected endpoint rejects an unauthenticated request', async ({ request }) => {
        const res = await request.get(`${API_URL}/api/words/`);
        expect(res.status()).toBe(401);
    });
});
