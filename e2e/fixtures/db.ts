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

const pool = new pg.Pool({ connectionString });

/** The email-verification token minted for `email` at registration. */
export async function getVerifyToken(email: string): Promise<{ userId: string; token: string }> {
    const { rows } = await pool.query<{ userId: string; token: string }>(
        `SELECT u.id AS "userId", t.token
           FROM users u
           JOIN tokens t ON t.user_id = u.id
          WHERE lower(u.email) = lower($1)`,
        [email],
    );
    if (!rows[0]) throw new Error(`no verification token found for ${email}`);
    return rows[0];
}

/** Best-effort teardown — never throws, so a cleanup failure can't fail a run. */
export async function deleteUsersByEmail(emails: string[]): Promise<void> {
    if (emails.length === 0) return;
    try {
        // FK cascade removes the matching `tokens` rows; Phase-1 accounts have
        // no words / tags / friendships attached.
        await pool.query(`DELETE FROM users WHERE lower(email) = ANY($1::text[])`, [
            emails.map((e) => e.toLowerCase()),
        ]);
    } catch (error) {
        console.warn('[e2e] user cleanup failed:', (error as Error).message);
    }
}

export async function closePool(): Promise<void> {
    await pool.end();
}
