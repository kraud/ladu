const jwt = require('jsonwebtoken');
const { db } = require('../src/db');
const { users } = require('../src/db/schema');

const { eq }: typeof import('drizzle-orm') = require('drizzle-orm');
const asyncHandler = require('express-async-handler');

const userColumnsWithoutPassword = {
    id: users.id,
    name: users.name,
    email: users.email,
    username: users.username,
    languages: users.languages,
    uiLanguage: users.uiLanguage,
    nativeLanguage: users.nativeLanguage,
    verified: users.verified,
    passwordTokens: users.passwordTokens,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
};

const serializeAuthenticatedUser = (user: Omit<typeof users.$inferSelect, 'password'>) => ({
    ...user,
    _id: user.id,
});

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

            // Attach both id and _id to bridge legacy controller expectations during migration.
            req.user = serializeAuthenticatedUser(user);
            next();
        } catch (error) {
            console.log(error);
            res.status(401);
            throw new Error('Not authorized');
        }
    }

    // Preserve the existing missing-token error message for callers and tests.
    if (!token) {
        res.status(401);
        throw new Error('Not authorized (missing token)');
    }
});

module.exports = { protect };
