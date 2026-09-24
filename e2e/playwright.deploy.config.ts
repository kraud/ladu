import { defineConfig, devices } from '@playwright/test';

/**
 * Deployed-environment smoke test — runs against a REAL deployed backend +
 * frontend (staging today, production once D-f exists), not the local dev
 * stack `playwright.config.ts` boots. No `webServer` here: the servers
 * already exist. No DB fixture access either (see fixtures/db.ts's own
 * comment) — CI cannot reach the staging DB, so `deployed-smoke.spec.ts`
 * creates and deletes its own data through the real UI, the way a real
 * user would (`.dev-context/deployment-strategy.md` §3).
 *
 * Run: BASE_URL=https://staging.ladu.com.ar SMOKE_TEST_EMAIL=... \
 *      SMOKE_TEST_PASSWORD=... EXPECTED_SHA=<sha> GOOGLE_CLIENT_ID=... \
 *      npm run test:e2e:smoke
 */

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
    throw new Error('BASE_URL is not set — this config only runs against a real deployed environment.');
}

const CI = !!process.env.CI;

export default defineConfig({
    testDir: './tests',
    testMatch: 'deployed-smoke.spec.ts',
    fullyParallel: false,
    forbidOnly: CI,
    retries: 0,
    workers: 1,
    // `github` alone prints only a pass count for a green run; `list` adds each
    // test's name, so a run's log shows which smoke tests actually ran.
    reporter: CI
        ? [['github'], ['list'], ['html', { open: 'never' }]]
        : [['list'], ['html', { open: 'never' }]],
    timeout: 30_000,
    expect: { timeout: 5_000 },

    use: {
        baseURL: BASE_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
});
