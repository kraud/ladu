import { defineConfig, devices } from '@playwright/test';

/**
 * Ladu end-to-end suite — full-stack, per-phase gate verification.
 *
 * Boots the REAL backend (:5001) + the frontend dev server (:5173) together and
 * drives them through a browser. One `*.spec.ts` per phase's vertical slice —
 * see `.context/plans/new-repo-build-plan.md` §5 (phase gates) and §6.
 *
 * Prerequisites (NOT managed here — same ones the backend Jest suite needs):
 *   1. `npm run docker:up`      — local Postgres (host :5433)
 *   2. `npm run db:migrate`     — schema applied to keelapp_v2_dev
 *   3. `backend/.env` present   — JWT secret, mail creds, DB URL
 *   4. `npm run e2e:install`    — one-time Chromium download (root script)
 *
 * Run:  `npm run test:e2e`  (from the repo root)
 *
 * UI mode: use `npm run test:e2e:ui` (`playwright test --ui --headed`). UI mode
 * never passes `headed` to the test server, so a plain `--ui` run launches
 * headless browsers — no window to watch.
 */

const FRONTEND_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const BACKEND_URL = process.env.E2E_API_URL ?? 'http://localhost:5001';
// Local stub OIDC issuer standing in for Google in tests —
// see e2e/fixtures/oidc-stub/server.ts and oauth-login-strategy.md Phase 0.
const OIDC_STUB_URL = process.env.OIDC_STUB_URL ?? 'http://localhost:4400';
const CI = !!process.env.CI;

export default defineConfig({
    testDir: './tests',
    // deployed-smoke.spec.ts targets a real deployed environment (real
    // BASE_URL, smoke-account credentials, EXPECTED_SHA) via its own
    // playwright.deploy.config.ts — this config's testDir would otherwise
    // pick it up too and fail immediately for missing env vars that only
    // deploy.yml's `smoke` job ever sets.
    testIgnore: 'deployed-smoke.spec.ts',
    fullyParallel: true,
    forbidOnly: CI,
    retries: CI ? 2 : 0,
    workers: CI ? 1 : undefined,
    reporter: CI
        ? [['github'], ['html', { open: 'never' }]]
        : [['list'], ['html', { open: 'never' }]],
    timeout: 30_000,
    expect: { timeout: 5_000 },

    use: {
        baseURL: FRONTEND_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],

    // Both servers are started from the repo root. `reuseExistingServer` lets you
    // keep `npm run dev` running in another terminal while iterating locally.
    webServer: [
        {
            // Migrations are a separate step from server startup (backend/scripts/migrate.js)
            // — the backend no longer applies them itself on boot.
            command: 'npm run migrate -w backend && npm run dev -w backend',
            cwd: '..',
            // OAUTH_ISSUER_GOOGLE points discovery at the local stub instead of the
            // real provider — accepted by the backend only outside production
            // (oauth-login-strategy.md Phase 0). No OAuth client code reads this yet;
            // this proves the backend boots cleanly once it's set, ahead of Phase 2.
            env: {
                OAUTH_ISSUER_GOOGLE: OIDC_STUB_URL,
            },
            // Backend mounts `GET /` -> 200 JSON (backend/app.js) — used purely
            // as a readiness probe.
            url: `${BACKEND_URL}/`,
            reuseExistingServer: !CI,
            timeout: 60_000,
            stdout: 'pipe',
            stderr: 'pipe',
        },
        {
            command: 'npm run dev -w frontend -- --port 5173 --strictPort',
            cwd: '..',
            url: FRONTEND_URL,
            reuseExistingServer: !CI,
            timeout: 60_000,
            stdout: 'pipe',
            stderr: 'pipe',
        },
        {
            // Stub OIDC issuer for the OAuth phases — implements the real
            // discovery/authorize/token/jwks contract so the backend's OAuth
            // client code runs against something that behaves like Google,
            // without a live third-party account in CI.
            command: 'npm run stub:oidc -w e2e',
            cwd: '..',
            url: `${OIDC_STUB_URL}/.well-known/openid-configuration`,
            reuseExistingServer: !CI,
            timeout: 30_000,
            stdout: 'pipe',
            stderr: 'pipe',
        },
    ],
});
