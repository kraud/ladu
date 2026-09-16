/**
 * Direct read/write access to the **dev** database (`keelapp_v2_dev`) for the
 * e2e suite. The full stack runs against the dev DB (see `playwright.config.ts`),
 * and these tests need two things the UI can't give them:
 *
 *  - the email-verification token (there is no inbox — read it from `tokens`);
 *  - teardown of the accounts each run creates (unique `e2e-*@ladu.test` emails).
 *
 * `DATABASE_URL` comes from the repo-root `.env`, the same file the backend
 * loads. `cwd` is the `e2e/` workspace when Playwright runs, so `../.env`.
 */
import { resolve } from 'node:path';
import { config } from 'dotenv';
import pg from 'pg';

config({ path: resolve(process.cwd(), '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error(
        'DATABASE_URL is not set. Run `npm run docker:up` and make sure the repo-root .env exists.',
    );
}

// A lazy, re-creatable singleton, NOT a plain module-scope `pool` — Playwright
// runs multiple `*.spec.ts` files inside the same worker process (guaranteed
// under `workers: 1`, the CI setting above, and possible locally whenever
// there are more spec files than workers). Every file imports this same
// module instance, so a plain `pool.end()` in one file's `afterAll` would
// kill the connection out from under every other file sharing that worker.
// `getPool()` transparently reopens after a close instead.
let pool: pg.Pool | undefined;

function getPool(): pg.Pool {
    if (!pool) pool = new pg.Pool({ connectionString });
    return pool;
}

/** The email-verification token minted for `email` at registration. */
export async function getVerifyToken(email: string): Promise<{ userId: string; token: string }> {
    const { rows } = await getPool().query<{ userId: string; token: string }>(
        `SELECT u.id AS "userId", t.token
           FROM users u
           JOIN tokens t ON t.user_id = u.id
          WHERE lower(u.email) = lower($1)`,
        [email],
    );
    if (!rows[0]) throw new Error(`no verification token found for ${email}`);
    return rows[0];
}

/** Backdates `words.created_at` for the given ids — lets a spec put a word outside the current calendar month without waiting for real time to pass (used to exercise the Dashboard's month-range selector, which is otherwise a single-option no-op on an account created during the run). */
export async function backdateWordsCreatedAt(wordIds: string[], date: Date): Promise<void> {
    await getPool().query(`UPDATE words SET created_at = $2 WHERE id = ANY($1::uuid[])`, [wordIds, date]);
}

/** Best-effort teardown — never throws, so a cleanup failure can't fail a run. */
export async function deleteUsersByEmail(emails: string[]): Promise<void> {
    if (emails.length === 0) return;
    try {
        // FK cascade removes the matching `tokens` rows; Phase-1 accounts have
        // no words / tags / friendships attached.
        await getPool().query(`DELETE FROM users WHERE lower(email) = ANY($1::text[])`, [
            emails.map((e) => e.toLowerCase()),
        ]);
    } catch (error) {
        console.warn('[e2e] user cleanup failed:', (error as Error).message);
    }
}

/** Safe to call from every spec file's `afterAll`, in any order — a no-op once already closed, and `getPool()` reopens transparently if another file still needs it after. */
export async function closePool(): Promise<void> {
    if (!pool) return;
    const current = pool;
    pool = undefined;
    await current.end();
}
