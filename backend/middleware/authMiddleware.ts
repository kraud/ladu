const jwt = require('jsonwebtoken');
const { db } = require('../src/db');
const { users } = require('../src/db/schema');

const { eq }: typeof import('drizzle-orm') = require('drizzle-orm');
const asyncHandler = require('express-async-handler');

// Columns loaded onto `req.user` for every protected route. Both the bcrypt
// `password` hash and the `passwordTokens` reset-token array are excluded — they
// would otherwise reach the client through `GET /me` (which returns `req.user`
// verbatim). No handler reads `req.user.passwordTokens`; the reset flow queries
// that column directly (Phase 1 Slice 5).
const userColumnsWithoutPassword = {
    id: users.id,
    name: users.name,
    email: users.email,
    username: users.username,
    languages: users.languages,
    uiLanguage: users.uiLanguage,
    nativeLanguage: users.nativeLanguage,
    verified: users.verified,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
};

const protect = asyncHandler(async (req: any, res: any, next: any) => {
    let token: string | undefined;

    // Require the same Bearer-token header shape the legacy middleware used.
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Split the header so only the raw JWT is passed to jsonwebtoken.
            const rawToken = req.headers.authorization.split(' ')[1];
            token = rawToken;

            // Verify the signature and recover the user id embedded at login.
            const decoded = jwt.verify(rawToken, process.env.JWT_SECRET as string) as unknown as { id: string };

            // Load the current user from PostgreSQL so downstream handlers use fresh profile data.
            const [user] = await db
                .select(userColumnsWithoutPassword)
                .from(users)
                .where(eq(users.id, decoded.id))
                .limit(1);

            if (!user) {
                res.status(401);
                throw new Error('Not authorized');
            }

            // Postgres `id` only — the legacy `_id` alias is gone (.context/plans/new-repo-build-plan.md §4).
            req.user = user;
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
