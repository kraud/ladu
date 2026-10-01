const jwt = require('jsonwebtoken');
const { db } = require('../src/db');
const { users, userActivityDays } = require('../src/db/schema');

const { and, eq, isNull, lt, or }: typeof import('drizzle-orm') = require('drizzle-orm');
const { accountBlock }: typeof import('../lib/accountAccess') = require('../lib/accountAccess');
const asyncHandler = require('express-async-handler');

// Columns loaded onto `req.user` for every protected route. The bcrypt
// `password` hash is excluded — it would otherwise reach the client through
// `GET /me` (which returns `req.user` verbatim). Password-reset tokens live
// in their own `password_reset_tokens` table (2026-09-22), not a user column,
// so there is nothing reset-related to exclude here any more.
const userColumnsWithoutPassword = {
    id: users.id,
    name: users.name,
    email: users.email,
    username: users.username,
    languages: users.languages,
    uiLanguage: users.uiLanguage,
    theme: users.theme,
    nativeLanguage: users.nativeLanguage,
    verified: users.verified,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
    // Admin-dashboard slice 1: read here to enforce bans, deletes and forced
    // logouts, then stripped before `req.user` is set (`GET /me` returns it).
    bannedAt: users.bannedAt,
    deletedAt: users.deletedAt,
    tokenVersion: users.tokenVersion,
    lastSeenAt: users.lastSeenAt,
};

// `last_seen_at` is refreshed at most this often per user, so an active user
// costs one extra write per hour, not one per request. (A new UTC day also
// forces a refresh: see the threshold in `protect`.)
const LAST_SEEN_INTERVAL_MS = 60 * 60 * 1000;

const protect = asyncHandler(async (req: any, res: any, next: any) => {
    let token: string | undefined;

    // Require the same Bearer-token header shape the legacy middleware used.
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Split the header so only the raw JWT is passed to jsonwebtoken.
            const rawToken = req.headers.authorization.split(' ')[1];
            token = rawToken;

            // Verify the signature and recover the user id embedded at login.
            // algorithms is explicit (not inferred) so a forged token can't switch
            // to a different algorithm than the one generateToken() signs with.
            const decoded = jwt.verify(rawToken, process.env.JWT_SECRET as string, { algorithms: ['HS256'] }) as unknown as { id: string; tv?: number };

            // Load the current user from PostgreSQL so downstream handlers use fresh profile data.
            const [user] = await db
                .select(userColumnsWithoutPassword)
                .from(users)
                .where(eq(users.id, decoded.id))
                .limit(1);

            // Deleted, banned, or an old token version (forced logout): all 401,
            // so the client drops the session. Tokens issued before `tv`
            // existed count as version 0.
            if (!user || accountBlock(user) || (decoded.tv ?? 0) !== user.tokenVersion) {
                res.status(401);
                throw new Error('Not authorized');
            }

            const { bannedAt, deletedAt, tokenVersion, lastSeenAt, ...publicUser } = user;

            // Two jobs, both cheap and both at most once in a while per user:
            //  - `last_seen_at`: refreshed at most once an hour;
            //  - `user_activity_days`: one row at the first request of each UTC day
            //    (admin dashboard, slice 9 -- `last_seen_at` alone cannot say how many
            //    users were active on a past day).
            // The day can change inside the hour (23:40, then 00:10), so ONE threshold
            // serves both: the later of "an hour ago" and "the start of today (UTC)".
            const now = new Date();
            const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            const refreshBefore = new Date(Math.max(now.getTime() - LAST_SEEN_INTERVAL_MS, startOfToday.getTime()));

            let dayRecorded = true;
            if (!lastSeenAt || lastSeenAt < startOfToday) {
                try {
                    await db
                        .insert(userActivityDays)
                        .values({ userId: user.id, day: now.toISOString().slice(0, 10) })
                        .onConflictDoNothing();
                } catch (error: any) {
                    // Statistics must never log anyone out. `last_seen_at` is left alone
                    // below, so the next request tries again.
                    dayRecorded = false;
                    console.warn(`Could not record the active day: ${error?.message ?? error}`);
                }
            }

            // The WHERE re-checks the threshold, so two parallel requests cannot both write.
            if (dayRecorded && (!lastSeenAt || lastSeenAt < refreshBefore)) {
                await db
                    .update(users)
                    .set({ lastSeenAt: now })
                    .where(and(eq(users.id, user.id), or(isNull(users.lastSeenAt), lt(users.lastSeenAt, refreshBefore))));
            }

            // Postgres `id` only — the legacy `_id` alias is gone (.context/plans/new-repo-build-plan.md §4).
            req.user = publicUser;
            next();
        } catch (error) {
            console.log(error);
            res.status(401);
            throw new Error('Not authorized', { cause: error });
        }
    }

    // Preserve the existing missing-token error message for callers and tests.
    if (!token) {
        res.status(401);
        throw new Error('Not authorized (missing token)');
    }
});

module.exports = { protect };
