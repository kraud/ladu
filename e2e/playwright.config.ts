import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { E2E_ADMIN_URL, E2E_API_URL, E2E_BASE_URL, EKI_STUB_URL, OIDC_STUB_URL, e2eDatabaseUrl, portOf } from './fixtures/env';

/**
 * Ladu end-to-end suite — full-stack, per-phase gate verification.
 *
 * Boots the REAL backend + the frontend dev server (and the admin app and two stubs) together and
 * drives them through a browser. They run on their own ports and their own database (fixtures/env.ts),
 * so a running `npm run dev` does not get in the way. One `*.spec.ts` per phase's vertical slice —
 * see `.context/plans/new-repo-build-plan.md` §5 (phase gates) and §6.
 *
 * Prerequisites (NOT managed here — same ones the backend Jest suite needs):
 *   1. `npm run docker:up`      — local Postgres (host :5433)
 *   2. the repo-root `.env`     — JWT secret, mail creds, DB URL (the e2e database `keelapp_e2e` is
 *                                 created and migrated by the run itself)
 *   3. `npm run e2e:install`    — one-time Chromium download (root script)
 *
 * Run:  `npm run test:e2e`  (from the repo root)
 *
 * UI mode: use `npm run test:e2e:ui` (`playwright test --ui --headed`). UI mode
 * never passes `headed` to the test server, so a plain `--ui` run launches
 * headless browsers — no window to watch.
 */

const FRONTEND_URL = E2E_BASE_URL;
// The admin dashboard (admin/) — its own Vite server, its own specs (`admin-*.spec.ts`).
const ADMIN_URL = E2E_ADMIN_URL;
const BACKEND_URL = E2E_API_URL;
const CI = !!process.env.CI;
// The Vite servers forward /api to the e2e backend, not to the dev backend on :5001.
const PROXY_ENV = { API_PROXY_TARGET: BACKEND_URL };
// The specs that change the registration or login gate (access-gates.md): `admin-11-registration-gate.spec.ts`, ...
const GATE_SPECS = /-gate\.spec\.ts$/;
// The gates are ONE row of global state, so no two gate specs may run at the same time (`fullyParallel: false`
// only orders the tests INSIDE one file; two files would still run in two workers). So each gate spec is its own
// project, and the projects are chained: the first waits for the main project, each next one for the one before.
const gateSpecs = readdirSync(fileURLToPath(new URL('./tests', import.meta.url)))
    .filter((file) => GATE_SPECS.test(file))
    .sort();
const gateProjectName = (file: string) => file.replace(/\.spec\.ts$/, '');
const gateProjects = gateSpecs.map((file, i) => ({
    name: gateProjectName(file),
    use: { ...devices['Desktop Chrome'] },
    testMatch: file,
    dependencies: [i === 0 ? 'chromium' : gateProjectName(gateSpecs[i - 1])],
}));

export default defineConfig({
    testDir: './tests',
    // Turns the onboarding switch off before the run (fixtures/global-setup.ts).
    globalSetup: './fixtures/global-setup.ts',
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
        // Every spec except the access-gate ones.
        // (A project-level testIgnore replaces the top-level one, so deployed-smoke is excluded again here.)
        { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: [GATE_SPECS, 'deployed-smoke.spec.ts'] },
        // The access-gate specs: one project for each, chained, after every other spec has finished (a failure
        // before them skips them). A closed gate would break any other spec that registers or signs in a learner.
        ...gateProjects,
    ],

    // The servers are started from the repo root, on the e2e ports (fixtures/env.ts), not the dev ports:
    // `npm run dev` can keep running in another terminal. `reuseExistingServer` only reuses a stack that
    // was started on purpose on the e2e ports.
    webServer: [
        {
            // Migrations are a separate step from server startup (backend/scripts/migrate.js)
            // — the backend no longer applies them itself on boot.
            // Then the committed lexicon fixtures (German, Spanish; ~40 words each) load, each only if its
            // language has no rows yet (--if-empty): CI gets them, a local full lexicon is kept.
            // Then the demo template (demo-access.md Slice 2), kept when it is there: every demo start copies it.
            command: 'npm run db:ensure -w e2e && npm run migrate -w backend && npm run lexicon:load:fixture -w backend && npm run demo:template -w backend && npm run dev -w backend',
            cwd: '..',
            // OAUTH_ISSUER_GOOGLE points discovery at the local stub instead of the
            // real provider — accepted by the backend only outside production
            // (oauth-login-strategy.md Phase 0). No OAuth client code reads this yet;
            // this proves the backend boots cleanly once it's set, ahead of Phase 2.
            //
            // GOOGLE_CLIENT_ID/SECRET are fake: the backend reports Google as
            // "configured" (and the frontend renders "Continue with Google")
            // only when both are set. These values win over the repo-root .env
            // (LADU_KEEP_PROCESS_ENV), and CI has no .env at all. The stub issuer
            // accepts any client ID.
            env: {
                // Own port and own database. `LADU_KEEP_PROCESS_ENV` makes the backend (and the migrate, lexicon
                // and demo scripts of this command) keep the values below over the ones in the repo-root `.env`,
                // so a real Ekilex, Turnstile or database value there cannot reach the run.
                LADU_KEEP_PROCESS_ENV: '1',
                PORT: portOf(BACKEND_URL),
                DATABASE_URL: e2eDatabaseUrl(),
                // Links in emails and the OAuth callback: the app, which forwards /api to the backend.
                BASE_URL: FRONTEND_URL,
                OAUTH_REDIRECT_BASE: FRONTEND_URL,
                OAUTH_ISSUER_GOOGLE: OIDC_STUB_URL,
                GOOGLE_CLIENT_ID: 'e2e-stub-client-id',
                GOOGLE_CLIENT_SECRET: 'e2e-stub-client-secret',
                // Signs staff tokens (admin-dashboard.md slice 2).
                ADMIN_JWT_SECRET: 'e2e-admin-secret',
                // The Estonian dictionary stub (Ekilex shape). The key is not checked by the stub.
                EKILEX_API_URL: EKI_STUB_URL,
                EKILEX_API_KEY: 'e2e-stub-key',
                // Every e2e demo start comes from one IP (demo-access.md Review log S1-1).
                DEMO_STARTS_PER_IP: '1000',
                // Cloudflare's Turnstile TEST keys: the widget always passes, and so does the server check. Only
                // `captcha-gate.spec.ts` turns the switch on. The check calls Cloudflare's real `siteverify`, so that
                // spec needs internet.
                TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
                TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
                // Empty: an access request is saved, but no email goes to the team (access-requests.md R5).
                ACCESS_REQUEST_EMAIL: '',
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
            command: `npm run dev -w frontend -- --port ${portOf(FRONTEND_URL)} --strictPort`,
            cwd: '..',
            env: PROXY_ENV,
            url: FRONTEND_URL,
            reuseExistingServer: !CI,
            timeout: 60_000,
            stdout: 'pipe',
            stderr: 'pipe',
        },
        {
            command: `npm run dev -w admin -- --port ${portOf(ADMIN_URL)} --strictPort`,
            cwd: '..',
            env: PROXY_ENV,
            url: ADMIN_URL,
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
            env: { OIDC_STUB_PORT: portOf(OIDC_STUB_URL) },
            url: `${OIDC_STUB_URL}/.well-known/openid-configuration`,
            reuseExistingServer: !CI,
            timeout: 30_000,
            stdout: 'pipe',
            stderr: 'pipe',
        },
        {
            // Stub Estonian dictionary (Ekilex API) for the autocomplete spec — fixed answers,
            // plus a request log the spec reads to check the URL encoding.
            command: 'npm run stub:eki -w e2e',
            cwd: '..',
            env: { EKI_STUB_PORT: portOf(EKI_STUB_URL) },
            url: `${EKI_STUB_URL}/health`,
            reuseExistingServer: !CI,
            timeout: 30_000,
            stdout: 'pipe',
            stderr: 'pipe',
        },
    ],
});
