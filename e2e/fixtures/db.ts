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
import bcrypt from 'bcryptjs';
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

/**
 * Inserts a password-less, verified account directly — there's no signup
 * flow that creates one yet (Phase 2/3 of oauth-login-strategy.md), but the
 * row shape (password NULL, verified true, matching a real OAuth signup) is
 * exactly what Phase 1's login guard has to handle.
 */
export async function createPasswordlessUser(email: string, opts: { name?: string; username?: string } = {}): Promise<{ userId: string }> {
    const { rows } = await getPool().query<{ id: string }>(
        `INSERT INTO users (name, email, username, password, languages, ui_language, verified)
         VALUES ($1, $2, $3, NULL, ARRAY['English', 'Spanish'], 'English', true)
         RETURNING id`,
        [opts.name ?? 'OAuth Only', email, opts.username ?? email.split('@')[0]],
    );
    if (!rows[0]) throw new Error(`failed to seed password-less user ${email}`);
    return { userId: rows[0].id };
}

/**
 * Inserts a password-less, verified account already linked to an OAuth
 * identity — `(provider, providerUserId)` must match what the stub issuer
 * will mint (its `/authorize` accepts `login_hint`/`sub` query params to
 * control exactly this). Phase 2's scope is deliberately limited to this
 * already-linked case (oauth-login-strategy.md) — there's no signup/link
 * flow yet to create this row through the UI.
 */
export async function createLinkedOAuthUser(
    email: string,
    provider: string,
    providerUserId: string,
    opts: { name?: string; username?: string } = {},
): Promise<{ userId: string }> {
    const { userId } = await createPasswordlessUser(email, opts);
    await getPool().query(
        `INSERT INTO oauth_identities (user_id, provider, provider_user_id, email_at_link)
         VALUES ($1, $2, $3, $4)`,
        [userId, provider, providerUserId, email],
    );
    return { userId };
}

/**
 * The row shape Phase 3's `oauth-3-google-signup.spec.ts` gate checks
 * directly: `password IS NULL`, `verified = true`, and how many
 * `oauth_identities` rows the account ended up with.
 */
export async function getUserAccountShape(
    email: string,
): Promise<{ userId: string; passwordIsNull: boolean; verified: boolean; oauthIdentityCount: number } | undefined> {
    const { rows } = await getPool().query<{
        id: string;
        password: string | null;
        verified: boolean;
        identity_count: string;
    }>(
        `SELECT u.id, u.password, u.verified, count(oi.id) AS identity_count
           FROM users u
           LEFT JOIN oauth_identities oi ON oi.user_id = u.id
          WHERE lower(u.email) = lower($1)
          GROUP BY u.id`,
        [email],
    );
    if (!rows[0]) return undefined;
    return {
        userId: rows[0].id,
        passwordIsNull: rows[0].password === null,
        verified: rows[0].verified,
        oauthIdentityCount: Number(rows[0].identity_count),
    };
}

/** True if a verification-token row exists for this email — Phase 3's proof that OAuth signup never sends mail. */
export async function hasVerificationToken(email: string): Promise<boolean> {
    const { rows } = await getPool().query(
        `SELECT 1 FROM users u JOIN tokens t ON t.user_id = u.id WHERE lower(u.email) = lower($1)`,
        [email],
    );
    return rows.length > 0;
}

/** Backdates `words.created_at` for the given ids — lets a spec put a word outside the current calendar month without waiting for real time to pass (used to exercise the Dashboard's month-range selector, which is otherwise a single-option no-op on an account created during the run). */
export async function backdateWordsCreatedAt(wordIds: string[], date: Date): Promise<void> {
    await getPool().query(`UPDATE words SET created_at = $2 WHERE id = ANY($1::uuid[])`, [wordIds, date]);
}

/** The `users.theme` value for an account (`null` = the user never chose one) — Phase 3.9's proof that a theme choice reached the row, and that a login without a choice did not overwrite it. */
export async function getUserTheme(email: string): Promise<string | null> {
    const { rows } = await getPool().query<{ theme: string | null }>(
        `SELECT theme FROM users WHERE lower(email) = lower($1)`,
        [email],
    );
    if (!rows[0]) throw new Error(`no user found for ${email}`);
    return rows[0].theme;
}

/**
 * The Terms record the server wrote when the account was created
 * (`users.terms_accepted_at` / `terms_version`; both `null` for accounts older
 * than the Terms page). `acceptedRecently` is worked out in SQL on purpose: the
 * backend (Drizzle) stores `timestamp` columns as UTC wall-clock time, and a
 * plain `pg` read would parse that as local time and be off by the UTC offset.
 */
export async function getUserTerms(email: string): Promise<{ acceptedRecently: boolean; version: string | null }> {
    const { rows } = await getPool().query<{ accepted_recently: boolean | null; terms_version: string | null }>(
        `SELECT terms_accepted_at > (now() AT TIME ZONE 'UTC') - interval '5 minutes' AS accepted_recently, terms_version
         FROM users WHERE lower(email) = lower($1)`,
        [email],
    );
    if (!rows[0]) throw new Error(`no user found for ${email}`);
    return { acceptedRecently: rows[0].accepted_recently === true, version: rows[0].terms_version };
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

/** Makes every saved practice session of an account expired (Phase 5.5) without waiting 7 days. Returns how many rows changed. */
export async function expirePracticeSessions(email: string): Promise<number> {
    const { rowCount } = await getPool().query(
        `UPDATE practice_sessions SET expires_at = now() - interval '1 hour'
          WHERE user_id = (SELECT id FROM users WHERE lower(email) = lower($1))`,
        [email],
    );
    return rowCount ?? 0;
}

// ---------------------------------------------------------------------------
// Admin dashboard (.context/plans/admin-dashboard.md) — rows the admin specs
// need that no UI creates: a staff account (the first `owner` comes from a
// server-side script, never the UI) and users with a known history.
// ---------------------------------------------------------------------------

/** Inserts a staff account; the password is hashed here with the same bcrypt the backend checks against. */
export async function createStaffAccount(email: string, role: string, password: string, name = `E2E ${role}`): Promise<{ staffId: string }> {
    const { rows } = await getPool().query<{ id: string }>(
        `INSERT INTO staff_accounts (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id`,
        [email.toLowerCase(), name, await bcrypt.hash(password, 4), role],
    );
    if (!rows[0]) throw new Error(`failed to seed staff ${email}`);
    return { staffId: rows[0].id };
}

/** Removes staff accounts and the audit rows that reference them (`audit_log.staff_id` is `ON DELETE RESTRICT`). */
export async function deleteStaffByEmail(emails: string[]): Promise<void> {
    if (emails.length === 0) return;
    try {
        const lowered = emails.map((e) => e.toLowerCase());
        await getPool().query(
            `DELETE FROM audit_log WHERE staff_id IN (SELECT id FROM staff_accounts WHERE email = ANY($1::text[]))`,
            [lowered],
        );
        await getPool().query(`DELETE FROM staff_accounts WHERE email = ANY($1::text[])`, [lowered]);
    } catch (error) {
        console.warn('[e2e] staff cleanup failed:', (error as Error).message);
    }
}

export interface SeedUserOptions {
    name: string;
    username: string;
    /** false = a Google-only account (NULL password hash). */
    hasPassword?: boolean;
    verified?: boolean;
    banned?: boolean;
    deleted?: boolean;
    lastLoginCountry?: string;
    /** A real password, so the account can sign in through the learner API. Without it the hash is a placeholder. */
    learnerPassword?: string;
    /** When the account was created, as an ISO string (UTC). Default: now. */
    createdAt?: string;
    /** The languages the user chose. Default: English and Estonian. */
    languages?: string[];
}

/** Inserts a user row directly, with the admin columns set as asked. */
export async function seedUser(email: string, opts: SeedUserOptions): Promise<{ userId: string }> {
    const { rows } = await getPool().query<{ id: string }>(
        `INSERT INTO users (name, email, username, password, languages, ui_language, verified,
                            banned_at, ban_reason, deleted_at, last_login_at, last_login_country, created_at)
         VALUES ($1, $2, $3, $4, $11::text[], 'English', $5,
                 $6, $7, $8, $9, $10, COALESCE($12::timestamp, now()))
         RETURNING id`,
        [
            opts.name,
            email,
            opts.username,
            opts.hasPassword === false ? null : opts.learnerPassword ? await bcrypt.hash(opts.learnerPassword, 4) : 'not-a-real-hash',
            opts.verified ?? true,
            opts.banned ? new Date() : null,
            opts.banned ? 'spam' : null,
            opts.deleted ? new Date() : null,
            opts.lastLoginCountry ? new Date() : null,
            opts.lastLoginCountry ?? null,
            opts.languages ?? ['English', 'Estonian'],
            opts.createdAt ?? null,
        ],
    );
    if (!rows[0]) throw new Error(`failed to seed user ${email}`);
    return { userId: rows[0].id };
}

/** A word with one translation per language — feeds the `words` and `translations` counts. */
export async function seedWord(userId: string, languages: string[]): Promise<void> {
    const { rows } = await getPool().query<{ id: string }>(
        `INSERT INTO words (user_id, part_of_speech) VALUES ($1, 'Noun') RETURNING id`,
        [userId],
    );
    const wordId = rows[0]?.id;
    for (const language of languages) {
        await getPool().query(`INSERT INTO translations (word_id, language) VALUES ($1, $2)`, [wordId, language]);
    }
}

export async function seedTag(userId: string, label: string): Promise<void> {
    await getPool().query(`INSERT INTO tags (author_id, label, visibility) VALUES ($1, $2, 'Private')`, [userId, label]);
}

export async function seedLoginEvent(userId: string, method: 'password' | 'google', country: string | null): Promise<void> {
    await getPool().query(`INSERT INTO login_events (user_id, method, country) VALUES ($1, $2, $3)`, [userId, method, country]);
}

export async function seedGoogleIdentity(userId: string, email: string): Promise<void> {
    await getPool().query(
        `INSERT INTO oauth_identities (user_id, provider, provider_user_id, email_at_link) VALUES ($1, 'google', $2, $3)`,
        [userId, `e2e-sub-${userId}`, email],
    );
}

export async function seedAuditEntry(staffId: string, userId: string, action: string, reason: string): Promise<void> {
    await getPool().query(
        `INSERT INTO audit_log (staff_id, action, target_type, target_id, reason) VALUES ($1, $2, 'user', $3, $4)`,
        [staffId, action, userId, reason],
    );
}

/** The audit rows written about one user (`target_type = 'user'`), oldest first. Survives the user's purge. */
export async function getAuditForUser(
    userId: string,
): Promise<{ action: string; reason: string | null; staffId: string | null; metadata: Record<string, unknown> | null }[]> {
    const { rows } = await getPool().query(
        `SELECT action, reason, staff_id AS "staffId", metadata
           FROM audit_log WHERE target_type = 'user' AND target_id = $1 ORDER BY created_at, id`,
        [userId],
    );
    return rows;
}

/** How many password-reset token rows a user has (the admin "Send password reset" action adds one each time). */
export async function countResetTokens(userId: string): Promise<number> {
    const { rows } = await getPool().query<{ n: number }>(
        `SELECT count(*)::int AS n FROM password_reset_tokens WHERE user_id = $1`,
        [userId],
    );
    return rows[0]?.n ?? 0;
}

/** An `ops_events` row as the VPS backup scripts write it, `hoursAgo` hours in the past. */
export async function seedOpsEvent(kind: 'backup' | 'restore_test', ok: boolean, detail: string, hoursAgo: number): Promise<void> {
    await getPool().query(
        `INSERT INTO ops_events (kind, ok, detail, created_at) VALUES ($1, $2, $3, now() - make_interval(hours => $4))`,
        [kind, ok, detail, hoursAgo],
    );
}

export async function deleteOpsEventsByDetail(prefix: string): Promise<void> {
    try {
        await getPool().query(`DELETE FROM ops_events WHERE detail LIKE $1`, [`${prefix}%`]);
    } catch (error) {
        console.warn('[e2e] ops_events cleanup failed:', (error as Error).message);
    }
}

/** True if `text` appears anywhere in the audit log (action, reason or metadata). Used to prove that no password is ever written there. */
export async function auditLogContains(text: string): Promise<boolean> {
    const { rows } = await getPool().query<{ n: string }>(
        `SELECT count(*) AS n FROM audit_log WHERE metadata::text LIKE $1 OR reason LIKE $1 OR action LIKE $1 OR target_id LIKE $1`,
        [`%${text}%`],
    );
    return Number(rows[0]?.n ?? 0) > 0;
}

/** One row of `user_activity_days`: the user was active on `day` (a UTC `YYYY-MM-DD`). */
export async function seedActivityDay(userId: string, day: string): Promise<void> {
    await getPool().query(`INSERT INTO user_activity_days (user_id, day) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, day]);
}

/** The rows `protect` wrote for a user: proves a real request recorded today. */
export async function getActivityDays(userId: string): Promise<string[]> {
    const { rows } = await getPool().query<{ day: string }>(
        `SELECT to_char(day, 'YYYY-MM-DD') AS day FROM user_activity_days WHERE user_id = $1 ORDER BY day`,
        [userId],
    );
    return rows.map((r) => r.day);
}

/**
 * The access gates (access-gates.md) are ONE row of global state, so the specs that change them
 * (`*-gate.spec.ts`) run in their own Playwright project, after every other spec.
 */
export async function setAccessSettings(registrationMode: 'open' | 'closed' | 'limited', registrationNote = ''): Promise<void> {
    await getPool().query(`UPDATE access_settings SET registration_mode = $1, registration_note = $2 WHERE id = 1`, [
        registrationMode,
        registrationNote,
    ]);
}

export async function getRegistrationSettings(): Promise<{ mode: string; note: string }> {
    const { rows } = await getPool().query<{ mode: string; note: string }>(
        `SELECT registration_mode AS mode, registration_note AS note FROM access_settings WHERE id = 1`,
    );
    if (!rows[0]) throw new Error('access_settings has no row');
    return rows[0];
}

export async function hasInvite(email: string): Promise<boolean> {
    const { rows } = await getPool().query(`SELECT 1 FROM registration_invites WHERE email = lower($1)`, [email]);
    return rows.length > 0;
}

export async function userExists(email: string): Promise<boolean> {
    const { rows } = await getPool().query(`SELECT 1 FROM users WHERE lower(email) = lower($1)`, [email]);
    return rows.length > 0;
}

/** Audit rows of one action about one email (`access.invite_used` has no staff member, so a staff cleanup would miss it). */
export async function countAuditByEmail(action: string, email: string): Promise<number> {
    const { rows } = await getPool().query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = $1 AND metadata->>'email' = lower($2)`,
        [action, email],
    );
    return rows[0]?.n ?? 0;
}

/** Best-effort teardown of what a gate spec made: the invites, and the staff-less `access.invite_used` audit rows. */
export async function deleteAccessTestData(emails: string[]): Promise<void> {
    if (emails.length === 0) return;
    try {
        const lowered = emails.map((e) => e.toLowerCase());
        await getPool().query(`DELETE FROM registration_invites WHERE email = ANY($1::text[])`, [lowered]);
        await getPool().query(`DELETE FROM audit_log WHERE action = 'access.invite_used' AND metadata->>'email' = ANY($1::text[])`, [lowered]);
    } catch (error) {
        console.warn('[e2e] access cleanup failed:', (error as Error).message);
    }
}

/** The login gate's state (access-gates.md). Like `setAccessSettings`, this is global state: only the `*-gate.spec.ts` specs may change it. */
export async function setLoginAccess(loginMode: 'open' | 'closed' | 'limited', loginNote = ''): Promise<void> {
    await getPool().query(`UPDATE access_settings SET login_mode = $1, login_note = $2 WHERE id = 1`, [loginMode, loginNote]);
}

export async function getLoginSettings(): Promise<{ mode: string; note: string }> {
    const { rows } = await getPool().query<{ mode: string; note: string }>(
        `SELECT login_mode AS mode, login_note AS note FROM access_settings WHERE id = 1`,
    );
    if (!rows[0]) throw new Error('access_settings has no row');
    return rows[0];
}

/** Is this account on the login allowed list? */
export async function hasLoginAllowed(email: string): Promise<boolean> {
    const { rows } = await getPool().query(
        `SELECT 1 FROM login_allowed_users l JOIN users u ON u.id = l.user_id WHERE lower(u.email) = lower($1)`,
        [email],
    );
    return rows.length > 0;
}

/** `users.token_version`: the "sign everyone out" button adds 1 to it for every account. */
export async function getTokenVersion(email: string): Promise<number> {
    const { rows } = await getPool().query<{ v: number }>(`SELECT token_version AS v FROM users WHERE lower(email) = lower($1)`, [email]);
    if (!rows[0]) throw new Error(`no user found for ${email}`);
    return rows[0].v;
}

export async function isVerified(email: string): Promise<boolean> {
    const { rows } = await getPool().query<{ verified: boolean | null }>(`SELECT verified FROM users WHERE lower(email) = lower($1)`, [email]);
    return rows[0]?.verified === true;
}

/** Audit rows of one action with this exact reason (a spec uses a reason that carries its own run id). */
export async function getAuditByReason(
    action: string,
    reason: string,
): Promise<{ action: string; reason: string | null; metadata: Record<string, unknown> | null }[]> {
    const { rows } = await getPool().query(`SELECT action, reason, metadata FROM audit_log WHERE action = $1 AND reason = $2`, [action, reason]);
    return rows;
}
