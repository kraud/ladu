/**
 * Where the e2e suite runs: its own ports and its own database.
 *
 * The suite does not share anything with `npm run dev`. The dev stack keeps :5001 (API), :5173 (app) and
 * :5174 (admin) and the database `keelapp_v2_dev`; the e2e stack uses the values below. So a running dev
 * server never blocks a run, and a run never writes to the dev data.
 *
 * Every value can be set from the outside (`E2E_API_URL`, `E2E_BASE_URL`, `E2E_ADMIN_URL`, `OIDC_STUB_URL`,
 * `EKI_STUB_URL`, `E2E_DATABASE_URL`). `playwright.config.ts` and the specs read them from here only.
 */
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// The repo-root `.env` (the backend reads the same file). Only the database URL is taken from it.
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

export const E2E_API_URL = process.env.E2E_API_URL ?? 'http://localhost:5101';
export const E2E_BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5273';
export const E2E_ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5274';
// Stand-in for Google sign-in (fixtures/oidc-stub) and for the Ekilex API (fixtures/eki-stub).
export const OIDC_STUB_URL = process.env.OIDC_STUB_URL ?? 'http://localhost:4500';
export const EKI_STUB_URL = process.env.EKI_STUB_URL ?? 'http://localhost:4501';

/** The port in a `http://localhost:PORT` URL. */
export function portOf(url: string): string {
    return new URL(url).port;
}

const E2E_DATABASE_NAME = 'keelapp_e2e';

/**
 * The database of the run. `E2E_DATABASE_URL` wins. Otherwise it is `DATABASE_URL` (shell or `.env`) with the
 * database name `keelapp_e2e` (CI already uses that name). The run deletes rows, so the name must say "e2e":
 * anything else is refused.
 */
export function e2eDatabaseUrl(): string {
    let url = process.env.E2E_DATABASE_URL;
    if (!url) {
        const base = process.env.DATABASE_URL;
        if (!base) {
            throw new Error('DATABASE_URL is not set. Run `npm run docker:up` and make sure the repo-root .env exists.');
        }
        const derived = new URL(base);
        derived.pathname = `/${E2E_DATABASE_NAME}`;
        url = derived.toString();
    }
    const name = e2eDatabaseName(url);
    if (!/e2e/.test(name)) {
        throw new Error(`Refusing to run e2e against the database "${name}": its name must contain "e2e".`);
    }
    return url;
}

export function e2eDatabaseName(url: string): string {
    return decodeURIComponent(new URL(url).pathname.slice(1));
}
